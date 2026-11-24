"""Google popup-code exchange and Gmail MIME transport."""
import base64
import os
from email.message import EmailMessage
from email.policy import SMTP

import httpx
from cryptography.fernet import Fernet
from fastapi import HTTPException

SCOPE = "https://www.googleapis.com/auth/gmail.send"
TOKEN = "https://oauth2.googleapis.com/token"
SEND = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
IDENTITY = "https://openidconnect.googleapis.com/v1/userinfo"


def client_id():
    if os.getenv("DEMO_MODE", "").lower() == "true":
        return None
    if all(os.getenv(k) for k in ("GMAIL_CLIENT_SECRET", "GMAIL_TOKEN_KEY", "GMAIL_WEB_ORIGIN")):
        try:
            cipher()
        except ValueError:
            return None
        return os.getenv("GMAIL_CLIENT_ID")
    return None


def cipher():
    return Fernet(os.environ["GMAIL_TOKEN_KEY"].encode())


async def tokens(**grant):
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            res = await client.post(TOKEN, data={**grant, "client_id":client_id(),
                                                "client_secret":os.environ["GMAIL_CLIENT_SECRET"]})
        except httpx.RequestError:
            raise HTTPException(503, "Google authorization is temporarily unavailable.")
    if res.status_code != 200:
        raise HTTPException(409, "Reconnect Gmail and review the email again.")
    return res.json()


async def exchange(code):
    data = await tokens(code=code, redirect_uri=os.environ["GMAIL_WEB_ORIGIN"], grant_type="authorization_code")
    if SCOPE not in data.get("scope", "").split():
        raise HTTPException(403, "Grant permission to send mail through Gmail.")
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(IDENTITY, headers={"Authorization":"Bearer "+data["access_token"]})
    if response.status_code != 200:
        raise HTTPException(409, "Google could not verify the sending account.")
    identity = response.json()
    if not identity.get("email_verified") or not identity.get("email"):
        raise HTTPException(409, "Choose a verified Google email address.")
    return identity["email"], data.get("refresh_token")


def raw_message(sender, recipient, subject, body, name, content_type, contents):
    message = EmailMessage(policy=SMTP)
    message["From"], message["To"], message["Subject"] = sender, recipient, subject
    message.set_content(body)
    major, minor = content_type.split("/", 1)
    message.add_attachment(contents, maintype=major, subtype=minor, filename=name)
    return base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")


async def send(access, raw):
    async with httpx.AsyncClient(timeout=40) as client:
        return await client.post(SEND, headers={"Authorization":"Bearer "+access}, json={"raw":raw})
