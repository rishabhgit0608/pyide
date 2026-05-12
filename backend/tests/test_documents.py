import os
os.environ["DB_NAME"] = "pyide_test"  # must be set before importing app

import pytest
from httpx import AsyncClient, ASGITransport
from database import get_db


@pytest.fixture(autouse=True)
async def clean_db():
    db = get_db()
    await db.documents.drop()
    yield
    await db.documents.drop()


@pytest.fixture
async def client():
    from main import app
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.mark.asyncio
async def test_create_document(client):
    resp = await client.post("/documents", json={
        "email": "test@example.com",
        "title": "My Script",
        "code": "print('hi')",
        "stdin": "",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"]
    assert data["email"] == "test@example.com"
    assert data["title"] == "My Script"
    assert data["code"] == "print('hi')"


@pytest.mark.asyncio
async def test_create_document_invalid_email(client):
    resp = await client.post("/documents", json={
        "email": "not-an-email",
        "title": "Bad",
        "code": "x=1",
        "stdin": "",
    })
    assert resp.status_code == 400
    assert "email" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_documents(client):
    for title in ["Doc A", "Doc B"]:
        await client.post("/documents", json={
            "email": "user@example.com",
            "title": title,
            "code": "pass",
            "stdin": "",
        })
    resp = await client.get("/documents/user@example.com")
    assert resp.status_code == 200
    docs = resp.json()
    assert len(docs) == 2
    titles = [d["title"] for d in docs]
    assert "Doc A" in titles
    assert "Doc B" in titles


@pytest.mark.asyncio
async def test_list_documents_empty(client):
    resp = await client.get("/documents/nobody@example.com")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_update_document(client):
    create_resp = await client.post("/documents", json={
        "email": "user@example.com",
        "title": "Original",
        "code": "x = 1",
        "stdin": "",
    })
    doc_id = create_resp.json()["id"]

    update_resp = await client.put(f"/documents/{doc_id}", json={
        "title": "Updated",
        "code": "x = 99",
        "stdin": "hello",
    })
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["title"] == "Updated"
    assert updated["code"] == "x = 99"
    assert updated["stdin"] == "hello"


@pytest.mark.asyncio
async def test_delete_document(client):
    create_resp = await client.post("/documents", json={
        "email": "user@example.com",
        "title": "ToDelete",
        "code": "pass",
        "stdin": "",
    })
    doc_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/documents/{doc_id}")
    assert del_resp.status_code == 200
    assert del_resp.json() == {"deleted": True}

    list_resp = await client.get("/documents/user@example.com")
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_update_nonexistent_document(client):
    fake_id = "000000000000000000000000"
    resp = await client.put(f"/documents/{fake_id}", json={
        "title": "X", "code": "pass", "stdin": ""
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_document(client):
    fake_id = "000000000000000000000000"
    resp = await client.delete(f"/documents/{fake_id}")
    assert resp.status_code == 404
