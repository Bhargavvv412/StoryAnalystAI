import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Zap, Crown, Star, ArrowRight, AlertCircle } from "lucide-react";
import { createRazorpayOrder, verifyRazorpayPayment } from "../services/api";
import useStore from "../state/store";
import Button from "../components/Button";
import Card from "../components/Card";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    display: "₹0",
    period: "/month",
    color: "border-surface-border",
    features: ["10 AI generations / month", "User Story Generator", "Website Explorer", "Basic Reports (HTML)", "Email Support"],
    cta: null,
    icon: null,
  },
  {
    id: "pro",
    name: "Pro",
    price: 19900,
    display: "₹199",
    period: "/month",
    color: "border-brand-blue",
    badge: "Most Popular",
    features: ["100 AI generations / month", "All Free features", "Combined Generator", "Test Executor", "PDF & CSV Reports", "Priority Support", "Usage Analytics"],
    cta: "Upgrade to Pro",
    icon: Zap,
    highlight: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: 49900,
    display: "₹499",
    period: "/month",
    color: "border-brand-purple",
    badge: "Best Value",
    features: ["Unlimited generations", "All Pro features", "Advanced Analytics", "API Access (coming soon)", "Dedicated Support", "Custom Integrations", "White-label Reports"],
    cta: "Go Premium",
    icon: Crown,
  },
];

export default function Subscription() {
  const { user, plan: currentPlan, setPlan, addToast } = useStore();
  const [loading, setLoading] = useState(null);
  const [successPlan, setSuccessPlan] = useState(null);

  async function handleUpgrade(planId) {
    if (!user) { addToast("Please sign in first.", "warning"); return; }
    if (planId === currentPlan) { addToast("You're already on this plan!", "info"); return; }

    setLoading(planId);
    try {
      const order = await createRazorpayOrder(planId);

      if (order.mock) {
        // Mock payment flow (no Razorpay keys configured)
        addToast("Mock payment successful! Plan upgraded.", "success");
        setPlan(planId);
        setSuccessPlan(planId);
        setLoading(null);
        return;
      }

      // Real Razorpay checkout
      const script = document.getElementById("razorpay-script") || (() => {
        const s = document.createElement("script");
        s.id = "razorpay-script";
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        document.body.appendChild(s);
        return s;
      })();

      if (!window.Razorpay) {
        await new Promise((res) => { script.onload = res; });
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "StoryAnalyst AI",
        description: `Upgrade to ${planId} plan`,
        order_id: order.orderId,
        prefill: { email: user.email, name: user.displayName },
        theme: { color: "#7C3AED" },
        handler: async (response) => {
          try {
            const result = await verifyRazorpayPayment({
              orderId:   response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              plan: planId,
            });
            if (result.success) {
              setPlan(planId);
              setSuccessPlan(planId);
              addToast(`Plan upgraded to ${result.plan}!`, "success");
            }
          } catch (err) {
            addToast("Payment verification failed: " + err.message, "error");
          }
        },
        modal: { ondismiss: () => setLoading(null) },
      });
      rzp.open();
    } catch (err) {
      addToast("Payment failed: " + err.message, "error");
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="font-display font-bold text-5xl text-white mb-4">
            Choose your <span className="gradient-text">plan</span>
          </h1>
          <p className="text-white/50 text-lg">Upgrade to unlock more AI power</p>

          {currentPlan && (
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-sm text-white/60 mt-4">
              <CheckCircle size={14} className="text-emerald-400" />
              Currently on: <strong className="text-white capitalize">{currentPlan}</strong> plan
            </div>
          )}
        </motion.div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((p, i) => {
            const Icon = p.icon;
            const isCurrentPlan = p.id === currentPlan;
            const isSucceeded = p.id === successPlan;

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                className={`relative rounded-2xl p-6 border ${isCurrentPlan ? "border-emerald-500/60" : p.color} ${p.highlight ? "bg-gradient-to-b from-brand-blue/15 to-transparent" : "glass"}`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge badge-pass text-xs whitespace-nowrap">
                    <CheckCircle size={10} /> Your Current Plan
                  </div>
                )}
                {!isCurrentPlan && p.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 badge ${p.highlight ? "badge-pro" : "badge-premium"} text-xs whitespace-nowrap`}>
                    <Star size={10} /> {p.badge}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  {Icon && <Icon size={20} className={p.highlight ? "text-brand-blue" : "text-brand-purple"} />}
                  <h2 className="font-display font-bold text-white text-xl">{p.name}</h2>
                </div>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-display font-bold text-4xl gradient-text">{p.display}</span>
                  <span className="text-white/40 text-sm">{p.period}</span>
                </div>

                <ul className="space-y-2.5 mb-8">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>

                {p.cta ? (
                  <Button
                    onClick={() => handleUpgrade(p.id)}
                    loading={loading === p.id}
                    disabled={isCurrentPlan || isSucceeded}
                    variant={isCurrentPlan ? "secondary" : "primary"}
                    className="w-full"
                    icon={isSucceeded ? CheckCircle : Icon}
                  >
                    {isSucceeded ? "Upgraded!" : isCurrentPlan ? "Current Plan" : p.cta}
                  </Button>
                ) : (
                  <div className={`w-full text-center py-3 rounded-xl text-sm font-semibold ${isCurrentPlan ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "btn-secondary"}`}>
                    {isCurrentPlan ? "Current Plan" : "Free Forever"}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Payment note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-start gap-3 glass rounded-xl px-4 py-3 mt-8 max-w-lg mx-auto"
        >
          <AlertCircle size={15} className="text-white/30 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-white/30">
            Payments are securely processed via Razorpay. All plans are monthly with no contracts.
            If Razorpay is not configured, payments run in mock mode for testing.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
