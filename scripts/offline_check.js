const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

const PORT = 8876;
const BASE = `http://127.0.0.1:${PORT}`;
const CHECK_SIGNING_KEY = crypto.randomBytes(32).toString("base64url");

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${body.error || response.statusText}`);
  return body;
}

async function waitForHealth() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const health = await request("/api/health");
      if (health.ok) return health;
    } catch {
      await sleep(250);
    }
  }
  throw new Error("Server did not become healthy");
}

async function main() {
  const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, NIYAMSETU_PORT: String(PORT), NIYAMSETU_SIGNING_KEY: CHECK_SIGNING_KEY, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    await waitForHealth();
    await request("/api/reset", { method: "POST" });

    const overview = await request("/api/bank/overview");
    if (overview.counts.branches !== 15) throw new Error(`Expected 15 bank branches, got ${overview.counts.branches}`);
    if (overview.counts.employees !== 107) throw new Error(`Expected 107 employees, got ${overview.counts.employees}`);

    const login = await request("/auth/guest", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!login.access_token || login.user.scope !== "BRANCH") throw new Error("Guest login/scoped access failed");

    const employees = await request("/api/bank/employees", { headers: { Authorization: `Bearer ${login.access_token}` } });
    if (!employees.length) throw new Error("Expected guest session to see scoped branch employees");

    const golden = await request("/api/golden");
    const state = await request("/api/regulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(golden),
    });
    if (state.maps.length !== 6) throw new Error(`Expected 6 MAPs, got ${state.maps.length}`);
    if (state.branch_tasks.length !== 45) throw new Error(`Expected 45 branch tasks, got ${state.branch_tasks.length}`);
    if (!state.audit.length) throw new Error("Expected audit events");

    const partial = await request("/api/validations/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ circular_id: state.circular.id, scenario: "partial" }) });
    if (partial.last_verdict.result !== "partial") throw new Error("Partial scenario did not return Partial");
    const validated = await request("/api/validations/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ circular_id: state.circular.id, scenario: "validated" }) });
    if (validated.last_verdict.result !== "validated") throw new Error("Validated scenario did not return Validated");
    const failed = await request("/api/validations/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ circular_id: state.circular.id, scenario: "not_validated" }) });
    if (failed.last_verdict.result !== "not_validated") throw new Error("Not validated scenario did not return Not Validated");

    const audit = await request("/api/audit/verify");
    if (!audit.ok) throw new Error(`Audit chain failed at event ${audit.failed_at}`);

    console.log("offline-check passed");
    console.log(`branches=${overview.counts.branches} employees=${overview.counts.employees} maps=${state.maps.length} branch_tasks=${state.branch_tasks.length} audit_events=${audit.events}`);
  } finally {
    child.kill();
    await sleep(300);
    if (process.env.NIYAMSETU_DEBUG_CHECK) console.log(logs);
  }
}

main().catch((error) => {
  console.error(`offline-check failed: ${error.message}`);
  process.exit(1);
});
