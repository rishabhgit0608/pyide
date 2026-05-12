# PyIDE — Python Online IDE

A lightweight, self-hosted Python code editor with cloud document saving via MongoDB.
No accounts, no authentication — your email is your identity.

## Prerequisites

- Python 3.11+
- MongoDB running locally (or Atlas URI)

## Setup

1. Install backend dependencies:
   ```bash
   cd python-ide/backend
   pip install -r requirements.txt
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env if using Atlas: set MONGO_URI=mongodb+srv://...
   ```

## Running

1. Start MongoDB (if local):
   ```bash
   mongod --dbpath /your/data/path
   ```

2. Start the backend:
   ```bash
   cd python-ide/backend
   uvicorn main:app --reload --port 8000
   ```

3. Open the frontend:
   - Open `python-ide/frontend/index.html` directly in your browser, **or**
   - Serve it: `python3 -m http.server 3000 --directory frontend/` then visit `http://localhost:3000`

## How It Works

- **Email as identity:** Type your email in the top bar. All documents are scoped to that email. No password, no verification — intended for personal/local use.
- **Run:** Executes Python 3 on the server using `asyncio.create_subprocess_exec`. Stdin is passed directly. Timeout: 10 seconds. Max output: 100KB.
- **Save:** Creates a new document (first save) or updates the existing one. Title can be set in the title bar or prompted on first save.
- **Documents:** Stored in MongoDB collection `documents`. Indexed by email.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `Cmd+Enter` | Run code |
| `Ctrl+S` / `Cmd+S` | Save document |
| `Tab` | Indent (4 spaces) |

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/run` | Execute code |
| POST | `/documents` | Create document |
| GET | `/documents/{email}` | List documents by email |
| PUT | `/documents/{doc_id}` | Update document |
| DELETE | `/documents/{doc_id}` | Delete document |

## Running Tests

```bash
cd python-ide/backend
python3 -m pytest tests/ -v
```

> Tests for document CRUD require MongoDB to be running.
