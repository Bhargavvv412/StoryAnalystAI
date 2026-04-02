const express = require("express");
const router = express.Router();
const { db } = require("../utils/firebaseAdmin");

// Basic sanitization
function sanitize(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").slice(0, 2000);
}

// ─── POST /api/contact ────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  const entry = {
    name: sanitize(name),
    email: sanitize(email),
    subject: sanitize(subject || "General Inquiry"),
    message: sanitize(message),
    timestamp: Date.now(),
    createdAt: new Date().toISOString(),
    status: "new",
  };

  const firestore = db();
  if (!firestore) {
    console.log("[Contact] Mock mode — entry:", entry);
    return res.json({ success: true, mock: true });
  }

  try {
    await firestore.collection("contacts").add(entry);
    res.json({ success: true });
  } catch (err) {
    console.error("[contact]", err.message);
    res.status(500).json({ error: "Failed to save message. Please try again." });
  }
});

module.exports = router;
