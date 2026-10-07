"""Pure-logic tests (no FastAPI / DB needed): run with `pytest test_negotiation_logic.py`."""
import pytest

from services.negotiation_logic import (
    annual_total_comp,
    normalize_followup_email,
    normalize_negotiation_plan,
    parse_json_object,
    suggest_counter,
    tone_or_default,
)


def test_annual_total_comp_spreads_equity_and_match():
    # 100k base + 10k bonus + 80k equity over 4y (20k) + 5% match (5k) + 2k benefits
    assert annual_total_comp(100_000, 10_000, 80_000, 4, 5, 2_000) == 137_000


def test_annual_total_comp_is_defensive():
    assert annual_total_comp(None) == 0
    assert annual_total_comp("abc", -5, -5, 0, -1, -1) == 0
    # zero/negative vesting falls back to 4 years instead of dividing by zero
    assert annual_total_comp(0, 0, 400, 0) == 100


def test_suggest_counter_default_rule_of_thumb():
    counter = suggest_counter(1_000_000)
    assert counter["target"] == 1_100_000
    assert counter["floor"] == 1_050_000
    assert counter["opening"] == 1_155_000
    assert counter["raisePct"] == 10.0
    assert counter["aggressive"] is False


def test_suggest_counter_with_leverage_and_competing_offer():
    leveraged = suggest_counter(1_000_000, has_leverage=True)
    assert leveraged["target"] == 1_150_000
    competing = suggest_counter(1_000_000, competing_bases=[1_300_000])
    # matches competing base but capped at +25%
    assert competing["target"] == 1_250_000
    assert competing["opening"] >= competing["target"] >= competing["floor"]


def test_suggest_counter_respects_user_target_and_flags_aggressive():
    counter = suggest_counter(100_000, target_base=140_000)
    assert counter["target"] == 140_000
    assert counter["opening"] == 140_000
    assert counter["aggressive"] is True
    # a target below the offer never lowers the base
    assert suggest_counter(100_000, target_base=90_000)["target"] == 100_000


def test_suggest_counter_without_base():
    counter = suggest_counter(0)
    assert counter["target"] == 0
    assert "base salary" in counter["rationale"].lower()


def test_parse_json_object_variants():
    assert parse_json_object('{"a": 1}') == {"a": 1}
    assert parse_json_object('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json_object('Sure! Here you go: {"a": 1} hope it helps') == {"a": 1}
    with pytest.raises(ValueError):
        parse_json_object("no json here")
    with pytest.raises(ValueError):
        parse_json_object("[1, 2]")


def test_normalize_negotiation_plan_forces_server_counter():
    counter = suggest_counter(100_000)
    plan = normalize_negotiation_plan(
        {
            "strategy": " Lead with enthusiasm ",
            "counter": {"target": 999},  # model-supplied numbers are ignored
            "talkingPoints": ["a", "", "b"],
            "email": {"subject": "Re: offer", "body": "Hello"},
            "phoneScript": "Hi",
            "pushbackResponses": [{"objection": "Budget", "response": "Understood"}, {"objection": "x"}, "bad"],
            "risks": "not-a-list",
        },
        counter,
    )
    assert plan["counter"] is counter
    assert plan["strategy"] == "Lead with enthusiasm"
    assert plan["talkingPoints"] == ["a", "b"]
    assert plan["pushbackResponses"] == [{"objection": "Budget", "response": "Understood"}]
    assert plan["risks"] == []


def test_normalize_negotiation_plan_rejects_empty():
    with pytest.raises(ValueError):
        normalize_negotiation_plan({"strategy": "only strategy"}, suggest_counter(100_000))


def test_normalize_followup_email():
    assert normalize_followup_email({"subject": "Hi", "body": " Body "}) == {"subject": "Hi", "body": "Body"}
    assert normalize_followup_email({"body": "Body"})["subject"] == "Following up on my application"
    with pytest.raises(ValueError):
        normalize_followup_email({"subject": "x"})


def test_tone_or_default():
    assert tone_or_default("firm", ("collaborative", "firm"), "collaborative") == "firm"
    assert tone_or_default("rude", ("collaborative", "firm"), "collaborative") == "collaborative"
