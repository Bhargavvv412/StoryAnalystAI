import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Search, AlertCircle, CheckCircle, Copy, Download, Save, ExternalLink } from "lucide-react";
import { exploreWebsite, saveReport } from "../services/api";
import useStore from "../state/store";
import Button from "../components/Button";
import Card from "../components/Card";
import { CardSkeleton } from "../components/LoadingSkeleton";

export default function WebsiteExplorerTab() {
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [output, setOutput] = useState(null);
  const { addToast, setUsageCount } = useStore();

  async function handleExplore() {
    if (!url.trim()) { addToast("Please enter a website URL.", "warning"); return; }
    if (!url.startsWith("http")) { addToast("URL must start with http:// or https://", "warning"); return; }
    setLoading(true); setError(null); setOutput(null);
    try {
      const data = await exploreWebsite(url, depth);
      setOutput(data);
      if (data.usageCount) setUsageCount(data.usageCount);
      if (data.mock) addToast("Showing demo data — explorer unavailable.", "warning");
      else addToast("Website explored successfully!", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!output) return;
    try {
      await saveReport("explorer", output.pages || [], output, { url });
      addToast("Exploration report saved!", "success");
    } catch (err) {
      addToast("Failed to save: " + err.message, "error");
    }
  }

  function handleDownload() {
    if (!output) return;
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "website_exploration.json"; a.click();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input */}
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Globe size={20} className="text-brand-purple" />
            <h2 className="font-semibold text-white">Website Explorer</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2" htmlFor="explore-url">Website URL</label>
              <div className="relative">
                <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="explore-url"
                  type="url"
                  className="input-field pl-9"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Crawl Depth: {depth}</label>
              <input
                type="range" min={1} max={2} value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="w-full accent-brand-purple"
              />
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>Surface (1 page)</span>
                <span>Deep (2 levels)</span>
              </div>
            </div>

            <Button onClick={handleExplore} loading={loading} disabled={!url.trim()} className="w-full" icon={Search}>
              Explore Website
            </Button>
          </div>
        </Card>

        <Card hover={false}>
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">What gets extracted</h3>
          <ul className="space-y-2 text-xs text-white/50">
            {["Page titles and navigation structure", "Forms and interactive elements", "Technology stack detection", "Accessibility issues", "Testable user flows"].map((t) => (
              <li key={t} className="flex items-start gap-2"><CheckCircle size={10} className="text-emerald-400 mt-0.5 flex-shrink-0" />{t}</li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Output */}
      <div className="space-y-4">
        {loading && <div className="space-y-4">{[1, 2].map((i) => <CardSkeleton key={i} />)}</div>}
        {error && !loading && (
          <Card>
            <div className="flex gap-3">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
              <div><p className="font-semibold text-red-400">Exploration Failed</p><p className="text-sm text-white/50">{error}</p></div>
            </div>
          </Card>
        )}

        {output && !loading && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{output.pages?.length || 0} pages found</span>
                {output.mock && <span className="badge badge-free">Demo Data</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleDownload} icon={Download}>JSON</Button>
                <Button variant="secondary" size="sm" onClick={handleSave} icon={Save}>Save</Button>
              </div>
            </div>

            {/* Technologies */}
            {output.technologies?.length > 0 && (
              <Card>
                <h3 className="text-xs font-semibold text-white/40 mb-2">Technologies Detected</h3>
                <div className="flex flex-wrap gap-2">
                  {output.technologies.map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-brand-blue/20 text-blue-300">{t}</span>
                  ))}
                </div>
              </Card>
            )}

            {/* Pages */}
            {output.pages?.map((page, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe size={14} className="text-brand-purple" />
                    <span className="font-semibold text-white text-sm truncate">{page.title || "Page"}</span>
                    <a href={page.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-white/30 hover:text-white/60">
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <p className="text-xs text-white/30 mb-3 truncate">{page.url}</p>

                  {page.features?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-white/40 mb-1.5">Features</p>
                      <div className="flex flex-wrap gap-1.5">
                        {page.features.map((f) => <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">{f}</span>)}
                      </div>
                    </div>
                  )}
                  {page.forms?.length > 0 && (
                    <div>
                      <p className="text-xs text-white/40 mb-1.5">Forms</p>
                      <div className="flex flex-wrap gap-1.5">
                        {page.forms.map((f) => <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">{f}</span>)}
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}

            {/* Accessibility Issues */}
            {output.accessibilityIssues?.length > 0 && (
              <Card>
                <h3 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle size={12} /> Accessibility Issues
                </h3>
                <ul className="space-y-1.5">
                  {output.accessibilityIssues.map((issue, i) => (
                    <li key={i} className="text-xs text-white/50 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">•</span> {issue}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}

        {!output && !loading && !error && (
          <div className="glass rounded-2xl p-12 text-center">
            <Globe size={40} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/40 text-sm">Exploration results will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
