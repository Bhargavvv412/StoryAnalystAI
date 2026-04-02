import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, CheckCircle, XCircle, AlertCircle, Image, Download, Save, Plus, Trash2 } from "lucide-react";
import { startTestJob, pollTestJob, saveReport } from "../services/api";
import useStore from "../state/store";
import Button from "../components/Button";
import Card from "../components/Card";
import Modal from "../components/Modal";

const DEFAULT_CASES = [
  { id: "TC-001", title: "Verify homepage loads correctly", type: "Positive", steps: [{ step: 1, action: "Navigate to homepage", selector: "body" }], expectedResult: "Page loads within 3 seconds" },
  { id: "TC-002", title: "Verify login with valid credentials", type: "Positive", steps: [{ step: 1, action: "Enter email", selector: "#email", value: "test@example.com" }, { step: 2, action: "Enter password", selector: "#password" }, { step: 3, action: "Click submit", selector: "#submit" }], expectedResult: "User redirected to dashboard" },
  { id: "TC-003", title: "Verify login with invalid credentials", type: "Negative", steps: [{ step: 1, action: "Enter wrong email", selector: "#email" }, { step: 2, action: "Click submit", selector: "#submit" }], expectedResult: "Error message displayed" },
];

function ResultCard({ result }) {
  const [imgModal, setImgModal] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="glass rounded-xl p-4"
      >
        <div className="flex items-center gap-3 mb-2">
          {result.status === "Pass" ? (
            <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
          ) : (
            <XCircle size={18} className="text-red-400 flex-shrink-0" />
          )}
          <span className="font-medium text-white text-sm flex-1">{result.title}</span>
          <span className={`badge ${result.status === "Pass" ? "badge-pass" : "badge-fail"}`}>{result.status}</span>
          <span className="text-xs text-white/30">{result.execTime}s</span>
        </div>

        {/* Logs */}
        <div className="space-y-1 mb-3">
          {result.logs?.map((log, i) => (
            <p key={i} className={`text-xs font-mono ${log.startsWith("✅") ? "text-emerald-400" : log.startsWith("❌") ? "text-red-400" : "text-white/40"}`}>
              {log}
            </p>
          ))}
        </div>

        {/* Screenshot */}
        {result.screenshot && (
          <button
            onClick={() => setImgModal(true)}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <Image size={12} /> View screenshot
          </button>
        )}
      </motion.div>

      <Modal isOpen={imgModal} onClose={() => setImgModal(false)} title={`Screenshot: ${result.title}`} size="lg">
        <img src={result.screenshot} alt="Test screenshot" className="w-full rounded-xl object-cover" loading="lazy" />
        <a href={result.screenshot} download className="btn-secondary text-sm mt-4 inline-flex items-center gap-2">
          <Download size={14} /> Download
        </a>
      </Modal>
    </>
  );
}

export default function TestExecutorTab() {
  const [testCases, setTestCases] = useState(DEFAULT_CASES);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const pollRef = useRef(null);
  const { addToast, combinedOutput } = useStore(state => ({ 
    addToast: state.addToast, 
    combinedOutput: state.combinedOutput 
  }));

  // Auto-import generated test cases infinitely with no loss of data
  useEffect(() => {
    if (combinedOutput?.test_cases?.length > 0) {
      // Create executable array without losing steps
      setTestCases(combinedOutput.test_cases);
    }
  }, [combinedOutput]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handleRun() {
    if (!testCases.length) { addToast("Add at least one test case.", "warning"); return; }
    setLoading(true);
    setJob({ status: "running", progress: 0, total: testCases.length, results: [] });

    try {
      const { jobId } = await startTestJob(testCases);
      pollRef.current = setInterval(async () => {
        try {
          const status = await pollTestJob(jobId);
          setJob(status);
          if (status.status === "done") {
            clearInterval(pollRef.current);
            setLoading(false);
            addToast(`Tests complete: ${status.summary?.passed} passed, ${status.summary?.failed} failed`, status.summary?.failed > 0 ? "warning" : "success");
          }
        } catch {
          clearInterval(pollRef.current);
          setLoading(false);
        }
      }, 800);
    } catch (err) {
      setLoading(false);
      addToast("Test execution failed: " + err.message, "error");
    }
  }

  async function handleSave() {
    if (!job?.results?.length) return;
    setSaving(true);
    try {
      await saveReport("test", job.results, job.summary, {});
      addToast("Test report saved!", "success");
    } catch (err) { addToast(err.message, "error"); }
    finally { setSaving(false); }
  }

  function addTestCase() {
    if (!newTitle.trim()) return;
    setTestCases((tc) => [...tc, { id: `TC-${String(tc.length + 1).padStart(3, "0")}`, title: newTitle, type: "Positive", steps: [{ step: 1, action: newTitle, selector: "body" }], expectedResult: "Expected behavior occurs" }]);
    setNewTitle("");
  }

  const progressPercent = job ? Math.round((job.progress / job.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Test Case List */}
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Play size={20} className="text-emerald-400" />
            <h2 className="font-semibold text-white">Test Cases</h2>
            <span className="ml-auto text-xs text-white/30">{testCases.length} test{testCases.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {testCases.map((tc, i) => (
              <div key={tc.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 text-sm">
                <span className="font-mono text-xs text-white/30 w-12 flex-shrink-0">{tc.id}</span>
                <span className="text-white/80 flex-1 truncate">{tc.title}</span>
                <button onClick={() => setTestCases((t) => t.filter((_, j) => j !== i))} className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Add test */}
          <div className="flex gap-2">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="Add test case title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTestCase()}
            />
            <Button variant="secondary" size="sm" onClick={addTestCase} icon={Plus}>Add</Button>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleRun}
              loading={loading}
              disabled={!testCases.length}
              className="flex-1"
              icon={Play}
            >
              {loading ? "Running Tests..." : "Run All Tests"}
            </Button>
            {job?.results?.length > 0 && (
              <Button variant="secondary" onClick={handleSave} loading={saving} icon={Save}>Save</Button>
            )}
          </div>
        </Card>

        {/* Progress */}
        <AnimatePresence>
          {loading && job && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card hover={false}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">Running tests...</span>
                  <span className="text-sm font-semibold gradient-text">{job.progress}/{job.total}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full bg-brand-gradient rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <p className="text-xs text-white/30 mt-2">{progressPercent}% complete</p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary */}
        {job?.status === "done" && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Passed", value: job.summary?.passed, color: "text-emerald-400" },
              { label: "Failed", value: job.summary?.failed, color: "text-red-400" },
              { label: "Total",  value: job.summary?.total,  color: "text-white" },
            ].map((s) => (
              <Card key={s.label} hover={false}>
                <p className={`font-display font-bold text-xl ${s.color}`}>{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Right: Results */}
      <div className="space-y-3">
        {job?.results?.length > 0 ? (
          <>
            <h3 className="font-semibold text-white text-sm">Execution Results</h3>
            {job.results.map((r, i) => <ResultCard key={r.id || i} result={r} />)}
          </>
        ) : (
          <div className="glass rounded-2xl p-12 text-center">
            <Play size={40} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/40 text-sm">Run tests to see results here</p>
          </div>
        )}
      </div>
    </div>
  );
}
