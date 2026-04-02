const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { db } = require("../utils/firebaseAdmin");
const axios = require("axios");

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:10000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "dev_secret_change_me";

// In-memory report store (always works even without Firestore)
const memReports = new Map();

function memId() {
  return `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// POST /api/reports/save
router.post("/save", verifyToken, async (req, res) => {
  const { type, results, summary, metadata = {} } = req.body;
  if (!results || !type) {
    return res.status(400).json({ error: "Results and type are required." });
  }

  const report = {
    userId:    req.user.uid,
    userEmail: req.user.email || "",
    type,
    results,
    summary: summary || {},
    metadata,
    createdAt: new Date().toISOString(),
    timestamp: Date.now(),
  };

  const firestore = db();
  const hasFirebase = !!(firestore && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);

  if (hasFirebase) {
    try {
      const docRef = await firestore.collection("reports").add(report);
      return res.json({ id: docRef.id, saved: true });
    } catch (err) {
      console.warn("[reports/save] Firestore failed, falling back to memory:", err.message);
    }
  }

  const id = memId();
  memReports.set(id, { id, ...report });
  return res.json({ id, saved: true, storage: "memory" });
});

// GET /api/reports/list
router.get("/list", verifyToken, async (req, res) => {
  const firestore = db();
  const hasFirebase = !!(firestore && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);

  const memList = [...memReports.values()]
    .filter(r => r.userId === req.user.uid)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (hasFirebase) {
    try {
      const snap = await firestore
        .collection("reports")
        .where("userId", "==", req.user.uid)
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();
      const fsReports = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.json({ reports: [...memList, ...fsReports] });
    } catch (err) {
      console.warn("[reports/list] Firestore failed, returning memory store:", err.message);
    }
  }

  return res.json({ reports: memList });
});

// DELETE /api/reports/:id
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (memReports.has(id)) {
    const rep = memReports.get(id);
    if (rep.userId !== req.user.uid) return res.status(403).json({ error: "Not authorized." });
    memReports.delete(id);
    return res.json({ deleted: true });
  }

  const firestore = db();
  if (!firestore) return res.status(404).json({ error: "Report not found." });

  try {
    const ref = firestore.collection("reports").doc(id);
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

// POST /api/reports/generate-html  -> proxied to Python /report
router.post("/generate-html", verifyToken, async (req, res) => {
  const { results, summary } = req.body;
  try {
    const { data } = await axios.post(
      `${PYTHON_AI_URL}/report`,
      { results, summary },
      { headers: { "X-Internal-Secret": INTERNAL_SECRET }, timeout: 30000 }
    );
    res.send(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate HTML report from Python: " + err.message });
  }
});

// GET /api/reports/download-html  -> streams from Python /report/download
router.get("/download-html", async (req, res) => {
  try {
    const response = await axios({
      method: "get",
      url: `${PYTHON_AI_URL}/report/download`,
      responseType: "stream",
      timeout: 15000,
    });
    res.setHeader("Content-Disposition", "attachment; filename=storyanalyst_test_report.html");
    res.setHeader("Content-Type", "text/html");
    response.data.pipe(res);
  } catch (err) {
    res.status(404).send("Report not available on Python backend.");
  }
});

module.exports = router;
