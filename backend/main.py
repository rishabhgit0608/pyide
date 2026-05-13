import asyncio
import os
import pathlib
import re
import secrets
import tempfile
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pymongo import ReturnDocument

from database import get_db
from models import (
    CreateDocumentRequest,
    CreateSessionRequest,
    RunRequest,
    RunResponse,
    UpdateDocumentRequest,
)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


MAX_SESSIONS = 100
SESSION_TTL_SECONDS = 2 * 60 * 60  # 2 hours


@dataclass
class SessionState:
    session_id: str
    owner_email: str
    doc_id: str
    members: list = field(default_factory=list)
    connections: dict = field(default_factory=dict)
    code: str = ""
    stdin: str = ""
    started: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    kicked_members: list = field(default_factory=list)
    allowed_emails: set = field(default_factory=set)


sessions: dict[str, SessionState] = {}


async def _cleanup_old_sessions():
    while True:
        await asyncio.sleep(600)
        now = datetime.now(timezone.utc)
        stale = [
            sid for sid, s in list(sessions.items())
            if (now - s.created_at).total_seconds() > SESSION_TTL_SECONDS
        ]
        for sid in stale:
            sessions.pop(sid, None)


def _random_session_id() -> str:
    return secrets.token_urlsafe(8)


async def _broadcast(state: SessionState, msg: dict, exclude: str | None = None) -> None:
    dead = []
    for email, ws in list(state.connections.items()):
        if email == exclude:
            continue
        try:
            await ws.send_json(msg)
        except Exception:
            dead.append(email)
    for email in dead:
        state.connections.pop(email, None)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_db()
    await db.documents.create_index("email")
    task = asyncio.create_task(_cleanup_old_sessions())
    yield
    task.cancel()


