// ── State ─────────────────────────────────────────────────────────────────
let _lastResult = null;  // story results
let _explorerData = null;  // website explorer results
let _combinedData = null;  // combined results
let _execData = null;  // execution results
let _allCards = [];    // story test case cards for filtering
let _comboCards = [];    // combined test case cards for filtering
let _currentMode = "story";

// ── Mode switching ─────────────────────────────────────────────────────────
function switchMode(mode) {
  _currentMode = mode;
  ["story", "url", "combo", "exec", "report"].forEach(m => {
    document.getElementById("tab-" + m)?.classList.toggle("active", mode === m);
    document.getElementById("panel-" + m)?.classList.toggle("hidden", mode !== m);
  });
  hideResults(); hideExplorerResults(); hideCombinedResults(); hideExecutionResults(); hideError();
}

// ── Example chips (story) ──────────────────────────────────────────────────
document.querySelectorAll(".chip[data-story]").forEach(chip => {
  chip.addEventListener("click", () => {
    document.getElementById("story-input").value = chip.dataset.story;
  });
});
// Example chips (URL)
document.querySelectorAll(".chip[data-url]").forEach(chip => {
  chip.addEventListener("click", () => {
    document.getElementById("url-input").value = chip.dataset.url;
  });
});
// Example chips (Combined)
document.querySelectorAll(".chip[data-combo-story]").forEach(chip => {
  chip.addEventListener("click", () => {
    document.getElementById("combo-story").value = chip.dataset.comboStory;
    document.getElementById("combo-url").value = chip.dataset.comboUrl;
  });
});

