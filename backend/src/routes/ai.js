const express = require("express");
const axios = require("axios");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const PROMPTS = require("../utils/promptTemplates");
const { db } = require("../utils/firebaseAdmin");

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:10000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "dev_secret_change_me";

// Plan usage limits
const PLAN_LIMITS = { free: 10, pro: 100, premium: 9999 };

/** Helper: check and increment usage count in Firestore */
async function checkAndIncrementUsage(uid) {
  const firestore = db();
  if (!firestore) return { allowed: true }; // mock mode

  try {
    const userRef = firestore.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      await userRef.set({ plan: "free", usageCount: 0 }, { merge: true });
      return { allowed: true };
    }

    const { plan = "free", usageCount = 0 } = snap.data();
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    if (usageCount >= limit) {
      return { allowed: false, plan, usageCount, limit };
    }

    await userRef.update({ usageCount: (usageCount || 0) + 1 });
    return { allowed: true, plan, usageCount: usageCount + 1 };
  } catch (err) {
    console.warn("⚠️ Firestore tracking disabled or failed (checking local fallback).", err.message);
    return { allowed: true }; // Bypass tracking if disabled
  }
}

/** Helper: proxy request to Python microservice */
async function proxyToPython(path, body) {
  try {
    const { data } = await axios.post(`${PYTHON_AI_URL}${path}`, body, {
      headers: { "X-Internal-Secret": INTERNAL_SECRET },
      timeout: 120000,
    });
    return { success: true, data };
  } catch (err) {
    const errMsg = err.response?.data?.error || err.message || "Python AI service error";
    return { success: false, error: errMsg };
  }
}

/** Mock responses for when Python microservice is unavailable */
function mockUserStories(requirement) {
  return [
    {
      id: "US-001",
      title: "User Authentication",
      asA: "registered user",
      iWant: "to log in securely",
      soThat: "I can access my personalized dashboard",
      priority: "High",
      storyPoints: 5,
      acceptanceCriteria: [
        "Given valid credentials, When I submit login, Then I am redirected to dashboard",
        "Given invalid password, When I submit, Then I see an error message",
        "Given locked account, When I try to login, Then I see account locked message",
      ],
      tags: ["authentication", "security"],
    },
    {
      id: "US-002",
      title: `Core Feature: ${requirement.slice(0, 40)}...`,
      asA: "product user",
      iWant: "to use the main application feature",
      soThat: "I can achieve my primary goal",
      priority: "High",
      storyPoints: 8,
      acceptanceCriteria: [
        "Given I am logged in, When I navigate to the feature, Then it loads within 2 seconds",
        "Given valid input, When I submit, Then I receive expected output",
        "Given network failure, When I submit, Then I see a retry option",
      ],
      tags: ["core", "feature"],
    },
    {
      id: "US-003",
      title: "Report Generation",
      asA: "team lead",
      iWant: "to download test reports as PDF",
      soThat: "I can share results with stakeholders",
      priority: "Medium",
      storyPoints: 3,
      acceptanceCriteria: [
        "Given a completed test run, When I click download, Then PDF is generated",
        "Given no test runs, When I visit reports, Then I see empty state message",
      ],
      tags: ["reports", "export"],
    },
  ];
}

// ─── POST /api/ai/generate-story ──────────────────────────────────────────────
router.post("/generate-story", verifyToken, async (req, res) => {
  const { requirement } = req.body;
  if (!requirement?.trim()) {
    return res.status(400).json({ error: "Requirement text is required." });
  }

  try {
    // Check usage limits
    const usage = await checkAndIncrementUsage(req.user.uid);
    if (!usage.allowed) {
      return res.status(429).json({
        error: `Usage limit reached. You have used ${usage.usageCount}/${usage.limit} generations on the ${usage.plan} plan. Please upgrade.`,
        upgradeRequired: true,
      });
    }

    // Proxy to Python microservice
    const result = await proxyToPython("/analyze", { story: requirement });

    if (result.success) {
      return res.json({ ...result.data, mock: false, usageCount: usage.usageCount });
    }

    // Fallback to mock
    console.warn("[AI] Python microservice unavailable, returning mock:", result.error);
    return res.json({
      analysis: mockUserStories(requirement),
      mock: true,
      mockNote: "Python AI service unavailable — showing demo data.",
      usageCount: usage.usageCount,
    });
  } catch (err) {
    console.error("[/generate-story]", err.message);
    res.status(500).json({ error: "Failed to generate user stories. " + err.message });
  }
});

