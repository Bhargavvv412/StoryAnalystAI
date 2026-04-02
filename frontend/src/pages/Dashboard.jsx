import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Globe, Code2, Play, FileText, Zap, Crown, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import useStore from "../state/store";
import UserStoryTab from "../tabs/UserStoryTab";
import WebsiteExplorerTab from "../tabs/WebsiteExplorerTab";
import CombinedTab from "../tabs/CombinedTab";
import TestExecutorTab from "../tabs/TestExecutorTab";
import ReportsTab from "../tabs/ReportsTab";

const TABS = [
  { id: "story",    label: "User Stories",     icon: Brain,    component: UserStoryTab },
  { id: "explorer", label: "Website Explorer", icon: Globe,    component: WebsiteExplorerTab },
  { id: "combined", label: "Combined",         icon: Code2,    component: CombinedTab },
  { id: "executor", label: "Test Executor",    icon: Play,     component: TestExecutorTab },
  { id: "reports",  label: "Reports",          icon: FileText, component: ReportsTab },
];

const PLAN_LIMITS = { free: 10, pro: 100, premium: 9999 };

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("story");
  const { user, plan, usageCount } = useStore();
  const limit = PLAN_LIMITS[plan] || 10;
  const usagePercent = Math.min((usageCount / limit) * 100, 100);
  const isAtLimit = usageCount >= limit && plan !== "premium";

  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component;

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
              Welcome, <span className="gradient-text">{user?.displayName?.split(" ")[0] || "there"}</span>
            </h1>
            <p className="text-white/40 text-sm mt-1">AI-powered QA workspace</p>
          </div>

          {/* Usage meter */}
          <div className="glass rounded-xl px-4 py-3 min-w-48">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-white/50">Monthly Usage</span>
              <span className={`text-xs font-semibold ${isAtLimit ? "text-red-400" : "text-white/70"}`}>
                {usageCount} / {plan === "premium" ? "∞" : limit}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isAtLimit ? "bg-red-500" : "bg-brand-gradient"}`}
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            {plan !== "premium" && (
              <Link to="/subscription" className="text-xs text-brand-purple hover:underline mt-1.5 block">
                {plan === "free" ? (
                  <span className="flex items-center gap-1"><Zap size={10} /> Upgrade to Pro</span>
                ) : (
                  <span className="flex items-center gap-1"><Crown size={10} /> Go Premium</span>
                )}
              </Link>
            )}
          </div>
        </div>

        {/* Usage limit warning */}
        <AnimatePresence>
          {isAtLimit && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 glass border border-orange-500/30 rounded-xl px-4 py-3 text-sm text-orange-300 mb-4"
            >
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>You've reached your {limit}-generation limit on the {plan} plan.</span>
              <Link to="/subscription" className="ml-auto btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                Upgrade Now
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs Row */}
        <div className="glass rounded-xl p-1 flex gap-1 overflow-x-auto mb-6 scrollbar-thin">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                aria-selected={activeTab === tab.id}
                role="tab"
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
          >
            {ActiveComponent && <ActiveComponent />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