// ── STORY ANALYSIS ─────────────────────────────────────────────────────────
async function analyze() {
  const story = document.getElementById("story-input").value.trim();
  if (!story) { showError("Please enter a user story first."); return; }

  hideError(); hideResults(); hideExplorerResults();
  showLoader("🤖 Gemini AI agents are thinking…");
  setBtn("analyze-btn", true, "⏳ Analyzing…");

  try {
    const res = await fetch("/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "Something went wrong."); return; }
    _lastResult = data;
    renderResults(data);
  } catch (err) {
    showError("Network error: " + err.message);
  } finally {
    hideLoader();
    setBtn("analyze-btn", false, "🚀 Analyze &amp; Generate Test Cases");
  }
}

function renderResults(data) {
  const { analysis, test_suite } = data;
  document.getElementById("res-feature").textContent = analysis.feature;
  document.getElementById("res-role").textContent = analysis.user_role;
  document.getElementById("res-count").textContent = `${analysis.conditions.length} conditions found`;

  const cl = document.getElementById("conditions-list");
  cl.innerHTML = "";
  analysis.conditions.forEach(c => {
    const li = document.createElement("li"); li.textContent = c; cl.appendChild(li);
  });
  renderStats(test_suite.test_cases);
  renderTestCases(test_suite.test_cases);
  showResults();
  document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderStats(cases) {
  const counts = { Positive: 0, Negative: 0, Boundary: 0, "Edge Case": 0 };
  cases.forEach(c => { if (c.type in counts) counts[c.type]++; });
  document.getElementById("stats-row").innerHTML = `
    <div class="stat-chip stat-total"><span class="stat-number">${cases.length}</span><span class="stat-label">Total</span></div>
    <div class="stat-chip stat-pos"><span class="stat-number">${counts["Positive"]}</span><span class="stat-label">✅ Positive</span></div>
    <div class="stat-chip stat-neg"><span class="stat-number">${counts["Negative"]}</span><span class="stat-label">❌ Negative</span></div>
    <div class="stat-chip stat-bound"><span class="stat-number">${counts["Boundary"]}</span><span class="stat-label">📏 Boundary</span></div>
    <div class="stat-chip stat-edge"><span class="stat-number">${counts["Edge Case"]}</span><span class="stat-label">⚠️ Edge</span></div>
  `;
}

function renderTestCases(cases) {
  const container = document.getElementById("test-cases-container");
  container.innerHTML = ""; _allCards = [];
  cases.forEach((tc, idx) => {
    const card = buildCard(tc, idx);
    container.appendChild(card);
    _allCards.push({ el: card, type: tc.type });
  });
}

function buildCard(tc, idx) {
  const borderMap = { "Positive": "left-border-pos", "Negative": "left-border-neg", "Boundary": "left-border-bnd", "Edge Case": "left-border-edg" };
  const badgeMap = { "Positive": "badge-Positive", "Negative": "badge-Negative", "Boundary": "badge-Boundary", "Edge Case": "badge-EdgeCase" };
  const card = document.createElement("div");
  card.className = `tc-card ${borderMap[tc.type] || ""}`;
  card.id = `tc-${idx}`;
  const precItems = (tc.preconditions || []).map(p => `<li>${esc(p)}</li>`).join("");
  const stepItems = (tc.steps || []).map(s => `<li>${esc(s)}</li>`).join("");
  card.innerHTML = `
    <div class="tc-card-header" onclick="toggleCard(${idx})">
      <div class="tc-row-main">
          <span class="tc-id">${esc(tc.id)}</span>
          <span class="tc-title">${esc(tc.title)}</span>
          <span class="tc-chevron">▼</span>
      </div>
      <div class="tc-row-meta">
          <span class="tc-badge ${badgeMap[tc.type] || ""}">${esc(tc.type)}</span>
          <span class="tc-priority-badge prio-${esc(tc.priority)}">${esc(tc.priority)}</span>
      </div>
    </div>
    <div class="tc-card-body">
      ${precItems ? `<div class="tc-section"><h4>Preconditions</h4><ul>${precItems}</ul></div>` : ""}
      <div class="tc-section"><h4>Test Steps</h4><ol>${stepItems}</ol></div>
      <div class="tc-section"><h4>Expected Result</h4><div class="tc-expected">${esc(tc.expected_result)}</div></div>
    </div>`;
  return card;
}

function toggleCard(idx) {
  const card = document.getElementById(`tc-${idx}`);
  if (card) card.classList.toggle("open");
}

function filterCases(type, btn) {
  document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  _allCards.forEach(({ el, type: tcType }) => {
    el.style.display = (type === "all" || tcType === type) ? "" : "none";
  });
}

function exportJSON() {
  if (!_lastResult) return;
  download("test_cases.json", JSON.stringify(_lastResult, null, 2), "application/json");
}
function exportCSV() {
  if (!_lastResult) return;
  const cases = _lastResult.test_suite.test_cases;
  const header = ["ID", "Title", "Type", "Priority", "Preconditions", "Steps", "Expected Result"];
  const rows = cases.map(tc => [tc.id, tc.title, tc.type, tc.priority,
  (tc.preconditions || []).join(" | "), (tc.steps || []).join(" | "), tc.expected_result]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  download("test_cases.csv", csv, "text/csv");
}

// ── WEBSITE EXPLORER ──────────────────────────────────────────────────────
async function exploreUrl() {
  const url = document.getElementById("url-input").value.trim();
  const depth = parseInt(document.getElementById("depth-select").value);
  if (!url) { showError("Please enter a URL first."); return; }

  hideError(); hideResults(); hideExplorerResults();
  showLoader(`🌐 Crawling ${url}…`);
  setBtn("explore-btn", true, "⏳ Exploring…");

  try {
    const res = await fetch("/explore", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, depth }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "Could not reach the website."); return; }
    _explorerData = data;
    renderExplorerResults(data);
  } catch (err) {
    showError("Network error: " + err.message);
  } finally {
    hideLoader();
    setBtn("explore-btn", false, "🔍 Explore Website");
  }
}

function renderExplorerResults(data) {
  const pages = data.pages || [];
  const totalForms = pages.reduce((s, p) => s + (p.forms || []).length, 0);
  const totalFields = pages.reduce((s, p) => s + (p.forms || []).reduce((f, frm) => f + (frm.fields || []).length, 0), 0);
  const totalLinks = pages.reduce((s, p) => s + (p.links || []).length, 0);

  document.getElementById("explorer-meta").innerHTML = `
    <span class="explorer-meta-badge">🗂️ ${pages.length} page${pages.length !== 1 ? "s" : ""}</span>
    <span class="explorer-meta-badge">📋 ${totalForms} form${totalForms !== 1 ? "s" : ""}</span>
    <span class="explorer-meta-badge">🔤 ${totalFields} field${totalFields !== 1 ? "s" : ""}</span>
    <span class="explorer-meta-badge">🔗 ${totalLinks} link${totalLinks !== 1 ? "s" : ""}</span>`;

  const container = document.getElementById("explorer-pages");
  container.innerHTML = "";
  pages.forEach(page => container.appendChild(buildPageBlock(page)));
  showExplorerResults();
  document.getElementById("explorer-results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildPageBlock(page) {
  const div = document.createElement("div");
  div.className = "page-block";

  const forms = page.forms || [];
  const links = page.links || [];

  let formsHtml = `<div class="explorer-section-title">📋 Forms <span class="explorer-count-badge">${forms.length}</span></div>`;
  if (forms.length === 0) {
    formsHtml += `<p style="color:var(--text-muted);font-size:.85rem">No forms found on this page.</p>`;
  } else {
    forms.forEach(form => {
      const fieldsRows = (form.fields || []).map(f => `
        <tr>
          <td>${esc(f.name)}</td>
          <td><span class="field-type-badge">${esc(f.type)}</span></td>
          <td>${f.required ? '<span class="required-yes">✓ Yes</span>' : '<span class="required-no">No</span>'}</td>
          <td style="color:var(--text-muted);font-size:.75rem">${esc(f.placeholder || "")}</td>
        </tr>`).join("");
      const btnChips = (form.buttons || []).map(b => `<span class="btn-chip">${esc(b.text)}</span>`).join("");
      formsHtml += `
        <div class="form-card">
          <div class="form-card-name">
            📄 ${esc(form.name)}
            <span class="form-method-badge">${esc(form.method || "GET")}</span>
          </div>
          ${form.fields.length ? `
          <table class="fields-table">
            <thead><tr><th>Field Name</th><th>Type</th><th>Required</th><th>Placeholder</th></tr></thead>
            <tbody>${fieldsRows}</tbody>
          </table>` : '<p style="color:var(--text-muted);font-size:.8rem">No input fields.</p>'}
          ${btnChips ? `<div class="btn-chips">${btnChips}</div>` : ""}
        </div>`;
    });
  }

  let linksHtml = `<div class="explorer-section-title">🔗 Navigation Links <span class="explorer-count-badge">${links.length}</span></div>`;
  if (links.length === 0) {
    linksHtml += `<p style="color:var(--text-muted);font-size:.85rem">No links found.</p>`;
  } else {
    linksHtml += `<div class="links-list">` + links.map(l => `
      <div class="link-row">
        <span class="link-text">${esc(l.text || "—")}</span>
        <span class="link-href"><a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.href)}</a></span>
      </div>`).join("") + `</div>`;
  }

  div.innerHTML = `
    <div class="page-block-header">
      <div class="tc-row-main">
          <span class="page-title-text">${esc(page.title || "Page")}</span>
          ${page.error ? `<span style="color:#fca5a5;font-size:.78rem">⚠️ ${esc(page.error)}</span>` : ""}
      </div>
      <div class="tc-row-meta" style="padding-left: 0;">
          <span class="page-url">${esc(page.url)}</span>
      </div>
    </div>
    <div class="page-block-body">
      <div>${formsHtml}</div>
      <div>${linksHtml}</div>
    </div>`;
  return div;
}

function exportExplorerJSON() {
  if (!_explorerData) return;
  download("website_structure.json", JSON.stringify(_explorerData, null, 2), "application/json");
}

// ── COMBINED GENERATOR ────────────────────────────────────────────────────
async function generateCombined() {
  const story = document.getElementById("combo-story").value.trim();
  const url = document.getElementById("combo-url").value.trim();
  const depth = parseInt(document.getElementById("combo-depth").value);
  if (!story) { showError("Please enter a user story in the Combined panel."); return; }
  if (!url) { showError("Please enter a website URL in the Combined panel."); return; }

  hideError(); hideResults(); hideExplorerResults(); hideCombinedResults();
  showLoader(`⚡ Crawling ${url} and generating combined test cases…`);
  setBtn("combo-btn", true, "⏳ Generating…");

  try {
    const res = await fetch("/generate-combined", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story, url, depth }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "Something went wrong."); return; }
    _combinedData = data;
    renderCombinedResults(data);
  } catch (err) {
    showError("Network error: " + err.message);
  } finally {
    hideLoader();
    setBtn("combo-btn", false, "⚡ Generate Combined Test Cases");
  }
}

