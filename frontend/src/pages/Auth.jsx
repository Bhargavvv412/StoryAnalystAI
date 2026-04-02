import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Mail, Lock, User, Eye, EyeOff, AlertCircle, Chrome } from "lucide-react";
import useStore from "../state/store";
import Button from "../components/Button";

export default function Auth() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "signup" ? "signup" : "login");
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const { login, signup, loginWithGoogle, authError, authLoading, user, addToast } = useStore();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate("/dashboard", { replace: true }); }, [user]);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (tab === "login") {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) { addToast("Name is required.", "error"); return; }
        await signup(form.email, form.password, form.name);
      }
      addToast(`Welcome${tab === "signup" ? " to StoryAnalyst AI" : " back"}!`, "success");
      navigate("/dashboard");
    } catch {
      // Error already in store as authError
    }
  }

  async function handleGoogle() {
    try {
      await loginWithGoogle();
      addToast("Signed in with Google!", "success");
      navigate("/dashboard");
    } catch {
      // Error in store
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      {/* Background */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-gradient opacity-10 blur-3xl rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow">
              <Brain size={20} className="text-white" />
            </div>
            <span className="font-display font-bold text-xl gradient-text">StoryAnalyst AI</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {tab === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {tab === "login" ? "Sign in to your workspace" : "Start your free QA journey"}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-xl p-1 mb-6" style={{ background: "rgba(255,255,255,0.05)" }}>
          {["login", "signup"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tab === t ? "bg-brand-gradient text-white shadow-glow" : "text-white/40 hover:text-white/70"
              }`}
            >
              {t === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Google Sign-in */}
        <button
          onClick={handleGoogle}
          disabled={authLoading}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-surface-border text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all mb-6"
        >
          <Chrome size={18} />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-surface-border" />
          <span className="text-white/30 text-xs">or continue with email</span>
          <div className="flex-1 h-px bg-surface-border" />
        </div>

        {/* Error */}
        <AnimatePresence>
          {authError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 text-sm text-red-400 mb-4"
            >
              <AlertCircle size={15} className="flex-shrink-0" />
              {authError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence>
            {tab === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="name">
                  Full Name
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required={tab === "signup"}
                    className="input-field pl-10"
                    autoComplete="name"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="input-field pl-10"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                id="password"
                name="password"
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder={tab === "signup" ? "Min 6 characters" : "Your password"}
                required
                minLength={tab === "signup" ? 6 : undefined}
                className="input-field pl-10 pr-10"
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type="submit" variant="primary" loading={authLoading} className="w-full mt-2">
            {tab === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-xs text-white/30 mt-6">
          {tab === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            className="text-brand-blue hover:underline font-medium"
            onClick={() => setTab(tab === "login" ? "signup" : "login")}
          >
            {tab === "login" ? "Sign Up Free" : "Sign In"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
