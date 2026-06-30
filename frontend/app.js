const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

let appState = {
  circular: null,
  interpretations: [],
  maps: [],
  branches: [],
  branch_tasks: [],
  validations: [],
  audit: [],
  graph: { nodes: [], edges: [] },
  golden_circular: "",
  agents: [],
};

let authState = { accessToken: null, refreshToken: null, user: null, employees: [], audits: [], loginLogs: [] };
const VIEW_ROUTES = { console: "/", maps: "/actions", branch: "/branches", bank: "/bank", validation: "/validation", audit: "/audit" };
const ROUTE_VIEWS = Object.fromEntries(Object.entries(VIEW_ROUTES).map(([view, route]) => [route, view]));
let selectedMapId = null;
let selectedBranchId = null;
let scenario = "partial";
let toastTimer = null;
let employeeSearch = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function sendJson(url, method, payload = {}) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || response.statusText);
  }
  return response.json();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function setAuthenticatedVisible(isAuthenticated) {
  const authGate = $("#authGate");
  const appShell = $("#app");
  authGate?.classList.toggle("is-hidden", isAuthenticated);
  appShell?.classList.toggle("is-hidden", !isAuthenticated);
  updateSessionUi();
  if (!isAuthenticated) setTimeout(() => $("#authUsername")?.focus(), 0);
}

function setAuthError(message = "") {
  const host = $("#authError");
  if (host) host.textContent = message;
}

function updateSessionUi() {
  const host = $("#sessionUser");
  if (!host) return;
  if (!authState.user) {
    host.textContent = "-";
    return;
  }
  host.textContent = `${authState.user.username} (${authState.user.scope})`;
}

async function loginWithCredentials(username, password, button) {
  setAuthError("");
  setBusy(button, true, "Signing in...");
  try {
    const result = await sendJson("/auth/login", "POST", { username, password });
    authState.accessToken = result.access_token;
    authState.refreshToken = result.refresh_token;
    authState.user = result.user;
    await loadBankPrivateData();
    renderAll();
    setAuthenticatedVisible(true);
    activateView("console");
    showToast(`Signed in as ${result.user.username}.`);
  } catch (error) {
    setAuthError("Could not sign in. Check the username and password.");
    showToast("Sign-in failed.");
  } finally {
    setBusy(button, false);
  }
}


function setSignupError(message = "") {
  const host = $("#signupError");
  if (host) host.textContent = message;
}

function togglePasswordVisibility() {
  const input = $("#authPassword");
  const button = $("#togglePasswordBtn");
  if (!input || !button) return;
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  button.textContent = showing ? "Show" : "Hide";
  button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
}

function toggleSignupPanel() {
  const form = $("#signupForm");
  const button = $("#signupToggleBtn");
  if (!form || !button) return;
  const hidden = form.classList.toggle("is-hidden");
  button.textContent = hidden ? "Create a demo account" : "Hide signup";
  if (!hidden) setTimeout(() => $("#signupName")?.focus(), 0);
}

async function guestLogin() {
  setAuthError("");
  const button = $("#guestLoginBtn");
  setBusy(button, true, "Opening...");
  try {
    const result = await sendJson("/auth/guest", "POST", {});
    authState.accessToken = result.access_token;
    authState.refreshToken = result.refresh_token;
    authState.user = result.user;
    await loadBankPrivateData();
    renderAll();
    setAuthenticatedVisible(true);
    activateView("console");
    showToast("Guest session started.");
  } catch (error) {
    setAuthError("Guest access is unavailable right now.");
  } finally {
    setBusy(button, false);
  }
}

