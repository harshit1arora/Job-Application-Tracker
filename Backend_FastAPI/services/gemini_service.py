import json
import os
import re
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types
from fastapi import HTTPException

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


class GeminiService:
    def __init__(self) -> None:
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.model_name = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
        self.client = None
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)

    def is_configured(self) -> bool:
        return bool(self.client and self.api_key)

    def _require_client(self):
        if not self.is_configured():
            raise HTTPException(status_code=503, detail="Gemini AI service unavailable")
        return self.client

    def _clean_text(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        return str(value).strip()

    async def chat(self, messages: List[Dict[str, str]], max_tokens: int = 700) -> str:
        client = self._require_client()
        prompt = "\n\n".join(
            f"{m.get('role', 'user').capitalize()}: {self._clean_text(m.get('content'))}"
            for m in messages
        )
        try:
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=max_tokens,
                    response_mime_type="text/plain",
                ),
            )
            text = getattr(response, "text", None)
            if isinstance(text, str) and text.strip():
                return text.strip()
            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                part_text = getattr(candidate, "content", None)
                if part_text:
                    return str(part_text).strip()
            raise HTTPException(status_code=502, detail="Gemini returned an empty response")
        except Exception as exc:  # pragma: no cover - runtime safety
            raise HTTPException(status_code=502, detail="Gemini AI service unavailable") from exc

    async def embed(self, texts: List[str]) -> List[List[float]]:
        client = self._require_client()
        if not texts:
            return []
        try:
            response = client.models.embed_content(
                model="gemini-embedding-001",
                contents=texts,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
            )
            values = getattr(response, "embeddings", None) or getattr(response, "data", None) or []
            outputs: List[List[float]] = []
            for item in values:
                embedding = getattr(item, "values", None)
                if embedding is not None:
                    outputs.append([float(v) for v in embedding])
            if outputs:
                return outputs
            raise HTTPException(status_code=502, detail="Gemini embedding response was empty")
        except Exception as exc:  # pragma: no cover - runtime safety
            raise HTTPException(status_code=502, detail="Gemini embedding service unavailable") from exc

    async def parse_resume(self, resume_text: str) -> Dict[str, Any]:
        client = self._require_client()
        prompt = (
            "You are a resume parsing expert. Return valid JSON only matching this schema: "
            "{\"fullName\": string, \"email\": string, \"phone\": string, \"city\": string, \"country\": string, "
            "\"ageOrExperience\": string, \"targetRole\": string, \"skills\": [string], \"education\": string, "
            "\"linkedin\": string, \"portfolio\": string, \"github\": string, \"summary\": string}. "
            f"Resume text:\n\n{resume_text[:12000]}"
        )
        response = client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=900,
                response_mime_type="application/json",
            ),
        )
        text = getattr(response, "text", None)
        if not isinstance(text, str):
            raise HTTPException(status_code=502, detail="Gemini returned an invalid resume parse response")
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        data = json.loads(text)
        if not isinstance(data, dict):
            raise HTTPException(status_code=502, detail="Gemini returned malformed resume JSON")
        return data

    async def generate_cover_letter(
        self,
        applicant_name: str,
        company: str,
        job_title: str,
        job_description: Optional[str],
        resume_highlights: Optional[str],
    ) -> str:
        client = self._require_client()
        prompt = (
            "Write a concise, truthful first-person cover letter. "
            "Do not invent experience, names, or facts. Use only the supplied information. "
            "Output only the final letter, no explanations.\n\n"
            f"Applicant name: {applicant_name or 'Candidate'}\n"
            f"Company: {company}\n"
            f"Role: {job_title}\n"
            f"Job description: {job_description or 'Not provided'}\n"
            f"Resume highlights: {resume_highlights or 'Not provided'}"
        )
        response = client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=600,
                response_mime_type="text/plain",
            ),
        )
        text = getattr(response, "text", None)
        if not isinstance(text, str) or not text.strip():
            raise HTTPException(status_code=502, detail="Gemini could not generate a cover letter")
        return text.strip()

    async def generate_interview_questions(self, role: str, context: str) -> str:
        client = self._require_client()
        prompt = (
            "Generate 5 concise, role-specific interview questions for a candidate. "
            "Return plain text only.\n\nRole: "
            f"{role}\nContext: {context}"
        )
        response = client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=600,
                response_mime_type="text/plain",
            ),
        )
        text = getattr(response, "text", None)
        if not isinstance(text, str) or not text.strip():
            raise HTTPException(status_code=502, detail="Gemini interview generation failed")
        return text.strip()

    async def match_score(self, resume_text: str, job_text: str) -> int:
        client = self._require_client()
        prompt = (
            "Return a single integer 0-100 representing how well the resume matches the job description. "
            "Return only the integer, with no extra text.\n\n"
            f"Resume:\n{resume_text[:6000]}\n\nJob description:\n{job_text[:6000]}"
        )
        response = client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=50,
                response_mime_type="text/plain",
            ),
        )
        text = getattr(response, "text", None)
        if not isinstance(text, str):
            raise HTTPException(status_code=502, detail="Gemini match response was invalid")
        match = re.search(r"(\d{1,3})", text)
        if not match:
            raise HTTPException(status_code=502, detail="Gemini match score was malformed")
        value = int(match.group(1))
        return max(0, min(100, value))


gemini_service = GeminiService()
