"""Greenhouse Job Board adapter. Credentials are scoped to one configured board."""
import os
import re
import hashlib
import json

import httpx
from fastapi import HTTPException


def board():
    if os.getenv("DEMO_MODE", "").lower() == "true":
        return None
    token = os.getenv("GREENHOUSE_BOARD_TOKEN", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", token) or not os.getenv("GREENHOUSE_JOB_BOARD_API_KEY"):
        return None
    return token


def endpoint(token, suffix):
    return f"https://boards-api.greenhouse.io/v1/boards/{token}{suffix}"


async def read(token, suffix, **params):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(endpoint(token, suffix), params=params)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Employer listing unavailable. Try again later.") from exc


def fields_for(job):
    """Only offer direct submission when the complete form can be represented."""
    if any(job.get(key) for key in ("location_questions", "compliance", "demographic_questions",
                                    "data_compliance", "include_ai_disclaimer", "education", "employment")):
        return None
    fields = []
    for question in job.get("questions", []):
        variants = question.get("fields", [])
        if any(item["name"] == "resume" and item["type"] == "input_file" for item in variants):
            item = next(item for item in variants if item["name"] == "resume")
        elif any(item["name"] == "cover_letter_text" for item in variants):
            item = next(item for item in variants if item["name"] == "cover_letter_text")
        elif len(variants) == 1:
            item = variants[0]
        else:
            return None
        name, kind = item["name"], item["type"]
        if name != "resume" and kind not in ("input_text", "textarea", "multi_value_single_select"):
            return None
        fields.append(dict(name=name, kind=kind, label=question["label"], required=question["required"],
                           options=[dict(value=str(v["value"]), label=v["label"]) for v in item.get("values", [])]))
    if not {"first_name", "last_name", "email"}.issubset(f["name"] for f in fields):
        return None
    return fields


def fingerprint(fields, title):
    return hashlib.sha256(json.dumps([title, fields], sort_keys=True).encode()).hexdigest()


async def deliver(token, job_id, answers, attachment):
    parts = [(name, (None, value)) for name, value in answers.items() if value]
    if attachment:
        parts.append(("resume", attachment))
    async with httpx.AsyncClient(timeout=35) as client:
        return await client.post(endpoint(token, f"/jobs/{job_id}"), files=parts,
                                 auth=(os.environ["GREENHOUSE_JOB_BOARD_API_KEY"], ""))