async function appSignup(event) {
  event?.preventDefault();
  setSignupError("");
  const payload = {
    full_name: $("#signupName")?.value.trim(),
    username: $("#signupUsername")?.value.trim(),
    email: $("#signupEmail")?.value.trim(),
    password: $("#signupPassword")?.value,
  };
  if (!payload.full_name || !payload.username || !payload.email || !payload.password) {
    setSignupError("Fill all signup fields.");
    return;
  }
  const button = $("#signupSubmitBtn");
  setBusy(button, true, "Creating...");
  try {
    const result = await sendJson("/auth/signup", "POST", payload);
    authState.accessToken = result.access_token;
    authState.refreshToken = result.refresh_token;
    authState.user = result.user;
    await loadBankPrivateData();
    renderAll();
    setAuthenticatedVisible(true);
    activateView("console");
    showToast("Account created.");
  } catch (error) {
    setSignupError(error.message || "Could not create account.");
  } finally {
    setBusy(button, false);
  }
}
async function appLogin(event) {
  event?.preventDefault();
  const username = $("#authUsername")?.value.trim();
  const password = $("#authPassword")?.value;
  if (!username || !password) {
    setAuthError("Enter both username and password.");
    return;
  }
  await loginWithCredentials(username, password, $("#authLoginBtn"));
}
function statusPill(value) {
  const normalized = String(value || "open").toLowerCase();
  if (["validated", "approved", "processed", "done"].includes(normalized)) return "good";
  if (["partial", "draft", "edited", "open", "processing"].includes(normalized)) return "warn";
  if (["not_validated", "rejected", "failed"].includes(normalized)) return "bad";
  return "neutral";
}

function verdictLabel(value) {
  if (value === "not_validated") return "Not Validated";
  if (value === "partial") return "Partial";
  if (value === "validated") return "Validated";
  return value || "Open";
}

async function bootstrap() {
  const savedTheme = "light";
  document.documentElement.dataset.theme = savedTheme;
  localStorage.setItem("theme", savedTheme);
  bindEvents();
  await checkHealth();
  const state = await getJson("/api/state");
  setState(state);
  $("#circularInput").value = state.golden_circular || "";
  renderAll();
  setAuthenticatedVisible(Boolean(authState.user));
  activateView(ROUTE_VIEWS[window.location.pathname] || "console", false);
}

function bindEvents() {
  $("#authForm")?.addEventListener("submit", appLogin);
  $("#togglePasswordBtn")?.addEventListener("click", togglePasswordVisibility);
  $("#guestLoginBtn")?.addEventListener("click", guestLogin);
  $("#signupToggleBtn")?.addEventListener("click", toggleSignupPanel);
  $("#signupForm")?.addEventListener("submit", appSignup);
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => activateView(button.dataset.view));
  });

  $("#themeToggleBtn").addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
  });

  $("#processBtn").addEventListener("click", processCircular);
  $("#resetBtn").addEventListener("click", resetDemo);
  $("#runValidationBtn").addEventListener("click", runValidation);
  $("#exportAuditBtn").addEventListener("click", exportAudit);
  $("#openBankViewBtn")?.addEventListener("click", () => activateView("bank"));
  $("#bankLoginBtn")?.addEventListener("click", bankLogin);
  $("#bankLogoutBtn")?.addEventListener("click", bankLogout);
  $("#appLogoutBtn")?.addEventListener("click", bankLogout);
  $("#employeeSearchInput")?.addEventListener("input", (event) => {
    employeeSearch = event.target.value.trim().toLowerCase();
    renderEmployeeTable();
  });
  window.addEventListener("popstate", () => activateView(ROUTE_VIEWS[window.location.pathname] || "console", false));
  $("#scenarioSelect").addEventListener("change", async (event) => {
    scenario = event.target.value;
    await renderCbsSnapshot();
  });
}

function activateView(viewName, pushRoute = true) {
  const button = $(`.nav-item[data-view="${viewName}"]`);
  const view = $(`#view-${viewName}`);
  if (!button || !view) return;
  $$(".nav-item").forEach((item) => {
    item.classList.remove("active");
    item.removeAttribute("aria-current");
  });
  button.classList.add("active");
  button.setAttribute("aria-current", "page");
  $$(".view").forEach((item) => item.classList.remove("active"));
  view.classList.add("active");
  if (pushRoute) {
    const route = VIEW_ROUTES[viewName] || "/";
    if (window.location.pathname !== route) history.pushState({ view: viewName }, "", route);
  }
}
async function checkHealth() {
  try {
    const health = await getJson("/api/health");
    $("#healthDot").className = health.ok ? "dot ok" : "dot warn";
    $("#healthText").textContent = health.ok ? "Local offline service ready" : "Service warning";
    $("#auditStatus").textContent = health.audit?.ok ? "chain valid" : "chain issue";
    $("#auditStatus").className = `pill ${health.audit?.ok ? "good" : "bad"}`;
  } catch (error) {
    $("#healthDot").className = "dot warn";
    $("#healthText").textContent = "Service unavailable";
  }
}

