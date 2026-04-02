"""
Combined Test Case Generator Agent
------------------------------------
Combines:
  - story_data  → feature, user_role, conditions  (from StoryAnalystAgent)
  - page_data   → pages, forms, fields, buttons, links  (from WebsiteExplorerAgent)

For each condition, matches it to real UI elements and generates:
  - manual_steps      (human tester instructions)
  - automation_steps  (code-style instructions for a test executor)

No LLM required — fully rule-based so it works even when quota is exhausted.
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class CombinedTestCase:
    tc_id: str
    feature: str
    user_role: str
    condition: str
    page_url: str
    page_title: str
    form_name: str
    type: str        # Positive | Negative | Boundary | Edge Case
    priority: str    # High | Medium | Low
    manual_steps: List[str]
    automation_steps: List[str]
    mapped: bool = True   # False if no page/form could be matched

    def to_dict(self) -> dict:
        return {
            "tc_id":            self.tc_id,
            "feature":          self.feature,
            "user_role":        self.user_role,
            "condition":        self.condition,
            "page_url":         self.page_url,
            "page_title":       self.page_title,
            "form_name":        self.form_name,
            "type":             self.type,
            "priority":         self.priority,
            "manual_steps":     self.manual_steps,
            "automation_steps": self.automation_steps,
            "mapped":           self.mapped,
        }


class CombinedGeneratorAgent:

    # ── Negative/Boundary/Edge keywords ────────────────────────────────────
    NEGATIVE_KW = ["invalid", "wrong", "empty", "blank", "missing", "error",
                   "rejected", "fail", "no ", "without", "not ", "expired",
                   "duplicate", "exceed", "locked", "disabled", "below",
                   "unregistered", "incorrect"]
    BOUNDARY_KW = ["minimum", "maximum", "exactly", "at least", "at most",
                   "length", "size", "limit", "min", "max", "boundary"]
    EDGE_KW     = ["special char", "sql injection", "xss", "whitespace",
                   "emoji", "concurrent", "timeout", "network", "interrupt",
                   "very long", "script", "injection"]

    def generate(self, story_data: dict, page_data: dict) -> List[dict]:
        """
        Main entry point.

        story_data keys: feature, user_role, conditions (list[str])
        page_data  keys: start_url, pages (list of page objects)

        Returns list of CombinedTestCase dicts.
        """
        feature   = story_data.get("feature", "Feature")
        user_role = story_data.get("user_role", "user")
        conditions = story_data.get("conditions", [])
        pages      = page_data.get("pages", [])
        # IMPORTANT: We always navigate to the ROOT URL only.
        # Sub-pages are used only for form/field matching, never as navigation targets.
        start_url  = page_data.get("start_url", "") or (pages[0].get("url", "") if pages else "")

        test_cases = []
        for idx, condition in enumerate(conditions, 1):
            if len(test_cases) >= 1000:
                break
                
            tc_id = f"TC-{len(test_cases)+1:03d}"
            page, form = self._match(condition, feature, pages)
            tc_type, priority = self._classify(condition)

            if page is None:
                tc = self._build_unmapped(tc_id, feature, user_role, condition,
                                          tc_type, priority, start_url)
            else:
                tc = self._build_mapped(tc_id, feature, user_role, condition,
                                        tc_type, priority, page, form, start_url)
            test_cases.append(tc.to_dict())

        # Generate exhaustive combinatorial test cases for each matched form
        for page in pages:
            for form in page.get("forms", []):
                tcs = self._generate_exhaustive_for_form(feature, user_role, page, form, len(test_cases) + 1, start_url)
                for tc in tcs:
                    if len(test_cases) >= 1000:
                        break
                    test_cases.append(tc)
                if len(test_cases) >= 1000:
                    break
            if len(test_cases) >= 1000:
                break

        return test_cases

    def _generate_exhaustive_for_form(self, feature, user_role, page, form, start_idx, start_url=""):
        tcs = []
        idx = start_idx
        form_name = form.get("name", "form")
        fields = form.get("fields", [])
        
        if not fields:
            return tcs
            
        variations = [
            ("Empty", "EXHAUSTIVE_TARGET:{fname} | leave empty/blank", "Negative", "High"),
            ("Missing", "EXHAUSTIVE_TARGET:{fname} | missing value", "Negative", "High"),
            ("Invalid Format", "EXHAUSTIVE_TARGET:{fname} | invalid format", "Negative", "High"),
            ("SQL Injection", "EXHAUSTIVE_TARGET:{fname} | SQL injection payload", "Edge Case", "Medium"),
            ("XSS", "EXHAUSTIVE_TARGET:{fname} | XSS script payload", "Edge Case", "Medium"),
            ("Special Chars", "EXHAUSTIVE_TARGET:{fname} | special characters", "Edge Case", "Low"),
            ("Very Long", "EXHAUSTIVE_TARGET:{fname} | very long string exceeding limits", "Edge Case", "Medium"),
            ("Whitespace", "EXHAUSTIVE_TARGET:{fname} | whitespace only", "Negative", "Medium"),
            ("Minimum Boundary", "EXHAUSTIVE_TARGET:{fname} | minimum boundary value", "Boundary", "Medium"),
            ("Maximum Boundary", "EXHAUSTIVE_TARGET:{fname} | maximum boundary value", "Boundary", "Medium"),
        ]
        
        for fld in fields:
            fname = fld.get("name") or fld.get("type", "field")
            for var_name, action_hint_template, tc_type, priority in variations:
                action_hint = action_hint_template.replace("{fname}", fname)
                mock_cond = f"{action_hint} → System handles the edge case safely"
                
                tc = self._build_mapped(
                    f"TC-{idx:03d}", feature, user_role, mock_cond,
                    tc_type, priority, page, form, start_url
                )
                
                tc.condition = f"[Exhaustive - {form_name}] Field '{fname}': {var_name}"
                tcs.append(tc.to_dict())
                idx += 1
                if len(tcs) > 1000:
                    return tcs
                    
        # Add form-wide extreme variations
        form_variations = [
            ("All Fields Empty", "EXHAUSTIVE_TARGET:.* | leave empty/blank", "Negative", "High"),
            ("All Fields SQL Injection", "EXHAUSTIVE_TARGET:.* | SQL injection payload", "Edge Case", "High"),
            ("All Fields XSS", "EXHAUSTIVE_TARGET:.* | XSS script payload", "Edge Case", "High"),
            ("All Fields Very Long", "EXHAUSTIVE_TARGET:.* | very long string exceeding limits", "Edge Case", "High")
        ]
        for var_name, action_hint, tc_type, priority in form_variations:
            mock_cond = f"{action_hint} → System handles the edge case safely"
            tc = self._build_mapped(
                f"TC-{idx:03d}", feature, user_role, mock_cond,
                tc_type, priority, page, form, start_url
            )
            tc.condition = f"[Exhaustive - {form_name}] Form-Wide: {var_name}"
            tcs.append(tc.to_dict())
            idx += 1
            if len(tcs) > 1000:
                break
                
        return tcs

    # ── Condition → Page/Form matcher ──────────────────────────────────────
    def _match(self, condition: str, feature: str, pages: list):
        """Return (page_dict, form_dict|None) best matching this condition."""
        cl  = condition.lower()
        fl  = feature.lower()

        # Score each page
        best_page  = None
        best_form  = None
        best_score = -1

        for page in pages:
            score = 0
            url_l  = page.get("url", "").lower()
            title_l = page.get("title", "").lower()

            # URL/title keyword match
            feature_words = re.findall(r'\w+', fl)
            for w in feature_words:
                if len(w) > 3 and (w in url_l or w in title_l):
                    score += 3

            # Condition word match on url/title
            cond_words = re.findall(r'\w+', cl)
            for w in cond_words:
                if len(w) > 3 and (w in url_l or w in title_l):
                    score += 1

            # Check forms for field name matches
            best_form_for_page = None
            best_form_score = -1
            for form in page.get("forms", []):
                fs = 0
                for fld in form.get("fields", []):
                    fname = (fld.get("name","") + " " + fld.get("type","")).lower()
                    if any(w in fname for w in cond_words if len(w) > 2):
                        fs += 2
                if fs > best_form_score:
                    best_form_score = fs
                    best_form_for_page = form
                score += fs

            if score > best_score:
                best_score = score
                best_page = page
                best_form = best_form_for_page

        if best_score <= 0:
            # Fall back: use first page that has any form, else first page
            for page in pages:
                if page.get("forms"):
                    return page, page["forms"][0]
            return (pages[0] if pages else None), None

        return best_page, best_form

    # ── Classify condition type ────────────────────────────────────────────
    def _classify(self, condition: str):
        cl = condition.lower()
        if any(k in cl for k in self.EDGE_KW):    return "Edge Case", "Medium"
        if any(k in cl for k in self.BOUNDARY_KW): return "Boundary",  "Medium"
        if any(k in cl for k in self.NEGATIVE_KW): return "Negative",  "High"
        return "Positive", "High"

    # ── Build a mapped test case ───────────────────────────────────────────
    def _build_mapped(self, tc_id, feature, user_role, condition,
                      tc_type, priority, page, form, start_url="") -> CombinedTestCase:
        # Use the ACTUAL page where the form/content was found.
        # The executor will navigate directly there. If it's a sub-page of start_url
        # it will be reachable. Falling back to start_url only if page URL is empty.
        page_url   = page.get("url", "") or start_url
        page_title = page.get("title", "Page")
        form_name  = form.get("name", "form") if form else "—"
        fields     = form.get("fields", []) if form else []
        buttons    = form.get("buttons", []) if form else []

        manual_steps, auto_steps = self._generate_steps(
            condition, page_url, page_title, form_name, fields, buttons, tc_type,
            start_url=start_url
        )

        return CombinedTestCase(
            tc_id=tc_id, feature=feature, user_role=user_role,
            condition=condition, page_url=page_url, page_title=page_title,
            form_name=form_name, type=tc_type, priority=priority,
            manual_steps=manual_steps, automation_steps=auto_steps,
            mapped=True,
        )

    # ── Build an unmapped test case ────────────────────────────────────────
    def _build_unmapped(self, tc_id, feature, user_role, condition,
                        tc_type, priority, start_url) -> CombinedTestCase:
        note = "⚠️ Assumption: No matching page/form found in explored data. Generic steps used."
        manual = [
            f"Open the browser and navigate to {start_url or 'the application'}.",
            f"Locate the area related to '{feature}'.",
            f"Perform the action: {condition.split('→')[0].strip()}.",
            "Submit or confirm the action.",
            f"Verify: {condition.split('→')[1].strip() if '→' in condition else 'system responds correctly'}.",
            note,
        ]
        auto = [
            f"Open browser and navigate to {start_url or 'the application URL'}.",
            f"Locate element related to '{feature}' feature.",
            f"Perform action for condition: {condition.split('→')[0].strip()}.",
            "Submit the form or trigger the action.",
            "Assert the response matches the expected outcome.",
            f"# {note}",
        ]
        return CombinedTestCase(
            tc_id=tc_id, feature=feature, user_role=user_role,
            condition=condition, page_url=start_url, page_title="Unknown",
            form_name="—", type=tc_type, priority=priority,
            manual_steps=manual, automation_steps=auto, mapped=False,
        )

    # ── Step generation ────────────────────────────────────────────────────
    def _generate_steps(self, condition, url, page_title, form_name, fields, buttons,
                        tc_type, start_url=""):
        parts        = condition.split("→")
        action_hint  = parts[0].strip().lower()
        outcome_hint = parts[1].strip() if len(parts) > 1 else ""

        # ── Smart navigation ────────────────────────────────────────────────────
        # If the target page is a sub-page, navigate through the home page first
        # This handles cases like: home page → click 'Sign Up' link → signup form
        is_subpage = start_url and url and url != start_url and url.startswith(start_url.rstrip("/"))

        if is_subpage:
            # Generate nav-link keyword from page title / URL path
            nav_hint = self._nav_hint_from_url(url, page_title)
            manual = [
                f"Open the browser and navigate to {start_url}.",
                f"On the home page, look for a '{nav_hint}' link or button in the navigation and click it.",
                f"Confirm you are now on the '{page_title}' page ({url}).",
            ]
            auto = [
                f"Open browser and navigate to '{start_url}'.",
                f"Find link or button with text '{nav_hint}' and click().",
                f"Open browser and navigate to '{url}'."  # fallback direct nav
            ]
        else:
            manual = [f"Open the browser and navigate to {url}."]
            auto   = [f"Open browser and navigate to '{url}'."]

        # ── Form field steps ─────────────────────────────────────────────────────
        if fields:
            for fld in fields:
                fname = fld.get("name", fld.get("type", "field"))
                ftype = fld.get("type", "text")
                value = self._pick_value(fname, ftype, action_hint, tc_type)
                manual.append(
                    f"In the '{form_name}' form, locate the '{fname}' field ({ftype}) "
                    f"and enter: {value if value != '' else '(leave empty)'}."
                )
                if value == "":
                    auto.append(f"Clear the '{fname}' field.")
                else:
                    auto.append(f"Enter '{value}' in the '{fname}' field.")
        else:
            manual.append(f"Locate the relevant input area on '{page_title}'.")
            auto.append(f"# No form fields extracted — locate inputs manually on {url}.")

        # ── Submit + assertion ──────────────────────────────────────────────────
        btn_text = buttons[0]["text"] if buttons else "Submit"
        manual.append(f"Click the '{btn_text}' button.")
        auto.append(f"Find button with text '{btn_text}' and click().")

        expected = outcome_hint or self._default_expected(tc_type, condition)
        manual.append(f"Verify that: {expected}.")
        auto.append(f"Assert that the page/response reflects: '{expected}'.")

        return manual, auto

    def _nav_hint_from_url(self, url: str, page_title: str) -> str:
        """Derive a natural navigation link text from the page URL or title."""
        # Prefer page title words (e.g. 'Sign Up', 'Register', 'Login')
        if page_title and page_title.lower() not in ("page", "unknown", ""):
            return page_title
        # Fallback: last segment of the URL path
        try:
            from urllib.parse import urlparse
            path = urlparse(url).path.rstrip("/")
            segment = path.split("/")[-1].replace("-", " ").replace("_", " ").title()
            if segment:
                return segment
        except Exception:
            pass
        return "Sign Up"

    def _pick_value(self, fname: str, ftype: str, action_hint: str, tc_type: str) -> str:
        """Choose a realistic test value for a field based on condition context.
        Returns a BARE string (no surrounding quotes) — the caller embeds it.
        """
        fl = fname.lower()
        al = action_hint.lower()

        # Determine if this field is the one being tested negatively
        is_targeted = f"exhaustive_target:{fl}" in al
        if not is_targeted and "exhaustive_target" not in al:
            # Fall back to heuristic for LLM conditions
            core_kw = fl.replace("login", "").replace("signup", "").replace("user", "")[:4]
            is_targeted = core_kw in al if len(core_kw) > 0 else True

        if tc_type in ("Negative", "Edge Case") and is_targeted:
            if "empty" in al or "blank" in al or "missing" in al:
                return ""  # intentionally empty — leave blank
            if "sql" in al or "injection" in al:
                return "' OR '1'='1"
            if "xss" in al or "script" in al:
                return "<script>alert(1)</script>"
            if "special" in al:
                return "!@#$%^&*()"
            if "very long" in al or "exceed" in al:
                return "A" * 300  # 300-character string for boundary test
            if "whitespace" in al:
                return "   "
            if ftype == "email":
                return "not-a-valid-email"
            if ftype == "password":
                return "wrongpassword123"
            return "invalid_test_value"

        if tc_type == "Boundary" and is_targeted:
            if "minimum" in al or "min" in al:
                return "a"  # 1 character — minimum boundary
            if "maximum" in al or "max" in al:
                return "A" * 255  # at max boundary
            return "boundary_value"

        # Positive — realistic values (no surrounding quotes)
        if ftype == "email":     return "testuser@example.com"
        if ftype == "password":  return "ValidPass@123"
        if ftype == "tel":       return "9876543210"
        if ftype == "number":    return "42"
        if ftype == "checkbox":  return "check the checkbox"
        if ftype == "select":    return "select a valid option from dropdown"
        if "name" in fl:         return "John Doe"
        if "user" in fl:         return "testuser"
        if "title" in fl:        return "Senior Software Engineer"
        if "desc" in fl or "bio" in fl: return "Sample description text"
        if "salary" in fl or "pay" in fl: return "75000"
        if "location" in fl or "city" in fl: return "New York, NY"
        return f"{fname}_test_value"

    def _default_expected(self, tc_type: str, condition: str) -> str:
        if tc_type == "Positive":
            return "the operation completes successfully and a confirmation is shown"
        if tc_type == "Negative":
            return "an appropriate error/validation message is displayed and the action is rejected"
        if tc_type == "Boundary":
            return "the system accepts or rejects the input correctly at the boundary value"
        return "the system handles the edge case safely without errors or security issues"
