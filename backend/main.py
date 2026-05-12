import asyncio
import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import get_db
from models import (
    CreateDocumentRequest,
    RunRequest,
    RunResponse,
    UpdateDocumentRequest,
)


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
