import { motion } from "framer-motion";
import { Brain, Globe, Code2, Play, FileText, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const STEPS = [
  {
    step: "01", icon: Brain, color: "from-blue-500 to-blue-700",
    title: "Describe Your Requirements",
    desc: "Enter a natural language description of your feature or paste an existing requirement. Our AI understands context, ambiguity, and technical nuances.",
    detail: "Supports both high-level feature descriptions and detailed technical specs. Works with Agile epics, BDD scenarios, and free-form text.",
  },
  {
    step: "02", icon: Globe, color: "from-purple-500 to-purple-700",
    title: "Explore Your Website",
    desc: "Provide a URL and let our crawler automatically discover pages, forms, navigation flows, and interactive elements.",
    detail: "Powered by real browser crawling (Selenium) to capture dynamic content. Extracts CSS selectors, XPath, and accessibility metadata.",
  },
  {
    step: "03", icon: Code2, color: "from-indigo-500 to-indigo-700",
    title: "Generate Test Cases",
    desc: "AI combines your requirements with the site structure to produce comprehensive test cases covering positive, negative, boundary, and edge cases.",
    detail: "Each test case includes step-by-step actions, expected results, selectors, and mapping to user stories.",
  },
  {
    step: "04", icon: Play, color: "from-emerald-500 to-emerald-700",
    title: "Execute & Monitor",
    desc: "Run your test suite with a single click. Watch real-time progress as tests execute and capture screenshots on failure.",
    detail: "Supports both headless and headed execution. Imports test cases from JSON or previous reports.",
  },
  {
    step: "05", icon: FileText, color: "from-orange-500 to-orange-700",
    title: "Download Reports",
    desc: "Generate professional PDF reports with executive summaries, detailed results tables, and embedded screenshots.",
    detail: "Export as PDF, HTML, or CSV. Share via link or download for stakeholder presentations.",
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-20"
        >
          <span className="text-xs font-semibold text-brand-purple uppercase tracking-widest mb-4 block">The Process</span>
          <h1 className="font-display font-bold text-5xl text-white mb-4">
            How <span className="gradient-text">StoryAnalyst AI</span> works
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            From requirement to report in 5 simple steps — fully automated, AI-powered, and production-ready.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-brand-blue via-brand-purple to-brand-navy opacity-40 hidden md:block" />

          <div className="space-y-12">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-6 md:gap-10 items-start"
                >
                  {/* Icon */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg z-10 relative`}>
                      <Icon size={26} className="text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-brand-navy border-2 border-brand-purple flex items-center justify-center">
                      <span className="text-xs font-bold text-brand-purple">{i + 1}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-2">
                    <span className="text-xs font-mono text-white/30 mb-1 block">Step {step.step}</span>
                    <h2 className="font-display font-bold text-2xl text-white mb-2">{step.title}</h2>
                    <p className="text-white/60 leading-relaxed mb-3">{step.desc}</p>
                    <div className="glass rounded-xl p-3 text-xs text-white/40 leading-relaxed">
                      {step.detail}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-20"
        >
          <p className="text-white/60 text-lg mb-6">Ready to experience it yourself?</p>
          <Link to="/auth?tab=signup" className="btn-primary text-base px-8 py-4 inline-flex items-center gap-2">
            Start for Free <ArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
