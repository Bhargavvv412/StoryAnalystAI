const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { db } = require("../utils/firebaseAdmin");
const axios = require("axios");

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:10000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "dev_secret_change_me";

// ─── POST /api/reports/save ───────────────────────────────────────────────────
router.post("/save", verifyToken, async (req, res) => {
  const { type, results, summary, metadata = {} } = req.body;
  if (!results || !type) {
    return res.status(400).json({ error: "Results and type are required." });
  }

  const firestore = db();
  if (!firestore) {
    // Mock mode
    return res.json({
      id: `mock_report_${Date.now()}`,
      saved: true,
      mock: true,
    });
  }

  // Double check if we should even try using Firestore
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 === undefined) {
      return res.json({ id: `mock_report_${Date.now()}`, saved: true, mock: true });
  }

  try {
    const docRef = await firestore.collection("reports").add({
      userId: req.user.uid,
      userEmail: req.user.email || "",
      type, // "story" | "explorer" | "combined" | "test"
      results,
      summary: summary || {},
      metadata,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
    });

    res.json({ id: docRef.id, saved: true });
  } catch (err) {
    console.warn("⚠️ Firestore tracking disabled or failed. Bypassing report save:", err.message);
    return res.json({ id: `mock_report_${Date.now()}`, saved: true, mock: true, warn: "Firestore not enabled" });
  }
});

// ─── GET /api/reports/list ────────────────────────────────────────────────────
router.get("/list", verifyToken, async (req, res) => {
  const firestore = db();
  if (!firestore) {
    return res.json({ reports: [], mock: true });
  }

  try {
    const snap = await firestore
      .collection("reports")
      .where("userId", "==", req.user.uid)
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();

    const reports = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ reports });
  } catch (err) {
    console.warn("⚠️ Firestore tracking disabled or failed. Bypassing report list:", err.message);
    return res.json({ reports: [], mock: true, warn: "Firestore not enabled" });
  }
});

// ─── DELETE /api/reports/:id ──────────────────────────────────────────────────
router.delete("/:id", verifyToken, async (req, res) => {
  const firestore = db();
  if (!firestore) return res.json({ deleted: true, mock: true });

  try {
    const ref = firestore.collection("reports").doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists) return res.status(404).json({ error: "Report not found." });
    if (snap.data().userId !== req.user.uid) return res.status(403).json({ error: "Not authorized." });

    await ref.delete();
    res.json({ deleted: true });
  } catch (err) {
    console.error("[reports/delete]", err.message);
    res.status(500).json({ error: "Failed to delete report: " + err.message });
  }
});

// ─── POST /api/reports/generate-html ─────────────────────────────────────────
router.post("/generate-html", verifyToken, async (req, res) => {
  const { results, summary } = req.body;
  try {
    const { data } = await axios.post(
      `${PYTHON_AI_URL}/report`,
      { results, summary },
      { headers: { "X-Internal-Secret": INTERNAL_SECRET } }
    );
    res.send(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate HTML report from Python." });
  }
});

// ─── GET /api/reports/download-html ──────────────────────────────────────────
router.get("/download-html", async (req, res) => {
  try {
    const response = await axios({
      method: "get",
      url: `${PYTHON_AI_URL}/report/download`,
      responseType: "stream"
    });
    res.setHeader("Content-Disposition", "attachment; filename=storyanalyst_test_report.html");
    res.setHeader("Content-Type", "text/html");
    response.data.pipe(res);
  } catch (err) {
    res.status(404).send("Report not available on Python backend.");
  }
});

module.exports = router;
