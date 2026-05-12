import pytest
from httpx import AsyncClient, ASGITransport


@pytest.fixture
async def client():
    from main import app
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.mark.asyncio
async def test_run_hello_world(client):
    resp = await client.post("/run", json={"code": "print('hello')", "stdin": ""})
    assert resp.status_code == 200
    data = resp.json()
    assert data["stdout"] == "hello\n"
    assert data["stderr"] == ""
    assert data["exit_code"] == 0
    assert data["timed_out"] is False


@pytest.mark.asyncio
async def test_run_with_stdin(client):
    resp = await client.post("/run", json={
        "code": "name = input()\nprint(f'Hello, {name}!')",
        "stdin": "World"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["stdout"] == "Hello, World!\n"
    assert data["exit_code"] == 0


@pytest.mark.asyncio
async def test_run_syntax_error(client):
    resp = await client.post("/run", json={
        "code": "def foo(:\n    pass",
        "stdin": ""
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["exit_code"] != 0
    assert "SyntaxError" in data["stderr"]


@pytest.mark.asyncio
async def test_run_runtime_error(client):
    resp = await client.post("/run", json={
        "code": "raise ValueError('boom')",
        "stdin": ""
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["exit_code"] != 0
    assert "ValueError" in data["stderr"]


@pytest.mark.asyncio
async def test_run_timeout(client):
    resp = await client.post("/run", json={
        "code": "while True: pass",
        "stdin": ""
    }, timeout=15.0)
    assert resp.status_code == 200
    data = resp.json()
    assert data["timed_out"] is True