function setState(next) {
  appState = next;
  if (!selectedMapId && appState.maps.length > 0) selectedMapId = appState.maps[0].id;
  if (!selectedBranchId && appState.branches.length > 0) {
    const rural = appState.branches.find((branch) => branch.id === "BR002");
    selectedBranchId = (rural || appState.branches[0]).id;
  }
}

function renderAll() {
  renderMetrics();
  renderAgentTrace();
  renderGraph();
  renderMaps();
  renderBranches();
  renderPhone();
  renderValidationResults();
  renderAudit();
  renderCbsSnapshot();
  renderConsoleBankSummary();
  renderBank();
}

function renderMetrics() {
  $("#metricDomain").textContent = appState.circular?.domain || "-";
  $("#metricMaps").textContent = appState.maps.length;
  $("#metricDispatches").textContent = appState.branch_tasks.length;
  $("#metricAudit").textContent = appState.audit.length;
  $("#pipelineStatus").textContent = appState.circular?.status || "idle";
  $("#pipelineStatus").className = `pill ${statusPill(appState.circular?.status)}`;
}

function renderAgentTrace(statusByAgent = {}) {
  const trace = $("#agentTrace");
  const hasCircular = Boolean(appState.circular);
  trace.innerHTML = appState.agents
    .map((agent) => {
      const status = statusByAgent[agent.key] || (hasCircular ? "done" : "idle");
      const label = status === "done" ? "complete" : status === "running" ? "working" : "queued";
      return `
        <article class="agent-card ${status === "done" ? "done" : status === "running" ? "running" : ""}" data-agent="${agent.key}">
          <div>
            <strong>${escapeHtml(agent.label)}</strong>
            <span>${escapeHtml(agent.role)}</span>
          </div>
          <div class="agent-summary">${label}</div>
        </article>
      `;
    })
    .join("");
}

async function animateTrace(events) {
  const statusByAgent = {};
  renderAgentTrace(statusByAgent);
  for (const event of events || []) {
    statusByAgent[event.agent] = event.status === "started" ? "running" : "done";
    renderAgentTrace(statusByAgent);
    const card = $(`.agent-card[data-agent="${event.agent}"] .agent-summary`);
    if (card && event.summary) {
      if (typeof event.summary === "object") {
        const [key, value] = Object.entries(event.summary)[0] || ["status", "updated"];
        const readableValue = Array.isArray(value) ? `${value.length} items` : value;
        card.textContent = `${key.replaceAll("_", " ")}: ${readableValue}`;
      } else {
        card.textContent = String(event.summary);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 260));
  }
}

async function processCircular() {
  const button = $("#processBtn");
  setBusy(button, true, "Running...");
  $("#pipelineStatus").textContent = "processing";
  $("#pipelineStatus").className = "pill warn";
  try {
    const state = await sendJson("/api/regulations", "POST", {
      title: $("#titleInput").value.trim() || "KYC-2026-001",
      full_text: $("#circularInput").value.trim(),
    });
    setState(state);
    renderAll();
    await animateTrace(state.events);
    renderAll();
    showToast("Circular processed end to end.");
  } catch (error) {
    showToast(`Run failed: ${error.message}`);
  } finally {
    setBusy(button, false);
    await checkHealth();
  }
}

async function resetDemo() {
  if (!confirm("Reset local demo data?")) return;
  const state = await sendJson("/api/reset", "POST", {});
  selectedMapId = null;
  selectedBranchId = null;
  setState(state);
  renderAll();
  showToast("Demo data reset.");
}

