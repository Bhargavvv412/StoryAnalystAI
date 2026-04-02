const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getUserByEmail, createUser } = require("../utils/localDb");
const { admin } = require("../utils/firebaseAdmin");

const router = express.Router();

const JWT_SECRET = process.env.INTERNAL_API_SECRET || "dev_secret_change_me_to_something_very_secure";

// ── LOCAL SIGNUP ──
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email is already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await createUser({
      email,
      name,
      password: hashedPassword,
    });

    // Generate strict JWT token
    const token = jwt.sign(
      { uid: newUser.uid, email: newUser.email, name: newUser.name, plan: newUser.plan },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ user: { uid: newUser.uid, email: newUser.email, name: newUser.name, plan: newUser.plan }, token });
  } catch (err) {
    console.error("[Auth Signup Error]", err);
    res.status(500).json({ error: "Failed to create account." });
  }
});

// ── LOCAL LOGIN ──
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." }); // Ambiguous for security
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { uid: user.uid, email: user.email, name: user.name, plan: user.plan },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ user: { uid: user.uid, email: user.email, name: user.name, plan: user.plan }, token });
  } catch (err) {
    console.error("[Auth Login Error]", err);
    res.status(500).json({ error: "Failed to login properly." });
  }
});

// ── FIREBASE FALLBACK LOGIN (For UI Google Auth support) ──
router.post("/firebase-login", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Firebase token required." });
    if (!admin || admin.apps.length === 0) return res.status(501).json({ error: "Firebase is not configured." });

    const decoded = await admin.auth().verifyIdToken(token);
    
    // We could sync to localDb here, but we'll just return a success payload so frontend updates state.
    // In dual-auth mode, the frontend can just send the Firebase token via Authorization header as standard.
    res.json({ success: true, user: { uid: decoded.uid, email: decoded.email } });
  } catch (err) {
    console.error("[Firebase Login Error]", err.message);
    res.status(401).json({ error: "Invalid Firebase token." });
  }
});

module.exports = router;
