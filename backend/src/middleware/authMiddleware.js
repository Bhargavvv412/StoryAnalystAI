const jwt = require("jsonwebtoken");
const { admin } = require("../utils/firebaseAdmin");

const JWT_SECRET = process.env.INTERNAL_API_SECRET || "dev_secret_change_me_to_something_very_secure";

/**
 * Middleware: Supports dual-authentication (Local JWT + Firebase ID tokens)
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header." });
  }

  const token = authHeader.split("Bearer ")[1];

  // Try decoding as local JWT first
  try {
    const decodedLocal = jwt.verify(token, JWT_SECRET);
    req.user = decodedLocal;
    return next();
  } catch (localErr) {
    // Not a valid local JWT (could be expired, or it's a Firebase token). Proceed to verify as Firebase JS
  }

  // Try decoding as Firebase ID token
  if (admin && admin.apps.length > 0) {
    try {
      const decodedFirebase = await admin.auth().verifyIdToken(token);
      req.user = decodedFirebase;
      return next();
    } catch (firebaseErr) {
      console.error("[AUTH] Firebase verification failed:", firebaseErr.message);
    }
  }

  // If both fail, deny access.
  return res.status(401).json({ error: "Invalid or expired token." });
}

module.exports = { verifyToken };