app = FastAPI(title="PyIDE", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _serialize_doc(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "email": doc.get("email", ""),
        "title": doc.get("title", ""),
        "code": doc.get("code", ""),
        "stdin": doc.get("stdin", ""),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


@app.post("/run", response_model=RunResponse)
async def run_code(req: RunRequest):
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=".py", delete=False, mode="w", encoding="utf-8"
        ) as f:
            f.write(req.code)
            tmp_path = f.name

        proc = await asyncio.create_subprocess_exec(
            "python3", tmp_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(input=req.stdin.encode("utf-8")),
                timeout=10.0,
            )
            timed_out = False
            exit_code = proc.returncode
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            stdout_b = b""
            stderr_b = b"Process timed out after 10 seconds\n"
            timed_out = True
            exit_code = -1

        return RunResponse(
            stdout=stdout_b.decode("utf-8", errors="replace")[:100_000],
            stderr=stderr_b.decode("utf-8", errors="replace")[:100_000],
            exit_code=exit_code,
            timed_out=timed_out,
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/documents")
async def create_document(req: CreateDocumentRequest, db=Depends(get_db)):
    if not EMAIL_REGEX.match(req.email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "email": req.email,
        "title": req.title,
        "code": req.code,
        "stdin": req.stdin,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.documents.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_doc(doc)


@app.get("/documents/{email}")
async def list_documents(email: str, db=Depends(get_db)):
    cursor = db.documents.find({"email": email}).sort("updated_at", -1)
    docs = [_serialize_doc(d) async for d in cursor]
    return docs


@app.put("/documents/{doc_id}")
async def update_document(doc_id: str, req: UpdateDocumentRequest, db=Depends(get_db)):
    try:
        oid = ObjectId(doc_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document id")

    now = datetime.now(timezone.utc).isoformat()
    result = await db.documents.find_one_and_update(
        {"_id": oid},
        {"$set": {"title": req.title, "code": req.code, "stdin": req.stdin, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return _serialize_doc(result)


@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, db=Depends(get_db)):
    try:
        oid = ObjectId(doc_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document id")

    result = await db.documents.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": True}


@app.post("/sessions")
async def create_session(req: CreateSessionRequest, db=Depends(get_db)):
    try:
        oid = ObjectId(req.doc_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document id")

    doc = await db.documents.find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("email") != req.owner_email:
        raise HTTPException(status_code=403, detail="You do not own this document")

    if len(sessions) >= MAX_SESSIONS:
        raise HTTPException(status_code=503, detail="Too many active sessions, try again later")

    sid = _random_session_id()
    while sid in sessions:
        sid = _random_session_id()

    sessions[sid] = SessionState(
        session_id=sid,
        owner_email=req.owner_email,
        doc_id=req.doc_id,
        members=[req.owner_email],
        allowed_emails={req.owner_email},
        code=doc.get("code", ""),
        stdin=doc.get("stdin", ""),
    )
    return {"session_id": sid}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    state = sessions.get(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "owner_email": state.owner_email,
        "members": state.members,
        "started": state.started,
        "doc_id": state.doc_id,
    }


@app.websocket("/ws/{session_id}/{email}")
async def ws_session(websocket: WebSocket, session_id: str, email: str):
    state = sessions.get(session_id)
    if state is None:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "Session not found"})
        await websocket.close()
        return

    if email in state.kicked_members:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "You have been removed from this session"})
        await websocket.close()
        return

    if state.started and email not in state.allowed_emails:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "Session already in progress"})
        await websocket.close()
        return

    if email not in state.members and len(state.members) >= 5:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "Session full"})
        await websocket.close()
        return

    await websocket.accept()
    if email not in state.members:
        state.members.append(email)
    state.allowed_emails.add(email)
    state.connections[email] = websocket

    await _broadcast(state, {"type": "lobby_update", "members": list(state.members)})

    if state.started:
        await websocket.send_json({
            "type": "session_started",
            "code": state.code,
            "stdin": state.stdin,
        })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "start_session":
                if email == state.owner_email:
                    state.started = True
                    await _broadcast(state, {
                        "type": "session_started",
                        "code": state.code,
                        "stdin": state.stdin,
                    })

            elif msg_type == "code_change":
                state.code = data.get("code", "")
                await _broadcast(state, {
                    "type": "code_change",
                    "code": state.code,
                    "email": email,
                })

            elif msg_type == "stdin_change":
                state.stdin = data.get("stdin", "")
                await _broadcast(state, {
                    "type": "stdin_change",
                    "stdin": state.stdin,
                    "email": email,
                })

            elif msg_type == "run_result":
                await _broadcast(state, {
                    "type": "run_result",
                    "stdout": data.get("stdout", ""),
                    "stderr": data.get("stderr", ""),
                    "exit_code": data.get("exit_code", 0),
                    "timed_out": data.get("timed_out", False),
                    "triggered_by": email,
                })

            elif msg_type == "cursor":
                await _broadcast(state, {
                    "type": "cursor",
                    "line": data.get("line"),
                    "col": data.get("col"),
                    "email": email,
                }, exclude=email)

            elif msg_type == "kick_member":
                if email == state.owner_email:
                    target = data.get("email")
                    if target and target in state.members and target != state.owner_email:
                        state.kicked_members.append(target)
                        state.allowed_emails.discard(target)
                        if target in state.connections:
                            try:
                                await state.connections[target].send_json({"type": "kicked"})
                                await state.connections[target].close()
                            except Exception:
                                pass
                            state.connections.pop(target, None)
                        state.members = [m for m in state.members if m != target]
                        await _broadcast(state, {"type": "lobby_update", "members": list(state.members)})

    except WebSocketDisconnect:
        state.connections.pop(email, None)
        state.members = [m for m in state.members if m != email]
        if email == state.owner_email:
            await _broadcast(state, {"type": "session_ended"})
            sessions.pop(state.session_id, None)
        elif not state.started:
            await _broadcast(state, {"type": "lobby_update", "members": list(state.members)})
        else:
            await _broadcast(state, {"type": "member_disconnected", "email": email})
            if len(state.members) <= 1:
                await _broadcast(state, {"type": "session_ended"})
                sessions.pop(state.session_id, None)


_frontend = pathlib.Path(__file__).parent.parent / "frontend"
if _frontend.exists():
    app.mount("/", StaticFiles(directory=_frontend, html=True), name="frontend")