function renderGraph() {
  const host = $("#graphView");
  if (!host) return;

  const graph = appState.graph || {};
  const graphNodes = Array.isArray(graph.nodes) ? graph.nodes.filter((node) => node && typeof node === "object" && node.id) : [];
  const graphEdges = Array.isArray(graph.edges) ? graph.edges.filter((edge) => edge && typeof edge === "object" && edge.from && edge.to) : [];

  if (!graphNodes.length) {
    host.innerHTML = `<div class="empty-state">Run the pipeline to load the impact flow.</div>`;
    return;
  }

  const columns = [
    ["regulation", "Circular"],
    ["clause", "Clauses"],
    ["policy", "Policy"],
    ["system", "Systems"],
    ["department", "Owners"],
    ["branch", "Branches"],
  ];
  const outgoing = graphEdges.reduce((acc, edge) => {
    acc[edge.from] = acc[edge.from] || [];
    acc[edge.from].push(edge);
    return acc;
  }, {});

  host.innerHTML = `
    <div class="graph-board" role="list" aria-label="Niyam-Jaal impact flow">
      ${columns.map(([group, title], index) => {
        const nodes = graphNodes.filter((node) => (node.group || "department") === group);
        return `
          <section class="graph-column" role="listitem">
            <div class="graph-column-title">${escapeHtml(title)}</div>
            <div class="graph-column-stack">
              ${nodes.length ? nodes.map((node) => {
                const next = outgoing[node.id] || [];
                return `
                  <article class="graph-node ${escapeHtml(group)}">
                    <span>${escapeHtml(node.label || node.id)}</span>
                    <strong>${escapeHtml(node.id)}</strong>
                    ${next.length ? `<em>${next.length} downstream link${next.length === 1 ? "" : "s"}</em>` : ""}
                  </article>
                `;
              }).join("") : `<div class="graph-empty">No ${escapeHtml(title.toLowerCase())}</div>`}
            </div>
            ${index < columns.length - 1 ? `<div class="graph-arrow" aria-hidden="true">-></div>` : ""}
          </section>
        `;
      }).join("")}
    </div>
  `;
}
function renderMaps() {
  const list = $("#mapList");
  if (!appState.maps.length) {
    list.innerHTML = `<div class="empty-state">Run agents to generate MAPs.</div>`;
    renderDraftDetail();
    return;
  }

  list.innerHTML = appState.maps
    .map((map) => `
      <article class="map-card ${map.id === selectedMapId ? "active" : ""}" data-map-id="${map.id}">
        <header>
          <div>
            <h3>${escapeHtml(map.code)}  -  ${escapeHtml(map.clause_ref)}</h3>
            <p>${escapeHtml(map.description)}</p>
          </div>
          <span class="pill ${statusPill(map.status)}">${escapeHtml(map.status)}</span>
        </header>
        <div class="tag-row">
          <span class="tag">${escapeHtml(map.assignment?.department || "Unassigned")}</span>
          <span class="tag">${escapeHtml(map.draft_type)}</span>
          <span class="tag">conf ${Number(map.confidence).toFixed(2)}</span>
        </div>
      </article>
    `)
    .join("");

  $$(".map-card", list).forEach((card) => {
    card.addEventListener("click", () => {
      selectedMapId = card.dataset.mapId;
      renderMaps();
      renderDraftDetail();
    });
  });

  renderDraftDetail();
}

function renderDraftDetail() {
  const host = $("#draftDetail");
  const map = appState.maps.find((item) => item.id === selectedMapId);
  if (!map || !map.draft) {
    host.className = "draft-detail empty-state";
    host.textContent = "Select a MAP to review its draft.";
    return;
  }
  host.className = "draft-detail";
  host.innerHTML = `
    <div class="draft-title">
      <p class="eyebrow">${escapeHtml(map.code)}  -  ${escapeHtml(map.draft.type)}</p>
      <h2>${escapeHtml(map.draft.title)}</h2>
      <div class="tag-row">
        <span class="tag">${escapeHtml(map.assignment?.owner_role || "")}</span>
        <span class="tag">${escapeHtml(map.assignment?.ticket_ref || "")}</span>
        <span class="pill ${statusPill(map.draft.status)}">${escapeHtml(map.draft.status)}</span>
      </div>
    </div>
    <textarea id="draftEditor" class="draft-text" aria-label="Draft content">${escapeHtml(map.draft.content)}</textarea>
    <div class="draft-actions">
      <button class="button primary" id="approveMapBtn" type="button">Approve MAP</button>
      <button class="button primary" id="approveDraftBtn" type="button">Approve draft</button>
      <button class="button ghost" id="saveDraftBtn" type="button">Save edit</button>
      <button class="button ghost" id="rejectDraftBtn" type="button">Reject</button>
    </div>
  `;

  $("#approveMapBtn").addEventListener("click", () => patchMap(map.id, "approve"));
  $("#approveDraftBtn").addEventListener("click", () => patchDraft(map.draft.id, "approve"));
  $("#saveDraftBtn").addEventListener("click", () => patchDraft(map.draft.id, "edit", $("#draftEditor").value));
  $("#rejectDraftBtn").addEventListener("click", () => patchDraft(map.draft.id, "reject"));
}

