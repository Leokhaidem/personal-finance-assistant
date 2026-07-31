import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_login_demo_user():
    response = client.post("/auth/login", data={"username": "user@example.com", "password": "password123"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_login_invalid_password():
    response = client.post("/auth/login", data={"username": "user@example.com", "password": "wrongpassword"})
    assert response.status_code == 400
