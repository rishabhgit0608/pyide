# PyIDE — Collaborative Python IDE in the Browser

Collaborate on Python code in real-time — no accounts, no setup. Enter your email, share a session link, and start coding together instantly.

**Live demo:**  https://pyide-9c0o.onrender.com/

---

## What It Does

- **Real-time collaboration** — multiple users edit the same file simultaneously, with live cursors and presence indicators
- **Run Python in the browser** — executes on the server, streams stdout/stderr back instantly
- **Zero-friction identity** — your email is your identity. No passwords, no OAuth, no verification
- **Persistent documents** — files are saved to MongoDB and scoped to your email, accessible from any device
- **Session management** — create a session, invite collaborators via link, kick members if needed

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Editor | CodeMirror 6 |
| Frontend | Vanilla JS, HTML/CSS |
| Backend | FastAPI (Python) |
| Realtime | WebSockets |
| Database | MongoDB (local or Atlas) |
| Deployment | Render |

## Architecture

```
Browser (CodeMirror 6)
    │
    ├── HTTP  →  FastAPI  →  MongoDB    (documents, CRUD)
    │
    └── WS    →  FastAPI  →  SessionState (in-memory, real-time collab)
                   │
                   └── broadcasts cursor positions + code changes to all peers
```

- Sessions are ephemeral (in-memory). Documents are persistent (MongoDB).
- Code execution uses `asyncio.create_subprocess_exec` with a 10s timeout and 100KB output cap.
- Session cleanup runs on a background task; idle sessions are purged automatically.

## Local Setup

**Prerequisites:** Python 3.11+, MongoDB

```bash
# 1. Clone and install
git clone https://github.com/rishabhgit0608/pyide
cd pyide/backend
pip install -r requirements.txt

# 2. Configure
cp .env.example .env
# For MongoDB Atlas: set MONGO_URI=mongodb+srv://...

# 3. Start MongoDB (if local)
mongod --dbpath /your/data/path

# 4. Run
uvicorn main:app --reload --port 8000
# App served at http://localhost:8000
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `Cmd+Enter` | Run code |
| `Ctrl+S` / `Cmd+S` | Save document |
| `Tab` | Indent (4 spaces) |

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/run` | Execute Python code |
| `POST` | `/sessions` | Create a collaboration session |
| `GET` | `/sessions/{id}` | Get session state |
| `WS` | `/ws/{session_id}/{email}` | Join session via WebSocket |
| `POST` | `/documents` | Create document |
| `GET` | `/documents/{email}` | List documents for email |
| `PUT` | `/documents/{doc_id}` | Update document |
| `DELETE` | `/documents/{doc_id}` | Delete document |

## Running Tests

```bash
cd backend
python3 -m pytest tests/ -v
```

> Integration tests require a running MongoDB instance.
