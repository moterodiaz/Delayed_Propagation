from fastapi.testclient import TestClient
from backend.main import app
client = TestClient(app)

def test_state_endpoint():
    r = client.get("/api/state")
    assert r.status_code == 200
    b = r.json()
    assert "events" in b and "network" in b
    assert any(e["id"]=="spacex-starship-f12" for e in b["events"])

def test_state_byte_identical():
    assert client.get("/api/state").text == client.get("/api/state").text

def test_chat_endpoint():
    r = client.post("/api/chat", json={"message":"What should I do about JBU1575?"})
    assert r.status_code == 200 and len(r.json()["reply"]) > 0