function renderCombinedResults(data) {
  const { summary, test_cases } = data;
  const { total, mapped, unmapped, by_type } = summary;

  document.getElementById("combined-meta").innerHTML = `
    <span class="explorer-meta-badge">🧪 ${total} test case${total !== 1 ? "s" : ""}</span>
    <span class="mapped-badge">✅ ${mapped} mapped</span>
    ${unmapped ? `<span class="unmapped-badge">⚠️ ${unmapped} unmapped</span>` : ""}
    <span class="explorer-meta-badge">✅ ${by_type["Positive"]} Positive</span>
    <span class="explorer-meta-badge">❌ ${by_type["Negative"]} Negative</span>
    <span class="explorer-meta-badge">📏 ${by_type["Boundary"]} Boundary</span>
    <span class="explorer-meta-badge">⚠️ ${by_type["Edge Case"]} Edge</span>`;

  const container = document.getElementById("combined-container");
  container.innerHTML = ""; _comboCards = [];
  test_cases.forEach((tc, idx) => {
    const card = buildCombinedCard(tc, idx);
    container.appendChild(card);
    _comboCards.push({ el: card, type: tc.type, mapped: tc.mapped });
  });

  showCombinedResults();
  document.getElementById("combined-results").scrollIntoView({ behavior: "smooth", block: "start" });
  _enableRunBtn();
}

