"""
Orchestrator  —  Hybrid: LLM-first with Rule-Based Fallback
-------------------------------------------------------------
1. Tries Google Gemini (single call, gemini-2.0-flash-lite).
2. On ANY API error (429 quota, network, etc.) automatically falls back
   to the built-in rule-based engine — the app ALWAYS works.
"""

import json
import re
import time
import google.generativeai as genai

from config import GEMINI_API_KEY
from models.story_model import StoryAnalysis, TestCase, TestSuite

# ── rule-based engines (always available) ─────────────────────────────────
from engines.rule_analyst import RuleAnalyst
from engines.rule_generator import RuleGenerator

genai.configure(api_key=GEMINI_API_KEY)

_MODEL_NAME = "gemini-2.5-flash"

_SYSTEM_PROMPT = """You are a combined QA Story Analyst and Test Case Generator.

Given a user story, return ONE JSON object:
{
  "analysis": {
    "feature": "<one short phrase>",
    "user_role": "<role: user / admin / recruiter …>",
    "conditions": ["<condition 1: description → expected outcome>", ...]
  },
  "test_suite": {
    "test_cases": [
      {
        "id": "TC-001",
        "title": "<Feature>: <short title>",
        "type": "<Positive | Negative | Boundary | Edge Case>",
        "priority": "<High | Medium | Low>",
        "preconditions": ["…"],
        "steps": ["step 1", "step 2", "…"],
        "expected_result": "<clear outcome>"
      }
    ]
  }
}

Conditions must cover: valid/happy-path, invalid input, empty fields (each separately),
boundary (min/max), edge cases (special chars, SQL injection, XSS, whitespace, very long input),
security (unauthorized access, session expiry, locked accounts), and any error messages implied.

One test case per condition. Positive/Negative → High. Boundary/Edge → Medium.
Return ONLY valid JSON — no markdown, no code fences.

must be make sure that the test cases are comprehensive and cover all the edge cases.


"""


class Orchestrator:
    def __init__(self):
        self._model = genai.GenerativeModel(
            model_name=_MODEL_NAME,
            system_instruction=_SYSTEM_PROMPT,
        )
        self._rule_analyst = RuleAnalyst()
        self._rule_generator = RuleGenerator()

    # ── Public API ─────────────────────────────────────────────────────────

    def run(self, user_story: str) -> dict:
        """Try LLM; fall back to rule-based engine on any API error."""
        try:
            raw = self._call_with_retry(user_story)
            data = self._parse_json(raw)
            if self._valid(data):
                return self._build_result_from_llm(data, user_story)
        except Exception:
            pass  # fall through to rule-based

        return self._run_rule_based(user_story)

    # ── LLM path ───────────────────────────────────────────────────────────

    def _call_with_retry(self, user_story: str, max_retries: int = 2) -> str:
        prompt = f'Analyze this user story and generate comprehensive test cases:\n\nUSER STORY:\n"""{user_story}"""\n\nReturn the complete JSON object.'
        wait = 3
        for attempt in range(max_retries):
            try:
                return self._model.generate_content(prompt).text.strip()
            except Exception as exc:
                err = str(exc)
                if ("429" in err or "quota" in err.lower()) and attempt < max_retries - 1:
                    time.sleep(wait)
                    wait *= 2
                    continue
                raise

    def _parse_json(self, raw: str) -> dict:
        cleaned = re.sub(r"```(?:json)?", "", raw).strip("`").strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group())
                except json.JSONDecodeError:
                    pass
        return {}

    def _valid(self, data: dict) -> bool:
        return (
            isinstance(data, dict)
            and "analysis" in data
            and "test_suite" in data
            and isinstance(data["analysis"].get("conditions"), list)
            and len(data["analysis"]["conditions"]) > 0
        )

    def _build_result_from_llm(self, data: dict, user_story: str) -> dict:
        a = data["analysis"]
        analysis = StoryAnalysis(
            feature=a.get("feature", "Feature"),
            user_role=a.get("user_role", "user"),
            conditions=a.get("conditions", []),
            original_story=user_story,
        )
        suite = TestSuite(feature=analysis.feature, user_role=analysis.user_role)
        for i, tc_data in enumerate(data["test_suite"].get("test_cases", []), 1):
            suite.test_cases.append(TestCase(
                id=tc_data.get("id", f"TC-{i:03d}"),
                title=tc_data.get("title", f"TC-{i:03d}"),
                type=tc_data.get("type", "Positive"),
                priority=tc_data.get("priority", "Medium"),
                preconditions=tc_data.get("preconditions", []),
                steps=tc_data.get("steps", []),
                expected_result=tc_data.get("expected_result", ""),
            ))
        return {"analysis": analysis.to_dict(), "test_suite": suite.to_dict()}

    # ── Rule-based fallback ────────────────────────────────────────────────

    def _run_rule_based(self, user_story: str) -> dict:
        analysis = self._rule_analyst.analyze(user_story)
        suite = self._rule_generator.generate(analysis)
        return {"analysis": analysis.to_dict(), "test_suite": suite.to_dict()}
