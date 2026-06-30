const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");
const { DatabaseSync } = require("node:sqlite");
const bank = require("./bank");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(process.env.NIYAMSETU_DATA_DIR || path.join(ROOT, "data"));
const FRONTEND_DIR = path.join(ROOT, "frontend");
const DB_PATH = path.join(DATA_DIR, "niyamsetu.db");
const PORT = Number(process.env.PORT || process.env.NIYAMSETU_PORT || 8765);
const HOST = process.env.HOST || process.env.NIYAMSETU_HOST || "127.0.0.1";

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");

const GOLDEN_CIRCULAR = `Bharat Vikas Bank internal demo circular KYC-2026-001

Source: Reserve Bank of India circular theme, synthetic paraphrase for SuRaksha demo.
Domain: KYC / AML.
Effective date: 60 days from issue.

For low-risk individual customers, the periodic KYC re-verification cycle is revised from
10 years to 8 years. Banks shall update internal policy, core banking parameters, branch
operating instructions, and customer communication templates before the effective date.

Banks shall identify all low-risk customers who become due or overdue under the revised
8-year cycle, issue customer notices in English and the dominant regional language of the
branch, and complete re-screening with an empathetic process for elderly, rural, and
inoperative-account customers.

Branches shall upload evidence of completed customer outreach, staff acknowledgement, and
KYC camp execution where pendency exceeds the bank threshold. Compliance shall maintain an
audit trail linking the circular clause, action point, owner, evidence, and validation result.`;

const BRANCHES = [
  ["hubli", "Hubli Rural", "Karnataka", "kn", "Kannada", "rural", 11800, 1540, 13.1],
  ["bengaluru", "Bengaluru Main", "Karnataka", "kn", "Kannada", "urban", 46200, 1386, 3.0],
  ["coimbatore", "Coimbatore", "Tamil Nadu", "ta", "Tamil", "semi_urban", 22100, 1768, 8.0],
  ["bhubaneswar", "Bhubaneswar Main", "Odisha", "or", "Odia", "urban", 25100, 1506, 6.0],
  ["varanasi", "Varanasi Rural", "Uttar Pradesh", "hi", "Hindi", "rural", 9200, 1840, 20.0],
  ["mumbai", "Mumbai Fort", "Maharashtra", "mr", "Marathi", "urban", 53800, 1076, 2.0],
  ["hyderabad", "Hyderabad", "Telangana", "te", "Telugu", "urban", 36400, 1456, 4.0],
  ["kolkata", "Kolkata North", "West Bengal", "bn", "Bengali", "semi_urban", 21400, 1926, 9.0],
];

const AGENTS = [
  ["prahari", "Prahari", "Classifies the circular"],
  ["vyakhya", "Vyakhya", "Extracts clause-level interpretation"],
  ["vibhajan", "Vibhajan", "Builds SMART measurable action points"],
  ["lekhak", "Lekhak", "Drafts the actual compliance artifacts"],
  ["niyojak", "Niyojak", "Routes ownership through Niyam-Jaal"],
  ["pramanik", "Pramanik", "Prepares validation controls"],
];

const ASSIGNMENTS = {
  "MAP-001": ["Compliance & AML", "Chief Compliance Officer", ["Legal", "Internal Audit"]],
  "MAP-002": ["Information Technology", "Head of Core Banking", ["Risk Management", "Compliance & AML"]],
  "MAP-003": ["Branch Operations / Network", "Zonal Operations Head", ["Retail Banking", "Compliance & AML"]],
  "MAP-004": ["Branch Operations / Network", "Branch Operations Lead", ["Compliance & AML"]],
  "MAP-005": ["Human Resources / Training", "Learning Lead", ["Branch Operations / Network"]],
  "MAP-006": ["Risk Management", "Operational Risk Lead", ["Information Technology", "Internal Audit"]],
};

