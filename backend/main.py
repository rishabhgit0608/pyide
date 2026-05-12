import asyncio
import os
import pathlib
import re
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pymongo import ReturnDocument

from database import get_db
from models import (
    CreateDocumentRequest,
    RunRequest,
    RunResponse,
    UpdateDocumentRequest,
)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_db()
    await db.documents.create_index("email")
    yield


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


_frontend = pathlib.Path(__file__).parent.parent / "frontend"
if _frontend.exists():
    app.mount("/", StaticFiles(directory=_frontend, html=True), name="frontend")
