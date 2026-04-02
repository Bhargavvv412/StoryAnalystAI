import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Brain, Sparkles, Globe, Code2, FileText, BarChart3,
  ArrowRight, CheckCircle, Zap, Crown, Shield, Star
} from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../components/Card";

const FEATURES = [
  { icon: Brain,    title: "User Story Generator",    desc: "Transform raw requirements into structured Agile user stories with acceptance criteria, priorities, and story points.", color: "from-blue-500/20 to-blue-600/10" },
  { icon: Globe,    title: "Website Explorer",         desc: "Crawl any website and extract testable features, navigation flows, forms, and accessibility insights automatically.", color: "from-purple-500/20 to-purple-600/10" },
  { icon: Code2,    title: "Combined Generator",       desc: "Merge website exploration data with requirements to produce a holistic test strategy in one click.", color: "from-indigo-500/20 to-indigo-600/10" },
  { icon: Sparkles, title: "Test Executor",            desc: "Run simulated or real browser tests against your application and see live pass/fail results with screenshots.", color: "from-violet-500/20 to-violet-600/10" },
  { icon: FileText, title: "Report Generator",         desc: "Generate professional PDF test reports with charts, summary tables, and detailed step-by-step results.", color: "from-fuchsia-500/20 to-fuchsia-600/10" },
  { icon: BarChart3, title: "Usage Analytics",         desc: "Track your generation history, usage counts, and test run trends across your team dashboard.", color: "from-sky-500/20 to-sky-600/10" },
];

const STATS = [
  { value: "10k+", label: "User Stories Generated" },
  { value: "98%",  label: "Test Accuracy" },
  { value: "5min", label: "Avg. Setup Time" },
  { value: "40+",  label: "Integrations" },
];

const PRICING = [
  {
    name: "Free",
    price: "₹0",
    period: "/month",
    features: ["10 generations/month", "User Story Generator", "Website Explorer", "Basic Reports", "Email Support"],
    cta: "Start Free",
    href: "/auth",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹199",
    period: "/month",
    badge: "Most Popular",
    features: ["100 generations/month", "All Free features", "Combined Generator", "Test Executor", "PDF Reports", "Priority Support"],
    cta: "Upgrade to Pro",
    href: "/subscription",
    highlight: true,
    icon: Zap,
  },
  {
    name: "Premium",
    price: "₹499",
    period: "/month",
    features: ["Unlimited generations", "All Pro features", "Advanced Analytics", "API Access", "Dedicated Support", "Custom Integrations"],
    cta: "Go Premium",
    href: "/subscription",
    highlight: false,
    icon: Crown,
  },
];

const TESTIMONIALS = [
  { name: "Priya S.",       role: "QA Lead @ TechCorp",        text: "StoryAnalyst AI cut our story writing time by 70%. The test case generation is incredibly accurate.", stars: 5 },
  { name: "Rahul M.",       role: "Product Manager @ StartupX", text: "Finally an AI tool that understands QA workflows. The website explorer feature is a game changer.", stars: 5 },
  { name: "Aisha K.",       role: "SDET @ Enterprise Co",       text: "The combined generator + PDF reports saved us hours every sprint. Highly recommend Premium.", stars: 5 },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden:  { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function Home() {
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => { setHeroVisible(true); }, []);

  return (
    <div className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden pt-16">
        {/* Background glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl bg-brand-blue animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl bg-brand-purple animate-pulse pointer-events-none" style={{ animationDelay: "1s" }} />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: heroVisible ? 1 : 0, y: heroVisible ? 0 : 40 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-5xl mx-auto relative z-10"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-sm text-white/70 mb-6"
          >
            <Sparkles size={14} className="text-brand-purple" />
            <span>Powered by Gemini AI</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </motion.div>

          <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl text-white leading-tight mb-6 text-balance">
            AI-Powered{" "}
            <span className="gradient-text">QA Automation</span>
            <br />for Modern Teams
          </h1>

          <p className="text-white/60 text-lg sm:text-xl max-w-2xl mx-auto mb-10 text-balance">
            Generate user stories, explore websites, create test cases, and execute tests — all powered by AI.
            Ship with confidence, test smarter.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth?tab=signup" className="btn-primary text-base px-8 py-4 flex items-center gap-2 justify-center">
              Get Started Free <ArrowRight size={18} />
            </Link>
            <Link to="/how-it-works" className="btn-secondary text-base px-8 py-4 flex items-center gap-2 justify-center">
              How It Works
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-6 mt-10 text-sm text-white/40">
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> No credit card</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Free forever plan</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> 2-min setup</span>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        >
          <div className="w-5 h-8 rounded-full border border-white/20 flex items-center justify-center">
            <div className="w-1 h-2.5 rounded-full bg-white/30 animate-bounce" />
          </div>
        </motion.div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 border-y border-surface-border">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <p className="font-display font-bold text-3xl gradient-text">{s.value}</p>
              <p className="text-white/50 text-sm mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="section" id="features">
        <div className="container-xl">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display font-bold text-4xl text-white mb-4"
            >
              Everything you need for{" "}
              <span className="gradient-text">smarter QA</span>
            </motion.h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              From raw requirements to production-ready test reports — all in one AI-powered platform.
            </p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <motion.div key={f.title} variants={itemVariants}>
                  <Card className="h-full">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                      <Icon size={22} className="text-white" />
                    </div>
                    <h3 className="font-semibold text-white text-lg mb-2">{f.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section className="section" id="pricing">
        <div className="container-xl">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display font-bold text-4xl text-white mb-4"
            >
              Simple, transparent <span className="gradient-text">pricing</span>
            </motion.h2>
            <p className="text-white/50 text-lg">Start free. Upgrade when you need more.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan, i) => {
              const Icon = plan.icon;
              return (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -8 }}
                  className={`relative rounded-2xl p-6 border ${
                    plan.highlight
                      ? "border-brand-purple/60 bg-gradient-to-b from-brand-purple/20 to-brand-navy"
                      : "glass"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge badge-pro text-xs">
                      <Star size={10} /> {plan.badge}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    {Icon && <Icon size={18} className="text-brand-purple" />}
                    <h3 className="font-display font-bold text-white text-xl">{plan.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="font-display font-bold text-4xl gradient-text">{plan.price}</span>
                    <span className="text-white/40 text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                        <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={plan.href}
                    className={`block text-center font-semibold py-3 rounded-xl transition-all text-sm ${
                      plan.highlight ? "btn-primary" : "btn-secondary"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container-lg">
          <h2 className="font-display font-bold text-3xl text-center text-white mb-12">
            Loved by <span className="gradient-text">QA teams</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card>
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.stars }).map((_, si) => (
                      <Star key={si} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed mb-4">"{t.text}"</p>
                  <div>
                    <p className="font-semibold text-white text-sm">{t.name}</p>
                    <p className="text-white/40 text-xs">{t.role}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="section pb-32">
        <div className="container-lg">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass rounded-3xl p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-brand-gradient opacity-10 pointer-events-none" />
            <Shield size={40} className="mx-auto text-brand-purple mb-4" />
            <h2 className="font-display font-bold text-4xl text-white mb-4">
              Ready to transform your QA workflow?
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
              Join thousands of QA engineers and product managers who ship faster with AI-powered testing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth?tab=signup" className="btn-primary text-base px-8 py-4 flex items-center gap-2 justify-center">
                Start for Free <ArrowRight size={18} />
              </Link>
              <Link to="/contact" className="btn-secondary text-base px-8 py-4">
                Talk to Sales
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
