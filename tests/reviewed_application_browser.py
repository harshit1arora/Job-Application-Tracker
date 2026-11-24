"""Browser smoke test. Requires backend deps, playwright, installed Chrome, and Frontend/npm ci."""
import json
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
            data = {"jobs": [job]} if self.path.endswith("/jobs") else job
            self.send_response(200)
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())

        def do_POST(self):
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
        from services import greenhouse
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
                doc = httpx.post("http://127.0.0.1:5198/api/documents/upload", headers=headers,
                                 files={"file": ("fixture.pdf", b"%PDF-browser-test", "application/pdf")})
                doc.raise_for_status()
                with sync_playwright() as pw:
                    browser = pw.chromium.launch(channel="chrome")
                    page = browser.new_page()
                    page.set_default_timeout(60000)
                    page.add_init_script("""localStorage.setItem("jobpilot_local_user", JSON.stringify({
                      id:"fixture-user",name:"Taylor Fixture",email:"taylor@example.org"}));
                      localStorage.setItem("jobpilot:profile:fixture-user", JSON.stringify({
                      fullName:"Taylor Fixture",email:"taylor@example.org",phone:"1234",
                      resumeText:"I build software.",location:"City",targetRole:"Engineer"}));""")
                    page.goto("http://127.0.0.1:5197/browse")
                    page.get_by_label("Employer listings").select_option("7")
                    expect(page.get_by_label("First name")).to_have_value("Taylor")
                    page.get_by_role("button", name="Draft from my profile").click()
                    expect(page.get_by_label("Availability")).to_have_value("I build software.")
                    page.get_by_label("Availability").fill("Reviewed answer for fixture")
                    page.get_by_label("Resume", exact=False).filter(visible=True).first.select_option(doc.json()["id"])
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
                    browser.close()
            finally:
                vite.terminate()
                api.should_exit = True
                worker.join(10)
                employer.shutdown()
                main.engine.dispose()


if __name__ == "__main__":
    run()
