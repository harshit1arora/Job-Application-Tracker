import os
os.environ["DEMO_MODE"] = "true"
from tempfile import TemporaryDirectory

_test_data = TemporaryDirectory()
os.environ["DATA_DIR"] = _test_data.name
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app, Base, get_db
from auth import get_current_user_id

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
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
    assert body["firebaseProjectId"] == "jobpilot-ai-tracker"

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


# ---------------------------------------------------------
# Offers + negotiation coach
# ---------------------------------------------------------

def _offer_payload(**overrides):
    payload = {
        "company": "Acme",
        "jobTitle": "Backend Engineer",
        "currency": "USD",
        "baseSalary": 100000,
        "annualBonus": 10000,
        "equityValue": 80000,
        "equityVestYears": 4,
        "retirementMatchPct": 5,
        "otherBenefitsValue": 2000,
    }
    payload.update(overrides)
    return payload


def test_offer_crud_and_computed_total_comp():
    headers = {"X-User-Id": "offer-user"}
    created = client.post("/api/offers", json=_offer_payload(deadline="2026-12-01"), headers=headers)
    assert created.status_code == 201
    offer = created.json()
    assert offer["status"] == "Pending"
    assert offer["annualTotalComp"] == 137000  # 100k + 10k + 20k equity + 5k match + 2k benefits

    listed = client.get("/api/offers", headers=headers).json()
    assert [o["id"] for o in listed] == [offer["id"]]

    patched = client.patch(
        f"/api/offers/{offer['id']}",
        json={"baseSalary": 120000, "status": "Negotiating", "negotiationPlan": '{"strategy":"x"}'},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["baseSalary"] == 120000
    assert patched.json()["status"] == "Negotiating"
    assert patched.json()["negotiationPlan"] == '{"strategy":"x"}'

    assert client.delete(f"/api/offers/{offer['id']}", headers=headers).status_code == 204
    assert client.get(f"/api/offers/{offer['id']}", headers=headers).status_code == 404


def test_offer_validation_rejects_bad_input():
    headers = {"X-User-Id": "offer-user"}
    assert client.post("/api/offers", json=_offer_payload(baseSalary=-1), headers=headers).status_code == 422
    assert client.post("/api/offers", json=_offer_payload(currency="dollars"), headers=headers).status_code == 422
    assert client.post("/api/offers", json=_offer_payload(growthRating=9), headers=headers).status_code == 422
    assert client.post("/api/offers", json=_offer_payload(deadline="next friday"), headers=headers).status_code == 422
    assert client.post("/api/offers", json=_offer_payload(status="Maybe"), headers=headers).status_code == 422


def test_offer_cross_user_isolation():
    owner = {"X-User-Id": "offer-owner"}
    other = {"X-User-Id": "offer-other"}
    offer_id = client.post("/api/offers", json=_offer_payload(), headers=owner).json()["id"]

    assert client.get(f"/api/offers/{offer_id}", headers=other).status_code == 404
    assert client.patch(f"/api/offers/{offer_id}", json={"baseSalary": 1}, headers=other).status_code == 404
    assert client.delete(f"/api/offers/{offer_id}", headers=other).status_code == 404
    assert client.get("/api/offers", headers=other).json() == []


def test_offer_application_link_is_owned_and_detached_on_delete():
    owner = {"X-User-Id": "offer-link-owner"}
    other = {"X-User-Id": "offer-link-other"}
    app_id = client.post("/api/applications", json={
        "company": "Linked", "jobTitle": "Dev", "applicationSource": "Other", "status": "Offer"
    }, headers=owner).json()["id"]

    # another user cannot attach an offer to someone else's application
    assert client.post("/api/offers", json=_offer_payload(applicationId=app_id), headers=other).status_code == 404

    offer = client.post("/api/offers", json=_offer_payload(applicationId=app_id), headers=owner).json()
    assert offer["applicationId"] == app_id

    # deleting the application keeps the offer but clears the link
    assert client.delete(f"/api/applications/{app_id}", headers=owner).status_code == 204
    kept = client.get(f"/api/offers/{offer['id']}", headers=owner)
    assert kept.status_code == 200
    assert kept.json()["applicationId"] is None


def test_negotiate_requires_ai_configuration(monkeypatch):
    from main import gemini_service

    monkeypatch.setattr(gemini_service, "is_configured", lambda: False)
    response = client.post(
        "/api/ai/negotiate",
        headers={"X-User-Id": "nego-user"},
        json={"company": "Acme", "jobTitle": "Dev", "baseSalary": 100000},
    )
    assert response.status_code == 503


def test_negotiate_validates_request(monkeypatch):
    from main import gemini_service

    monkeypatch.setattr(gemini_service, "is_configured", lambda: True)
    headers = {"X-User-Id": "nego-user"}
    assert client.post("/api/ai/negotiate", headers=headers, json={"company": "A", "jobTitle": "B", "baseSalary": 0}).status_code == 422
    too_many = [{"company": f"C{i}", "baseSalary": 1, "totalComp": 1} for i in range(5)]
    assert client.post(
        "/api/ai/negotiate", headers=headers,
        json={"company": "A", "jobTitle": "B", "baseSalary": 10, "competingOffers": too_many},
    ).status_code == 422


def test_negotiate_returns_plan_from_service(monkeypatch):
    from main import gemini_service

    captured = {}

    async def fake_plan(ctx):
        captured.update(ctx)
        return {"strategy": "ok", "counter": {"target": 110000}, "talkingPoints": [], "email": {"subject": "s", "body": "b"},
                "phoneScript": "", "pushbackResponses": [], "risks": []}

    monkeypatch.setattr(gemini_service, "is_configured", lambda: True)
    monkeypatch.setattr(gemini_service, "generate_negotiation_plan", fake_plan)
    response = client.post(
        "/api/ai/negotiate",
        headers={"X-User-Id": "nego-user"},
        json={"company": "Acme", "jobTitle": "Dev", "baseSalary": 100000, "tone": "aggressive-nonsense",
              "priorities": ["base", "  ", "equity"]},
    )
    assert response.status_code == 200
    assert response.json()["strategy"] == "ok"
    assert captured["tone"] == "collaborative"  # unknown tones fall back safely
    assert captured["priorities"] == ["base", "equity"]


# ---------------------------------------------------------
# Smart follow-ups
# ---------------------------------------------------------

def test_followup_settings_defaults_then_upsert():
    headers = {"X-User-Id": "fu-settings-user"}
    defaults = client.get("/api/followups/settings", headers=headers).json()
    assert defaults["enabled"] is True
    assert defaults["appliedDays"] == 7
    assert defaults["maxFollowUps"] == 3

    saved = client.put(
        "/api/followups/settings",
        json={"enabled": True, "appliedDays": 5, "underReviewDays": 8, "interviewDays": 2,
              "maxFollowUps": 4, "autoCreateReminders": False, "defaultTone": "friendly"},
        headers=headers,
    )
    assert saved.status_code == 200
    assert saved.json()["appliedDays"] == 5
    assert client.get("/api/followups/settings", headers=headers).json()["defaultTone"] == "friendly"

    # a second PUT updates the same row instead of creating a duplicate
    client.put("/api/followups/settings", json={"appliedDays": 9}, headers=headers)
    assert client.get("/api/followups/settings", headers=headers).json()["appliedDays"] == 9

    # other users are unaffected
    assert client.get("/api/followups/settings", headers={"X-User-Id": "fu-settings-other"}).json()["appliedDays"] == 7


def test_followup_settings_validation():
    headers = {"X-User-Id": "fu-settings-user"}
    assert client.put("/api/followups/settings", json={"appliedDays": 0}, headers=headers).status_code == 422
    assert client.put("/api/followups/settings", json={"maxFollowUps": 99}, headers=headers).status_code == 422
    assert client.put("/api/followups/settings", json={"defaultTone": "rude"}, headers=headers).status_code == 422


def test_followup_log_lifecycle_and_isolation():
    owner = {"X-User-Id": "fu-log-owner"}
    other = {"X-User-Id": "fu-log-other"}
    app_row = client.post("/api/applications", json={
        "company": "LogCo", "jobTitle": "Dev", "applicationSource": "Other", "status": "Applied"
    }, headers=owner).json()

    assert client.post("/api/followups/logs", json={"applicationId": app_row["id"]}, headers=other).status_code == 404

    created = client.post(
        "/api/followups/logs",
        json={"applicationId": app_row["id"], "channel": "email", "tone": "polite", "subject": "Hi", "body": "Checking in"},
        headers=owner,
    )
    assert created.status_code == 201
    log = created.json()

    # logging a follow-up restarts the application's quiet-clock
    refreshed = client.get(f"/api/applications/{app_row['id']}", headers=owner).json()
    assert refreshed["updatedAt"] >= app_row["updatedAt"]
    assert refreshed["updatedAt"] == log["createdAt"]

    assert [l["id"] for l in client.get("/api/followups/logs", headers=owner).json()] == [log["id"]]
    assert client.get("/api/followups/logs", headers=other).json() == []
    assert client.delete(f"/api/followups/logs/{log['id']}", headers=other).status_code == 404
    assert client.delete(f"/api/followups/logs/{log['id']}", headers=owner).status_code == 204


def test_followup_logs_are_removed_with_application():
    owner = {"X-User-Id": "fu-cascade-owner"}
    app_id = client.post("/api/applications", json={
        "company": "CascadeCo", "jobTitle": "Dev", "applicationSource": "Other", "status": "Applied"
    }, headers=owner).json()["id"]
    client.post("/api/followups/logs", json={"applicationId": app_id}, headers=owner)
    assert len(client.get("/api/followups/logs", headers=owner).json()) == 1

    assert client.delete(f"/api/applications/{app_id}", headers=owner).status_code == 204
    assert client.get("/api/followups/logs", headers=owner).json() == []


def test_followup_email_requires_ai_configuration(monkeypatch):
    from main import gemini_service

    monkeypatch.setattr(gemini_service, "is_configured", lambda: False)
    response = client.post(
        "/api/ai/followup-email",
        headers={"X-User-Id": "fu-ai-user"},
        json={"company": "Acme", "jobTitle": "Dev"},
    )
    assert response.status_code == 503


def test_followup_email_returns_draft_from_service(monkeypatch):
    from main import gemini_service

    captured = {}

    async def fake_email(ctx):
        captured.update(ctx)
        return {"subject": "Checking in", "body": "Hello"}

    monkeypatch.setattr(gemini_service, "is_configured", lambda: True)
    monkeypatch.setattr(gemini_service, "generate_followup_email", fake_email)
    response = client.post(
        "/api/ai/followup-email",
        headers={"X-User-Id": "fu-ai-user"},
        json={"company": "Acme", "jobTitle": "Dev", "tone": "shouty", "channel": "carrier-pigeon", "followUpNumber": 2},
    )
    assert response.status_code == 200
    assert response.json() == {"subject": "Checking in", "body": "Hello"}
    assert captured["tone"] == "polite"
    assert captured["channel"] == "email"
    assert captured["followUpNumber"] == 2

@pytest.fixture
def employer(monkeypatch):
    import httpx
    from services import greenhouse
    calls = []
    questions = [{"label": key, "required": True, "fields": [{"type": "input_text", "name": key}]}
                 for key in ("first_name", "last_name", "email")]
    questions.append({"label": "Resume", "required": True, "fields": [{"type": "input_file", "name": "resume"}]})
    job = {"id": 7, "title": "Engineer", "absolute_url": "https://example.org/jobs/7", "questions": questions}

    async def read(token, path, **params):
        return {"jobs": [job]} if path == "/jobs" else job

    async def deliver(*args):
        calls.append(args)
        return httpx.Response(200, json={"success": True})

    monkeypatch.setattr(greenhouse, "board", lambda: "test-board")
    monkeypatch.setattr(greenhouse, "read", read)
    monkeypatch.setattr(greenhouse, "deliver", deliver)
    return job, calls


def reviewed_payload(headers):
    path = "/api/agent/test-board/jobs/7"
    form = client.get(path, headers=headers).json()
    doc = client.post("/api/documents/upload", headers=headers,
                      files={"file": ("resume.pdf", b"%PDF-test", "application/pdf")}).json()
    return path, {"approved": True, "version": form["version"], "board": "test-board", "resumeId": doc["id"],
                  "answers": {"first_name": "Test", "last_name": "Applicant", "email": "candidate@example.org"}}


def test_reviewed_submission(employer):
    _, calls = employer
    headers = {"X-User-Id": "candidate"}
    path, payload = reviewed_payload(headers)
    assert not calls
    for changed in ({"approved": False}, {"version": "stale"}, {"answers": {}}):
        assert client.post(path+"/submit", headers=headers, json=payload | changed).status_code in (409, 422)
    assert client.post(path+"/submit", headers={"X-User-Id": "other"}, json=payload).status_code == 422
    assert not calls
    for _ in range(2):
        assert client.post(path+"/submit", headers=headers, json=payload).json()["status"] == "confirmed"
    assert len(calls) == 1
    assert calls[0][2:] == (payload["answers"], ("resume.pdf", b"%PDF-test", "application/pdf"))
    apps = client.get("/api/applications", headers=headers).json()
    assert len(apps) == 1 and apps[0]["status"] == "Applied"
    assert client.get(path, headers=headers).json()["applicationId"] == apps[0]["id"]


def test_pending_and_rejected(employer, monkeypatch):
    import httpx
    from services import greenhouse
    headers = {"X-User-Id": "candidate"}
    path, payload = reviewed_payload(headers)
    results = [httpx.Response(422), httpx.ReadTimeout("lost response")]

    async def deliver(*args):
        result = results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(greenhouse, "deliver", deliver)
    for expected in ("rejected", "pending", "pending"):
        assert client.post(path+"/submit", headers=headers, json=payload).json()["status"] == expected
    assert client.get("/api/applications", headers=headers).json() == []


def test_agent_declines_unrepresented_consent(employer):
    job, _ = employer
    job["data_compliance"] = [{"requires_consent": True}]
    result = client.get("/api/agent/test-board/jobs/7", headers={"X-User-Id": "candidate"})
    assert result.json()["status"] == "unsupported"

def test_receipt_survives_source_deletion_and_tracker_edits(employer):
    headers = {"X-User-Id": "candidate"}
    path, payload = reviewed_payload(headers)
    submitted = client.post(path+"/submit", headers=headers, json=payload).json()
    app_path = "/api/applications/" + submitted["applicationId"]
    client.delete("/api/documents/" + payload["resumeId"], headers=headers).raise_for_status()
    client.patch(app_path, headers=headers, json={"company": "Edited"}).raise_for_status()
    receipt = client.get(app_path+"/receipt", headers=headers).json()
    assert receipt["company"] == "test-board" and receipt["submittedAt"] <= receipt["confirmedAt"]
    assert receipt["destination"] == employer[0]["absolute_url"]
    assert client.get(app_path+"/receipt/resume", headers=headers).content == b"%PDF-test"
    other = {"X-User-Id": "other"}
    assert client.get(app_path+"/receipt", headers=other).json() is None
    assert client.get(app_path+"/receipt/resume", headers=other).status_code == 404
    client.delete(app_path, headers=headers).raise_for_status()
    assert client.get(app_path+"/receipt/resume", headers=headers).status_code == 404

def test_job_import_confirmation_and_isolation(monkeypatch):
    from services import job_import
    headers = {"X-User-Id": "reader"}
    source = '<script type="application/ld+json">{"@graph":[{"@type":"JobPosting","title":"Developer","hiringOrganization":{"name":"Example"},"validThrough":"2028-02-01","description":"Build things"}]}</script>'
    monkeypatch.setattr(job_import, "read_page", lambda url: source)
    url = "https://careers.example.org/job/2"
    preview = client.post("/api/job-imports/preview", json={"url":url}, headers=headers).json()
    assert preview["role"] == "Developer" and preview["deadline"] == "2028-02-01"
    assert client.get("/api/job-imports", headers=headers).json() == []
    data = {**preview, "url":url, "company":"Confirmed employer"}
    for _ in range(2):
        saved = client.post("/api/job-imports", json=data, headers=headers).json()
    assert len(client.get("/api/job-imports", headers=headers).json()) == 1
    other = {"X-User-Id":"other"}
    assert client.get("/api/job-imports", headers=other).json() == []
    assert client.get("/api/job-imports/"+saved["id"]+"/methods", headers=other).status_code == 404


def test_listing_reader_and_methods():
    from services import job_import
    for value in ("file:///jobs", "https://127.0.0.1/jobs", "https://user:pass@example.org/jobs"):
        with pytest.raises(ValueError):
            job_import.listing_url(value)
    assert not job_import.same_listing("https://example.org/jobs?id=7", "https://example.org/jobs?id=8")
    assert job_import.same_listing("https://example.org/7?utm_source=portal", "https://example.org/7")
    assert job_import.application_email("Email your resume to jobs@example.org") == "jobs@example.org"
    assert job_import.application_email("Email support@example.org for questions.") is None

@pytest.fixture
def gmail_review(monkeypatch):
    from cryptography.fernet import Fernet
    from main import GmailAccount
    from services import gmail
    monkeypatch.setattr(gmail, "client_id", lambda: "fixture")
    monkeypatch.setenv("GMAIL_TOKEN_KEY", Fernet.generate_key().decode())
    async def tokens(**kwargs):
        return {"access_token":"fixture"}
    monkeypatch.setattr(gmail, "tokens", tokens)
    headers = {"X-User-Id":"applicant"}
    with TestingSessionLocal() as db:
        db.add(GmailAccount(userId="applicant", email="applicant@example.org", secret=gmail.cipher().encrypt(b"refresh")))
        db.commit()
    listing = client.post("/api/job-imports", headers=headers, json={"url":"https://example.org/jobs/42",
        "role":"Analyst","company":"Example","instructions":"Email your resume to hiring@example.org"}).json()
    doc = client.post("/api/documents/upload", headers=headers, files={"file":("resume.pdf",b"%PDF-test","application/pdf")}).json()
    return headers, "/api/job-imports/"+listing["id"]+"/gmail", {"approved":True,"sender":"applicant@example.org",
        "recipient":"hiring@example.org","subject":"Application","body":"Reviewed body","resumeId":doc["id"]}


def test_gmail_validates_review_and_prevents_uncertain_retry(gmail_review, monkeypatch):
    import httpx
    from services import gmail
    headers, path, payload = gmail_review
    calls = []
    async def send(*args):
        calls.append(1)
        raise httpx.ReadTimeout("ambiguous")
    monkeypatch.setattr(gmail,"send",send)
    for change in ({"approved":False},{"sender":"other@example.org"},{"recipient":"other@example.org"},
                   {"resumeId":"missing"},{"subject":"hi\nthere"},{"body":"  "}):
        assert client.post(path, headers=headers,json=payload|change).status_code in (409,422)
    assert client.post(path,headers={"X-User-Id":"other"},json=payload).status_code == 404
    assert not calls
    for _ in range(2):
        assert client.post(path,headers=headers,json=payload).json()["status"] == "pending"
    assert len(calls) == 1
    assert client.get("/api/applications",headers=headers).json() == []


def test_gmail_definite_rejection_and_receipt(gmail_review, monkeypatch):
    import httpx
    from services import gmail
    headers, path, payload = gmail_review
    responses = [httpx.Response(403), httpx.Response(200,json={"id":"mail-1"})]
    async def send(*args):
        return responses.pop(0)
    monkeypatch.setattr(gmail,"send",send)
    assert client.post(path,headers=headers,json=payload).status_code == 409
    result = client.post(path,headers=headers,json=payload).json()
    assert result["status"] == "sent"
    assert client.post(path,headers=headers,json=payload).json() == result
    base = "/api/applications/"+result["applicationId"]+"/receipt"
    assert client.get(base,headers=headers).json()["reference"] == "mail-1"
    assert client.get(base+"/resume",headers=headers).content == b"%PDF-test"
    assert client.get(base+"/resume",headers={"X-User-Id":"other"}).status_code == 404
    client.delete("/api/gmail/account",headers=headers).raise_for_status()
    assert client.get("/api/gmail/account",headers=headers).json()["email"] is None


def test_gmail_popup_requires_expected_origin_and_header(monkeypatch):
    from services import gmail
    monkeypatch.setenv("GMAIL_WEB_ORIGIN", "https://jobpilot.example")
    monkeypatch.setattr(gmail, "client_id", lambda: "fixture")
    for extra in ({"Origin":"https://other.example","X-Requested-With":"XmlHttpRequest"},
                  {"Origin":"https://jobpilot.example"}):
        response = client.post("/api/gmail/account",headers={"X-User-Id":"candidate",**extra},json={"code":"fixture"})
        assert response.status_code == 403