const translationCache = new Map();

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function hash(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function toJson(value) {
  return JSON.stringify(value);
}

function fromJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS circulars (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      full_text TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      domain TEXT,
      classification_json TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interpretations (
      id TEXT PRIMARY KEY,
      circular_id TEXT NOT NULL REFERENCES circulars(id) ON DELETE CASCADE,
      clause_ref TEXT NOT NULL,
      scope TEXT NOT NULL,
      applicability TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      obligation_type TEXT NOT NULL,
      exceptions_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY,
      circular_id TEXT NOT NULL REFERENCES circulars(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      clause_ref TEXT NOT NULL,
      description TEXT NOT NULL,
      smart_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      needs_review INTEGER NOT NULL,
      draft_type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
      department TEXT NOT NULL,
      owner_role TEXT NOT NULL,
      collaborators_json TEXT NOT NULL,
      ticket_ref TEXT NOT NULL,
      rationale TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      language TEXT NOT NULL,
      language_label TEXT NOT NULL,
      region_type TEXT NOT NULL,
      total_accounts INTEGER NOT NULL,
      kyc_pending INTEGER NOT NULL,
      pendency_pct REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS branch_tasks (
      id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      language TEXT NOT NULL,
      instruction_text TEXT NOT NULL,
      vernacular_text TEXT NOT NULL,
      status TEXT NOT NULL,
      evidence_note TEXT,
      validation_result TEXT,
      validation_reasoning TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS validation_results (
      id TEXT PRIMARY KEY,
      circular_id TEXT NOT NULL REFERENCES circulars(id) ON DELETE CASCADE,
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      scenario TEXT NOT NULL,
      result TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      evidence_checked_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      circular_id TEXT,
      stage TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL
    );
  `);

  const count = db.prepare("SELECT COUNT(*) AS n FROM branches").get().n;
  if (count === 0) seedBranches();
  bank.seedBank(db);
}

function seedBranches() {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO branches
    (id, name, state, language, language_label, region_type, total_accounts, kyc_pending, pendency_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of BRANCHES) stmt.run(...row);
}

function resetDb() {
  db.exec("DELETE FROM audit_events;");
  bank.seedBank(db, true);
}

function audit(circularId, stage, actor, action, payload) {
  const previous = db.prepare("SELECT hash FROM audit_events ORDER BY rowid DESC LIMIT 1").get();
  const prevHash = previous ? previous.hash : "GENESIS";
  const id = newId("audit");
  const ts = nowIso();
  const payloadJson = toJson(payload);
  const eventHash = hash([id, ts, circularId || "", stage, actor, action, payloadJson, prevHash].join("|"));
  db.prepare(`
    INSERT INTO audit_events
    (id, ts, circular_id, stage, actor, action, payload_json, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, ts, circularId, stage, actor, action, payloadJson, prevHash, eventHash);
  return { id, ts, circular_id: circularId, stage, actor, action, payload, prev_hash: prevHash, hash: eventHash };
}

function clearPipelineRows(circularId) {
  db.prepare("DELETE FROM validation_results WHERE circular_id = ?").run(circularId);
  db.prepare("DELETE FROM branch_tasks WHERE map_id IN (SELECT id FROM maps WHERE circular_id = ?)").run(circularId);
  db.prepare("DELETE FROM assignments WHERE map_id IN (SELECT id FROM maps WHERE circular_id = ?)").run(circularId);
  db.prepare("DELETE FROM drafts WHERE map_id IN (SELECT id FROM maps WHERE circular_id = ?)").run(circularId);
  db.prepare("DELETE FROM maps WHERE circular_id = ?").run(circularId);
  db.prepare("DELETE FROM interpretations WHERE circular_id = ?").run(circularId);
}

async function callLLM(prompt, systemPrompt = "You are an AI assistant for NiyamSetu, an Indian banking regulatory compliance platform. You always output valid JSON.") {
  const provider = process.env.LLM_PROVIDER || "gemini"; // default to internet LLM for now

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Please set it to use the internet LLM. Falling back to mock data.");
      return null;
    }
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        })
      });
      if (!response.ok) throw new Error("Gemini error: " + response.statusText);
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      return JSON.parse(text);
    } catch (error) {
      console.error("Gemini API Error, falling back to mock data.", error);
      return null;
    }
  }

  // Ollama
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3", // user can change to their local model
        system: systemPrompt,
        prompt: prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.1 }
      })
    });
    if (!response.ok) throw new Error("Ollama error: " + response.statusText);
    const data = await response.json();
    return JSON.parse(data.response);
  } catch (error) {
    console.error("Ollama Error, falling back to mock data.", error);
    return null;
  }
}

async function classifyCircular(text) {
  const prompt = `Analyze this banking circular and classify it.
Circular: ${text}
Output JSON with these fields: regulator (string), circular_type (string), domain (string), sub_domains (array of strings), affected_entity_types (array of strings), urgency (high/medium/low), rationale (string).`;
  const result = await callLLM(prompt);
  
  if (result) return result;
  
  // Fallback if LLM fails
  const lowered = text.toLowerCase();
  let domain = "KYC / AML";
  if (lowered.includes("cyber")) domain = "Cybersecurity & IT Risk";
  if (lowered.includes("digital lending")) domain = "Digital Lending";
  return {
    regulator: "RBI",
    circular_type: "amendment",
    domain,
    sub_domains: ["periodic_kyc", "customer_due_diligence", "branch_execution", "core_banking_controls"],
    affected_entity_types: ["commercial_banks"],
    urgency: lowered.includes("shall") ? "high" : "medium",
    rationale: "The circular changes a KYC operating rule and requires policy, system, branch, and audit action.",
  };
}

