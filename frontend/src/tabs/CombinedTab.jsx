import { useState } from "react";
import { motion } from "framer-motion";
import { Code2, AlertCircle, CheckCircle, Download, Save, Brain, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { generateCombined, saveReport } from "../services/api";
import useStore from "../state/store";
import Button from "../components/Button";
import Card from "../components/Card";
import { CardSkeleton } from "../components/LoadingSkeleton";

const TYPE_META = {
  Positive:   { color: "text-emerald-400 bg-emerald-500/10", label: "Valid inputs → expected success" },
  Negative:   { color: "text-red-400   bg-red-500/10",     label: "Invalid inputs → error shown" },
  Boundary:   { color: "text-amber-400 bg-amber-500/10",   label: "Min/max limits exactly" },
  "Edge Case": { color: "text-purple-400 bg-purple-500/10",  label: "Unusual/extreme scenarios" },
};

function TestCaseRow({ tc, index }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[tc.type] || TYPE_META.Positive;

  // Python returns: tc_id, condition, type, priority, manual_steps, automation_steps
  const displayId    = tc.tc_id  || tc.id    || `#${index + 1}`;
  const displayTitle = tc.condition || tc.title || "(no description)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      className="glass rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-xs font-mono text-white/30 w-16 flex-shrink-0">{displayId}</span>
        <span className="font-medium text-white text-sm flex-1 truncate" title={displayTitle}>{displayTitle}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${meta.color}`}>{tc.type}</span>
        <span className="text-white/30 flex-shrink-0">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-surface-border">
          {/* Type legend */}
          <p className="text-xs text-white/40 mt-3 italic">🏷 {tc.type}: {meta.label}</p>

          {/* Priority + page */}
          <div className="flex gap-4 text-xs text-white/40">
            {tc.priority && <span>Priority: <span className="text-white/70">{tc.priority}</span></span>}
            {tc.page_title && <span>Page: <span className="text-white/70">{tc.page_title}</span></span>}
            {tc.form_name && tc.form_name !== "—" && <span>Form: <span className="text-white/70">{tc.form_name}</span></span>}
          </div>

          {/* Manual Steps */}
          {tc.manual_steps?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-white/50">Manual Steps:</p>
              {tc.manual_steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-brand-blue/20 text-blue-300 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-white/70">{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Automation Steps */}
          {tc.automation_steps?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-white/50">Automation Steps:</p>
              <div className="bg-black/20 rounded-lg p-2 font-mono text-xs text-white/50 space-y-0.5">
                {tc.automation_steps.map((step, i) => (
                  <p key={i}>{i + 1}. {step}</p>
                ))}
              </div>
            </div>
          )}

          {/* Old-style steps fallback */}
          {!tc.manual_steps && tc.steps?.map((step) => (
            <div key={step.step} className="flex items-start gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-brand-blue/20 text-blue-300 flex items-center justify-center font-bold flex-shrink-0">{step.step}</span>
              <div>
                <span className="text-white/70">{step.action}</span>
                {step.selector && <span className="text-white/30 ml-2 font-mono">{step.selector}</span>}
              </div>
            </div>
          ))}

          {tc.expectedResult && (
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle size={12} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <span className="text-white/60">{tc.expectedResult}</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function CombinedTab() {
  const [requirement, setRequirement] = useState("");
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [output, setOutput] = useState(null);
  const { addToast, setUsageCount, setCombinedOutput } = useStore();

  async function handleGenerate() {
    if (!requirement.trim() || !url.trim()) { addToast("Both requirement and URL are required.", "warning"); return; }
    setLoading(true); setError(null); setOutput(null);
    try {
      const data = await generateCombined(requirement, url, depth);
      setOutput(data);
      setCombinedOutput(data);
      if (data.usageCount) setUsageCount(data.usageCount);
      if (data.mock) addToast("Showing demo data.", "warning");
      else addToast("Combined analysis complete!", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!output) return;
    try {
      await saveReport("combined", output.test_cases, output.summary, { requirement, url });
      addToast("Saved!", "success");
    } catch (err) { addToast(err.message, "error"); }
  }

  function handleDownload() {
    if (!output) return;
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "combined_output.json"; a.click();
  }

  const summary = output?.summary;

  return (
    <div className="space-y-6">
      {/* Input */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Code2 size={20} className="text-indigo-400" />
          <h2 className="font-semibold text-white">Combined Generator</h2>
          <span className="text-xs text-white/30 ml-auto">Story + Site → Test Cases</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Requirement</label>
            <textarea
              className="textarea-field"
              placeholder="Describe your feature requirement..."
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Website URL</label>
              <input type="url" className="input-field" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Crawl Depth: {depth}</label>
              <input type="range" min={1} max={2} value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="w-full accent-indigo-500" />
            </div>
          </div>
        </div>

        <Button onClick={handleGenerate} loading={loading} disabled={!requirement.trim() || !url.trim()} className="mt-4" icon={Code2}>
          Generate Combined Analysis
        </Button>
      </Card>

      {loading && <div className="space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>}

      {error && !loading && (
        <Card>
          <div className="flex gap-3"><AlertCircle size={18} className="text-red-400" /><div><p className="font-semibold text-red-400">Failed</p><p className="text-sm text-white/50">{error}</p></div></div>
        </Card>
      )}

      {output && !loading && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total",      value: summary?.total || 0,              color: "text-white" },
              { label: "Positive",   value: summary?.by_type?.Positive   || 0, color: "text-emerald-400", hint: "Valid input flows" },
              { label: "Negative",   value: summary?.by_type?.Negative   || 0, color: "text-red-400",     hint: "Error/rejection flows" },
              { label: "Boundary",   value: summary?.by_type?.Boundary   || 0, color: "text-amber-400",   hint: "Min/max edge" },
              { label: "Edge Case",  value: summary?.by_type?.["Edge Case"] || 0, color: "text-purple-400", hint: "Unusual scenarios" },
              { label: "Mapped",     value: summary?.mapped || 0,              color: "text-blue-400",    hint: "Linked to real page" },
            ].map((s) => (
              <Card key={s.label} hover={false}>
                <p className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
                {s.hint && <p className="text-white/20 text-[10px] leading-tight mt-0.5">{s.hint}</p>}
              </Card>
            ))}
          </div>

          {/* Type legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(TYPE_META).map(([type, m]) => (
              <span key={type} className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${m.color}`}>
                <span className="font-semibold">{type}</span>
                <span className="text-white/40">— {m.label}</span>
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{output.test_cases?.length} test cases</span>
              {output.mock && <span className="badge badge-free">Demo Data</span>}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleDownload} icon={Download}>JSON</Button>
              <Button variant="secondary" size="sm" onClick={handleSave} icon={Save}>Save</Button>
            </div>
          </div>

          {/* Test Cases */}
          <div className="space-y-2">
            {output.test_cases?.map((tc, i) => <TestCaseRow key={tc.id || i} tc={tc} index={i} />)}
          </div>
        </>
      )}

      {!output && !loading && !error && (
        <div className="glass rounded-2xl p-12 text-center">
          <Code2 size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/40 text-sm">Combined results will appear here</p>
        </div>
      )}
    </div>
  );
}
