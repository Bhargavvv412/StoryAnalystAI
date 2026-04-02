"""
Rule-Based Story Analyst (fallback engine)
------------------------------------------
Works entirely offline — no LLM needed.
"""

import re
from models.story_model import StoryAnalysis


class RuleAnalyst:

    FEATURE_KEYWORDS = {
        "Login": ["login", "sign in", "signin", "log in", "authenticate"],
        "Registration": ["register", "sign up", "signup", "create account"],
        "Search": ["search", "find", "filter", "query", "look up"],
        "Checkout": ["checkout", "purchase", "buy", "order", "payment"],
        "Password Reset": ["reset password", "forgot password", "change password"],
        "Job Application": ["apply", "job application", "submit application"],
        "Job Posting": ["post a job", "job listing", "create job", "add job"],
        "Profile": ["profile", "account settings", "update profile"],
        "Upload": ["upload", "attach file", "import file"],
        "Download": ["download", "export"],
        "Logout": ["logout", "sign out", "log out"],
        "Booking": ["book", "reserve", "schedule", "appointment"],
        "Cart": ["cart", "basket", "add to cart"],
        "Messaging": ["message", "chat", "inbox", "send message"],
        "Notification": ["notification", "alert", "notify"],
        "Admin Panel": ["admin", "manage users", "moderate", "dashboard"],
    }

    ROLE_PATTERNS = [
        r"as an?\s+([a-zA-Z\s]+?)(?:,|\s+i\s+want|\s+i\s+would|\s+i\s+can|\s+i\s+need)",
    ]

    def analyze(self, user_story: str) -> StoryAnalysis:
        sl = user_story.lower()
        feature = self._detect_feature(sl)
        role = self._detect_role(sl)
        conditions = self._get_conditions(feature)
        return StoryAnalysis(feature=feature, user_role=role, conditions=conditions, original_story=user_story)

    def _detect_feature(self, sl):
        for name, kws in self.FEATURE_KEYWORDS.items():
            if any(kw in sl for kw in kws):
                return name
        m = re.search(r"(?:want to|able to|can)\s+([a-zA-Z\s]{3,25}?)(?:\s+so that|\.|$)", sl)
        return m.group(1).strip().title() if m else "Feature"

    def _detect_role(self, sl):
        for p in self.ROLE_PATTERNS:
            m = re.search(p, sl)
            if m:
                role = re.sub(r"\b(the|a|an)\b", "", m.group(1)).strip()
                if role:
                    return role.lower()
        for kw in ["admin", "recruiter", "employer", "job seeker", "candidate", "guest"]:
            if kw in sl:
                return kw
        return "user"

    def _get_conditions(self, feature):
        f = feature.lower()
        DB = {
            "login": [
                "valid email and valid password → successful login",
                "valid email and invalid password → error message shown",
                "invalid email and valid password → error message shown",
                "empty email field → validation error",
                "empty password field → validation error",
                "both fields empty → validation error",
                "email without @ symbol → rejected",
                "password at minimum allowed length → accepted",
                "password exceeding maximum length → rejected",
                "username with special characters → handled per policy",
                "SQL injection in email field → safely handled",
                "XSS script in email field → safely handled",
                "whitespace-only password → rejected",
                "multiple failed attempts (5+) → account locked or CAPTCHA triggered",
                "locked/disabled account login → appropriate error",
                "login from multiple browsers simultaneously → handled",
                "session expires → redirect to login page",
                "password field masks characters",
                "remember-me checkbox persists session",
                "forgot-password link navigates correctly",
            ],
            "registration": [
                "all valid fields → account created successfully",
                "empty first name → validation error",
                "empty last name → validation error",
                "empty email → validation error",
                "empty password → validation error",
                "empty confirm-password → validation error",
                "email without @ → rejected",
                "duplicate email address → rejected with message",
                "password shorter than minimum length → rejected",
                "password and confirm-password mismatch → rejected",
                "name exceeding maximum length → rejected",
                "phone number with non-numeric characters → rejected",
                "name with special characters/emojis → handled",
                "SQL injection in email → safely handled",
                "submitting without accepting terms → rejected",
                "confirmation email sent after successful registration",
                "expired verification link → appropriate error",
            ],
            "search": [
                "valid keyword matching results → results displayed",
                "keyword with no matches → 'no results found' message",
                "empty search field → validation error or all results shown",
                "whitespace-only search → treated as empty",
                "partial keyword → relevant results shown",
                "keyword with special characters → safely handled",
                "SQL injection in search field → safely handled",
                "very long search string (>255 chars) → truncated or rejected",
                "apply filter with valid criteria → filtered results",
                "apply multiple filters → correctly combined",
                "clear filters → original results restored",
                "navigate to next/previous page of results",
                "search result count matches actual results",
                "search returns within acceptable response time",
            ],
            "job application": [
                "all required fields valid → application submitted successfully",
                "empty name field → validation error",
                "empty email field → validation error",
                "invalid email format → validation error",
                "invalid resume file type → rejected",
                "resume exceeding size limit → rejected",
                "resume at exactly maximum size → accepted",
                "submitting without resume (if required) → validation error",
                "cover letter exceeding character limit → rejected",
                "applying to a closed/expired job → appropriate error",
                "applying to the same job twice → duplicate application handled",
                "applying without being logged in → redirected to login",
                "confirmation message shown after successful application",
                "confirmation email sent to applicant",
            ],
            "job posting": [
                "all valid fields → job posted successfully",
                "empty job title → validation error",
                "empty job description → validation error",
                "empty location → validation error",
                "salary field with non-numeric value → rejected",
                "negative salary value → rejected",
                "job title exceeding maximum length → rejected",
                "description exceeding maximum length → rejected",
                "posting with past expiry date → rejected",
                "posting with future expiry date → accepted",
                "job appears in search results after posting",
                "recruiter can edit a posted job",
                "recruiter can delete a posted job",
            ],
            "password reset": [
                "valid registered email → reset link sent",
                "unregistered email → generic message (no account reveal)",
                "empty email field → validation error",
                "invalid email format → validation error",
                "reset link works within expiry window",
                "expired reset link → appropriate error",
                "reset link used more than once → rejected",
                "new password same as old → rejected or allowed per policy",
                "new password below minimum length → rejected",
                "new and confirm password mismatch → rejected",
                "valid new password → updated and confirmation shown",
                "login with old password after reset → rejected",
                "login with new password after reset → successful",
            ],
        }
        for key in DB:
            if key in f:
                return DB[key]
        return [
            f"all required fields valid → {feature} successful",
            f"one required field empty → validation error",
            f"all required fields empty → validation error",
            f"input at minimum allowed length → accepted",
            f"input at maximum allowed length → accepted",
            f"input exceeding maximum length → rejected",
            f"input with special characters → handled per policy",
            f"SQL injection attempt → safely handled",
            f"XSS script attempt → safely handled",
            f"duplicate submission → handled gracefully",
            f"network failure during action → error handled",
            f"unauthenticated user attempts {feature} → redirected to login",
            f"success confirmation shown after {feature}",
        ]
