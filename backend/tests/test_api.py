from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_is_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_personas_returns_a_list():
    response = client.get("/api/personas")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
