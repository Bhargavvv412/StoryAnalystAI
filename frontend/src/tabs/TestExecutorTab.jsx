import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, CheckCircle, XCircle, AlertCircle, Image, Download, Save,
         ChevronLeft, ChevronRight, Activity, Cpu, Zap } from "lucide-react";
import { startTestJob, pollTestJob, saveReport } from "../services/api";
import useStore from "../state/store";
import Button from "../components/Button";
import Card from "../components/Card";
import Modal from "../components/Modal";

// Full backend URL so <img> tags resolve against Node API, not Vite dev server
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const TYPE_COLORS = {
  Positive:   "text-emerald-400 bg-emerald-500/10",
  Negative:   "text-red-400 bg-red-500/10",
  Boundary:   "text-amber-400 bg-amber-500/10",
  "Edge Case":"text-purple-400 bg-purple-500/10",
};

const STATUS_BADGE = {
  Pending: <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/60">Pending</span>,
  Pass:    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400"><CheckCircle size={10}/>Pass</span>,
  Fail:    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400"><XCircle size={10}/>Fail</span>,
  Error:   <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400"><AlertCircle size={10}/>Error</span>,
};

function ResultRow({ test, onViewScreenshot }) {
  const typeColor = TYPE_COLORS[test.original_tc?.type] || "text-white/40 bg-white/5";
  const screenshotUrl = test.screenshot
    ? (test.screenshot.startsWith("http") ? test.screenshot : `${BACKEND_URL}${test.screenshot}`)
    : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border last:border-0 hover:bg-white/5 transition-colors">
      {/* TC ID */}
      <div className="w-20 font-mono text-xs text-white/40 flex-shrink-0">{test.testId}</div>

      {/* Condition Name */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-white truncate" title={test.description}>{test.description}</p>
        {test.execTime > 0 && (
          <p className="text-xs text-white/30">{test.execTime}s</p>
        )}
      </div>

      {/* Type */}
      <div className="w-24 flex-shrink-0 hidden sm:block">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeColor}`}>
          {test.original_tc?.type || "—"}
        </span>
      </div>

      {/* Status */}
      <div className="w-24 flex-shrink-0">
        {STATUS_BADGE[test.status] || STATUS_BADGE.Pending}
      </div>

      {/* Screenshot Action */}
      <div className="w-10 flex justify-end flex-shrink-0">
        {screenshotUrl ? (
          <button
            onClick={() => onViewScreenshot(screenshotUrl, test.testId)}
            className="text-amber-400/70 hover:text-amber-400 transition-colors"
            title="View Screenshot"
          >
            <Image size={16} />
          </button>
        ) : (
          <span className="text-white/10"><Image size={16}/></span>
        )}
      </div>
    </div>
  );
}

export default function TestExecutorTab() {
  const {
    addToast,
    combinedOutput,
    generatedTests,
    setGeneratedTests,
    executedResults,
    setExecutedResults,
  } = useStore(state => ({
    addToast:          state.addToast,
    combinedOutput:    state.combinedOutput,
    generatedTests:    state.generatedTests,
    setGeneratedTests: state.setGeneratedTests,
    executedResults:   state.executedResults,
    setExecutedResults:state.setExecutedResults,
  }));

  const [job, setJob]           = useState(null);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [workers, setWorkers]   = useState(1);       // parallel Chrome instances
  const [page, setPage]         = useState(1);
  const [screenshotModal, setScreenshotModal] = useState({ open: false, url: "", title: "" });
  const ITEMS_PER_PAGE = 20;

  const pollRef      = useRef(null);
  // ref to latest generatedTests to avoid stale closure in polling callback
  const testsRef     = useRef(generatedTests);
  useEffect(() => { testsRef.current = generatedTests; }, [generatedTests]);

  // Map combinedOutput → normalised generatedTests whenever it changes
  useEffect(() => {
    if (combinedOutput?.test_cases?.length > 0) {
      const mapped = combinedOutput.test_cases.map((tc, idx) => {
        const testId = tc.tc_id || `TC-${String(idx + 1).padStart(3, "0")}`;
        const safeName = String(tc.condition || tc.feature || "test")
          .replace(/[^a-zA-Z0-9 ]/g, " ")
          .trim()
          .slice(0, 40);
        return {
          id:          crypto.randomUUID?.() ?? `uid-${idx}-${Math.random()}`,
          testId,
          name:        `${testId} — ${safeName}`,
          description: tc.condition || tc.title || "(no description)",
          status:      "Pending",
          screenshot:  null,
          execTime:    0,
          original_tc: tc,
        };
      });
      setGeneratedTests(mapped);
      setExecutedResults([]);
      setJob(null);
      setPage(1);
    }
  }, [combinedOutput, setGeneratedTests, setExecutedResults]);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function viewScreenshot(url, title) {
    setScreenshotModal({ open: true, url, title });
  }

  async function handleRun() {
    if (!generatedTests?.length) { addToast("Generate test cases first.", "warning"); return; }
    if (loading) return;

    setLoading(true);
    setExecutedResults([]);
    setJob({ status: "running", progress: 0, total: generatedTests.length, results: [] });

    // Reset all statuses to Pending
    const reset = generatedTests.map(t => ({ ...t, status: "Pending", screenshot: null, execTime: 0 }));
    setGeneratedTests(reset);
    testsRef.current = reset;

    if (pollRef.current) clearInterval(pollRef.current);

    const payload = generatedTests.map(t => t.original_tc);

    try {
      const { jobId } = await startTestJob(payload, workers);

      pollRef.current = setInterval(async () => {
        try {
          const status = await pollTestJob(jobId);
          setJob(status);

          if (status.results?.length) {
            setExecutedResults(status.results);

            // Update rows using the ref (avoids stale closure)
            const latest = testsRef.current.map(t => ({ ...t }));
            status.results.forEach(res => {
              const idx = latest.findIndex(
                t => t.testId === res.tc_id || t.testId === res.id
              );
              if (idx !== -1) {
                const screenshotUrl = res.screenshot
                  ? (res.screenshot.startsWith("http") ? res.screenshot : `${BACKEND_URL}${res.screenshot}`)
                  : null;
                latest[idx] = {
                  ...latest[idx],
                  status:    res.status,
                  screenshot: screenshotUrl,
                  execTime:  res.duration_seconds ?? res.execTime ?? 0,
                };
              }
            });
            setGeneratedTests(latest);
            testsRef.current = latest;
          }

          if (status.status === "done" || status.status === "failed") {
            clearInterval(pollRef.current);
            setLoading(false);
            if (status.status === "done") {
              addToast(
                `Done: ${status.summary?.passed ?? 0} passed, ${status.summary?.failed ?? 0} failed`,
                status.summary?.failed > 0 ? "warning" : "success"
              );
            } else {
              addToast(`Execution failed: ${status.error || "Unknown error"}`, "error");
            }
          }
        } catch {
          clearInterval(pollRef.current);
          setLoading(false);
          addToast("Polling error — check backend connection.", "error");
        }
      }, 4000);
    } catch (err) {
      setLoading(false);
      addToast("Failed to start execution: " + err.message, "error");
    }
  }

  async function handleSave() {
    if (!executedResults?.length) {
      addToast("No executed results to save.", "warning");
      return;
    }
    setSaving(true);
    try {
      await saveReport("test", executedResults, job?.summary || {}, {});
      addToast("Report saved! View it in the Reports tab.", "success");
    } catch (err) {
      addToast("Save failed: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.ceil((generatedTests?.length || 0) / ITEMS_PER_PAGE);
  const currentTests = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return (generatedTests || []).slice(start, start + ITEMS_PER_PAGE);
  }, [generatedTests, page]);

  const progressPercent = job?.total ? Math.round((job.progress / job.total) * 100) : 0;

  // Derived counts from live table
  const livePassed  = (generatedTests || []).filter(t => t.status === "Pass").length;
  const liveFailed  = (generatedTests || []).filter(t => t.status === "Fail").length;
  const liveErrored = (generatedTests || []).filter(t => t.status === "Error").length;
  const livePending = (generatedTests || []).filter(t => t.status === "Pending").length;

  return (
    <div className="space-y-6">
      <Card>
        {/* Workers + header row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow">
              <Activity size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Test Execution Engine</h2>
              <p className="text-xs text-white/40">
                {generatedTests?.length || 0} tests ready
                {executedResults?.length > 0 && ` · ${executedResults.length} executed`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {executedResults?.length > 0 && (
              <Button variant="secondary" size="sm" onClick={handleSave} loading={saving} icon={Save}>
                Save Report
              </Button>
            )}
            <Button
              onClick={handleRun}
              loading={loading}
              disabled={!generatedTests?.length}
              icon={Play}
            >
              {loading ? "Executing…" : "Run All Tests"}
            </Button>
          </div>
        </div>

        {/* Parallel Workers Selector */}
        <div className="mb-5 p-4 rounded-xl bg-white/5 border border-surface-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-white">Parallel Browsers</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-bold">{workers}×</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <Zap size={11} className="text-amber-400" />
                ~{workers}× faster
              </span>
              <span className="text-white/20">|</span>
              <span>RAM: ~{workers * 280}MB</span>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={workers}
            onChange={e => setWorkers(Number(e.target.value))}
            disabled={loading}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #7c6fff ${(workers - 1) / 7 * 100}%, rgba(255,255,255,0.1) ${(workers - 1) / 7 * 100}%)`,
            }}
          />
          <div className="flex justify-between text-xs text-white/25 mt-1 px-0.5">
            {[1,2,3,4,5,6,7,8].map(n => (
              <span key={n} className={workers === n ? "text-purple-400 font-bold" : ""}>{n}</span>
            ))}
          </div>
          {workers >= 4 && (
            <p className="mt-2 text-xs text-amber-400/70 flex items-center gap-1">
              ⚠ {workers} browsers × ~280MB = ~{workers * 280}MB RAM used simultaneously. Ensure your system can handle this.
            </p>
          )}
          {workers === 1 && (
            <p className="mt-2 text-xs text-white/30">Single browser — safe for any machine. Increase for faster execution.</p>
          )}
        </div>

        {/* Live stat pills — visible any time there are tests */}
        {generatedTests?.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: "Pending", value: livePending, color: "text-white/50",   bg: "bg-white/5" },
              { label: "Passed",  value: livePassed,  color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Failed",  value: liveFailed,  color: "text-red-400",     bg: "bg-red-500/10" },
              { label: "Errors",  value: liveErrored, color: "text-amber-400",   bg: "bg-amber-500/10" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center border border-surface-border`}>
                <p className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        <AnimatePresence>
          {loading && job && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                <span>Running tests headless in Chrome…</span>
                <span className="font-semibold gradient-text">{job.progress}/{job.total}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-brand-gradient rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <div className="border border-surface-border rounded-xl overflow-hidden min-h-[380px] flex flex-col">
          {/* Header row */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-border bg-white/5 text-xs font-semibold text-white/40 uppercase tracking-wider">
            <div className="w-20 flex-shrink-0">Test ID</div>
            <div className="flex-1">Condition / Description</div>
            <div className="w-24 hidden sm:block flex-shrink-0">Type</div>
            <div className="w-24 flex-shrink-0">Status</div>
            <div className="w-10 flex-shrink-0 text-right">📸</div>
          </div>

          <div className="flex-1 relative">
            {!generatedTests?.length ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                <AlertCircle size={36} className="text-white/10 mb-3" />
                <p className="text-white/30 text-sm">
                  No test cases yet.<br />
                  Go to the <span className="text-white/60">Combined</span> tab and generate tests first.
                </p>
              </div>
            ) : (
              currentTests.map(test => (
                <ResultRow key={test.id} test={test} onViewScreenshot={viewScreenshot} />
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
            <span>
              Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, generatedTests.length)} of {generatedTests.length}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} icon={ChevronLeft} />
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={14} />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>Last</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Screenshot Modal */}
      <Modal
        isOpen={screenshotModal.open}
        onClose={() => setScreenshotModal({ open: false, url: "", title: "" })}
        title={`Screenshot — ${screenshotModal.title}`}
        size="lg"
      >
        {screenshotModal.url ? (
          <>
            <img
              src={screenshotModal.url}
              alt="Failure screenshot"
              className="w-full rounded-xl border border-surface-border"
              loading="lazy"
            />
            <a
              href={screenshotModal.url}
              download
              className="btn-secondary text-sm mt-4 inline-flex items-center gap-2"
            >
              <Download size={14} /> Download PNG
            </a>
          </>
        ) : (
          <p className="text-white/40 text-sm text-center py-8">Screenshot not available.</p>
        )}
      </Modal>
    </div>
  );
}
