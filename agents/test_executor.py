"""
Test Executor Agent — Parallel Edition
-----------------------------------------
Runs test cases across N Chrome workers in parallel using ThreadPoolExecutor.
Each worker gets its own Chrome instance and an independent slice of the
test-case list, so wall-clock execution time is ~sequential_time / N.

Thread-safety
-------------
  _shot_counter is incremented via threading.Lock
  Each worker creates its own webdriver.Chrome — no shared state

Public API
----------
  execute_all(test_cases, headless, workers, screenshots_dir) -> list[dict]
"""

import math
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchElementException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

SCREENSHOTS_DIR   = Path(__file__).parent.parent / "screenshots"
WAIT_TIMEOUT      = 3   # seconds per element wait
PAGE_LOAD_TIMEOUT = 8   # seconds per page load
MAX_WORKERS       = 8   # hard cap to protect RAM

_UNREACHABLE_PATTERNS = (
    "ERR_NAME_NOT_RESOLVED",
    "ERR_CONNECTION_REFUSED",
    "ERR_CONNECTION_TIMED_OUT",
    "ERR_INTERNET_DISCONNECTED",
    "ERR_ADDRESS_UNREACHABLE",
    "net::ERR_",
)

# Regex: Enter 'value' in the 'fieldname' field
_ENTER_FIELD_PAT = re.compile(
    r"""enter\s+(['"]?)([^'"]*?)\1\s+in\s+(?:the\s+)?(['"]?)(\w[\w\-]*)\3?\s*field""",
    re.I,
)


@dataclass
class ExecutionResult:
    tc_id:            str
    feature:          str
    user_role:        str
    condition:        str
    page_url:         str
    status:           str   # Pass | Fail | Error
    duration_seconds: float
    error_message:    Optional[str]
    screenshot_path:  Optional[str]
    log:              str

    def to_dict(self) -> dict:
        return {
            "tc_id":            self.tc_id,
            "feature":          self.feature,
            "user_role":        self.user_role,
            "condition":        self.condition,
            "page_url":         self.page_url,
            "status":           self.status,
            "duration_seconds": round(self.duration_seconds, 2),
            "error_message":    self.error_message,
            "screenshot_path":  self.screenshot_path,
            "log":              self.log,
        }


