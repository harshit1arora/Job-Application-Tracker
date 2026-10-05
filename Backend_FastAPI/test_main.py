import os
os.environ["DEMO_MODE"] = "true"
os.environ["DATA_DIR"] = "./data"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app, Base, get_db
from auth import get_current_user_id

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert isinstance(body["firebaseAdminInitialized"], bool)
    assert "firebaseProjectId" in body

def test_production_frontend_cors_preflight():
    response = client.options(
        "/api/applications",
        headers={
            "Origin": "https://job-application-tracker-pearl-nine.vercel.app",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,x-user-id",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://job-application-tracker-pearl-nine.vercel.app"

def test_create_and_get_application():
    headers = {"X-User-Id": "test-user-123"}
    app_data = {
        "company": "Test Corp",
        "jobTitle": "Engineer",
        "applicationSource": "LinkedIn",
        "status": "Applied"
    }
    
    # Create
    response = client.post("/api/applications", json=app_data, headers=headers)
    assert response.status_code == 201
    created_app = response.json()
    assert created_app["company"] == "Test Corp"
    app_id = created_app["id"]
    
    # Get
    response = client.get(f"/api/applications/{app_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == app_id

def test_cross_user_isolation():
    # User 1 creates app
    headers1 = {"X-User-Id": "user1"}
    response = client.post("/api/applications", json={
        "company": "Corp 1", "jobTitle": "Dev", "applicationSource": "Direct", "status": "Saved"
    }, headers=headers1)
    app_id = response.json()["id"]
    
    # User 2 tries to access User 1's app
    headers2 = {"X-User-Id": "user2"}
    response = client.get(f"/api/applications/{app_id}", headers=headers2)
    assert response.status_code == 404

def test_dashboard_stats():
    headers = {"X-User-Id": "stats-user"}
    # Create 2 applications
    client.post("/api/applications", json={
        "company": "Stats 1", "jobTitle": "Dev", "applicationSource": "Direct", "status": "Applied"
    }, headers=headers)
    client.post("/api/applications", json={
        "company": "Stats 2", "jobTitle": "Dev", "applicationSource": "Direct", "status": "Interview"
    }, headers=headers)
    
    response = client.get("/api/dashboard/stats", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["totalApplications"] == 2
    assert data["byStatus"]["applied"] == 1
    assert data["byStatus"]["interview"] == 1

def test_upload_and_download_document():
    headers = {"X-User-Id": "doc-user"}
    
    # Create application first
    app_res = client.post("/api/applications", json={
        "company": "Corp", "jobTitle": "Dev", "applicationSource": "Direct", "status": "Saved"
    }, headers=headers)
    app_id = app_res.json()["id"]
    
    response = client.post(
        "/api/documents/upload",
        headers=headers,
        data={"applicationId": app_id, "displayName": "My Resume"},
        files={"file": ("resume.pdf", b"%PDF-1.7\nresume content", "application/pdf")},
    )
    
    assert response.status_code == 201
    doc_id = response.json()["id"]
    
    # Download doc
    dl_response = client.get(f"/api/documents/{doc_id}/download", headers=headers)
    assert dl_response.status_code == 200
    assert dl_response.content == b"%PDF-1.7\nresume content"

    delete_response = client.delete(f"/api/documents/{doc_id}", headers=headers)
    assert delete_response.status_code == 204


def test_upload_rejects_mime_type_spoofing():
    response = client.post(
        "/api/documents/upload",
        headers={"X-User-Id": "doc-user"},
        files={"file": ("not-a-pdf.pdf", b"plain text", "application/pdf")},
    )

    assert response.status_code == 422
    assert "does not match" in response.json()["detail"]


def test_upload_rejects_unsupported_text_file():
    response = client.post(
        "/api/documents/upload",
        headers={"X-User-Id": "doc-user"},
        files={"file": ("resume.txt", b"resume text", "text/plain")},
    )

    assert response.status_code == 422


def test_upload_rejects_oversized_file():
    response = client.post(
        "/api/documents/upload",
        headers={"X-User-Id": "doc-user"},
        files={"file": ("large.pdf", b"%PDF-1.7" + b"x" * (5 * 1024 * 1024), "application/pdf")},
    )

    assert response.status_code == 413

def test_production_auth_rejection():
    # Force DEMO_MODE off to test production behavior
    import auth
    auth.DEVELOPMENT_MODE = False
    
    headers = {"X-User-Id": "doc-user"}
    response = client.get("/api/applications", headers=headers)
    
    # Reset it so other tests don't break if they run after
    auth.DEVELOPMENT_MODE = True
    
    assert response.status_code == 401
    assert "Authentication required" in response.text or "Invalid or expired" in response.text

def test_ai_proxy_requires_authentication():
    import auth

    original_mode = auth.DEVELOPMENT_MODE
    auth.DEVELOPMENT_MODE = False
    try:
        response = client.post(
            "/api/ai/chat/completions",
            headers={"X-User-Id": "unauthenticated-user"},
            json={"model": "google/gemma-4-26b-a4b-it:free", "messages": []},
        )
    finally:
        auth.DEVELOPMENT_MODE = original_mode

    assert response.status_code == 401

def test_ai_proxy_rejects_unapproved_model():
    response = client.post(
        "/api/ai/chat/completions",
        headers={"X-User-Id": "demo-user"},
        json={"model": "untrusted/model", "messages": []},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "AI model is not allowed"

def test_ai_proxy_reports_missing_provider_configuration(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    response = client.post(
        "/api/ai/chat/completions",
        headers={"X-User-Id": "demo-user"},
        json={"model": "gemini-2.5-flash", "messages": []},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "AI service is not configured"
