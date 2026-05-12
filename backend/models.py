from pydantic import BaseModel


class RunRequest(BaseModel):
    code: str
    stdin: str = ""


class RunResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool


class CreateDocumentRequest(BaseModel):
    email: str
    title: str
    code: str
    stdin: str = ""


class UpdateDocumentRequest(BaseModel):
    title: str
    code: str
    stdin: str = ""


class CreateSessionRequest(BaseModel):
    owner_email: str
    doc_id: str
