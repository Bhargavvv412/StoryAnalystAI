require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./src/routes/auth");
const aiRoutes = require("./src/routes/ai");
const testRoutes = require("./src/routes/tests");
const paymentRoutes = require("./src/routes/payments");
const reportRoutes = require("./src/routes/reports");
const contactRoutes = require("./src/routes/contact");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origin.startsWith("http://localhost:") || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
// Raw body needed for Razorpay webhook signature verification
app.use((req, res, next) => {
  if (req.originalUrl === "/api/payments/razorpay/webhook") {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    express.json({ limit: "2mb" })(req, res, next);
  }
});

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan("combined"));

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
app.use(globalLimiter);

// AI-specific tighter limiter
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 15,
  message: { error: "AI rate limit exceeded. Try again in a minute." },
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/contact", contactRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", ts: Date.now() }));

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found." }));

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message || err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error. Please try again.",
  });
});

app.listen(PORT, () => {
  console.log(`✅  StoryAnalyst AI backend running on port ${PORT}`);
});

module.exports = app;
