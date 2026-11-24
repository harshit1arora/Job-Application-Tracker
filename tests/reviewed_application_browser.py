"""Browser smoke test. Requires backend deps, playwright, installed Chrome, and Frontend/npm ci."""
import base64
import json
from email import policy
from email.parser import BytesParser
from urllib.parse import parse_qs
from cryptography.fernet import Fernet
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx
import uvicorn
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Backend_FastAPI"))


def run():
    expect.set_options(timeout=30000)
    received = []
    emails = []
    role = "Fixture engineer"
    questions = [{"label": label, "required": True, "fields": [{"name": name, "type": kind}]}
                 for label, name, kind in [("First name", "first_name", "input_text"),
                                           ("Last name", "last_name", "input_text"),
                                           ("Email", "email", "input_text"),
                                           ("Availability", "question_7", "textarea"),
                                           ("Resume", "resume", "input_file")]]
    job = {"id": 7, "title": role, "questions": questions, "absolute_url": "https://example.invalid/job/7"}

    class Employer(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/userinfo":
                assert self.headers["Authorization"] == "Bearer fixture-access"
                data = {"email":"applicant@example.org","email_verified":True}
            else:
                data = {"jobs": [job]} if self.path.endswith("/jobs") else job
            self.send_response(200)
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())

        def do_POST(self):
            if self.path in ("/token", "/gmail/send"):
                body = self.rfile.read(int(self.headers["Content-Length"]))
                if self.path == "/token":
                    grant = parse_qs(body.decode())
                    assert grant["client_id"] == ["fixture-client"]
                    if grant["grant_type"] == ["authorization_code"]:
                        assert grant["code"] == ["fixture-code"] and grant["redirect_uri"] == ["http://127.0.0.1:5197"]
                    else:
                        assert grant["refresh_token"] == ["fixture-refresh"]
                    result = {"access_token":"fixture-access", "refresh_token":"fixture-refresh",
                              "scope":"email https://www.googleapis.com/auth/gmail.send"}
                else:
                    assert self.headers["Authorization"] == "Bearer fixture-access"
                    emails.append(BytesParser(policy=policy.default).parsebytes(base64.urlsafe_b64decode(json.loads(body)["raw"])))
                    result = {"id":"fixture-gmail-001"}
                self.send_response(200)
                self.send_header("Content-Type","application/json")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
                return
            assert self.path == "/jobs/7" and self.headers["Authorization"].startswith("Basic ")
            received.append(self.rfile.read(int(self.headers["Content-Length"])))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"success":true}')

    with tempfile.TemporaryDirectory() as tmp, ThreadingHTTPServer(("127.0.0.1", 0), Employer) as employer:
        os.environ.update(DATA_DIR=tmp, DATABASE_URL="sqlite:///" + str(Path(tmp)/"test.db"),
                          DEMO_MODE="true", GREENHOUSE_JOB_BOARD_API_KEY="fixture",
                          CORS_ORIGINS="http://127.0.0.1:5197")
        import main
        async def draft_answer(messages, max_tokens):
            assert "I build software." in messages[-1]["content"]
            return "I build software."

        main.gemini_service.is_configured = lambda: True
        main.gemini_service.chat = draft_answer
        from services import greenhouse, job_import, gmail
        os.environ.update(GMAIL_CLIENT_SECRET="fixture-secret", GMAIL_WEB_ORIGIN="http://127.0.0.1:5197",
                          GMAIL_TOKEN_KEY=Fernet.generate_key().decode())
        gmail.client_id = lambda: "fixture-client"
        gmail.TOKEN = f"http://127.0.0.1:{employer.server_port}/token"
        gmail.IDENTITY = f"http://127.0.0.1:{employer.server_port}/userinfo"
        gmail.SEND = f"http://127.0.0.1:{employer.server_port}/gmail/send"
        def fixture_listing(url):
            if url.endswith("/blocked"):
                raise ValueError("unreadable fixture")
            return b"""<html><script type="application/ld+json">{"@type":"JobPosting","title":"Fixture engineer",
            "hiringOrganization":{"name":"Fixture Co"},"validThrough":"2027-04-30","description":"Build software.",
            "applicationInstructions":"Apply on the employer website."}</script></html>"""
        job_import.read_page = fixture_listing
        greenhouse.board = lambda: "fixture"
        greenhouse.endpoint = lambda token, suffix: f"http://127.0.0.1:{employer.server_port}{suffix}"
        threading.Thread(target=employer.serve_forever, daemon=True).start()
        api = uvicorn.Server(uvicorn.Config(main.app, host="127.0.0.1", port=5198, log_level="error"))
        worker = threading.Thread(target=api.run, daemon=True)
        worker.start()
        frontend = ROOT/"Frontend"
        env = dict(os.environ, VITE_API_URL="http://127.0.0.1:5198/api", VITE_DEMO_MODE="false")
        with subprocess.Popen([shutil.which("node"), "node_modules/vite/bin/vite.js", "--host", "127.0.0.1",
                               "--port", "5197", "--strictPort"], cwd=frontend, env=env) as vite:
            try:
                for _ in range(120):
                    try:
                        if api.started and httpx.get("http://127.0.0.1:5197").is_success:
                            break
                    except httpx.TransportError:
                        pass
                    time.sleep(.5)
                headers = {"X-User-Id": "fixture-user"}
                with sync_playwright() as pw:
                    browser = pw.chromium.launch(channel="chrome")
                    page = browser.new_page()
                    page.set_default_timeout(60000)
                    page.route("https://accounts.google.com/gsi/client", lambda route: route.fulfill(
                        content_type="application/javascript",
                        body="window.google={accounts:{oauth2:{initCodeClient:o=>({requestCode:()=>o.callback({code:'fixture-code'})})}}};"))
                    page.add_init_script("""localStorage.setItem("jobpilot_local_user", JSON.stringify({
                      id:"fixture-user",name:"Taylor Fixture",email:"taylor@example.org"}));
                      localStorage.setItem("jobpilot:profile:fixture-user", JSON.stringify({
                      fullName:"Taylor Fixture",email:"taylor@example.org",phone:"1234",
                      resumeText:"I build software.",location:"City",targetRole:"Engineer"}));""")
                    page.goto("http://127.0.0.1:5197/profile")
                    library = page.locator("div.bg-card").filter(has=page.get_by_role("heading", name="Résumé versions")).last
                    page.get_by_label("Version name").fill("Backend résumé")
                    library.locator('input[type=file]').set_input_files({"name":"fixture.pdf", "mimeType":"application/pdf", "buffer":b"%PDF-browser-test"})
                    expect(library.get_by_text("Backend résumé", exact=True)).to_be_visible()
                    page.get_by_label("Version name").fill("Data analyst résumé")
                    library.locator('input[type=file]').set_input_files({"name":"fixture.pdf", "mimeType":"application/pdf", "buffer":b"%PDF-analyst-version"})
                    expect(library.get_by_text("Data analyst résumé", exact=True)).to_be_visible()
                    page.goto("http://127.0.0.1:5197/browse")
                    page.get_by_label("Listing URL").fill("https://example.invalid/blocked")
                    page.get_by_role("button", name="Extract listing details").click()
                    page.get_by_label("Paste job description").fill("Company: Acme\nRole: Analyst\nDeadline: Friday\nInstructions: Email your resume to hiring@example.org")
                    page.get_by_role("button", name="Extract listing details").click()
                    page.get_by_label("Company", exact=True).fill("Acme Data")
                    page.get_by_role("button", name="Confirm and save opening").click()
                    expect(page.get_by_role("link", name="Apply by email to hiring@example.org")).to_be_visible()
                    page.reload()
                    page.get_by_label("Imported openings").select_option(label="Acme Data · Analyst")
                    expect(page.get_by_text("Deadline: Friday")).to_be_visible()
                    page.get_by_role("button", name="Apply by Gmail").click()
                    mail_form = page.get_by_role("region", name="Review Gmail application")
                    mail_form.get_by_role("button", name="Connect Gmail").click()
                    expect(mail_form.get_by_text("From: applicant@example.org", exact=False)).to_be_visible()
                    mail_form.get_by_label("Email subject").fill("Reviewed analyst application")
                    mail_form.get_by_label("Email message").fill("Here is the requested analyst résumé.")
                    mail_form.get_by_label("Résumé attachment").select_option(label="Data analyst résumé · fixture.pdf")
                    with page.expect_download() as preview:
                        mail_form.get_by_role("button", name="Download attachment for review").click()
                    assert Path(preview.value.path()).read_bytes() == b"%PDF-analyst-version"
                    assert not emails
                    mail_form.get_by_role("button", name="Send application").click()
                    mail_form.get_by_role("link", name="View email receipt").click()
                    mail_receipt = page.get_by_role("region", name="Submission receipt")
                    expect(mail_receipt.get_by_text("Gmail message ID: fixture-gmail-001")).to_be_visible()
                    mail_receipt.get_by_text("Submitted answers", exact=False).click()
                    expect(mail_receipt.get_by_text("Reviewed analyst application",exact=True)).to_be_visible()
                    assert len(emails) == 1
                    sent = emails[0]
                    assert str(sent["From"]) == "applicant@example.org" and str(sent["To"]) == "hiring@example.org"
                    assert sent["Subject"] == "Reviewed analyst application"
                    assert sent.get_body().get_content().strip() == "Here is the requested analyst résumé."
                    attachment, = sent.iter_attachments()
                    assert attachment.get_filename() == "fixture.pdf" and attachment.get_payload(decode=True) == b"%PDF-analyst-version"
                    page.goto("http://127.0.0.1:5197/browse")
                    page.get_by_label("Imported openings").select_option(label="Acme Data · Analyst")
                    page.get_by_role("button", name="Apply by Gmail").click()
                    expect(page.get_by_role("link", name="View email receipt")).to_be_visible()
                    assert len(emails) == 1
                    page.get_by_label("Listing URL").fill(job["absolute_url"])
                    page.get_by_role("button", name="Extract listing details").click()
                    expect(page.get_by_label("Application deadline")).to_have_value("2027-04-30")
                    page.get_by_role("button", name="Confirm and save opening").click()
                    page.get_by_role("button", name="Review with JobPilot").click()
                    expect(page.get_by_label("First name")).to_have_value("Taylor")
                    page.get_by_role("button", name="Draft from my profile").click()
                    expect(page.get_by_label("Availability")).to_have_value("I build software.")
                    page.get_by_label("Availability").fill("Reviewed answer for fixture")
                    page.get_by_label("Resume", exact=False).filter(visible=True).first.select_option(label="Backend résumé · fixture.pdf")
                    page.reload()
                    page.get_by_label("Employer listings").select_option("7")
                    expect(page.get_by_label("Availability")).to_have_value("Reviewed answer for fixture")
                    assert not received
                    page.get_by_role("button", name="Submit reviewed application").click()
                    expect(page.get_by_text("Employer confirmed receipt.", exact=False)).to_be_visible()
                    assert len(received) == 1
                    for value in (b"Reviewed answer for fixture", b"%PDF-browser-test", b"taylor@example.org"):
                        assert value in received[0]
                    page.get_by_role("link", name="View tracked application").click()
                    expect(page.get_by_text(role, exact=True).first).to_be_visible(timeout=30000)
                    receipt = page.get_by_role("region", name="Submission receipt")
                    expect(receipt.get_by_text("Backend résumé", exact=False).first).to_be_visible()
                    receipt.get_by_text("Submitted answers", exact=False).click()
                    expect(receipt.get_by_text("Reviewed answer for fixture", exact=True)).to_be_visible()
                    expect(receipt.locator("time")).to_be_visible()
                    expect(receipt.get_by_role("link")).to_have_attribute("href", job["absolute_url"])
                    with page.expect_download() as saved:
                        receipt.get_by_role("button", name="Download fixture.pdf").click()
                    assert Path(saved.value.path()).read_bytes() == b"%PDF-browser-test"
                    browser.close()
            finally:
                vite.terminate()
                api.should_exit = True
                worker.join(10)
                employer.shutdown()
                main.engine.dispose()


if __name__ == "__main__":
    run()
