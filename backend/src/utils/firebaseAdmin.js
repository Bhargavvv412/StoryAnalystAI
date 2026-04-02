const admin = require("firebase-admin");

let initialized = false;

function initFirebaseAdmin() {
  if (initialized || admin.apps.length > 0) return admin;

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64) {
    console.warn("⚠️  FIREBASE_SERVICE_ACCOUNT_BASE64 not set — Firebase Admin bypassed.");
    initialized = true;
    return null;
  }

  try {
    const json = Buffer.from(base64, "base64").toString("utf8");
    const serviceAccount = JSON.parse(json);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });

    initialized = true;
    console.log("✅  Firebase Admin initialized successfully.");
    return admin;
  } catch (err) {
    console.error("❌  Firebase Admin initialization failed. Invalid credential format or corrupted base64.", err.message);
    initialized = true; // Prevent crash loops
    return null;
  }
}

initFirebaseAdmin();

module.exports = { admin, db: () => (admin.apps.length ? admin.firestore() : null) };