// ─── POST /api/ai/explore-website ─────────────────────────────────────────────
router.post("/explore-website", verifyToken, async (req, res) => {
  const { url, depth = 1 } = req.body;
  if (!url?.trim()) {
    return res.status(400).json({ error: "URL is required." });
  }

  try {
    const usage = await checkAndIncrementUsage(req.user.uid);
    if (!usage.allowed) {
      return res.status(429).json({ error: "Usage limit reached.", upgradeRequired: true });
    }

    const result = await proxyToPython("/explore", { url, depth: Math.min(Number(depth), 2) });

    if (result.success) {
      return res.json({ ...result.data, mock: false });
    }

    // Mock fallback
    return res.json({
      url,
      pages: [
        { url, title: "Home Page", features: ["Navigation", "Hero Section", "CTA Button", "Footer"], forms: ["Contact Form", "Newsletter Signup"], navigationLinks: ["/about", "/pricing", "/login"] },
        { url: `${url}/about`, title: "About Page", features: ["Team Section", "Mission Statement", "Timeline"], forms: [], navigationLinks: ["/contact"] },
      ],
      technologies: ["React", "Tailwind CSS", "Node.js"],
      accessibilityIssues: ["Some images may lack alt tags", "Color contrast should be verified"],
      testableAreas: ["Navigation links work correctly", "Forms submit successfully", "Responsive layout on mobile", "Page load time under 3s"],
      mock: true,
      mockNote: "Python AI service unavailable — showing demo data.",
    });
  } catch (err) {
    console.error("[/explore-website]", err.message);
    res.status(500).json({ error: "Failed to explore website. " + err.message });
  }
});

// ─── POST /api/ai/combined ────────────────────────────────────────────────────
router.post("/combined", verifyToken, async (req, res) => {
  const { requirement, url, depth = 1 } = req.body;
  if (!requirement?.trim() || !url?.trim()) {
    return res.status(400).json({ error: "Both requirement and URL are required." });
  }

  try {
    const usage = await checkAndIncrementUsage(req.user.uid);
    if (!usage.allowed) {
      return res.status(429).json({ error: "Usage limit reached.", upgradeRequired: true });
    }

    const result = await proxyToPython("/generate-combined", {
      story: requirement,
      url,
      depth: Math.min(Number(depth), 2),
    });

    if (result.success) {
      return res.json({ ...result.data, mock: false });
    }

    // Mock fallback
    const stories = mockUserStories(requirement);
    const mockTestCases = stories.flatMap((s, i) => [
      { id: `TC-00${i * 2 + 1}`, storyId: s.id, title: `Verify: ${s.title}`, type: "Positive", priority: s.priority, steps: [{ step: 1, action: "Navigate to relevant page", selector: "body" }, { step: 2, action: "Perform primary action", selector: ".main-action" }], expectedResult: s.acceptanceCriteria[0], mapped: true },
      { id: `TC-00${i * 2 + 2}`, storyId: s.id, title: `Negative: ${s.title}`, type: "Negative", priority: "Medium", steps: [{ step: 1, action: "Navigate to relevant page", selector: "body" }, { step: 2, action: "Submit invalid data", selector: ".form-submit" }], expectedResult: "Error message displayed", mapped: true },
    ]);

    return res.json({
      story_data: stories,
      page_data: { url, pages: [], mock: true },
      test_cases: mockTestCases,
      summary: { total: mockTestCases.length, mapped: mockTestCases.length, unmapped: 0, by_type: { Positive: stories.length, Negative: stories.length, Boundary: 0, "Edge Case": 0 } },
      mock: true,
      mockNote: "Python AI service unavailable — showing demo data.",
    });
  } catch (err) {
    console.error("[/combined]", err.message);
    res.status(500).json({ error: "Failed to generate combined output. " + err.message });
  }
});

module.exports = router;
