const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { createOrder, verifyWebhookSignature, verifyPaymentSignature } = require("../utils/razorpayHelper");
const { admin, db } = require("../utils/firebaseAdmin");

const PLAN_NAMES = { pro: "Pro", premium: "Premium" };

async function updateUserPlan(uid, plan) {
  const firestore = db();
  if (!firestore) {
    console.warn("[Payments] Firestore unavailable — skipping plan update (mock mode).");
    return;
  }
  await firestore.collection("users").doc(uid).set(
    {
      plan,
      planUpdatedAt: new Date().toISOString(),
      usageCount: 0, // reset on upgrade
    },
    { merge: true }
  );
}

// ─── POST /api/payments/razorpay/create-order ─────────────────────────────────
router.post("/razorpay/create-order", verifyToken, async (req, res) => {
  const { plan } = req.body;
  if (!plan || !["pro", "premium"].includes(plan)) {
    return res.status(400).json({ error: "Invalid plan. Choose 'pro' or 'premium'." });
  }

  try {
    const order = await createOrder(plan);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_mock",
      mock: order.mock || false,
    });
  } catch (err) {
    console.error("[create-order]", err.message);
    res.status(500).json({ error: "Could not create payment order: " + err.message });
  }
});

// ─── POST /api/payments/razorpay/verify ──────────────────────────────────────
// Called by frontend after successful Razorpay checkout
router.post("/razorpay/verify", verifyToken, async (req, res) => {
  const { orderId, paymentId, signature, plan } = req.body;

  if (!orderId || !paymentId || !plan) {
    return res.status(400).json({ error: "Missing payment details." });
  }

  // Verify payment signature
  const isValid = verifyPaymentSignature({ orderId, paymentId, signature });
  if (!isValid) {
    return res.status(400).json({ error: "Payment verification failed — invalid signature." });
  }

  try {
    await updateUserPlan(req.user.uid, plan);
    res.json({ success: true, plan, message: `Plan upgraded to ${PLAN_NAMES[plan]} successfully!` });
  } catch (err) {
    console.error("[verify]", err.message);
    res.status(500).json({ error: "Payment verified but plan update failed: " + err.message });
  }
});

// ─── POST /api/payments/razorpay/webhook ─────────────────────────────────────
// Razorpay sends raw body — must be parsed as raw buffer in server.js
router.post("/razorpay/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.body; // Buffer (raw body configured in server.js)

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("[webhook] Invalid signature");
    return res.status(400).json({ error: "Invalid webhook signature." });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  console.log("[webhook] Event:", event.event);

  if (event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    const notes = payment?.notes || {};
    const plan = notes.plan;
    const uid = notes.uid; // You should pass uid in notes when creating order

    if (uid && plan) {
      try {
        await updateUserPlan(uid, plan);
        console.log(`[webhook] Plan updated: ${uid} → ${plan}`);
      } catch (err) {
        console.error("[webhook] Plan update failed:", err.message);
      }
    }
  }

  res.json({ received: true });
});

// ─── POST /api/payments/stripe/charge ────────────────────────────────────────
router.post("/stripe/charge", verifyToken, async (req, res) => {
  const { plan } = req.body;
  
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(501).json({ error: "Stripe not configured. Please use Razorpay." });
  }

  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const amounts = { pro: 19900, premium: 49900 };
    const amount = amounts[plan];

    if (!amount) return res.status(400).json({ error: "Invalid plan." });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "inr",
          product_data: { name: `StoryAnalyst AI — ${plan} Plan` },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/subscription?success=true&plan=${plan}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription?cancelled=true`,
      metadata: { uid: req.user.uid, plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("[stripe]", err.message);
    res.status(500).json({ error: "Stripe error: " + err.message });
  }
});

module.exports = router;
