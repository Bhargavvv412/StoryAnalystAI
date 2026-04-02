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

/** Mock execution result for one test case */
function mockExecuteTestCase(tc) {
  const passed = Math.random() > 0.25; // 75% pass rate
  const execTime = (Math.random() * 2 + 0.3).toFixed(2);
  const screenshots = [
    "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800",
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
  ];

  return {
    id: tc.id || `TC-${Date.now()}`,
    title: tc.title || "Unnamed Test",
    status: passed ? "Pass" : "Fail",
    execTime: parseFloat(execTime),
    timestamp: new Date().toISOString(),
    screenshot: screenshots[Math.floor(Math.random() * screenshots.length)],
    logs: passed
      ? [`✅ Step 1: Navigation successful`, `✅ Step 2: Element found`, `✅ Step 3: Assertion passed`]
      : [`✅ Step 1: Navigation successful`, `❌ Step 2: Element not found — selector: ${tc.steps?.[1]?.selector || ".target"}`, `❌ Test failed: assertion mismatch`],
    error: passed ? null : "Element not found or assertion failed",
  };
}

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
  } catch {
    // Mock execution
    const results = test_cases.map(mockExecuteTestCase);
    const passed = results.filter((r) => r.status === "Pass").length;
    const failed = results.filter((r) => r.status === "Fail").length;

    return res.json({
      results,
      summary: { total: results.length, passed, failed, errored: 0 },
      mock: true,
      mockNote: "Simulated test execution — Python executor unavailable.",
    });
  }
});

// ─── POST /api/tests/start ───────────────────────────────────────────────────
// Async job-based execution with polling
router.post("/start", verifyToken, async (req, res) => {
  const { test_cases = [] } = req.body;
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
        { test_cases, headless: true },
        { headers: { "X-Internal-Secret": INTERNAL_SECRET }, timeout: 180000 }
      );
      
      // Mutate screenshot paths to pipe through node.js proxy instead of direct 10000 port
      const results = (data.results || []).map(r => {
        if (r.screenshot && r.screenshot.startsWith("/screenshots/")) {
          // Node route will be /api/tests/screenshots/file.png
          r.screenshot = `/api/tests${r.screenshot}`; 
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
      console.warn("⚠️ Python executor failed, falling back to mock:", err.message);
      const results = test_cases.map(mockExecuteTestCase);
      jobs.set(jobId, {
        status: "done",
        progress: test_cases.length,
        total: test_cases.length,
        results,
        summary: { total: results.length, passed: results.filter((r) => r.status === "Pass").length, failed: results.filter((r) => r.status === "Fail").length, errored: 0 },
        mockNote: "Python executor failed, showing mock data."
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