async function buildInterpretation(text) {
  const prompt = `Extract exactly 5 key clauses/obligations from this circular.
Circular: ${text}
Output JSON format: { "clauses": [ { "clause_ref": "Title", "scope": "String", "applicability": "String", "effective_date": "String", "exceptions": ["String"], "obligation_type": "policy_change" } ] }
Valid obligation_type values: policy_change, system_change, branch_process, last_mile, assurance.`;
  const result = await callLLM(prompt);
  if (result && result.clauses && result.clauses.length > 0) return result.clauses;

  // Fallback
  return [
    {
      clause_ref: "KYC cycle revision",
      scope: "Low-risk individual periodic KYC re-verification changes from 10 years to 8 years.",
      applicability: "All low-risk individual customers of Bharat Vikas Bank.",
      effective_date: "T+60 days",
      exceptions: ["Higher-risk customers retain stricter internal cycles."],
      obligation_type: "policy_change",
    },
    {
      clause_ref: "CBS parameter update",
      scope: "Core banking configuration must calculate next KYC due date using an 8-year low-risk cycle.",
      applicability: "CBS, onboarding, branch operations, and customer communication systems.",
      effective_date: "Before T+60 days",
      exceptions: [],
      obligation_type: "system_change",
    },
    {
      clause_ref: "Customer re-screening",
      scope: "Customers newly due or overdue under the 8-year rule must be identified and re-screened.",
      applicability: "All branches, with priority to high-pendency rural branches.",
      effective_date: "Start immediately; certify by T+60 days",
      exceptions: ["Empathetic handling for elderly and inoperative-account customers."],
      obligation_type: "branch_process",
    },
    {
      clause_ref: "Vernacular branch execution",
      scope: "Branch instructions and customer notices must be available in the dominant local language.",
      applicability: "Branch managers, tellers, business correspondents, and customer service staff.",
      effective_date: "Before branch dispatch",
      exceptions: [],
      obligation_type: "last_mile",
    },
    {
      clause_ref: "Evidence and audit trail",
      scope: "Evidence must link circular clause, MAP, owner, branch task, CBS result, and validation verdict.",
      applicability: "Compliance, branch operations, risk, IT, and internal audit.",
      effective_date: "Continuous",
      exceptions: [],
      obligation_type: "assurance",
    },
  ];
}

async function buildMaps(interpretations) {
  const prompt = `Based on these clauses: ${JSON.stringify(interpretations)}, generate Measurable Action Points (MAPs).
Generate 1 MAP per clause.
Output JSON format: { "maps": [ { "code": "MAP-001", "clause_ref": "Matches clause_ref", "description": "String", "smart": { "specific": "String", "measurable": "String", "assignable": "Department name", "relevant": "String", "time_bound": "String" }, "confidence": 0.9, "draft_type": "policy_paragraph" } ] }
Valid draft_type values: policy_paragraph, system_param, sop, customer_notice, training_module, completion_certificate.`;
  const result = await callLLM(prompt);
  if (result && result.maps && result.maps.length > 0) return result.maps;

  // Fallback
  return [
    {
      code: "MAP-001",
      clause_ref: "KYC cycle revision",
      description: "Revise the BVB KYC policy so low-risk periodic re-verification is every 8 years instead of 10.",
      smart: {
        specific: "Update policy clause KYC-POL-4.2 and approval note.",
        measurable: "Approved policy paragraph and circular addendum stored in repository.",
        assignable: "Compliance & AML",
        relevant: "Implements the changed KYC cycle.",
        time_bound: "Within 15 days.",
      },
      confidence: 0.94,
      draft_type: "policy_paragraph",
    },
    {
      code: "MAP-002",
      clause_ref: "CBS parameter update",
      description: "Change CBS parameter kyc.low_risk_periodic_years from 10 to 8 and run due-date regression tests.",
      smart: {
        specific: "Update CBS and onboarding due-date calculation.",
        measurable: "Parameter reads 8 and test cases pass for low-risk customers.",
        assignable: "Information Technology",
        relevant: "Prevents accounts from using the old 10-year cycle.",
        time_bound: "Within 30 days.",
      },
      confidence: 0.91,
      draft_type: "system_param",
    },
    {
      code: "MAP-003",
      clause_ref: "Customer re-screening",
      description: "Generate branch-wise lists of customers newly due under the 8-year cycle and complete re-screening.",
      smart: {
        specific: "Identify newly due customers, prioritize rural high-pendency branches, and close KYC updates.",
        measurable: "1,500 target customers re-screened or exception-coded.",
        assignable: "Branch Operations / Network",
        relevant: "Converts the circular into customer-level execution.",
        time_bound: "Within 60 days.",
      },
      confidence: 0.88,
      draft_type: "sop",
    },
    {
      code: "MAP-004",
      clause_ref: "Vernacular branch execution",
      description: "Issue branch checklist and customer notice templates in English and each branch's local language.",
      smart: {
        specific: "Publish role-specific branch checklist and customer notice.",
        measurable: "Checklist dispatched to all 15 BVB branches with translation cache hit on repeat.",
        assignable: "Branch Operations / Network",
        relevant: "Closes the last-mile understanding gap.",
        time_bound: "Within 20 days.",
      },
      confidence: 0.9,
      draft_type: "customer_notice",
    },
    {
      code: "MAP-005",
      clause_ref: "Vernacular branch execution",
      description: "Train tellers, branch managers, and business correspondents on the 8-year KYC cycle.",
      smart: {
        specific: "Deliver a 20-minute staff acknowledgement module.",
        measurable: "100% target staff acknowledgement uploaded branch-wise.",
        assignable: "Human Resources / Training",
        relevant: "Ensures branch behavior changes before effective date.",
        time_bound: "Within 45 days.",
      },
      confidence: 0.86,
      draft_type: "training_module",
    },
    {
      code: "MAP-006",
      clause_ref: "Evidence and audit trail",
      description: "Validate policy approval, CBS parameter, branch evidence, and re-screening counts before closure.",
      smart: {
        specific: "Run Pramanik validation and produce an audit-ready completion certificate.",
        measurable: "Validated, Partial, or Not Validated verdict with cited evidence.",
        assignable: "Risk Management",
        relevant: "Proves compliance rather than only tracking tasks.",
        time_bound: "Before final certification.",
      },
      confidence: 0.92,
      draft_type: "completion_certificate",
    },
  ];
}

