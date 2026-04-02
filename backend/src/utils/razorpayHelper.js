const Razorpay = require("razorpay");
const crypto = require("crypto");

const PLAN_AMOUNTS = {
  pro: 19900,      // ₹199 in paise
  premium: 49900,  // ₹499 in paise
};

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null; // mock mode
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * Create a Razorpay order for a given plan.
 * Returns null in mock mode.
 */
async function createOrder(plan) {
  const rzp = getRazorpayInstance();
  const amount = PLAN_AMOUNTS[plan];

  if (!amount) throw new Error(`Invalid plan: ${plan}`);

  if (!rzp) {
    // Mock order for testing without Razorpay keys
    return {
      id: `mock_order_${Date.now()}`,
      amount,
      currency: "INR",
      plan,
      mock: true,
    };
  }

  return await rzp.orders.create({
    amount,
    currency: "INR",
    notes: { plan },
    receipt: `receipt_${plan}_${Date.now()}`,
  });
}

/**
 * Verify Razorpay webhook signature.
 * Returns true if valid, false otherwise.
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("⚠️  RAZORPAY_WEBHOOK_SECRET not set — skipping verification (dev mode).");
    return true;
  }

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return expectedSig === signature;
}

/**
 * Verify Razorpay payment signature (client-side checkout).
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return true; // mock mode

  const body = `${orderId}|${paymentId}`;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return expectedSig === signature;
}

module.exports = { createOrder, verifyWebhookSignature, verifyPaymentSignature, PLAN_AMOUNTS };
