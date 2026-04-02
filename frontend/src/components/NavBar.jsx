import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Menu, X, ChevronDown, LogOut, User,
  Zap, Crown, BarChart3, Settings
} from "lucide-react";
import useStore from "../state/store";

const NAV_LINKS = [
  { label: "Home",         to: "/" },
  { label: "How It Works", to: "/how-it-works" },
  { label: "Dashboard",    to: "/dashboard" },
  { label: "Pricing",      to: "/subscription" },
  { label: "Contact",      to: "/contact" },
];

const PLAN_META = {
  free:    { label: "Free",    badge: "badge-free",    icon: null },
  pro:     { label: "Pro",     badge: "badge-pro",     icon: Zap },
  premium: { label: "Premium", badge: "badge-premium", icon: Crown },
};

export default function NavBar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, plan, usageCount, logout, addToast } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const planMeta = PLAN_META[plan] || PLAN_META.free;
  const PlanIcon = planMeta.icon;

  async function handleLogout() {
    await logout();
    addToast("Logged out successfully.", "info");
    navigate("/auth");
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-30">
      <div className="glass border-b border-surface-border">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center shadow-glow">
              <Brain size={18} className="text-white" />
            </div>
            <span className="font-display font-bold text-lg gradient-text hidden sm:block">
              StoryAnalyst AI
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === link.to
                    ? "text-white bg-white/10"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {user ? (
              /* Profile dropdown */
              <div className="relative">
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass hover:bg-white/10 transition-all duration-200"
                  aria-expanded={profileOpen}
                  aria-haspopup="true"
                  id="profile-menu-btn"
                >
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="hidden sm:flex flex-col items-start max-w-[120px]">
                    <span className="text-xs font-semibold text-white truncate max-w-full">
                      {user.displayName || user.email?.split("@")[0]}
                    </span>
                    <span className={`text-xs ${planMeta.badge} flex items-center gap-0.5`}>
                      {PlanIcon && <PlanIcon size={10} />} {planMeta.label}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-white/40 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 glass-strong rounded-xl py-2 shadow-2xl border border-surface-border"
                      role="menu"
                    >
                      {/* User info */}
                      <div className="px-4 py-2 border-b border-surface-border">
                        <p className="text-sm font-semibold text-white truncate">{user.displayName || "User"}</p>
                        <p className="text-xs text-white/40 truncate">{user.email}</p>
                      </div>

                      {/* Usage */}
                      <div className="px-4 py-2 border-b border-surface-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white/40">Usage</span>
                          <span className="text-xs text-white/60">{usageCount} / {plan === "premium" ? "∞" : plan === "pro" ? "100" : "10"}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-brand-gradient"
                            style={{ width: `${Math.min((usageCount / (plan === "premium" ? 1000 : plan === "pro" ? 100 : 10)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <Link
                        to="/dashboard"
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                        onClick={() => setProfileOpen(false)}
                        role="menuitem"
                      >
                        <BarChart3 size={15} /> Dashboard
                      </Link>
                      <Link
                        to="/subscription"
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                        onClick={() => setProfileOpen(false)}
                        role="menuitem"
                      >
                        <Crown size={15} /> Upgrade Plan
                      </Link>
                      <button
                        onClick={() => { setProfileOpen(false); handleLogout(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        role="menuitem"
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/auth" className="btn-ghost text-sm">Sign In</Link>
                <Link to="/auth?tab=signup" className="btn-primary text-sm px-4 py-2">Get Started</Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle mobile menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-surface-border overflow-hidden"
            >
              <div className="p-4 space-y-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      location.pathname === link.to
                        ? "text-white bg-brand-blue/20"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                {!user && (
                  <Link
                    to="/auth"
                    onClick={() => setMobileOpen(false)}
                    className="btn-primary w-full text-center mt-2 block"
                  >
                    Get Started Free
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