async function draftFor(draftType, mapData, circularText) {
  const prompt = `Draft a ${draftType} document for the following Action Point: ${JSON.stringify(mapData)}. 
Context: ${circularText}. 
Output JSON format: { "title": "Document Title", "content": "Full document text" }`;
  const result = await callLLM(prompt);
  if (result && result.title && result.content) return [result.title, result.content];

  // Fallback
  const drafts = {
    policy_paragraph: [
      "Policy Addendum: Low-Risk Periodic KYC Cycle",
      "Regulatory anchor: KYC-2026-001, clause 'KYC cycle revision'.\n\nBharat Vikas Bank shall complete periodic KYC re-verification for low-risk individual customers at least once every 8 years. The earlier 10-year cycle is withdrawn for this category. Branches and digital channels shall calculate the next due date from the last verified KYC date, apply the stricter cycle where customer risk is upgraded, and retain evidence of customer outreach, verification, and exceptions in the audit repository.",
    ],
    system_param: [
      "CBS Change Specification: Low-Risk KYC Cycle",
      "Parameter: kyc.low_risk_periodic_years\nCurrent value: 10\nRequired value: 8\nEffective window: before T+60 days\n\nRegression tests:\n1. Low-risk customer verified on 2018-07-01 becomes due on 2026-07-01.\n2. Customer with upgraded risk category follows the stricter risk cycle.\n3. Branch worklist refreshes within one business day after parameter deployment.\nRollback: restore previous config snapshot and mark all generated worklists as stale.",
    ],
    sop: [
      "SOP: Branch Re-Screening Under 8-Year KYC Cycle",
      "1. Download the branch worklist from NiyamSetu.\n2. Contact customers due under the revised 8-year cycle.\n3. Accept any officially valid document permitted by the bank policy; do not insist on Aadhaar.\n4. Offer assisted service through branch staff or business correspondents for rural customers.\n5. Upload outreach evidence, KYC completion count, and exception reasons by the due date.\n6. Escalate hardship, elderly, or inoperative-account cases to the Branch Manager.",
    ],
    customer_notice: [
      "Customer Notice: Periodic KYC Updation",
      "Dear Customer,\n\nYour periodic KYC details may be due for update under the revised 8-year low-risk customer cycle. Please visit your branch or contact the bank's authorised representative with any accepted official valid document. Aadhaar is not mandatory. If your details are unchanged, staff will help you record the required declaration. For assistance, contact your Branch Manager.\n\nBharat Vikas Bank",
    ],
    training_module: [
      "Training Module: 8-Year KYC Cycle",
      "Audience: branch managers, tellers, business correspondents.\nDuration: 20 minutes.\n\nKey points: explain the new 8-year cycle, handle customers empathetically, accept permitted OVDs, avoid Aadhaar-only language, record exceptions, and upload evidence. Staff must acknowledge before serving KYC update requests under this circular.",
    ],
    completion_certificate: [
      "Completion Certificate Template",
      "This certificate records that BVB has reviewed KYC-2026-001, updated policy and CBS controls, dispatched branch instructions, collected evidence, and run Pramanik validation. Final status must cite the CBS parameter value, re-screened customer count, branch evidence coverage, and remaining exceptions, if any.",
    ],
  };
  return drafts[draftType] || ["Draft", "Content not available."];
}

function translateInstruction(text, language) {
  const key = `${hash(text)}:${language}`;
  if (translationCache.has(key)) return translationCache.get(key);
  const labels = {
    kn: "Kannada branch checklist",
    ta: "Tamil branch checklist",
    or: "Odia branch checklist",
    hi: "Hindi branch checklist",
    mr: "Marathi branch checklist",
    te: "Telugu branch checklist",
    bn: "Bengali branch checklist",
    gu: "Gujarati branch checklist",
  };
  const translated = `${labels[language] || "Branch checklist"}: verify the 8-year KYC due list, contact customers, record staff acknowledgement, run the KYC camp where needed, and upload evidence before closure.`;
  translationCache.set(key, translated);
  return translated;
}
function shouldDispatch(code) {
  return ["MAP-003", "MAP-004", "MAP-005"].includes(code);
}

