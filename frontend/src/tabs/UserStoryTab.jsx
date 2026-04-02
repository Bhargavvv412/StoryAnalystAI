import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Copy, Download, Save, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { generateStory, saveReport } from "../services/api";
import useStore from "../state/store";
import Button from "../components/Button";
import Card from "../components/Card";
import { CardSkeleton } from "../components/LoadingSkeleton";

function StoryCard({ story, index }) {
  const priorityColors = { High: "text-red-400 bg-red-500/10", Medium: "text-amber-400 bg-amber-500/10", Low: "text-emerald-400 bg-emerald-500/10" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-white/30">{story.id}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[story.priority] || priorityColors.Medium}`}>
                {story.priority}
              </span>
              <span className="text-xs text-white/30">{story.storyPoints} pts</span>
            </div>
            <h3 className="font-semibold text-white">{story.title}</h3>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-white/60"><span className="text-white/40">As a</span> {story.asA}</p>
          <p className="text-white/60"><span className="text-white/40">I want</span> {story.iWant}</p>
          <p className="text-white/60"><span className="text-white/40">So that</span> {story.soThat}</p>
        </div>

        {story.acceptanceCriteria?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-white/40 mb-2">Acceptance Criteria</p>
            <ul className="space-y-1.5">
              {story.acceptanceCriteria.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                  <CheckCircle size={12} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {story.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {story.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-brand-purple/20 text-purple-300">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export default function UserStoryTab() {
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [output, setOutput] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const { addToast, setUsageCount } = useStore();

  async function handleGenerate() {
    if (!requirement.trim()) { addToast("Please enter your requirement.", "warning"); return; }
    setLoading(true); setError(null); setOutput(null);
    try {
      const data = await generateStory(requirement);
      const stories = data.analysis || data.stories || data;
      setOutput({ stories: Array.isArray(stories) ? stories : [stories], mock: data.mock, usageCount: data.usageCount });
      if (data.usageCount) setUsageCount(data.usageCount);
      if (data.mock) addToast("Showing demo data — Python AI service unavailable.", "warning");
      else addToast("User stories generated!", "success");
    } catch (err) {
      setError(err.message);
      if (err.message?.includes("limit")) addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(JSON.stringify(output.stories, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast("Copied to clipboard!", "success");
  }

  function handleDownload() {
    if (!output) return;
    const blob = new Blob([JSON.stringify(output.stories, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "user_stories.json"; a.click();
    URL.revokeObjectURL(url);
    addToast("Downloaded user_stories.json", "success");
  }

  async function handleSave() {
    if (!output) return;
    setSaving(true);
    try {
      await saveReport("story", output.stories, { total: output.stories.length }, { requirement });
      addToast("Report saved!", "success");
    } catch (err) {
      addToast("Failed to save: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Brain size={20} className="text-brand-blue" />
            <h2 className="font-semibold text-white">User Story Generator</h2>
            <div className="flex items-center gap-1 text-xs text-white/40 ml-auto">
              <Sparkles size={11} className="text-brand-purple" /> Gemini AI
            </div>
          </div>

          <label className="block text-xs font-medium text-white/50 mb-2" htmlFor="story-requirement">
            Requirement / Feature Description
          </label>
          <textarea
            id="story-requirement"
            className="textarea-field"
            placeholder="Describe your feature... e.g., 'User authentication system with email/password login, forgot password flow, and remember me option.'"
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            rows={8}
          />

          <div className="flex items-center justify-between mt-2 text-xs text-white/30">
            <span>{requirement.length} chars</span>
            <span>Generates 3-8 user stories</span>
          </div>

          <Button
            onClick={handleGenerate}
            loading={loading}
            disabled={!requirement.trim()}
            className="w-full mt-4"
            icon={Brain}
          >
            Generate User Stories
          </Button>
        </Card>

        {/* Tips */}
        <Card hover={false}>
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Tips for better results</h3>
          <ul className="space-y-2 text-xs text-white/50">
            {["Be specific about the user role and goal", "Mention technical constraints if any", "Include edge cases in your description", "Describe the expected user journey"].map((t) => (
              <li key={t} className="flex items-start gap-2"><CheckCircle size={10} className="text-emerald-400 mt-0.5 flex-shrink-0" />{t}</li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Output Panel */}
      <div className="space-y-4">
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {error && !loading && (
          <Card>
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-400 mb-1">Generation Failed</p>
                <p className="text-sm text-white/50">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {output && !loading && (
          <>
            {/* Action bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{output.stories.length} stories generated</span>
                {output.mock && <span className="badge badge-free">Demo Data</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleCopy} icon={copied ? CheckCircle : Copy}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDownload} icon={Download}>JSON</Button>
                <Button variant="secondary" size="sm" onClick={handleSave} loading={saving} icon={Save}>Save</Button>
              </div>
            </div>

            <div className="space-y-4">
              {output.stories.map((story, i) => (
                <StoryCard key={story.id || i} story={story} index={i} />
              ))}
            </div>
          </>
        )}

        {!output && !loading && !error && (
          <div className="glass rounded-2xl p-12 text-center">
            <Brain size={40} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/40 text-sm">Your generated user stories will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