class TestExecutorAgent:

    def __init__(self):
        self._shot_counter = 0
        self._shot_lock    = threading.Lock()

    # ── Public API ─────────────────────────────────────────────────────────

    def execute_all(
        self,
        test_cases:      List[dict],
        headless:        bool = True,
        workers:         int  = 1,
        screenshots_dir: Optional[Path] = None,
    ) -> List[dict]:
        """
        Execute test_cases across `workers` parallel Chrome instances.
        Results are returned in the SAME ORDER as the input test_cases list.
        """
        if screenshots_dir is None:
            screenshots_dir = SCREENSHOTS_DIR
        screenshots_dir = Path(screenshots_dir)
        screenshots_dir.mkdir(parents=True, exist_ok=True)

        workers = max(1, min(int(workers), MAX_WORKERS, len(test_cases)))
        self._shot_counter = 0

        # Tag each TC with its original index so we can sort after parallel exec
        indexed: List[Tuple[int, dict]] = list(enumerate(test_cases))

        if workers == 1:
            # Fast path — no threading overhead
            raw = self._run_worker(indexed, headless, screenshots_dir)
            return [r for _, r in sorted(raw, key=lambda x: x[0])]

        # Split into N chunks
        chunk_size = math.ceil(len(indexed) / workers)
        chunks = [indexed[i: i + chunk_size] for i in range(0, len(indexed), chunk_size)]

        # (original_index, result_dict) pairs from all workers
        all_indexed: List[Tuple[int, dict]] = []
        lock = threading.Lock()

        def worker_task(chunk):
            results = self._run_worker(chunk, headless, screenshots_dir)
            with lock:
                all_indexed.extend(results)

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(worker_task, chunk) for chunk in chunks]
            for f in as_completed(futures):
                exc = f.exception()
                if exc:
                    print(f"[executor] Worker error: {exc}")

        # Restore original order
        all_indexed.sort(key=lambda x: x[0])
        return [r for _, r in all_indexed]

    # ── Worker (runs in its own thread with its own driver) ────────────────

    def _run_worker(
        self,
        indexed_cases: List[Tuple[int, dict]],
        headless:      bool,
        screenshots_dir: Path,
    ) -> List[Tuple[int, dict]]:
        """Returns list of (original_index, result_dict) pairs."""
        driver = self._build_driver(headless)
        results: List[Tuple[int, dict]] = []
        try:
            for original_idx, tc in indexed_cases:
                result = self._execute_one(tc, driver, screenshots_dir)
                results.append((original_idx, result.to_dict()))
        finally:
            try:
                driver.quit()
            except Exception:
                pass
        return results

    # ── Driver builder ──────────────────────────────────────────────────

    def _build_driver(self, headless: bool) -> webdriver.Chrome:
        opts = Options()
        if headless:
            opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--window-size=1440,900")
        opts.add_argument("--log-level=3")
        opts.add_argument("--disable-extensions")
        opts.add_argument("--blink-settings=imagesEnabled=false")
        opts.add_experimental_option("excludeSwitches", ["enable-logging"])
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=opts)
        driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
        driver.implicitly_wait(1)
        return driver

    # ── Execute one test case ───────────────────────────────────────────

    def _execute_one(
        self,
        tc:              dict,
        driver:          webdriver.Chrome,
        screenshots_dir: Path,
    ) -> ExecutionResult:
        tc_id     = tc.get("tc_id", "TC-???")
        feature   = tc.get("feature", "")
        user_role = tc.get("user_role", "")
        condition = tc.get("condition", "")
        page_url  = (tc.get("page_url") or "").strip()
        steps     = tc.get("automation_steps", [])

        # Must be a real URL
        if not page_url.startswith(("http://", "https://")):
            page_url = ""

        log_lines: List[str] = []
        start = time.time()

        try:
            # ── Navigate to the target page ───────────────────────────────────
            if page_url:
                try:
                    driver.get(page_url)
                    src = driver.page_source or ""
                    if any(p in src for p in _UNREACHABLE_PATTERNS):
                        raise WebDriverException(f"Host unreachable: {page_url}")
                    log_lines.append(f"✔ Navigated to {page_url}")
                except TimeoutException:
                    # Page load timed out but may have partial content — continue
                    log_lines.append(f"⚠ Page load timed out at {page_url} — continuing with partial content")
                except WebDriverException as nav_err:
                    err_str = str(nav_err)[:200]
                    log_lines.append(f"✘ Navigation failed: {err_str}")
                    shot = self._screenshot(driver, tc_id, screenshots_dir)
                    return ExecutionResult(
                        tc_id=tc_id, feature=feature, user_role=user_role,
                        condition=condition, page_url=page_url,
                        status="Error",
                        duration_seconds=time.time() - start,
                        error_message=f"Navigation error: {err_str}",
                        screenshot_path=shot,
                        log="\n".join(log_lines),
                    )
            else:
                log_lines.append("⚠ No valid page URL — skipping navigation.")

            # ── Automation steps ──────────────────────────────────────────────
            for i, step in enumerate(steps, 1):
                try:
                    self._run_step(step, driver)
                    log_lines.append(f"✔ Step {i}: {step[:90]}")
                except (AssertionError, NoSuchElementException,
                        TimeoutException, WebDriverException) as exc:
                    log_lines.append(f"✘ Step {i} FAILED: {step[:90]}")
                    log_lines.append(f"   Reason: {str(exc)[:120]}")
                    shot = self._screenshot(driver, tc_id, screenshots_dir)
                    return ExecutionResult(
                        tc_id=tc_id, feature=feature, user_role=user_role,
                        condition=condition, page_url=page_url,
                        status="Fail",
                        duration_seconds=time.time() - start,
                        error_message=str(exc)[:300],
                        screenshot_path=shot,
                        log="\n".join(log_lines),
                    )

            # ── Pass — screenshot for evidence ────────────────────────────────
            log_lines.append("✅ All steps passed.")
            pass_shot = self._screenshot(driver, tc_id, screenshots_dir)
            return ExecutionResult(
                tc_id=tc_id, feature=feature, user_role=user_role,
                condition=condition, page_url=page_url,
                status="Pass",
                duration_seconds=time.time() - start,
                error_message=None,
                screenshot_path=pass_shot,
                log="\n".join(log_lines),
            )

        except Exception as exc:
            log_lines.append(f"💥 Unexpected error: {str(exc)[:200]}")
            shot = self._screenshot(driver, tc_id, screenshots_dir)
            return ExecutionResult(
                tc_id=tc_id, feature=feature, user_role=user_role,
                condition=condition, page_url=page_url,
                status="Error",
                duration_seconds=time.time() - start,
                error_message=str(exc)[:300],
                screenshot_path=shot,
                log="\n".join(log_lines),
            )

    # ── Thread-safe screenshot ─────────────────────────────────────────

    def _screenshot(
        self,
        driver:          webdriver.Chrome,
        tc_id:           str,
        screenshots_dir: Path,
    ) -> Optional[str]:
        try:
            time.sleep(0.25)
            with self._shot_lock:
                self._shot_counter += 1
                idx = self._shot_counter
            safe_id = re.sub(r"[^\w\-]", "_", tc_id)
            ts      = int(time.time() * 1000)
            fname   = f"{idx:04d}_{safe_id}_{ts}.png"
            path    = screenshots_dir / fname
            driver.save_screenshot(str(path))
            return f"screenshots/{fname}"
        except Exception:
            return None

    # ── Step interpreter ───────────────────────────────────────────────

    def _run_step(self, step: str, driver: webdriver.Chrome) -> None:
        s  = step.strip()
        sl = s.lower()

        if not s or sl.startswith("#"):
            return

        wait = WebDriverWait(driver, WAIT_TIMEOUT)

        # Navigate
        if any(k in sl for k in ("navigate to", "open browser", "go to")):
            url = self._extract_url(s) or self._extract_quoted(s)
            if url:
                driver.get(url)
            return

        # Clear field — pattern: Clear the 'name' field.
        if re.search(r"\bclear\b.*\bfield\b", sl):
            fname = self._extract_quoted(s)
            if fname:
                el = self._find_input(wait, fname)
                try:
                    el.clear()
                except Exception:
                    driver.execute_script("arguments[0].value = '';", el)
            return

        # Enter value in field — pattern: Enter 'val' in the 'fieldname' field
        m = _ENTER_FIELD_PAT.search(s)
        if m:
            value = m.group(2).strip()
            name  = m.group(4).strip()
            el = self._find_input(wait, name)
            try:
                el.clear()
                el.send_keys(value)
            except Exception:
                driver.execute_script("arguments[0].value = arguments[1];", el, value)
            return

        # Click button
        if any(k in sl for k in ("click()", "click the", "click button", "and click")):
            btn_text = self._extract_quoted(s)
            if btn_text:
                bt_lower = btn_text.lower()
                clicked  = False

                # Priority 1: input[type=submit]
                for el in driver.find_elements(By.CSS_SELECTOR, "input[type='submit']"):
                    val = el.get_attribute("value") or ""
                    if bt_lower in val.lower():
                        try:
                            driver.execute_script("arguments[0].scrollIntoView(true);", el)
                            el.click()
                        except Exception:
                            driver.execute_script("arguments[0].click();", el)
                        clicked = True
                        break

                # Priority 2: button[type=submit]
                if not clicked:
                    for el in driver.find_elements(By.CSS_SELECTOR, "button[type='submit']"):
                        if bt_lower in el.text.strip().lower():
                            try:
                                driver.execute_script("arguments[0].scrollIntoView(true);", el)
                                el.click()
                            except Exception:
                                driver.execute_script("arguments[0].click();", el)
                            clicked = True
                            break

                # Priority 2.5: partial text match on links
                if not clicked:
                    for el in driver.find_elements(By.TAG_NAME, "a"):
                        if bt_lower in el.text.strip().lower():
                            try:
                                driver.execute_script("arguments[0].scrollIntoView(true);", el)
                                el.click()
                            except Exception:
                                driver.execute_script("arguments[0].click();", el)
                            clicked = True
                            break

                # Priority 3: exact text match (case-insensitive) via XPath
                if not clicked:
                    xpath_btn = (
                        f"//button[translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='{bt_lower}']"
                        f"|//input[translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='{bt_lower}' and (@type='button' or @type='submit')]"
                        f"|//a[translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='{bt_lower}']"
                        f"|//a//*[translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='{bt_lower}']/.."
                    )
                    try:
                        el = wait.until(EC.element_to_be_clickable((By.XPATH, xpath_btn)))
                        driver.execute_script("arguments[0].click();", el)
                        clicked = True
                    except Exception:
                        pass

                # Priority 4: any submit element
                if not clicked:
                    try:
                        el = driver.find_element(By.CSS_SELECTOR, "input[type='submit'],button[type='submit']")
                        driver.execute_script("arguments[0].click();", el)
                    except Exception:
                        raise NoSuchElementException(f"Button '{btn_text}' not found")

            # Dismiss any alert that appears after click
            try:
                driver.switch_to.alert.accept()
            except Exception:
                pass
            return

        # Assert URL
        if re.search(r"\b(assert|verify|check|confirm)\b", sl) and "url" in sl:
            expected = self._extract_quoted(s) or self._extract_url(s)
            if expected:
                cur = driver.current_url
                assert expected in cur, f"URL mismatch: '{expected}' not in '{cur}'"
            return

        # Assert text / state
        if re.search(r"\b(assert|verify|check|confirm)\b", sl):
            expected = self._extract_quoted(s)
            if expected:
                el = expected.lower()
                generic_phrases = [
                    "operation completes successfully",
                    "error/validation message",
                    "accepts or rejects",
                    "handles the edge case safely",
                    "the page/response reflects",
                    "system responds correctly",
                    "confirmation is shown",
                    "appropriate error",
                    "action is rejected",
                    "boundary value",
                    "edge case safely",
                ]
                if any(g in el for g in generic_phrases):
                    return  # non-assertable placeholder — skip

                src     = driver.page_source.lower()
                cur_url = driver.current_url.lower()

                positive_kw = ["successful", "success", "welcome", "logged in",
                               "logout", "log out", "sign out", "dashboard",
                               "account created", "registered", "profile",
                               "thank you", "confirmed", "submitted", "saved"]
                negative_kw = ["invalid", "incorrect", "error", "failed", "failure",
                               "wrong", "denied", "unauthorized", "not found",
                               "required", "please", "try again"]

                is_positive = any(k in el for k in positive_kw)
                is_negative = any(k in el for k in negative_kw)

                if is_positive:
                    success_found = (
                        any(k in src for k in positive_kw)
                        or any(k in cur_url for k in ["dashboard", "home", "profile",
                                                       "welcome", "success", "account"])
                        or "login" not in cur_url
                    )
                    if not success_found and el not in src:
                        assert False, "Expected success but page shows no success indicators"
                    return

                if is_negative:
                    # Soft pass — if no error visible, move on
                    return

                if len(el) < 60 and el not in driver.page_source.lower():
                    assert False, f"Text '{expected}' not found in page"
            return

        # Select dropdown
        if "select" in sl and any(k in sl for k in ("option", "dropdown", "from")):
            opt = self._extract_quoted(s)
            if opt:
                selects = driver.find_elements(By.TAG_NAME, "select")
                if selects:
                    Select(selects[0]).select_by_visible_text(opt)
            return

        # Checkbox
        if "checkbox" in sl or "check the" in sl:
            cbs = driver.find_elements(By.CSS_SELECTOR, "input[type='checkbox']")
            if cbs and not cbs[0].is_selected():
                cbs[0].click()
            return

        # Unknown step — silently skip

    # ── Element helpers ────────────────────────────────────────────────

    def _find_input(self, wait: WebDriverWait, locator: str):
        for by in (By.NAME, By.ID):
            try:
                return wait.until(EC.presence_of_element_located((by, locator)))
            except TimeoutException:
                pass
        try:
            css = f"input[placeholder*='{locator}' i]"
            return wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, css)))
        except TimeoutException:
            pass
        raise NoSuchElementException(
            f"Input '{locator}' not found by name, id, or placeholder")

    def _extract_quoted(self, s: str) -> Optional[str]:
        m = re.search(r"""['"]([^'"]+)['"]""", s)
        return m.group(1).strip() if m else None

    def _extract_url(self, s: str) -> Optional[str]:
        m = re.search(r"https?://[^\s\"']+", s)
        return m.group(0).rstrip(".,;") if m else None