async function runPipeline(circularId) {
  const circular = db.prepare("SELECT * FROM circulars WHERE id = ?").get(circularId);
  if (!circular) throw new Error("Circular not found");
  clearPipelineRows(circularId);
  db.prepare("UPDATE circulars SET status = ? WHERE id = ?").run("processing", circularId);

  const events = [];
  const event = (agent, status, summary) => events.push({ agent, status, summary, ts: nowIso() });

  event("prahari", "started", { activity: "classifying" });
  const classification = await classifyCircular(circular.full_text);
  db.prepare("UPDATE circulars SET domain = ?, classification_json = ? WHERE id = ?")
    .run(classification.domain, toJson(classification), circularId);
  audit(circularId, "agent", "prahari", "classified circular", classification);
  event("prahari", "completed", { domain: classification.domain, urgency: classification.urgency });

  event("vyakhya", "started", { activity: "extracting clauses" });
  const interpretations = await buildInterpretation(circular.full_text);
  const insertInterpretation = db.prepare(`
    INSERT INTO interpretations
    (id, circular_id, clause_ref, scope, applicability, effective_date, obligation_type, exceptions_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of interpretations) {
    insertInterpretation.run(newId("int"), circularId, item.clause_ref, item.scope, item.applicability, item.effective_date, item.obligation_type, toJson(item.exceptions));
  }
  audit(circularId, "agent", "vyakhya", "interpreted clauses", { clauses: interpretations.length });
  event("vyakhya", "completed", { clauses: interpretations.length });

  event("vibhajan", "started", { activity: "creating MAPs" });
  const maps = await buildMaps(interpretations);
  const mapIds = {};
  const insertMap = db.prepare(`
    INSERT INTO maps
    (id, circular_id, code, clause_ref, description, smart_json, confidence, needs_review, draft_type, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of maps) {
    const id = newId("map");
    mapIds[item.code] = id;
    insertMap.run(id, circularId, item.code, item.clause_ref, item.description, toJson(item.smart), item.confidence, item.confidence < 0.7 ? 1 : 0, item.draft_type, "open", nowIso());
  }
  audit(circularId, "agent", "vibhajan", "created MAPs", { maps: maps.length, review_required: 0 });
  event("vibhajan", "completed", { maps: maps.length, review_required: 0 });

  event("lekhak", "started", { activity: "drafting artifacts" });
  const insertDraft = db.prepare(`
    INSERT INTO drafts (id, map_id, type, title, content, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of maps) {
    const [title, content] = await draftFor(item.draft_type, item.smart, circular.full_text);
    insertDraft.run(newId("draft"), mapIds[item.code], item.draft_type, title, content, "draft", nowIso());
  }
  audit(circularId, "agent", "lekhak", "drafted artifacts", { drafts: maps.length });
  event("lekhak", "completed", { drafts: maps.length });

  event("niyojak", "started", { activity: "routing ownership" });
  const insertAssignment = db.prepare(`
    INSERT INTO assignments
    (id, map_id, department, owner_role, collaborators_json, ticket_ref, rationale, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertBranchTask = db.prepare(`
    INSERT INTO branch_tasks
    (id, map_id, branch_id, role, language, instruction_text, vernacular_text, status, evidence_note, validation_result, validation_reasoning, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)
  `);
  const branches = db.prepare("SELECT * FROM branches ORDER BY pendency_pct DESC").all();
  for (const item of maps) {
    const [department, ownerRole, collaborators] = ASSIGNMENTS[item.code];
    insertAssignment.run(
      newId("asg"),
      mapIds[item.code],
      department,
      ownerRole,
      toJson(collaborators),
      `NS-${item.code.split("-")[1]}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      "Routed by Niyam-Jaal impact graph: clause -> system/policy -> capability owner.",
      "open",
      nowIso(),
    );
    if (shouldDispatch(item.code)) {
      for (const branch of branches) {
        const role = item.code === "MAP-005" ? "Branch Trainer" : "Branch Manager";
        const instruction = `${item.code}: ${item.description} Branch ${branch.name} has ${branch.kyc_pending} pending KYC items.`;
        insertBranchTask.run(newId("bt"), mapIds[item.code], branch.id, role, branch.language, instruction, translateInstruction(instruction, branch.language), "open", nowIso());
      }
    }
  }
  audit(circularId, "agent", "niyojak", "routed MAPs", { assignments: maps.length, branches: bank.BRANCHES.length });
  event("niyojak", "completed", { assignments: maps.length, branch_dispatches: bank.BRANCHES.length * 3 });

  event("pramanik", "started", { activity: "preparing validation controls" });
  audit(circularId, "agent", "pramanik", "prepared validation controls", { scenarios: ["validated", "partial", "not_validated"], cbs: "mock local service" });
  event("pramanik", "completed", { controls: 3, cbs: "ready" });

  db.prepare("UPDATE circulars SET status = ? WHERE id = ?").run("processed", circularId);
  audit(circularId, "pipeline", "system", "pipeline completed", { events: events.length, status: "processed" });
  return events;
}

function cbsSnapshot(scenario) {
  const selected = ["validated", "partial", "not_validated"].includes(scenario) ? scenario : "partial";
  const base = {
    scenario: selected,
    target_due_customers: 1500,
    branch_evidence_expected: bank.BRANCHES.length * 3,
    last_sync: nowIso(),
  };
  if (selected === "validated") {
    return { ...base, low_risk_periodic_years: 8, rescreened_customers: 1500, exceptions_recorded: 0, branch_evidence_uploaded: bank.BRANCHES.length * 3 };
  }
  if (selected === "partial") {
    return { ...base, low_risk_periodic_years: 8, rescreened_customers: 1200, exceptions_recorded: 42, branch_evidence_uploaded: 14 };
  }
  return { ...base, low_risk_periodic_years: 10, rescreened_customers: 220, exceptions_recorded: 0, branch_evidence_uploaded: 3 };
}

function judgeValidation(scenario, evidenceNote) {
  const cbs = cbsSnapshot(scenario);
  const checked = [
    `cbs.low_risk_periodic_years=${cbs.low_risk_periodic_years}`,
    `rescreened=${cbs.rescreened_customers}/${cbs.target_due_customers}`,
    `branch_evidence_uploaded=${cbs.branch_evidence_uploaded}/${cbs.branch_evidence_expected}`,
    `evidence_note=${evidenceNote ? "yes" : "no"}`,
  ];
  if (cbs.low_risk_periodic_years !== 8) {
    return { result: "not_validated", reasoning: "CBS still uses the old 10-year low-risk KYC cycle; the core control is not compliant.", evidence_checked: checked, cbs };
  }
  if (cbs.rescreened_customers >= cbs.target_due_customers && evidenceNote) {
    return { result: "validated", reasoning: "CBS parameter is 8 years, all target customers are re-screened, and branch evidence is present.", evidence_checked: checked, cbs };
  }
  return {
    result: "partial",
    reasoning: `CBS parameter is correct, but only ${cbs.rescreened_customers} of ${cbs.target_due_customers} target customers are re-screened.`,
    evidence_checked: checked,
    cbs,
  };
}

function graphForCircular(circularId) {
  return {
    circular_id: circularId,
    nodes: [
      { id: "KYC-2026-001", label: "Circular", group: "regulation" },
      { id: "KYC cycle revision", label: "Clause", group: "clause" },
      { id: "CBS parameter update", label: "Clause", group: "clause" },
      { id: "Customer re-screening", label: "Clause", group: "clause" },
      { id: "KYC-POL-4.2", label: "Policy", group: "policy" },
      { id: "CBS:kyc.low_risk_periodic_years", label: "System", group: "system" },
      { id: "Compliance & AML", label: "Department", group: "department" },
      { id: "Information Technology", label: "Department", group: "department" },
      { id: "Branch Operations / Network", label: "Department", group: "department" },
      { id: "Risk Management", label: "Department", group: "department" },
      { id: "Hubli Rural", label: "Branch", group: "branch" },
      { id: "Varanasi Rural", label: "Branch", group: "branch" },
    ],
    edges: [
      { from: "KYC-2026-001", to: "KYC cycle revision", type: "CONTAINS" },
      { from: "KYC-2026-001", to: "CBS parameter update", type: "CONTAINS" },
      { from: "KYC-2026-001", to: "Customer re-screening", type: "CONTAINS" },
      { from: "KYC cycle revision", to: "KYC-POL-4.2", type: "AMENDS" },
      { from: "CBS parameter update", to: "CBS:kyc.low_risk_periodic_years", type: "CONFIGURES" },
      { from: "KYC-POL-4.2", to: "Compliance & AML", type: "OWNED_BY" },
      { from: "CBS:kyc.low_risk_periodic_years", to: "Information Technology", type: "OWNED_BY" },
      { from: "Customer re-screening", to: "Branch Operations / Network", type: "OWNED_BY" },
      { from: "Customer re-screening", to: "Risk Management", type: "VALIDATED_BY" },
      { from: "Branch Operations / Network", to: "Hubli Rural", type: "DISPATCHES" },
      { from: "Branch Operations / Network", to: "Varanasi Rural", type: "DISPATCHES" },
    ],
  };
}

function latestCircularId() {
  const row = db.prepare("SELECT id FROM circulars ORDER BY created_at DESC LIMIT 1").get();
  return row ? row.id : null;
}

function getState(circularId = null) {
  const selectedId = circularId || latestCircularId();
  const branches = db.prepare("SELECT * FROM branches ORDER BY pendency_pct DESC").all();
  if (!selectedId) {
    return {
      circular: null,
      interpretations: [],
      maps: [],
      branches,
      branch_tasks: [],
      validations: [],
      audit: [],
      graph: graphForCircular("draft"),
      golden_circular: GOLDEN_CIRCULAR,
      agents: AGENTS.map(([key, label, role]) => ({ key, label, role })),
      bank: bank.getBankState(db),
    };
  }

  const circular = db.prepare("SELECT * FROM circulars WHERE id = ?").get(selectedId);
  if (circular) {
    circular.classification = fromJson(circular.classification_json, {});
    delete circular.classification_json;
  }

  const interpretations = db.prepare("SELECT * FROM interpretations WHERE circular_id = ? ORDER BY rowid").all(selectedId)
    .map((item) => ({ ...item, exceptions: fromJson(item.exceptions_json, []) }));
  for (const item of interpretations) delete item.exceptions_json;

  const maps = db.prepare("SELECT * FROM maps WHERE circular_id = ? ORDER BY code").all(selectedId).map((item) => {
    const draft = db.prepare("SELECT * FROM drafts WHERE map_id = ?").get(item.id) || null;
    const assignment = db.prepare("SELECT * FROM assignments WHERE map_id = ?").get(item.id) || null;
    if (assignment) {
      assignment.collaborators = fromJson(assignment.collaborators_json, []);
      delete assignment.collaborators_json;
    }
    return {
      ...item,
      smart: fromJson(item.smart_json, {}),
      needs_review: Boolean(item.needs_review),
      draft,
      assignment,
    };
  });
  for (const item of maps) delete item.smart_json;

  const branchTasks = db.prepare(`
    SELECT bt.*, b.name AS branch_name, b.state, b.language_label, b.pendency_pct,
           m.code AS map_code, m.description AS map_description
    FROM branch_tasks bt
    JOIN branches b ON b.id = bt.branch_id
    JOIN maps m ON m.id = bt.map_id
    WHERE m.circular_id = ?
    ORDER BY b.pendency_pct DESC, m.code
  `).all(selectedId);

  const validations = db.prepare("SELECT * FROM validation_results WHERE circular_id = ? ORDER BY created_at DESC").all(selectedId)
    .map((item) => ({ ...item, evidence_checked: fromJson(item.evidence_checked_json, []) }));
  for (const item of validations) delete item.evidence_checked_json;

  const auditRows = db.prepare("SELECT * FROM audit_events WHERE circular_id = ? ORDER BY rowid").all(selectedId)
    .map((item) => ({ ...item, payload: fromJson(item.payload_json, {}) }));
  for (const item of auditRows) delete item.payload_json;

  return {
    circular,
    interpretations,
    maps,
    branches,
    branch_tasks: branchTasks,
    validations,
    audit: auditRows,
    graph: graphForCircular(selectedId),
    golden_circular: GOLDEN_CIRCULAR,
    agents: AGENTS.map(([key, label, role]) => ({ key, label, role })),
    bank: bank.getBankState(db),
  };
}

async function createOrRunCircular(payload) {
  const title = payload.title || "KYC-2026-001";
  const fullText = payload.full_text || GOLDEN_CIRCULAR;
  const contentHash = hash(fullText).slice(0, 16);
  let circular = db.prepare("SELECT * FROM circulars WHERE content_hash = ?").get(contentHash);
  let circularId = circular ? circular.id : newId("cir");
  if (!circular) {
    db.prepare(`
      INSERT INTO circulars
      (id, title, source, full_text, content_hash, domain, classification_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)
    `).run(circularId, title, "RBI", fullText, contentHash, "ingested", nowIso());
  }
  audit(circularId, "intake", "human", "ingested circular", { title, hash: contentHash });
  const events = await runPipeline(circularId);
  return { ...getState(circularId), events };
}

function updateDraft(draftId, payload) {
  const draft = db.prepare(`
    SELECT d.*, m.circular_id, m.code
    FROM drafts d JOIN maps m ON m.id = d.map_id
    WHERE d.id = ?
  `).get(draftId);
  if (!draft) throw Object.assign(new Error("Draft not found"), { status: 404 });
  if (payload.action === "approve") {
    db.prepare("UPDATE drafts SET status = ? WHERE id = ?").run("approved", draftId);
  } else if (payload.action === "reject") {
    db.prepare("UPDATE drafts SET status = ? WHERE id = ?").run("rejected", draftId);
  } else if (payload.action === "edit") {
    db.prepare("UPDATE drafts SET content = ?, status = ? WHERE id = ?").run(payload.content || draft.content, "edited", draftId);
  } else {
    throw Object.assign(new Error("Invalid draft action"), { status: 400 });
  }
  audit(draft.circular_id, "human_gate", "human", `draft ${payload.action}`, { draft_id: draftId, map: draft.code });
  return getState(draft.circular_id);
}

function updateMap(mapId, payload) {
  const row = db.prepare("SELECT circular_id, code FROM maps WHERE id = ?").get(mapId);
  if (!row) throw Object.assign(new Error("MAP not found"), { status: 404 });
  const status = payload.action === "approve" ? "approved" : "open";
  db.prepare("UPDATE maps SET status = ? WHERE id = ?").run(status, mapId);
  audit(row.circular_id, "human_gate", "human", `MAP ${status}`, { map: row.code });
  return getState(row.circular_id);
}

function submitEvidence(taskId, payload) {
  const task = db.prepare(`
    SELECT bt.*, m.circular_id, m.code, b.name AS branch_name
    FROM branch_tasks bt
    JOIN maps m ON m.id = bt.map_id
    JOIN branches b ON b.id = bt.branch_id
    WHERE bt.id = ?
  `).get(taskId);
  if (!task) throw Object.assign(new Error("Branch task not found"), { status: 404 });
  const scenario = payload.scenario || "partial";
  const evidenceNote = payload.evidence_note || "";
  const verdict = judgeValidation(scenario, evidenceNote);
  db.prepare(`
    UPDATE branch_tasks
    SET status = ?, evidence_note = ?, validation_result = ?, validation_reasoning = ?, updated_at = ?
    WHERE id = ?
  `).run(verdict.result, evidenceNote, verdict.result, verdict.reasoning, nowIso(), taskId);
  db.prepare(`
    INSERT INTO validation_results
    (id, circular_id, subject_type, subject_id, scenario, result, reasoning, evidence_checked_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(newId("val"), task.circular_id, "branch_task", taskId, scenario, verdict.result, verdict.reasoning, toJson(verdict.evidence_checked), nowIso());
  audit(task.circular_id, "validation", "pramanik", "validated branch evidence", {
    task_id: taskId,
    map: task.code,
    branch: task.branch_name,
    scenario,
    result: verdict.result,
  });
  return { ...getState(task.circular_id), last_verdict: verdict };
}

function runValidation(payload) {
  const circularId = payload.circular_id || latestCircularId();
  if (!circularId) throw Object.assign(new Error("No circular has been processed"), { status: 404 });
  const scenario = payload.scenario || "partial";
  const verdict = judgeValidation(scenario, "Console validation run");
  db.prepare(`
    INSERT INTO validation_results
    (id, circular_id, subject_type, subject_id, scenario, result, reasoning, evidence_checked_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(newId("val"), circularId, "circular", circularId, scenario, verdict.result, verdict.reasoning, toJson(verdict.evidence_checked), nowIso());
  audit(circularId, "validation", "pramanik", "validated circular closure", { scenario, result: verdict.result, cbs: verdict.cbs });
  return { ...getState(circularId), last_verdict: verdict };
}

function verifyAuditChain() {
  const rows = db.prepare("SELECT * FROM audit_events ORDER BY rowid").all();
  let previous = "GENESIS";
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const expected = hash([row.id, row.ts, row.circular_id || "", row.stage, row.actor, row.action, row.payload_json, row.prev_hash].join("|"));
    if (row.prev_hash !== previous || row.hash !== expected) return { ok: false, events: rows.length, failed_at: i + 1 };
    previous = row.hash;
  }
  return { ok: true, events: rows.length, failed_at: null };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(Object.assign(new Error("Invalid JSON body"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, payload, status = 200) {
  const body = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendStatic(res, pathname) {
  const targetPath = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(FRONTEND_DIR, `.${targetPath}`);
  const safe = resolved.startsWith(FRONTEND_DIR);
  const file = safe && fs.existsSync(resolved) && fs.statSync(resolved).isFile()
    ? resolved
    : path.join(FRONTEND_DIR, "index.html");
  const ext = path.extname(file);
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  }[ext] || "application/octet-stream";
  const body = fs.readFileSync(file);
  res.writeHead(200, { 
    "Content-Type": contentType, 
    "Content-Length": body.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store"
  });
  res.end(body);
}

async function handle(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname.startsWith("/auth/") || pathname.startsWith("/api/bank/") || pathname.startsWith("/api/rbac/")) {
      const bankResult = await bank.handleBankRoute(db, req, url, parseBody);
      if (bankResult !== null) return sendJson(res, bankResult);
    }

    if (req.method === "GET" && pathname === "/api/health") {
      return sendJson(res, { ok: true, service: "niyamsetu", offline_ready: true, db: DB_PATH, audit: verifyAuditChain() });
    }
    if (req.method === "GET" && pathname === "/api/state") {
      return sendJson(res, getState(url.searchParams.get("circular_id")));
    }
    if (req.method === "GET" && pathname === "/api/golden") {
      return sendJson(res, { title: "KYC-2026-001", full_text: GOLDEN_CIRCULAR });
    }
    if (req.method === "GET" && pathname === "/api/branches") {
      return sendJson(res, getState().branches);
    }
    if (req.method === "GET" && pathname === "/api/cbs") {
      return sendJson(res, cbsSnapshot(url.searchParams.get("scenario") || "partial"));
    }
    if (req.method === "GET" && pathname === "/api/audit/verify") {
      return sendJson(res, verifyAuditChain());
    }
    const branchMatch = pathname.match(/^\/api\/branches\/([^/]+)\/tasks$/);
    if (req.method === "GET" && branchMatch) {
      const state = getState();
      return sendJson(res, state.branch_tasks.filter((task) => task.branch_id === branchMatch[1]));
    }

    if (req.method === "POST" && pathname === "/api/regulations") {
      const payload = await parseBody(req);
      const result = await createOrRunCircular(payload);
      return sendJson(res, result);
    }
    if (req.method === "POST" && pathname === "/api/reset") {
      resetDb();
      return sendJson(res, getState());
    }
    if (req.method === "POST" && pathname === "/api/validations/run") {
      return sendJson(res, runValidation(await parseBody(req)));
    }
    const evidenceMatch = pathname.match(/^\/api\/branch-tasks\/([^/]+)\/evidence$/);
    if (req.method === "POST" && evidenceMatch) {
      return sendJson(res, submitEvidence(evidenceMatch[1], await parseBody(req)));
    }

    const draftMatch = pathname.match(/^\/api\/drafts\/([^/]+)$/);
    if (req.method === "PATCH" && draftMatch) {
      return sendJson(res, updateDraft(draftMatch[1], await parseBody(req)));
    }
    const mapMatch = pathname.match(/^\/api\/maps\/([^/]+)$/);
    if (req.method === "PATCH" && mapMatch) {
      return sendJson(res, updateMap(mapMatch[1], await parseBody(req)));
    }

    if (req.method === "GET") return sendStatic(res, pathname);
    return sendJson(res, { error: "Not found" }, 404);
  } catch (error) {
    return sendJson(res, { error: error.message || "Server error" }, error.status || 500);
  }
}

initDb();
http.createServer(handle).listen(PORT, HOST, () => {
  console.log(`NiyamSetu running offline at http://${HOST}:${PORT}`);
  console.log("Press Ctrl+C to stop.");
});



