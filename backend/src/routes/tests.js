const express = require("express");
const axios = require("axios");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:10000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "dev_secret_change_me";

/** In-memory job store for polling (use Redis in production) */
const jobs = new Map();

function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Removed mockExecuteTestCase functionality to enforce accurate Python execution

// ─── POST /api/tests/execute ─────────────────────────────────────────────────
// Synchronous execution (try Python, fallback to mock)
router.post("/execute", verifyToken, async (req, res) => {
  const { test_cases = [], headless = true } = req.body;
  if (!test_cases.length) {
    return res.status(400).json({ error: "No test cases provided." });
  }

  try {
    // Try Python microservice
    const { data } = await axios.post(
      `${PYTHON_AI_URL}/execute`,
      { test_cases, headless },
      { headers: { "X-Internal-Secret": INTERNAL_SECRET }, timeout: 180000 }
    );
    return res.json({ ...data, mock: false });
  } catch (err) {
    console.error("Python executor failed:", err.message);
    const errMsg = err.response?.data?.error || err.message;
    return res.status(500).json({ error: "Failed to execute tests on Python microservice. " + errMsg });
  }
});

// ─── POST /api/tests/start ───────────────────────────────────────────────────
// Async job-based execution with polling
router.post("/start", verifyToken, async (req, res) => {
  const { test_cases = [], workers = 1 } = req.body;
  if (!test_cases.length) {
    return res.status(400).json({ error: "No test cases provided." });
  }

  const jobId = generateJobId();
  jobs.set(jobId, { status: "running", progress: 0, total: test_cases.length, results: [] });

  // Real async proxy to Python
  (async () => {
    try {
      // Add fake midway progress for UX loading states
      jobs.set(jobId, { status: "running", progress: Math.max(1, Math.floor(test_cases.length / 2)), total: test_cases.length, results: [] });
      
      const { data } = await axios.post(
        `${PYTHON_AI_URL}/execute`,
        { test_cases, headless: true, workers: Math.max(1, Math.min(Number(workers), 8)) },
        { headers: { "X-Internal-Secret": INTERNAL_SECRET }, timeout: 600000 }  // 10 min max
      );
      
      // Fix screenshot paths: Python returns "screenshots/filename.png" (no leading slash)
      const results = (data.results || []).map(r => {
        if (r.screenshot_path) {
          // Normalise to just the filename part
          const fname = r.screenshot_path.replace(/^\/?screenshots\//, '');
          r.screenshot = `/api/tests/screenshots/${fname}`;
        }
        return r;
      });

      jobs.set(jobId, {
        status: "done",
        progress: test_cases.length,
        total: test_cases.length,
        results,
        summary: data.summary || { total: results.length, passed: results.filter(r=>r.status==="Pass").length, failed: results.filter(r=>r.status==="Fail").length, errored: 0 }
      });
    } catch (err) {
      console.warn("⚠️ Python executor failed:", err.message);
      const errMsg = err.response?.data?.error || err.message;
      jobs.set(jobId, {
        status: "failed",
        error: errMsg,
        progress: 0,
        total: test_cases.length,
        results: [],
        summary: { total: test_cases.length, passed: 0, failed: test_cases.length, errored: test_cases.length },
      });
    }
  })();

  res.json({ jobId, status: "running" });
});

// ─── GET /api/tests/status/:jobId ────────────────────────────────────────────
router.get("/status/:jobId", verifyToken, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });

  const passed = job.results.filter((r) => r.status === "Pass").length;
  const failed = job.results.filter((r) => r.status === "Fail").length;

  res.json({
    ...job,
    summary: job.summary || { total: job.total, passed, failed, errored: 0 },
  });
});

// ─── GET /api/tests/screenshots/:filename ────────────────────────────────────
router.get("/screenshots/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const response = await axios({
      method: "get",
      url: `${PYTHON_AI_URL}/screenshots/${filename}`,
      responseType: "stream",
      timeout: 10000,
    });
    response.data.pipe(res);
  } catch (err) {
    console.error("[tests/screenshot] Image fetch failed:", err.message);
    res.status(404).json({ error: "Screenshot not found on Python backend." });
  }
});

module.exports = router;
