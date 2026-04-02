"""
Flask Microservice — AI Backend
--------------------------------
Pure JSON API microservice called by the Node.js backend.
HTML auth routes removed — authentication handled by Firebase + Node.js.

Routes:
  GET  /health              → health check
  POST /analyze             → user story text → test cases / analysis
  POST /explore             → website URL → site structure
  POST /generate-combined   → story + site → combined test cases
  POST /execute             → combined test cases → execution results
  POST /report              → execution results → HTML report
  GET  /report/download     → download latest report as .html file
  GET  /screenshots/<f>     → serve screenshot files
"""

from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from orchestrator import Orchestrator
from agents.website_explorer import WebsiteExplorerAgent
from agents.combined_generator import CombinedGeneratorAgent
from agents.test_executor import TestExecutorAgent
from agents.report_agent import ReportAgent
import os

app = Flask(__name__, static_folder="ui/static")

# CORS — only allow Node.js backend
CORS(app, origins=[
    os.environ.get("ALLOWED_ORIGIN", "http://localhost:5000"),
    "http://localhost:5173",  # dev
])

# Internal secret — requests must include X-Internal-Secret header
INTERNAL_SECRET = os.environ.get("INTERNAL_API_SECRET", "dev_secret_change_me")

def check_secret():
    secret = request.headers.get("X-Internal-Secret", "")
    if secret != INTERNAL_SECRET:
        return jsonify({"error": "Unauthorized — missing internal secret."}), 403
    return None

orchestrator = Orchestrator()
explorer     = WebsiteExplorerAgent()
combiner     = CombinedGeneratorAgent()
executor     = TestExecutorAgent()
reporter     = ReportAgent()

_last_report_html: str = ""


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "python-ai-microservice"})


@app.route("/analyze", methods=["POST"])
def analyze():
    err = check_secret()
    if err: return err

    data = request.get_json()
    user_story = (data or {}).get("story", "").strip()
    if not user_story:
        return jsonify({"error": "No user story provided."}), 400
    try:
        return jsonify(orchestrator.run(user_story))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/explore", methods=["POST"])
def explore():
    err = check_secret()
    if err: return err

    data  = request.get_json()
    url   = (data or {}).get("url", "").strip()
    depth = int((data or {}).get("depth", 1))
    if not url:
        return jsonify({"error": "No URL provided."}), 400
    try:
        return jsonify(explorer.explore(url, depth=min(depth, 2)))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/generate-combined", methods=["POST"])
def generate_combined():
    err = check_secret()
    if err: return err

    data       = request.get_json() or {}
    user_story = data.get("story", "").strip()
    url        = data.get("url", "").strip()
    depth      = int(data.get("depth", 1))
    if not user_story:
        return jsonify({"error": "No user story provided."}), 400
    if not url:
        return jsonify({"error": "No website URL provided."}), 400
    try:
        story_result = orchestrator.run(user_story)
        story_data   = story_result["analysis"]
        page_data    = explorer.explore(url, depth=min(depth, 2))
        test_cases   = combiner.generate(story_data, page_data)
        counts = {"Positive": 0, "Negative": 0, "Boundary": 0, "Edge Case": 0}
        mapped = sum(1 for tc in test_cases if tc.get("mapped", True))
        for tc in test_cases:
            t = tc.get("type", "Positive")
            if t in counts:
                counts[t] += 1
        return jsonify({
            "story_data": story_data,
            "page_data":  page_data,
            "test_cases": test_cases,
            "summary": {
                "total":    len(test_cases),
                "mapped":   mapped,
                "unmapped": len(test_cases) - mapped,
                "by_type":  counts,
            },
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/execute", methods=["POST"])
def execute():
    err = check_secret()
    if err: return err

    data       = request.get_json() or {}
    test_cases = data.get("test_cases", [])
    headless   = data.get("headless", True)
    workers    = max(1, min(int(data.get("workers", 1)), 8))  # 1–8 parallel Chrome instances

    if not test_cases:
        return jsonify({"error": "No test cases provided."}), 400
    try:
        results = executor.execute_all(test_cases, headless=headless, workers=workers)
        passed  = sum(1 for r in results if r["status"] == "Pass")
        failed  = sum(1 for r in results if r["status"] == "Fail")
        errored = sum(1 for r in results if r["status"] == "Error")
        return jsonify({
            "results": results,
            "summary": {
                "total":   len(results),
                "passed":  passed,
                "failed":  failed,
                "errored": errored,
            },
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/report", methods=["POST"])
def generate_report():
    global _last_report_html
    err = check_secret()
    if err: return err

    data = request.get_json() or {}
    if not data.get("results"):
        return jsonify({"error": "No execution results provided."}), 400
    try:
        html = reporter.generate(data)
        _last_report_html = html
        return Response(html, mimetype="text/html")
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/report/download")
def download_report():
    if not _last_report_html:
        return jsonify({"error": "No report generated yet. Run /report first."}), 404
    return Response(
        _last_report_html,
        mimetype="text/html",
        headers={"Content-Disposition": "attachment; filename=test_report.html"},
    )


@app.route("/screenshots/<path:filename>")
def serve_screenshot(filename):
    screenshots_dir = os.path.join(os.path.dirname(__file__), "screenshots")
    return send_from_directory(screenshots_dir, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