function buildCombinedCard(tc, idx) {
  const borderMap = { "Positive": "left-border-pos", "Negative": "left-border-neg", "Boundary": "left-border-bnd", "Edge Case": "left-border-edg" };
  const badgeMap = { "Positive": "badge-Positive", "Negative": "badge-Negative", "Boundary": "badge-Boundary", "Edge Case": "badge-EdgeCase" };

  const manualHtml = (tc.manual_steps || []).map((s, i) =>
    `<li>${esc(s)}</li>`).join("");
  const autoHtml = (tc.automation_steps || []).map(s =>
    `<li><code class="auto-step">${esc(s)}</code></li>`).join("");

  const card = document.createElement("div");
  card.className = `ctc-card ${borderMap[tc.type] || ""}`;
  card.id = `ctc-${idx}`;
  card.innerHTML = `
    <div class="ctc-card-header" onclick="toggleCombinedCard(${idx})">
      <div class="tc-row-main">
          <span class="ctc-id">${esc(tc.tc_id)}</span>
          <span class="ctc-condition">${esc(tc.condition)}</span>
          <span class="tc-chevron">▼</span>
      </div>
      <div class="tc-row-meta">
          <span class="tc-badge ${badgeMap[tc.type] || ""}">` + esc(tc.type) + `</span>
          <span class="tc-priority-badge prio-${esc(tc.priority)}">${esc(tc.priority)}</span>
          ${tc.mapped ? '<span class="mapped-badge">✅ Mapped</span>' : '<span class="unmapped-badge">⚠️ Unmapped</span>'}
      </div>
    </div>
    <div class="ctc-body">
      <div class="steps-col">
        <h4>👤 Manual Steps</h4>
        <ol>${manualHtml}</ol>
      </div>
      <div class="steps-col">
        <h4>🤖 Automation Steps</h4>
        <ol>${autoHtml}</ol>
      </div>
    </div>`;
  return card;
}

function toggleCombinedCard(idx) {
  const card = document.getElementById(`ctc-${idx}`);
  if (card) card.classList.toggle("open");
}

function filterCombined(type, btn) {
  document.querySelectorAll("#combo-pills .pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  _comboCards.forEach(({ el, type: tcType, mapped }) => {
    let show = false;
    if (type === "all") show = true;
    else if (type === "unmapped") show = !mapped;
    else show = tcType === type;
    el.style.display = show ? "" : "none";
  });
}

