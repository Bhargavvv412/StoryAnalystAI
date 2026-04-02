"""
Website Explorer Agent
-----------------------
Crawls a given URL (static scraping — no JS execution) and extracts:
  - Pages (start URL + direct internal links)
  - Forms (with fields: name, type, required)
  - Buttons
  - Navigation links

Uses requests + BeautifulSoup. No LLM needed.
"""

import re
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


class WebsiteExplorerAgent:
    """
    Crawls a URL up to a configurable depth and returns a structured
    dict describing pages, forms, buttons, and links.
    """

    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    TIMEOUT = 10  # seconds per request
    MAX_PAGES = 6  # max internal pages to crawl

    def explore(self, start_url: str, depth: int = 1) -> dict:
        """
        Main entry point.
        depth=0 → only the start page
        depth=1 → start page + its direct internal links (default)
        """
        start_url = self._normalise(start_url)
        base_domain = urlparse(start_url).netloc

        visited = set()
        queue = [(start_url, 0)]
        pages = []

        while queue and len(visited) < self.MAX_PAGES:
            url, current_depth = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)

            page_data = self._scrape_page(url)
            pages.append(page_data)

            # Queue internal links for next depth level
            if current_depth < depth:
                for link in page_data.get("links", []):
                    href = link.get("href", "")
                    if href and urlparse(href).netloc == base_domain and href not in visited:
                        queue.append((href, current_depth + 1))

        return {"start_url": start_url, "pages": pages}

    # ── Scrape a single page ───────────────────────────────────────────────

    def _scrape_page(self, url: str) -> dict:
        try:
            resp = requests.get(url, headers=self.HEADERS, timeout=self.TIMEOUT)
            resp.raise_for_status()
            html = resp.text
        except requests.RequestException as exc:
            return {
                "url": url,
                "title": "Error",
                "error": str(exc),
                "forms": [],
                "links": [],
            }

        soup = BeautifulSoup(html, "html.parser")
        base = "{uri.scheme}://{uri.netloc}".format(uri=urlparse(url))

        return {
            "url": url,
            "title": self._get_title(soup),
            "forms": self._get_forms(soup),
            "links": self._get_links(soup, base),
        }

    # ── Title ──────────────────────────────────────────────────────────────

    def _get_title(self, soup: BeautifulSoup) -> str:
        tag = soup.find("title")
        if tag and tag.get_text(strip=True):
            return tag.get_text(strip=True)
        h1 = soup.find("h1")
        if h1:
            return h1.get_text(strip=True)
        return "Untitled"

    # ── Forms ──────────────────────────────────────────────────────────────

    def _get_forms(self, soup: BeautifulSoup) -> list:
        forms = []
        for form_tag in soup.find_all("form"):
            form_name = (
                form_tag.get("id")
                or form_tag.get("name")
                or form_tag.get("class", [""])[0]
                or "form"
            )

            fields = []
            for inp in form_tag.find_all(["input", "select", "textarea"]):
                field_type = inp.get("type", inp.name).lower()
                if field_type in ("hidden", "submit", "button", "image", "reset"):
                    continue
                fields.append({
                    "name": inp.get("name") or inp.get("id") or inp.get("placeholder") or field_type,
                    "type": field_type,
                    "required": inp.has_attr("required"),
                    "placeholder": inp.get("placeholder", ""),
                })

            buttons = []
            for btn in form_tag.find_all(["button", "input"]):
                btn_type = btn.get("type", "button").lower()
                if btn_type in ("submit", "button"):
                    text = btn.get_text(strip=True) or btn.get("value") or btn.get("aria-label") or "Button"
                    if text:
                        buttons.append({"text": text, "type": btn_type})

            forms.append({
                "name": form_name,
                "action": form_tag.get("action", ""),
                "method": form_tag.get("method", "get").upper(),
                "fields": fields,
                "buttons": buttons,
            })
        return forms

    # ── Links ──────────────────────────────────────────────────────────────

    def _get_links(self, soup: BeautifulSoup, base: str) -> list:
        seen = set()
        links = []
        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True)
            href = a["href"].strip()
            if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
                continue
            full_href = urljoin(base, href)
            if full_href not in seen:
                seen.add(full_href)
                links.append({"text": text or href, "href": full_href})
        return links[:30]  # cap at 30 links per page

    # ── Utilities ──────────────────────────────────────────────────────────

    def _normalise(self, url: str) -> str:
        url = url.strip()
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        return url
