"""Pure helpers for the Offer Comparison / Negotiation and Smart Follow-up features.

This module deliberately has NO FastAPI, SQLAlchemy or Gemini imports so that it can be
unit-tested in isolation (see ``test_negotiation_logic.py``).

Design rule: *numbers are computed here, words are written by the AI.*
The model is handed the already-computed counter-offer figures and is only asked to write
prose around them, so it can never invent a salary number that disagrees with the UI.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, List, Optional

# A counter-offer more than this far above the current base is flagged as aggressive.
MAX_RAISE_PCT = 0.25
BASE_RAISE_PCT = 0.10
LEVERAGE_BONUS_PCT = 0.05
OPENING_ANCHOR_PCT = 0.05

TONES_NEGOTIATION = ("collaborative", "firm", "enthusiastic")
TONES_FOLLOWUP = ("polite", "friendly", "direct")


# ---------------------------------------------------------------------------
# Compensation maths
# ---------------------------------------------------------------------------

def _num(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number != number or number in (float("inf"), float("-inf")):
        return default
    return number


def annual_total_comp(
    base: Any,
    bonus: Any = 0,
    equity_total: Any = 0,
    vest_years: Any = 4,
    retirement_match_pct: Any = 0,
    other_benefits: Any = 0,
) -> float:
    """Steady-state yearly compensation (excludes one-off signing bonus).

    equity is spread over its vesting period; retirement match is a % of base.
    """
    base_v = max(0.0, _num(base))
    vest = _num(vest_years, 4.0)
    if vest <= 0:
        vest = 4.0
    total = (
        base_v
        + max(0.0, _num(bonus))
        + max(0.0, _num(equity_total)) / vest
        + base_v * max(0.0, _num(retirement_match_pct)) / 100.0
        + max(0.0, _num(other_benefits))
    )
    return round(total, 2)


def _round_step(value: float, reference: float) -> float:
    """Round a salary figure to a human-friendly step relative to its magnitude."""
    if reference >= 50_000:
        step = 1000
    elif reference >= 5_000:
        step = 100
    else:
        step = 10
    return float(round(value / step) * step)


def suggest_counter(
    base: Any,
    target_base: Any = None,
    competing_bases: Optional[Iterable[Any]] = None,
    has_leverage: bool = False,
) -> Dict[str, Any]:
    """Return a deterministic counter-offer range for the base salary.

    * ``floor``   – the lowest counter worth sending (halfway to the target)
    * ``target``  – the figure the candidate would be happy to land on
    * ``opening`` – the anchor to open with (slightly above target to leave room)
    """
    base_v = max(0.0, _num(base))
    if base_v <= 0:
        return {
            "floor": 0.0,
            "target": 0.0,
            "opening": 0.0,
            "raisePct": 0.0,
            "aggressive": False,
            "rationale": "Add a base salary to get a counter-offer suggestion.",
        }

    competing = [b for b in (_num(x) for x in (competing_bases or [])) if b > 0]
    best_competing = max(competing) if competing else 0.0
    leveraged = bool(has_leverage) or bool(competing)

    user_target = _num(target_base)
    if user_target > 0:
        target = user_target
        rationale = "Using the target base you entered."
    else:
        pct = BASE_RAISE_PCT + (LEVERAGE_BONUS_PCT if leveraged else 0.0)
        target = base_v * (1 + pct)
        rationale = (
            f"Rule of thumb: asking about {round(pct * 100)}% above the initial base is common"
            + (" when you hold a competing offer or other leverage." if leveraged else ".")
        )
        if best_competing > base_v:
            matched = min(best_competing, base_v * (1 + MAX_RAISE_PCT))
            if matched > target:
                target = matched
                rationale = "Matching the strongest competing base salary (capped at +25%)."
    target = max(target, base_v)

    opening = target * (1 + OPENING_ANCHOR_PCT) if user_target <= 0 else target
    if user_target <= 0:
        opening = min(opening, base_v * (1 + MAX_RAISE_PCT + OPENING_ANCHOR_PCT))
    floor = base_v + (target - base_v) / 2.0

    target_r = _round_step(target, base_v)
    opening_r = max(_round_step(opening, base_v), target_r)
    floor_r = min(_round_step(floor, base_v), target_r)
    raise_pct = (target_r - base_v) / base_v * 100.0
    return {
        "floor": floor_r,
        "target": target_r,
        "opening": opening_r,
        "raisePct": round(raise_pct, 1),
        "aggressive": raise_pct > MAX_RAISE_PCT * 100.0 + 1e-9,
        "rationale": rationale,
    }


# ---------------------------------------------------------------------------
# AI output normalisation
# ---------------------------------------------------------------------------

def parse_json_object(text: Any) -> Dict[str, Any]:
    """Parse a model response that should be a JSON object (tolerates code fences / chatter)."""
    if not isinstance(text, str):
        raise ValueError("AI response was not text")
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            raise ValueError("AI response did not contain JSON")
        data = json.loads(cleaned[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("AI response JSON was not an object")
    return data


def _text(value: Any, limit: int) -> str:
    if value is None:
        return ""
    return str(value).strip()[:limit]


def _text_list(value: Any, max_items: int, limit: int) -> List[str]:
    if not isinstance(value, list):
        return []
    out = [_text(item, limit) for item in value]
    return [item for item in out if item][:max_items]


def normalize_negotiation_plan(raw: Dict[str, Any], counter: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce a model response into the strict shape the frontend expects.

    The numeric ``counter`` block always comes from :func:`suggest_counter`, never the model.
    """
    email_raw = raw.get("email") if isinstance(raw.get("email"), dict) else {}
    pushback_raw = raw.get("pushbackResponses")
    pushback: List[Dict[str, str]] = []
    if isinstance(pushback_raw, list):
        for item in pushback_raw[:6]:
            if not isinstance(item, dict):
                continue
            objection = _text(item.get("objection"), 300)
            response = _text(item.get("response"), 900)
            if objection and response:
                pushback.append({"objection": objection, "response": response})

    plan = {
        "strategy": _text(raw.get("strategy"), 1500),
        "counter": counter,
        "talkingPoints": _text_list(raw.get("talkingPoints"), 8, 400),
        "email": {
            "subject": _text(email_raw.get("subject"), 200),
            "body": _text(email_raw.get("body"), 4000),
        },
        "phoneScript": _text(raw.get("phoneScript"), 3000),
        "pushbackResponses": pushback,
        "risks": _text_list(raw.get("risks"), 5, 300),
    }
    if not plan["email"]["body"] and not plan["phoneScript"]:
        raise ValueError("AI negotiation plan was empty")
    return plan


def normalize_followup_email(raw: Dict[str, Any]) -> Dict[str, str]:
    subject = _text(raw.get("subject"), 200)
    body = _text(raw.get("body"), 3000)
    if not body:
        raise ValueError("AI follow-up email was empty")
    return {"subject": subject or "Following up on my application", "body": body}


def tone_or_default(value: Any, allowed: Iterable[str], default: str) -> str:
    return value if value in set(allowed) else default