function exportCombinedJSON() {
  if (!_combinedData) return;
  download("combined_test_cases.json", JSON.stringify(_combinedData, null, 2), "application/json");
}
function exportCombinedCSV() {
  if (!_combinedData) return;
  const cases = _combinedData.test_cases;
  const header = ["TC ID", "Feature", "User Role", "Type", "Priority", "Condition", "Page URL", "Page Title", "Form Name", "Mapped", "Manual Steps", "Automation Steps"];
  const rows = cases.map(tc => [
    tc.tc_id, tc.feature, tc.user_role, tc.type, tc.priority,
    tc.condition, tc.page_url, tc.page_title, tc.form_name,
    tc.mapped ? "Yes" : "No",
    (tc.manual_steps || []).join(" | "),
    (tc.automation_steps || []).join(" | "),
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(",")).join("\n");
  download("combined_test_cases.csv", csv, "text/csv");
}

// ── Shared utilities ───────────────────────────────────────────────────────
function clearAll() {
  document.getElementById("story-input").value = "";
  document.getElementById("url-input").value = "";
  document.getElementById("combo-story").value = "";
  document.getElementById("combo-url").value = "";
  hideResults(); hideExplorerResults(); hideCombinedResults(); hideExecutionResults(); hideError();
  _lastResult = null; _explorerData = null; _combinedData = null; _execData = null;
}

function showLoader(msg) {
  document.getElementById("loader-text").textContent = msg || "Processing…";
  document.getElementById("loader").classList.remove("hidden");
}
function hideLoader() { document.getElementById("loader").classList.add("hidden"); }
function showResults() { document.getElementById("results").classList.remove("hidden"); }
function hideResults() { document.getElementById("results").classList.add("hidden"); }
function showExplorerResults() { document.getElementById("explorer-results").classList.remove("hidden"); }
function hideExplorerResults() { document.getElementById("explorer-results").classList.add("hidden"); }
function showCombinedResults() { document.getElementById("combined-results").classList.remove("hidden"); }
function hideCombinedResults() { document.getElementById("combined-results").classList.add("hidden"); }
function showExecutionResults() { document.getElementById("execution-results").classList.remove("hidden"); }
function hideExecutionResults() { document.getElementById("execution-results").classList.add("hidden"); }
function showError(msg) { const b = document.getElementById("error-banner"); b.innerHTML = "⚠️ " + esc(msg); b.classList.remove("hidden"); }
function hideError() { document.getElementById("error-banner").classList.add("hidden"); }

function download(filename, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename; a.click();
}

function setBtn(id, loading, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = label;
}

// ── TEST EXECUTOR ─────────────────────────────────────────────────────────
async function runTests() {
  if (!_combinedData || !_combinedData.test_cases.length) {
    showError("No combined test cases found. Generate them first in the 🔗 Combined Generator tab.");
    return;
  }
  const headless = document.getElementById("headless-toggle").checked;
  const tcs = _combinedData.test_cases;

  hideError(); hideExecutionResults();
  showLoader(`🎬 Running ${tcs.length} test case${tcs.length !== 1 ? "s" : ""} in ${headless ? "headless" : "visible"} Chrome…`);
  setBtn("run-btn", true, "⏳ Running…");

  try {
    const res = await fetch("/execute", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test_cases: tcs, headless }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "Execution failed."); return; }
    _execData = data;
    renderExecResults(data);
  } catch (err) {
    showError("Network error: " + err.message);
  } finally {
    hideLoader();
    setBtn("run-btn", false, "▶ Run Tests");
  }
}

function renderExecResults(data) {
  const { results, summary } = data;
  const { total, passed, failed, errored } = summary;

  document.getElementById("exec-meta").innerHTML = `
    <span class="explorer-meta-badge">🧪 ${total} total</span>
    <span class="mapped-badge">✅ ${passed} passed</span>
    ${failed ? `<span class="unmapped-badge">❌ ${failed} failed</span>` : ""}
    ${errored ? `<span class="unmapped-badge">💥 ${errored} error${errored > 1 ? "s" : ""}</span>` : ""}`;

  document.getElementById("exec-stats").innerHTML = `
    <div class="stat-chip stat-total">
      <span class="stat-number">${total}</span><span class="stat-label">Total</span></div>
    <div class="stat-chip stat-pos">
      <span class="stat-number">${passed}</span><span class="stat-label">✅ Passed</span></div>
    <div class="stat-chip stat-neg">
      <span class="stat-number">${failed}</span><span class="stat-label">❌ Failed</span></div>
    <div class="stat-chip stat-edge">
      <span class="stat-number">${errored}</span><span class="stat-label">💥 Errors</span></div>`;

  const tbody = document.getElementById("exec-tbody");
  tbody.innerHTML = "";
  results.forEach(r => tbody.appendChild(buildExecRow(r)));

  showExecutionResults();
  document.getElementById("execution-results").scrollIntoView({ behavior: "smooth", block: "start" });
  _enableReportBtn();
}