async function patchMap(mapId, action) {
  const state = await sendJson(`/api/maps/${mapId}`, "PATCH", { action });
  setState(state);
  renderAll();
  showToast("MAP approval recorded.");
}

async function patchDraft(draftId, action, content = null) {
  const state = await sendJson(`/api/drafts/${draftId}`, "PATCH", { action, content });
  setState(state);
  renderAll();
  showToast("Draft gate recorded.");
}

function renderBranches() {
  const host = $("#branchList");
  if (!appState.branches.length) {
    host.innerHTML = `<div class="empty-state">No branches seeded.</div>`;
    return;
  }
  host.innerHTML = appState.branches
    .map((branch) => {
      const tasks = appState.branch_tasks.filter((task) => task.branch_id === branch.id);
      const pill = branch.pendency_pct >= 12 ? "bad" : branch.pendency_pct >= 8 ? "warn" : "good";
      return `
        <article class="branch-card ${branch.id === selectedBranchId ? "active" : ""}" data-branch-id="${branch.id}">
          <div class="panel-heading">
            <div>
              <strong>${escapeHtml(branch.name)}</strong>
              <span>${escapeHtml(branch.state)}  -  ${escapeHtml(branch.language_label)}</span>
            </div>
            <span class="pill ${pill}">${branch.pendency_pct}%</span>
          </div>
          <span>${tasks.length} dispatched tasks</span>
        </article>
      `;
    })
    .join("");

  $$(".branch-card", host).forEach((card) => {
    card.addEventListener("click", () => {
      selectedBranchId = card.dataset.branchId;
      renderBranches();
      renderPhone();
    });
  });
}

function hasBrokenLocalText(value) {
  return /[à�]/.test(String(value || ""));
}

function readableBranchInstruction(task, branch) {
  if (task.vernacular_text && !hasBrokenLocalText(task.vernacular_text)) return task.vernacular_text;
  const language = task.language_label || branch?.language_label || "Local";
  return `${language} checklist: verify the 8-year KYC due list, contact customers, record staff acknowledgement, run the KYC camp where needed, and upload evidence before closure.`;
}
function renderPhone() {
  const branch = appState.branches.find((item) => item.id === selectedBranchId);
  if (!branch) return;
  const tasks = appState.branch_tasks.filter((task) => task.branch_id === branch.id);
  $("#phoneBranch").textContent = branch.name;
  $("#phoneLanguage").textContent = `${branch.language_label} checklist`;
  $("#phonePendency").textContent = `${branch.kyc_pending} pending`;
  $("#phonePendency").className = `pill ${branch.pendency_pct >= 12 ? "bad" : branch.pendency_pct >= 8 ? "warn" : "good"}`;

  const host = $("#branchTasks");
  if (!tasks.length) {
    host.innerHTML = `<div class="empty-state">Process a circular to dispatch branch tasks.</div>`;
    return;
  }
  host.innerHTML = tasks
    .map((task) => `
      <article class="task-card">
        <header>
          <div>
            <h3>${escapeHtml(task.map_code)}  -  ${escapeHtml(task.role)}</h3>
            <p>${escapeHtml(task.map_description)}</p>
          </div>
          <span class="pill ${statusPill(task.status)}">${escapeHtml(verdictLabel(task.status))}</span>
        </header>
        <div class="task-local"><span>Readable branch instruction</span>${escapeHtml(readableBranchInstruction(task, branch))}</div>
        ${task.validation_reasoning ? `<p class="task-reason">${escapeHtml(task.validation_reasoning)}</p>` : ""}
        <div class="evidence-box">
          <textarea data-evidence-for="${task.id}" aria-label="Evidence note">${escapeHtml(task.evidence_note || "Photo of customer outreach list, staff acknowledgement, and branch KYC camp register.")}</textarea>
          <button class="button primary" data-submit-evidence="${task.id}" type="button">Upload evidence & close</button>
        </div>
      </article>
    `)
    .join("");

  $$("[data-submit-evidence]", host).forEach((button) => {
    button.addEventListener("click", async () => {
      const taskId = button.dataset.submitEvidence;
      const note = $(`[data-evidence-for="${taskId}"]`).value;
      setBusy(button, true, "Checking...");
      try {
        const state = await sendJson(`/api/branch-tasks/${taskId}/evidence`, "POST", {
          scenario,
          evidence_note: note,
        });
        setState(state);
        renderAll();
        showToast(`Pramanik returned ${verdictLabel(state.last_verdict?.result)}.`);
      } catch (error) {
        showToast(error.message);
      } finally {
        setBusy(button, false);
      }
    });
  });
}

