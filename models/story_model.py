"""
Data models for the Story Analyst + Test Case Generator system.
"""

from dataclasses import dataclass, field
from typing import List
import json


@dataclass
class StoryAnalysis:
    """Result produced by the StoryAnalystAgent."""
    feature: str
    user_role: str
    conditions: List[str]
    original_story: str = ""

    def to_dict(self) -> dict:
        return {
            "feature": self.feature,
            "user_role": self.user_role,
            "conditions": self.conditions,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)


@dataclass
class TestCase:
    """A single generated test case."""
    id: str
    title: str
    type: str          # "Positive", "Negative", "Boundary", "Edge Case"
    preconditions: List[str]
    steps: List[str]
    expected_result: str
    priority: str      # "High", "Medium", "Low"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "type": self.type,
            "preconditions": self.preconditions,
            "steps": self.steps,
            "expected_result": self.expected_result,
            "priority": self.priority,
        }


@dataclass
class TestSuite:
    """Collection of test cases for a feature."""
    feature: str
    user_role: str
    test_cases: List[TestCase] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "feature": self.feature,
            "user_role": self.user_role,
            "total_test_cases": len(self.test_cases),
            "test_cases": [tc.to_dict() for tc in self.test_cases],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)