function buildExecRow(r) {
  const tr = document.createElement("tr");
  const stCls = r.status === "Pass" ? "exec-status-pass" :
    r.status === "Fail" ? "exec-status-fail" : "exec-status-error";
  const shotPath = r.screenshot_path ? `/${esc(r.screenshot_path)}` : null;
  const shotCell = shotPath
    ? `<a href="${shotPath}" target="_blank" class="exec-shot-link" title="Click to view full screenshot">
         <img src="${shotPath}" alt="Failure screenshot" class="exec-shot-thumb"
              onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'">
         <span class="exec-shot-fallback" style="display:none">View 📸</span>
       </a>`
    : `<span style="color:var(--text-muted);font-size:.75rem">—</span>`;
  tr.innerHTML = `
    <td style="font-family:monospace;font-size:.78rem;white-space:nowrap">${esc(r.tc_id)}</td>
    <td style="max-width:200px">${esc(r.condition)}</td>
    <td><span class="${stCls}">${esc(r.status)}</span></td>
    <td style="white-space:nowrap;font-size:.8rem">${r.duration_seconds}s</td>
    <td class="exec-log-cell">
      <pre class="exec-log-pre">${esc(r.error_message || r.log)}</pre>
    </td>
    <td>${shotCell}</td>`;
  return tr;
}

function exportExecJSON() {
  if (!_execData) return;
  download("execution_results.json", JSON.stringify(_execData, null, 2), "application/json");
}

// Allow opening executor tab when combined data is ready (called from renderCombinedResults)
function _enableRunBtn() {
  const btn = document.getElementById("run-btn");
  const hint = document.getElementById("exec-hint");
  const cnt = document.getElementById("exec-count-hint");
  if (!btn) return;
  if (_combinedData && _combinedData.test_cases.length) {
    btn.disabled = false;
    if (hint) hint.classList.add("hidden");
    if (cnt) cnt.textContent = `${_combinedData.test_cases.length} test case${_combinedData.test_cases.length !== 1 ? "s" : ""} ready`;
  } else {
    btn.disabled = true;
    if (hint) hint.classList.remove("hidden");
    if (cnt) cnt.textContent = "";
  }
}

function esc(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}


// ── REPORT GENERATOR ───────────────────────────────────────────────────────
async function generateReport() {
  if (!_execData || !_execData.results.length) {
    showError("No execution results yet. Run tests first in the 🎬 Test Executor tab.");
    return;
  }
  setBtn("gen-report-btn", true, "⏳ Generating…");
  try {
    const res = await fetch("/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(_execData),
    });
    if (!res.ok) {
      const d = await res.json();
      showError(d.error || "Report generation failed.");
      return;
    }
    const html = await res.text();
    // Display in iframe using a blob URL
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    document.getElementById("report-iframe").src = url;
    document.getElementById("report-preview-wrap").classList.remove("hidden");
    document.getElementById("dl-report-btn").classList.remove("hidden");
    document.getElementById("report-hint").classList.add("hidden");
  } catch (err) {
    showError("Network error: " + err.message);
  } finally {
    setBtn("gen-report-btn", false, "📊 Generate Report");
  }
}

function downloadReport() {
  window.open("/report/download", "_blank");
}

function _enableReportBtn() {
  const btn = document.getElementById("gen-report-btn");
  const hint = document.getElementById("report-hint");
  if (!btn) return;
  if (_execData && _execData.results.length) {
    btn.disabled = false;
    if (hint) hint.classList.add("hidden");
  } else {
    btn.disabled = true;
    if (hint) hint.classList.remove("hidden");
  }
}

// Ctrl+Enter shortcuts

const storyInput = document.getElementById("story-input");
if (storyInput) {
  storyInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) analyze();
  });
}

const urlInput = document.getElementById("url-input");
if (urlInput) {
  urlInput.addEventListener("keydown", e => {
    if (e.key === "Enter") exploreUrl();
  });
}

const comboUrl = document.getElementById("combo-url");
if (comboUrl) {
  comboUrl.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generateCombined();
  });
}
