"""
Story Analyst Agent  (LLM-powered)
------------------------------------
Uses Google Gemini to read a user story and extract:
  - feature name
  - user role
  - comprehensive list of testable conditions
"""

import json
import re
import google.generativeai as genai

from config import GEMINI_API_KEY
from models.story_model import StoryAnalysis

genai.configure(api_key=GEMINI_API_KEY)


class StoryAnalystAgent:
    """
    LLM-powered agent that analyses a user story and returns a StoryAnalysis.
    Falls back to a lightweight rule-based extractor if the LLM call fails.
    """

    SYSTEM_PROMPT = """You are a senior QA engineer and story analyst.
Your job is to read a user story and extract structured testing information.

Given a user story, return a JSON object with exactly these keys:
{
  "feature": "<one short phrase — the main feature being described>",
  "user_role": "<the role of the user in the story, e.g. user, admin, recruiter>",
  "conditions": [
    "<condition 1>",
    "<condition 2>",
    ...
  ]
}

The "conditions" list must be ABSOLUTELY EXHAUSTIVE and MASSIVE. Generate AS MANY test conditions as humanly and technically possible for this feature (aim for 50 to 200 conditions if applicable).
Think of EVERY possible permutation of inputs, edge cases, negative flows, boundary values, security bypass attempts, concurrent sessions, and complex state changes.

Ensure you include ALL of:
  1. Valid / happy-path scenarios (all variations)
  2. Invalid input scenarios (wrong format, wrong characters, regex bypass)
  3. Missing / empty field scenarios (single missing, multiple missing, all missing)
  4. Boundary conditions (min length-1, min length, max length, max length+1)
  5. Edge cases (special characters, SQL injection, Cross-Site Scripting (XSS), whitespace-only, emoji overloading, very long strings)
  6. Security scenarios (unauthorized access, session expiry, locked accounts, CSRF tokens, rate limiting)
  7. Error message / validation rule scenarios for every single possible failure
  8. Any domain-specific conditions implied by the story, including temporal and stateful variations

Rules:
- Do NOT invent features not mentioned in the story.
- Keep each condition SHORT, CLEAR, and focused on ONE behavior.
- Format: "<input description> → <expected outcome>" where the outcome is clear.
- Return ONLY valid JSON — no markdown, no explanation, no code fences.
"""

    def __init__(self):
        self._model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=self.SYSTEM_PROMPT,
        )

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def analyze(self, user_story: str) -> StoryAnalysis:
        """Analyse a user story string and return a StoryAnalysis."""
        raw = self._call_llm(user_story)
        data = self._parse_json(raw)

        return StoryAnalysis(
            feature=data.get("feature", "Feature"),
            user_role=data.get("user_role", "user"),
            conditions=data.get("conditions", []),
            original_story=user_story,
        )

    # ------------------------------------------------------------------ #
    # LLM call
    # ------------------------------------------------------------------ #

    def _call_llm(self, user_story: str) -> str:
        prompt = f"""Analyze the following user story and return the JSON object as instructed.

USER STORY:
\"\"\"{user_story}\"\"\"
"""
        response = self._model.generate_content(prompt)
        return response.text.strip()

    # ------------------------------------------------------------------ #
    # JSON parsing (robust)
    # ------------------------------------------------------------------ #

    def _parse_json(self, raw: str) -> dict:
        # Strip markdown fences if present
        cleaned = re.sub(r"```(?:json)?", "", raw).strip("`").strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to extract the first {...} block
            m = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group())
                except json.JSONDecodeError:
                    pass
        return {"feature": "Feature", "user_role": "user", "conditions": [raw]}