async function renderCbsSnapshot() {
  const host = $("#cbsSnapshot");
  if (!host) return;
  try {
    const cbs = await getJson(`/api/cbs?scenario=${encodeURIComponent(scenario)}`);
    const cards = [
      ["KYC parameter", `${cbs.low_risk_periodic_years} years`, "Required low-risk cycle"],
      ["Re-screened", `${cbs.rescreened_customers} / ${cbs.target_due_customers}`, "Target customers completed"],
      ["Branch evidence", `${cbs.branch_evidence_uploaded} / ${cbs.branch_evidence_expected}`, "Expected uploads received"],
      ["Exceptions", cbs.exceptions_recorded, "Open exception records"],
    ];
    host.innerHTML = cards
      .map(([label, value, note]) => `
        <article class="cbs-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <small>${escapeHtml(note)}</small>
        </article>
      `)
      .join("");
  } catch (error) {
    host.innerHTML = `<div class="empty-state compact">CBS snapshot unavailable. Check the local service.</div>`;
  }
}

async function runValidation() {
  const button = $("#runValidationBtn");
  setBusy(button, true, "Running...");
  try {
    const state = await sendJson("/api/validations/run", "POST", {
      scenario,
      circular_id: appState.circular?.id,
    });
    setState(state);
    renderAll();
    showToast(`Circular verdict: ${verdictLabel(state.last_verdict?.result)}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(button, false);
  }
}

function renderValidationResults() {
  const host = $("#validationResults");
  if (!appState.validations.length) {
    host.innerHTML = `<div class="empty-state">Run Pramanik or upload branch evidence to create verdicts.</div>`;
    return;
  }
  host.innerHTML = appState.validations
    .map((item) => `
      <article class="validation-card">
        <header>
          <div>
            <h3>${escapeHtml(verdictLabel(item.result))}</h3>
            <p>${escapeHtml(item.reasoning)}</p>
          </div>
          <span class="pill ${statusPill(item.result)}">${escapeHtml(item.scenario)}</span>
        </header>
        <div class="tag-row">
          ${item.evidence_checked.map((checked) => `<span class="tag">${escapeHtml(checked)}</span>`).join("")}
        </div>
      </article>
    `)
    .join("");
}

function auditPayloadSummary(payload) {
  if (!payload || typeof payload !== "object") return [];
  return Object.entries(payload).map(([key, value]) => {
    const label = key.replaceAll("_", " ");
    if (Array.isArray(value)) return [label, value.join(", ")];
    if (value && typeof value === "object") return [label, Object.entries(value).map(([k, v]) => `${k}: ${v}`).join("; ")];
    return [label, value ?? "-"];
  });
}

function renderAudit() {
  const host = $("#auditTimeline");
  if (!host) return;
  if (!appState.audit.length) {
    host.innerHTML = `<div class="empty-state">Audit events appear after processing.</div>`;
    return;
  }
  host.innerHTML = appState.audit
    .map((event, index) => {
      const rows = auditPayloadSummary(event.payload).slice(0, 5);
      return `
        <article class="audit-card">
          <div class="audit-index">${String(index + 1).padStart(2, "0")}</div>
          <div class="audit-main">
            <div class="audit-title-row">
              <div>
                <strong>${escapeHtml(event.action)}</strong>
                <span>${escapeHtml(event.actor)} - ${escapeHtml(event.stage)}</span>
              </div>
              <code>${escapeHtml(event.hash.slice(0, 16))}</code>
            </div>
            <div class="audit-payload">
              ${rows.length ? rows.map(([key, value]) => `<p><span>${escapeHtml(key)}</span>${escapeHtml(value)}</p>`).join("") : `<p><span>details</span>No additional details</p>`}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function exportAudit() {
  const payload = {
    exported_at: new Date().toISOString(),
    circular: appState.circular,
    audit: appState.audit,
    validations: appState.validations,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "niyamsetu-audit-export.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function authHeaders() {
  return authState.accessToken ? { Authorization: `Bearer ${authState.accessToken}` } : {};
}

async function bankLogin() {
  const username = $("#bankUsername")?.value.trim() || $("#authUsername")?.value.trim();
  const password = $("#bankPassword")?.value || $("#authPassword")?.value;
  await loginWithCredentials(username, password, $("#bankLoginBtn") || $("#authLoginBtn"));
}

async function bankLogout() {
  try {
    if (authState.refreshToken) await sendJson("/auth/logout", "POST", { refresh_token: authState.refreshToken });
  } catch {}
  authState = { accessToken: null, refreshToken: null, user: null, employees: [], audits: [], loginLogs: [] };
  employeeSearch = "";
  if ($("#employeeSearchInput")) $("#employeeSearchInput").value = "";
  renderBank();
  setAuthenticatedVisible(false);
  showToast("Signed out.");
}

async function loadBankPrivateData() {
  if (!authState.accessToken) return;
  authState.employees = [];
  authState.audits = [];
  authState.loginLogs = [];
  try {
    authState.employees = await getJsonWithHeaders("/api/bank/employees", authHeaders());
  } catch {}
  try {
    authState.audits = await getJsonWithHeaders("/api/bank/audits", authHeaders());
  } catch {}
  const permissions = authState.user?.permissions || [];
  const canViewLoginLogs = permissions.includes("system.admin") || permissions.includes("loginlog.view");
  if (canViewLoginLogs) {
    try {
      authState.loginLogs = await getJsonWithHeaders("/api/bank/login-logs", authHeaders());
    } catch {
      authState.loginLogs = [];
    }
  }
}

async function getJsonWithHeaders(url, headers) {
  const response = await fetch(url, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || response.statusText);
  return body;
}

function renderBank() {
  const bank = appState.bank;
  if (!bank) return;
  const metrics = $("#bankMetrics");
  if (metrics) {
    metrics.innerHTML = [
      ["Branches", bank.counts.branches],
      ["Employees", bank.counts.employees],
      ["Roles", bank.counts.roles],
      ["Open findings", bank.counts.open_findings],
    ].map(([label, value]) => `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("");
  }
  const samples = $("#sampleLogins");
  if (samples) {
    samples.innerHTML = (bank.by_role || []).slice(0, 8).map((item) => `
      <article class="sample-login role-card">
        <strong>${escapeHtml(item.name.replaceAll("_", " "))}</strong>
        <span>${escapeHtml(item.users)} users</span>
      </article>
    `).join("");
  }
  const status = $("#bankAuthStatus");
  if (status) {
    status.textContent = authState.user ? `${authState.user.username}  -  ${authState.user.scope}` : "not signed in";
    status.className = `pill ${authState.user ? "good" : "neutral"}`;
  }
  renderBankMe();
  renderEmployeeTable();
  renderBankAudits();
  renderLoginLogs();
}

function renderConsoleBankSummary() {
  const host = $("#consoleBankSummary");
  if (!host) return;
  const bank = appState.bank;
  if (!bank) {
    host.innerHTML = `<div class="empty-state compact">Bank seed data is not loaded.</div>`;
    return;
  }
  const focusBranches = bank.branches.slice(0, 5).map((branch) => `
    <article class="bank-branch-chip">
      <strong>${escapeHtml(branch.city)}</strong>
      <span>${escapeHtml(branch.region_name)} - ${escapeHtml(branch.language_label)}</span>
    </article>
  `).join("");
  host.innerHTML = `
    <div class="bank-console-kpis">
      <article><span>Branches</span><strong>${escapeHtml(bank.counts.branches)}</strong></article>
      <article><span>Employees</span><strong>${escapeHtml(bank.counts.employees)}</strong></article>
      <article><span>User accounts</span><strong>${escapeHtml(bank.counts.users)}</strong></article>
      <article><span>Open findings</span><strong>${escapeHtml(bank.counts.open_findings)}</strong></article>
    </div>
    <div>
      <p class="console-bank-label">Branch sample</p>
      <div class="bank-branch-strip">${focusBranches}</div>
    </div>
  `;
}
function renderBankMe() {
  const host = $("#bankMe");
  if (!host) return;
  if (!authState.user) {
    host.className = "bank-me empty-state";
    host.textContent = "Sign in to see your access scope.";
    return;
  }
  const u = authState.user;
  host.className = "bank-me";
  host.innerHTML = `
    <div class="scope-card">
      <h3>${escapeHtml(u.full_name)}</h3>
      <p>${escapeHtml(u.designation)}  -  ${escapeHtml(u.department)}</p>
      <p>${escapeHtml(u.branch_name || "All branches")}  -  ${escapeHtml(u.region_name || "Global")}</p>
      <div class="tag-row">${u.roles.map((r) => `<span class="tag">${escapeHtml(r.name)}  -  ${escapeHtml(r.scope)}</span>`).join("")}</div>
      <div class="permission-list"><span class="tag">${escapeHtml(u.scope)} access</span><span class="tag">${escapeHtml(u.roles.map((r) => r.name).join(", "))}</span></div>
    </div>
  `;
}

function renderEmployeeTable() {
  const host = $("#employeeTable");
  if (!host) return;
  if (!authState.user) {
    host.className = "table-wrap empty-state";
    host.textContent = "Login to load employees.";
    return;
  }
  const filteredEmployees = authState.employees.filter((e) => {
    if (!employeeSearch) return true;
    return [e.emp_code, e.full_name, e.email, e.designation, e.department, e.branch_name, e.roles, e.manager_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(employeeSearch);
  });
  if (!filteredEmployees.length) {
    host.className = "table-wrap empty-state";
    host.textContent = "No employees match this search.";
    return;
  }
  host.className = "table-wrap";
  const rows = filteredEmployees.slice(0, 60).map((e) => `
    <tr>
      <td>${escapeHtml(e.emp_code)}</td>
      <td>${escapeHtml(e.full_name)}<br><span class="eyebrow">${escapeHtml(e.email)}</span></td>
      <td>${escapeHtml(e.designation)}<br><span class="eyebrow">${escapeHtml(e.scale)}</span></td>
      <td>${escapeHtml(e.department)}</td>
      <td>${escapeHtml(e.branch_name)}</td>
      <td>${escapeHtml(e.roles || "")}</td>
      <td>${escapeHtml(e.manager_name || "-")}</td>
    </tr>
  `).join("");
  host.innerHTML = `<table class="data-table"><thead><tr><th>Code</th><th>Name</th><th>Grade</th><th>Dept</th><th>Branch</th><th>Role</th><th>Manager</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderBankAudits() {
  const host = $("#bankAudits");
  if (!host) return;
  if (!authState.user) { host.innerHTML = `<div class="empty-state">Login to load audits.</div>`; return; }
  if (!authState.audits.length) { host.innerHTML = `<div class="empty-state">No audit records are visible for this branch.</div>`; return; }
  host.innerHTML = authState.audits.map((audit) => `
    <article class="validation-card">
      <header><div><h3>${escapeHtml(audit.reference)}</h3><p>${escapeHtml(audit.title)}</p></div><span class="pill ${statusPill(audit.status)}">${escapeHtml(audit.score)}</span></header>
      <div class="tag-row">${audit.findings.map((f) => `<span class="tag">${escapeHtml(f.severity)}  -  ${escapeHtml(f.status)}</span>`).join("")}</div>
    </article>
  `).join("");
}

function renderLoginLogs() {
  const host = $("#loginLogs");
  if (!host) return;
  if (!authState.user) { host.innerHTML = `<div class="empty-state">Login as SUPER_ADMIN or Executive to view logs.</div>`; return; }
  if (!authState.loginLogs.length) { host.innerHTML = `<div class="empty-state">Only roles with login-log access can view this activity.</div>`; return; }
  host.innerHTML = authState.loginLogs.slice(0, 12).map((log) => `
    <article class="validation-card">
      <header><div><h3>${escapeHtml(log.username_attempted)}</h3><p>${escapeHtml(log.created_at)}</p></div><span class="pill ${log.success ? "good" : "bad"}">${log.success ? "success" : "failed"}</span></header>
      <p>${escapeHtml(log.failure_reason || "authenticated")}</p>
    </article>
  `).join("");
}
bootstrap().catch((error) => {
  console.error(error);
  showToast(error.message);
});


