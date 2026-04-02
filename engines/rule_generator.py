"""
Rule-Based Test Case Generator (fallback engine)
-------------------------------------------------
Converts a StoryAnalysis into a full TestSuite — no LLM needed.
"""

from models.story_model import StoryAnalysis, TestCase, TestSuite


class RuleGenerator:

    NEGATIVE_KW = ["invalid", "wrong", "empty", "blank", "missing", "error", "rejected",
                   "fail", "no ", "without", "not ", "expired", "duplicate", "exceed",
                   "locked", "disabled", "below", "unregistered"]
    BOUNDARY_KW = ["minimum", "maximum", "exactly", "at least", "at most", "length",
                   "size", "limit", "min", "max"]
    EDGE_KW     = ["special char", "sql injection", "xss", "whitespace", "emoji",
                   "concurrent", "timeout", "network", "interrupt", "very long", "script"]

    def generate(self, analysis: StoryAnalysis) -> TestSuite:
        suite = TestSuite(feature=analysis.feature, user_role=analysis.user_role)
        for idx, condition in enumerate(analysis.conditions, 1):
            suite.test_cases.append(self._build(idx, condition, analysis.feature, analysis.user_role))
        return suite

    def _classify(self, c):
        cl = c.lower()
        if any(k in cl for k in self.EDGE_KW):    return "Edge Case", "Medium"
        if any(k in cl for k in self.BOUNDARY_KW): return "Boundary",  "Medium"
        if any(k in cl for k in self.NEGATIVE_KW): return "Negative",  "High"
        return "Positive", "High"

    def _build(self, idx, condition, feature, role):
        tc_type, priority = self._classify(condition)
        parts = condition.split("→")
        title_raw = parts[0].strip()
        expected_hint = parts[1].strip() if len(parts) > 1 else ""

        return TestCase(
            id=f"TC-{idx:03d}",
            title=f"{feature}: {title_raw}",
            type=tc_type,
            priority=priority,
            preconditions=self._preconditions(feature, role),
            steps=self._steps(title_raw, feature),
            expected_result=self._expected(expected_hint, tc_type, feature, condition),
        )

    def _preconditions(self, feature, role):
        base = ["Application is running and accessible", f"User has '{role}' role"]
        f = feature.lower()
        if f in ("login", "password reset"):
            base.append("A registered test account exists with known credentials")
        elif f in ("checkout", "cart", "booking", "job application"):
            base += ["User is logged in", "Required items/services are available"]
        elif f in ("job posting", "admin panel"):
            base.append("User has recruiter/admin privileges and is logged in")
        elif f in ("profile", "messaging", "notification", "logout"):
            base.append("User is logged in")
        elif f == "search":
            base.append("Database contains relevant test data")
        return base

    def _steps(self, condition_text, feature):
        f = feature.lower()
        c = condition_text.lower()
        if f == "login":
            if "empty email" in c or "empty username" in c:
                return ["Navigate to the login page", "Leave the email/username field empty",
                        "Enter a valid password", "Click 'Login'"]
            if "empty password" in c:
                return ["Navigate to the login page", "Enter a valid email/username",
                        "Leave the password field empty", "Click 'Login'"]
            if "sql injection" in c:
                return ["Navigate to the login page",
                        "Enter SQL injection payload in email field (e.g. ' OR '1'='1)",
                        "Enter any value in password", "Click 'Login'"]
            if "locked" in c or "disabled" in c:
                return ["Navigate to the login page",
                        "Enter username of a locked/disabled account",
                        "Enter the correct password", "Click 'Login'"]
            return ["Navigate to the login page",
                    "Enter the test email in the email field",
                    "Enter the test password in the password field",
                    "Click the 'Login' button"]
        if f in ("job application", "job posting"):
            return [f"Log in as a {feature.lower()} user",
                    f"Navigate to the {feature} page",
                    f"Fill in the form as per condition: '{condition_text}'",
                    "Click the 'Submit' / 'Publish' button"]
        return [f"Navigate to the {feature} page",
                f"Perform the action: '{condition_text}'",
                "Submit or confirm the action",
                "Observe the system response"]

    def _expected(self, hint, tc_type, feature, full):
        if hint:
            return hint[0].upper() + hint[1:]
        c = full.lower()
        if tc_type == "Positive":
            return f"{feature} operation completes successfully; confirmation is shown."
        if "empty" in c or "missing" in c:
            return "Inline validation error is shown; form is NOT submitted."
        if "invalid" in c or "incorrect" in c:
            return "Appropriate error message is displayed; action is rejected."
        if "sql injection" in c or "xss" in c:
            return "Input is safely sanitised; no script executes; no DB error exposed."
        if "exceed" in c or "maximum" in c:
            return "Input is rejected with a message indicating the limit was exceeded."
        if "minimum" in c or "boundary" in c:
            return "Input at the boundary is accepted/rejected correctly per specification."
        if "locked" in c or "disabled" in c:
            return "Login is rejected; informative account-status message is shown."
        return "System responds correctly as per the specification for this condition."
