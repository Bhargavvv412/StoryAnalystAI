"""
Test Case Generator Agent  (LLM-powered)
-----------------------------------------
Uses Google Gemini to convert a StoryAnalysis into a full TestSuite
with Positive, Negative, Boundary, and Edge test cases.
"""

import json
import re
import google.generativeai as genai

from config import GEMINI_API_KEY
from models.story_model import StoryAnalysis, TestCase, TestSuite

genai.configure(api_key=GEMINI_API_KEY)


class TestCaseGeneratorAgent:
    """
    LLM-powered agent that generates detailed, structured test cases
    from a StoryAnalysis object.
    """

    SYSTEM_PROMPT = """You are a senior QA automation engineer.
Your job is to generate detailed, structured test cases from a feature name, user role, and a list of testable conditions.

For each condition, produce one test case object with these exact keys:
{
  "id": "TC-001",
  "title": "<Feature>: <short descriptive title>",
  "type": "<one of: Positive | Negative | Boundary | Edge Case>",
  "priority": "<one of: High | Medium | Low>",
  "preconditions": ["<precondition 1>", ...],
  "steps": ["<step 1>", "<step 2>", ...],
  "expected_result": "<clear expected outcome>"
}

Classification rules:
- Positive  → valid/happy-path scenarios          → High priority
- Negative  → invalid input, error, rejection     → High priority
- Boundary  → min/max values, exact limits        → Medium priority
- Edge Case → special chars, injection, whitespace, concurrent, timeout → Medium priority

Return a JSON array of test case objects — one per condition.
Return ONLY valid JSON — no markdown fences, no explanation.
"""

    def __init__(self):
        self._model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=self.SYSTEM_PROMPT,
        )

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def generate(self, analysis: StoryAnalysis) -> TestSuite:
        """Generate a full TestSuite from a StoryAnalysis."""
        raw = self._call_llm(analysis)
        cases_data = self._parse_json(raw)

        suite = TestSuite(feature=analysis.feature, user_role=analysis.user_role)
        for i, tc_data in enumerate(cases_data, start=1):
            tc = TestCase(
                id=tc_data.get("id", f"TC-{i:03d}"),
                title=tc_data.get("title", f"TC-{i:03d}"),
                type=tc_data.get("type", "Positive"),
                priority=tc_data.get("priority", "Medium"),
                preconditions=tc_data.get("preconditions", []),
                steps=tc_data.get("steps", []),
                expected_result=tc_data.get("expected_result", ""),
            )
            suite.test_cases.append(tc)

        return suite

    # ------------------------------------------------------------------ #
    # LLM call
    # ------------------------------------------------------------------ #

    def _call_llm(self, analysis: StoryAnalysis) -> str:
        conditions_text = "\n".join(
            f"{i+1}. {c}" for i, c in enumerate(analysis.conditions)
        )
        prompt = f"""Generate detailed test cases for the following:

Feature: {analysis.feature}
User Role: {analysis.user_role}

Testable Conditions:
{conditions_text}

Return a JSON array of test case objects as instructed.
"""
        response = self._model.generate_content(prompt)
        return response.text.strip()

    # ------------------------------------------------------------------ #
    # JSON parsing (robust)
    # ------------------------------------------------------------------ #

    def _parse_json(self, raw: str) -> list:
        cleaned = re.sub(r"```(?:json)?", "", raw).strip("`").strip()
        try:
            result = json.loads(cleaned)
            if isinstance(result, list):
                return result
            if isinstance(result, dict):
                # Some models wrap in {"test_cases": [...]}
                for key in ("test_cases", "cases", "testCases"):
                    if key in result and isinstance(result[key], list):
                        return result[key]
        except json.JSONDecodeError:
            m = re.search(r"\[.*\]", cleaned, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group())
                except json.JSONDecodeError:
                    pass
        return []
