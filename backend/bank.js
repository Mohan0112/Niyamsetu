const crypto = require("node:crypto");

const SEED_LOGIN_VALUE = crypto.randomBytes(24).toString("base64url");
const SIGNING_KEY = process.env.NIYAMSETU_SIGNING_KEY || crypto.randomBytes(32).toString("base64url");
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.NIYAMSETU_ACCESS_TTL_SECONDS || 28800);
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.NIYAMSETU_REFRESH_TTL_SECONDS || 1209600);
const LOGIN_LOCK_THRESHOLD = Number(process.env.NIYAMSETU_LOCK_THRESHOLD || 5);
const LOGIN_LOCK_SECONDS = Number(process.env.NIYAMSETU_LOCK_SECONDS || 900);

const REGIONS = [["RGN-S", "South Region", "Bengaluru"], ["RGN-W", "West Region", "Mumbai"], ["RGN-NE", "North & East Region", "New Delhi"]];
const DEPARTMENTS = [["EXEC", "Executive Office"], ["COMP", "Compliance"], ["AUDIT", "Internal Audit"], ["IT", "Information Technology"], ["RTL", "Retail Banking"], ["OPS", "Operations"], ["RISK", "Risk Management"], ["LEG", "Legal & Secretarial"], ["HR", "Human Resources"]];
const DESIGNATIONS = {
  MD_CEO: ["Managing Director & CEO", "TEGS-VII", 100, "Executive"], GM: ["General Manager", "TEGS-VII", 70, "Executive"], DGM: ["Deputy General Manager", "TEGS-VI", 60, "Officer"], AGM: ["Assistant General Manager", "SMGS-V", 50, "Officer"], CHIEF_MANAGER: ["Chief Manager", "SMGS-IV", 40, "Officer"], SENIOR_MANAGER: ["Senior Manager", "MMGS-III", 30, "Officer"], MANAGER: ["Manager", "MMGS-II", 20, "Officer"], ASSISTANT_MANAGER: ["Assistant Manager", "JMGS-I", 12, "Officer"], IT_OFFICER: ["IT Officer (Specialist)", "JMGS-I", 12, "Officer"], CLERK: ["Single Window Operator (Clerk)", "Clerical", 5, "Clerical"], SUB_STAFF: ["Office Attendant", "Subordinate", 1, "Subordinate"]
};
const PERMISSIONS = {
  "circular.view": ["View circulars relevant to own scope", "Circular"], "circular.view_all": ["View all circulars across the bank", "Circular"], "circular.create": ["Ingest / create a circular", "Circular"], "circular.assign": ["Assign a circular to branches/officers", "Circular"], "circular.delete": ["Delete a circular", "Circular"],
  "task.view": ["View tasks assigned to self", "Task"], "task.view_all": ["View all tasks in scope", "Task"], "task.create": ["Create a compliance task", "Task"], "task.update": ["Update a task status/details", "Task"], "task.assign": ["Assign tasks to staff", "Task"], "task.approve": ["Approve completed tasks", "Task"], "task.submit_evidence": ["Upload evidence for a task", "Task"],
  "audit.view": ["View audits for own branch", "Audit"], "audit.view_all": ["View all audits in scope", "Audit"], "audit.create": ["Plan / create an audit", "Audit"], "audit.conduct": ["Conduct an audit and record findings", "Audit"], "audit.finding.manage": ["Create/update/close audit findings", "Audit"], "audit.report": ["Generate audit reports", "Audit"],
  "employee.view": ["View employees in own branch", "Employee"], "employee.view_all": ["View all employees in scope", "Employee"], "employee.create": ["Add an employee", "Employee"], "employee.update": ["Edit an employee record", "Employee"], "employee.delete": ["Remove an employee", "Employee"],
  "branch.view": ["View own branch", "Branch"], "branch.view_all": ["View all branches in scope", "Branch"], "branch.manage": ["Create / edit branches", "Branch"], "user.view": ["View user accounts", "User"], "user.create": ["Create user accounts", "User"], "user.update": ["Edit user accounts", "User"], "user.deactivate": ["Activate / deactivate users", "User"], "user.reset_password": ["Reset another user password", "User"],
  "role.manage": ["Create/edit roles and assign permissions", "RBAC"], "permission.manage": ["Manage the permission catalog", "RBAC"], "report.view": ["View dashboards and reports", "Report"], "report.generate": ["Generate / export reports", "Report"], "system.admin": ["Full system administration wildcard", "System"], "auditlog.view": ["View action audit trail", "System"], "loginlog.view": ["View login logs", "System"]
};
const ROLES = { SUPER_ADMIN: ["System administrator (IT) - full control", "GLOBAL"], EXECUTIVE: ["MD & CEO / board-level oversight", "GLOBAL"], CHIEF_COMPLIANCE_OFFICER: ["Owns bank-wide compliance", "GLOBAL"], COMPLIANCE_MANAGER: ["HO/Regional compliance", "REGION"], REGIONAL_MANAGER: ["Heads a region", "REGION"], BRANCH_MANAGER: ["Heads a branch", "BRANCH"], COMPLIANCE_OFFICER: ["Branch compliance officer", "BRANCH"], AUDITOR: ["Internal audit", "GLOBAL"], IT_ENGINEER: ["IT/systems support", "GLOBAL"], BANK_STAFF: ["Frontline staff", "BRANCH"] };
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ["system.admin"], EXECUTIVE: ["circular.view_all", "task.view_all", "audit.view_all", "audit.report", "employee.view_all", "branch.view_all", "report.view", "report.generate", "auditlog.view", "loginlog.view", "user.view"], CHIEF_COMPLIANCE_OFFICER: ["circular.view_all", "circular.create", "circular.assign", "circular.delete", "task.view_all", "task.create", "task.assign", "task.approve", "task.update", "audit.view_all", "audit.create", "audit.report", "employee.view_all", "branch.view_all", "report.view", "report.generate", "auditlog.view", "user.view"], COMPLIANCE_MANAGER: ["circular.view_all", "circular.assign", "task.view_all", "task.create", "task.assign", "task.approve", "task.update", "audit.view_all", "audit.report", "employee.view_all", "branch.view_all", "report.view", "report.generate"], REGIONAL_MANAGER: ["circular.view_all", "task.view_all", "task.assign", "task.approve", "audit.view_all", "employee.view_all", "branch.view_all", "report.view", "report.generate"], BRANCH_MANAGER: ["circular.view", "task.view_all", "task.assign", "task.approve", "task.update", "audit.view", "employee.view", "branch.view", "report.view"], COMPLIANCE_OFFICER: ["circular.view", "task.view", "task.update", "task.submit_evidence", "audit.view", "audit.conduct", "audit.finding.manage", "report.view"], AUDITOR: ["audit.view_all", "audit.create", "audit.conduct", "audit.finding.manage", "audit.report", "task.view_all", "circular.view_all", "branch.view_all", "employee.view", "report.view", "auditlog.view"], IT_ENGINEER: ["user.view", "user.create", "user.update", "user.deactivate", "user.reset_password", "branch.view_all", "auditlog.view", "loginlog.view"], BANK_STAFF: ["circular.view", "task.view", "task.update", "task.submit_evidence", "audit.view"]
};
const BRANCHES = [
  { id: "BR001", name: "BVB Bengaluru Main Branch", ifsc: "BVBK000001", branch_code: "BR001", city: "Bengaluru", state: "Karnataka", language: "kn", language_label: "Kannada", tier: 1, is_head_office: 1, region_id: "RGN-S", region_type: "urban", total_accounts: 46200, kyc_pending: 1386, pendency_pct: 3.0 },
  { id: "BR002", name: "BVB Hubballi", ifsc: "BVBK000002", branch_code: "BR002", city: "Hubballi", state: "Karnataka", language: "kn", language_label: "Kannada", tier: 3, is_head_office: 0, region_id: "RGN-S", region_type: "rural", total_accounts: 11800, kyc_pending: 1540, pendency_pct: 13.1 },
  { id: "BR003", name: "BVB Coimbatore", ifsc: "BVBK000003", branch_code: "BR003", city: "Coimbatore", state: "Tamil Nadu", language: "ta", language_label: "Tamil", tier: 2, is_head_office: 0, region_id: "RGN-S", region_type: "semi_urban", total_accounts: 22100, kyc_pending: 1768, pendency_pct: 8.0 },
  { id: "BR004", name: "BVB Chennai T Nagar", ifsc: "BVBK000004", branch_code: "BR004", city: "Chennai", state: "Tamil Nadu", language: "ta", language_label: "Tamil", tier: 1, is_head_office: 0, region_id: "RGN-S", region_type: "urban", total_accounts: 39200, kyc_pending: 1176, pendency_pct: 3.0 },
  { id: "BR005", name: "BVB Hyderabad", ifsc: "BVBK000005", branch_code: "BR005", city: "Hyderabad", state: "Telangana", language: "te", language_label: "Telugu", tier: 2, is_head_office: 0, region_id: "RGN-S", region_type: "urban", total_accounts: 36400, kyc_pending: 1456, pendency_pct: 4.0 },
  { id: "BR006", name: "BVB Mumbai Fort", ifsc: "BVBK000006", branch_code: "BR006", city: "Mumbai", state: "Maharashtra", language: "mr", language_label: "Marathi", tier: 1, is_head_office: 0, region_id: "RGN-W", region_type: "urban", total_accounts: 53800, kyc_pending: 1076, pendency_pct: 2.0 },
  { id: "BR007", name: "BVB Pune", ifsc: "BVBK000007", branch_code: "BR007", city: "Pune", state: "Maharashtra", language: "mr", language_label: "Marathi", tier: 2, is_head_office: 0, region_id: "RGN-W", region_type: "semi_urban", total_accounts: 28400, kyc_pending: 1988, pendency_pct: 7.0 },
  { id: "BR008", name: "BVB Ahmedabad", ifsc: "BVBK000008", branch_code: "BR008", city: "Ahmedabad", state: "Gujarat", language: "gu", language_label: "Gujarati", tier: 2, is_head_office: 0, region_id: "RGN-W", region_type: "semi_urban", total_accounts: 24700, kyc_pending: 2223, pendency_pct: 9.0 },
  { id: "BR009", name: "BVB Surat", ifsc: "BVBK000009", branch_code: "BR009", city: "Surat", state: "Gujarat", language: "gu", language_label: "Gujarati", tier: 3, is_head_office: 0, region_id: "RGN-W", region_type: "semi_urban", total_accounts: 16800, kyc_pending: 1680, pendency_pct: 10.0 },
  { id: "BR010", name: "BVB Indore", ifsc: "BVBK000010", branch_code: "BR010", city: "Indore", state: "Madhya Pradesh", language: "hi", language_label: "Hindi", tier: 3, is_head_office: 0, region_id: "RGN-W", region_type: "semi_urban", total_accounts: 15600, kyc_pending: 1716, pendency_pct: 11.0 },
  { id: "BR011", name: "BVB New Delhi Connaught Place", ifsc: "BVBK000011", branch_code: "BR011", city: "New Delhi", state: "Delhi", language: "hi", language_label: "Hindi", tier: 1, is_head_office: 0, region_id: "RGN-NE", region_type: "urban", total_accounts: 51200, kyc_pending: 1536, pendency_pct: 3.0 },
  { id: "BR012", name: "BVB Jaipur", ifsc: "BVBK000012", branch_code: "BR012", city: "Jaipur", state: "Rajasthan", language: "hi", language_label: "Hindi", tier: 2, is_head_office: 0, region_id: "RGN-NE", region_type: "semi_urban", total_accounts: 23800, kyc_pending: 2142, pendency_pct: 9.0 },
  { id: "BR013", name: "BVB Lucknow", ifsc: "BVBK000013", branch_code: "BR013", city: "Lucknow", state: "Uttar Pradesh", language: "hi", language_label: "Hindi", tier: 3, is_head_office: 0, region_id: "RGN-NE", region_type: "semi_urban", total_accounts: 19600, kyc_pending: 2156, pendency_pct: 11.0 },
  { id: "BR014", name: "BVB Kolkata", ifsc: "BVBK000014", branch_code: "BR014", city: "Kolkata", state: "West Bengal", language: "bn", language_label: "Bengali", tier: 2, is_head_office: 0, region_id: "RGN-NE", region_type: "semi_urban", total_accounts: 21400, kyc_pending: 1926, pendency_pct: 9.0 },
  { id: "BR015", name: "BVB Bhubaneswar", ifsc: "BVBK000015", branch_code: "BR015", city: "Bhubaneswar", state: "Odisha", language: "or", language_label: "Odia", tier: 3, is_head_office: 0, region_id: "RGN-NE", region_type: "rural", total_accounts: 13200, kyc_pending: 1980, pendency_pct: 15.0 },
];
const STAFF_PLAN = {
  1: [["CHIEF_MANAGER", "BRANCH_MANAGER", "RTL", 1], ["MANAGER", "COMPLIANCE_OFFICER", "COMP", 1], ["ASSISTANT_MANAGER", "BANK_STAFF", "RTL", 2], ["IT_OFFICER", "IT_ENGINEER", "IT", 1], ["CLERK", "BANK_STAFF", "OPS", 4]],
  2: [["SENIOR_MANAGER", "BRANCH_MANAGER", "RTL", 1], ["ASSISTANT_MANAGER", "COMPLIANCE_OFFICER", "COMP", 1], ["ASSISTANT_MANAGER", "BANK_STAFF", "OPS", 1], ["CLERK", "BANK_STAFF", "OPS", 3]],
  3: [["MANAGER", "BRANCH_MANAGER", "RTL", 1], ["ASSISTANT_MANAGER", "COMPLIANCE_OFFICER", "COMP", 1], ["CLERK", "BANK_STAFF", "OPS", 2]],
};
const FIRST_NAMES = ["Aarav", "Ananya", "Vikram", "Meera", "Rohan", "Priya", "Sanjay", "Nisha", "Arjun", "Kavya", "Rahul", "Sneha", "Aditya", "Pooja", "Karthik", "Divya", "Manish", "Neha", "Suresh", "Lakshmi", "Ramesh", "Suma", "Vasanth", "Anitha", "Mahesh", "Sunita", "Ravi", "Aman", "Geeta", "Deepak", "Sai", "Manoj", "Ishita", "Farah", "Irfan", "Jaya", "Harish", "Leela", "Maya", "Uday"];
const LAST_NAMES = ["Menon", "Rao", "Iyer", "Krishnan", "Sharma", "Nair", "Kulkarni", "Das", "Bhat", "Hegde", "Verma", "Patil", "Joshi", "Shah", "Reddy", "Gupta", "Singh", "Kumar", "Gowda", "Tiwari", "Devi", "Deshmukh", "Banerjee", "Khan", "Ali", "Prakash", "Shetty", "Thomas", "Dutta", "Mehta"];
const SAMPLE_LOGINS = [["SUPER_ADMIN", "cto.admin"], ["EXECUTIVE", "md.ceo"], ["CHIEF_COMPLIANCE_OFFICER", "compliance.head"], ["AUDITOR", "audit.head"], ["REGIONAL_MANAGER", "south.rm"], ["BRANCH_MANAGER", "hubli.bm"], ["COMPLIANCE_OFFICER", "hubli.co"], ["IT_ENGINEER", "ho.it"], ["BANK_STAFF", "hubli.staff"]];

function bankNowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); }
function sha256(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex"); }
function makeId(prefix, value) { return `${prefix}_${sha256(value).slice(0, 12)}`; }
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) { const iter = 120000; return `pbkdf2$${iter}$${salt}$${crypto.pbkdf2Sync(password, salt, iter, 32, "sha256").toString("hex")}`; }
function verifyPassword(password, stored) { const [kind, iter, salt, expected] = String(stored || "").split("$"); if (kind !== "pbkdf2") return false; const got = crypto.pbkdf2Sync(password, salt, Number(iter), 32, "sha256").toString("hex"); return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(got, "hex")); }
function b64(input) { return Buffer.from(input).toString("base64url"); }
function signAccessToken(userId) { const h = b64(JSON.stringify({ alg: "HS256", typ: "JWT" })); const p = b64(JSON.stringify({ sub: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS })); const body = `${h}.${p}`; const s = crypto.createHmac("sha256", SIGNING_KEY).update(body).digest("base64url"); return `${body}.${s}`; }
function verifyAccessToken(token) { const parts = String(token || "").split("."); if (parts.length !== 3) return null; const body = `${parts[0]}.${parts[1]}`; const sig = crypto.createHmac("sha256", SIGNING_KEY).update(body).digest("base64url"); if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(sig))) return null; const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); return payload.exp < Math.floor(Date.now() / 1000) ? null : payload; }
function ensureColumn(db, table, column, definition) { const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name); if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); }
function ensureBankSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS regions (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL, headquarters_city TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS designations (id TEXT PRIMARY KEY, title TEXT NOT NULL, scale TEXT NOT NULL, rank INTEGER NOT NULL, cadre TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT NOT NULL, scope TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, PRIMARY KEY (role_id, permission_id));
    CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, emp_code TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT NOT NULL, gender TEXT, date_of_joining TEXT, status TEXT NOT NULL, designation_id TEXT NOT NULL REFERENCES designations(id), department_id TEXT NOT NULL REFERENCES departments(id), branch_id TEXT NOT NULL REFERENCES branches(id), manager_id TEXT REFERENCES employees(id), functional_manager_id TEXT REFERENCES employees(id));
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, is_active INTEGER NOT NULL, employee_id TEXT UNIQUE REFERENCES employees(id), last_login_at TEXT, failed_login_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS user_roles (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, PRIMARY KEY (user_id, role_id));
    CREATE TABLE IF NOT EXISTS refresh_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, user_agent TEXT, ip_address TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS login_logs (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), username_attempted TEXT NOT NULL, success INTEGER NOT NULL, failure_reason TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, summary TEXT, old_values_json TEXT, new_values_json TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bank_audits (id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, title TEXT NOT NULL, audit_type TEXT NOT NULL, branch_id TEXT NOT NULL REFERENCES branches(id), auditor_id TEXT REFERENCES employees(id), status TEXT NOT NULL, period_start TEXT, period_end TEXT, score INTEGER, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_findings (id TEXT PRIMARY KEY, audit_id TEXT NOT NULL REFERENCES bank_audits(id) ON DELETE CASCADE, severity TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, remediation TEXT, created_at TEXT NOT NULL);
  `);
  ensureColumn(db, "branches", "ifsc", "TEXT"); ensureColumn(db, "branches", "branch_code", "TEXT"); ensureColumn(db, "branches", "city", "TEXT"); ensureColumn(db, "branches", "tier", "INTEGER DEFAULT 2"); ensureColumn(db, "branches", "is_head_office", "INTEGER DEFAULT 0"); ensureColumn(db, "branches", "region_id", "TEXT");
}

function clearBankSeed(db) {
  db.exec(`
    DELETE FROM validation_results; DELETE FROM branch_tasks; DELETE FROM assignments; DELETE FROM drafts; DELETE FROM maps; DELETE FROM interpretations; DELETE FROM circulars;
    DELETE FROM audit_findings; DELETE FROM bank_audits; DELETE FROM audit_logs; DELETE FROM login_logs; DELETE FROM refresh_tokens; DELETE FROM user_roles; DELETE FROM users; DELETE FROM employees; DELETE FROM role_permissions; DELETE FROM roles; DELETE FROM permissions; DELETE FROM designations; DELETE FROM departments; DELETE FROM regions; DELETE FROM branches;
  `);
}

function makeName(index) { return `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[(index * 7) % LAST_NAMES.length]}`; }
function usernameFromName(name, used) { const base = name.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/).slice(0, 2).join(".") || "user"; let u = base, n = 2; while (used.has(u)) u = `${base}${n++}`; used.add(u); return u; }

function seedBank(db, force = false) {
  ensureBankSchema(db);
  const existingEmployees = db.prepare("SELECT COUNT(*) AS n FROM employees").get().n;
  const existingBranches = db.prepare("SELECT COUNT(*) AS n FROM branches").get().n;
  if (!force && existingEmployees === 107 && existingBranches === 15) return;
  clearBankSeed(db);

  const insRegion = db.prepare("INSERT INTO regions (id, name, code, headquarters_city) VALUES (?, ?, ?, ?)"); REGIONS.forEach(([id, name, hq]) => insRegion.run(id, name, id, hq));
  const insDept = db.prepare("INSERT INTO departments (id, name, code) VALUES (?, ?, ?)"); DEPARTMENTS.forEach(([id, name]) => insDept.run(id, name, id));
  const insDesig = db.prepare("INSERT INTO designations (id, title, scale, rank, cadre) VALUES (?, ?, ?, ?, ?)"); Object.entries(DESIGNATIONS).forEach(([id, d]) => insDesig.run(id, ...d));
  const insPerm = db.prepare("INSERT INTO permissions (id, code, description, category) VALUES (?, ?, ?, ?)"); Object.entries(PERMISSIONS).forEach(([code, p]) => insPerm.run(makeId("perm", code), code, ...p));
  const insRole = db.prepare("INSERT INTO roles (id, name, description, scope) VALUES (?, ?, ?, ?)"); Object.entries(ROLES).forEach(([name, r]) => insRole.run(makeId("role", name), name, ...r));
  const insRP = db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)"); Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => perms.forEach((p) => insRP.run(makeId("role", role), makeId("perm", p))));
  const insBranch = db.prepare("INSERT INTO branches (id, name, state, language, language_label, region_type, total_accounts, kyc_pending, pendency_pct, ifsc, branch_code, city, tier, is_head_office, region_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  BRANCHES.forEach((b) => insBranch.run(b.id, b.name, b.state, b.language, b.language_label, b.region_type, b.total_accounts, b.kyc_pending, b.pendency_pct, b.ifsc, b.branch_code, b.city, b.tier, b.is_head_office, b.region_id));

  const used = new Set();
  const pwHash = hashPassword(SEED_LOGIN_VALUE, "bvb-demo-fixed-salt");
  let empNo = 100000, nameNo = 0;
  const regionManagers = {}, regionalCompliance = {}, auditorIds = [];
  function addEmp({ id, name, designation, department, branch, role, username, managerId = null, functionalManagerId = null }) {
    const empId = id || `EMP${empNo + 1}`; empNo += 1;
    const fullName = name || makeName(nameNo++);
    const uname = username || usernameFromName(fullName, used); used.add(uname);
    const email = `${uname}@bvb.example`;
    db.prepare("INSERT INTO employees (id, emp_code, full_name, email, phone, gender, date_of_joining, status, designation_id, department_id, branch_id, manager_id, functional_manager_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(empId, `BVB${empNo}`, fullName, email, `+9198${String(empNo).slice(-8)}`, nameNo % 2 ? "Female" : "Male", `202${nameNo % 6}-0${(nameNo % 9) + 1}-15T00:00:00Z`, "ACTIVE", designation, department, branch, managerId, functionalManagerId);
    const userId = `USR_${empId}`;
    db.prepare("INSERT INTO users (id, username, email, password_hash, is_active, employee_id, last_login_at, failed_login_attempts, locked_until, created_at) VALUES (?, ?, ?, ?, 1, ?, NULL, 0, NULL, ?)").run(userId, uname, email, pwHash, empId, bankNowIso());
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").run(userId, makeId("role", role));
    return { employeeId: empId, userId, username: uname };
  }

  const md = addEmp({ id: "EMP_MD", name: "Aarav Menon", designation: "MD_CEO", department: "EXEC", branch: "BR001", role: "EXECUTIVE", username: "md.ceo" });
  const cco = addEmp({ id: "EMP_CCO", name: "Ananya Rao", designation: "AGM", department: "COMP", branch: "BR001", role: "CHIEF_COMPLIANCE_OFFICER", username: "compliance.head", managerId: md.employeeId });
  const cto = addEmp({ id: "EMP_CTO", name: "Meera Krishnan", designation: "GM", department: "IT", branch: "BR001", role: "SUPER_ADMIN", username: "cto.admin", managerId: md.employeeId });
  addEmp({ id: "EMP_GM_COMP", name: "Vikram Iyer", designation: "GM", department: "COMP", branch: "BR001", role: "COMPLIANCE_MANAGER", username: "compliance.manager", managerId: cco.employeeId });
  const auditHead = addEmp({ id: "EMP_AUDIT_HEAD", name: "Rohan Sharma", designation: "DGM", department: "AUDIT", branch: "BR001", role: "AUDITOR", username: "audit.head", managerId: md.employeeId }); auditorIds.push(auditHead.employeeId);
  for (let i = 0; i < 2; i++) auditorIds.push(addEmp({ designation: i ? "ASSISTANT_MANAGER" : "MANAGER", department: "AUDIT", branch: "BR001", role: "AUDITOR", managerId: auditHead.employeeId }).employeeId);
  addEmp({ designation: "IT_OFFICER", department: "IT", branch: "BR001", role: "IT_ENGINEER", username: "ho.it", managerId: cto.employeeId, functionalManagerId: cto.employeeId });
  addEmp({ designation: "IT_OFFICER", department: "IT", branch: "BR001", role: "IT_ENGINEER", managerId: cto.employeeId, functionalManagerId: cto.employeeId });

  REGIONS.forEach(([regionId]) => { const hq = BRANCHES.find((b) => b.region_id === regionId && b.is_head_office) || BRANCHES.find((b) => b.region_id === regionId); const rm = addEmp({ designation: regionId === "RGN-S" ? "DGM" : "AGM", department: "RTL", branch: hq.id, role: "REGIONAL_MANAGER", username: regionId === "RGN-S" ? "south.rm" : undefined, managerId: md.employeeId }); const rco = addEmp({ designation: "CHIEF_MANAGER", department: "COMP", branch: hq.id, role: "COMPLIANCE_MANAGER", managerId: rm.employeeId, functionalManagerId: cco.employeeId }); regionManagers[regionId] = rm.employeeId; regionalCompliance[regionId] = rco.employeeId; });

  BRANCHES.forEach((branch) => { let bm = null; STAFF_PLAN[branch.tier].forEach(([designation, role, department, count]) => { for (let i = 0; i < count; i++) { const alias = branch.id === "BR002" && role === "BRANCH_MANAGER" ? "hubli.bm" : branch.id === "BR002" && role === "COMPLIANCE_OFFICER" ? "hubli.co" : branch.id === "BR002" && role === "BANK_STAFF" && i === 0 ? "hubli.staff" : undefined; const emp = addEmp({ designation, department, branch: branch.id, role, username: alias, managerId: role === "BRANCH_MANAGER" ? regionManagers[branch.region_id] : bm, functionalManagerId: role === "COMPLIANCE_OFFICER" ? regionalCompliance[branch.region_id] : role === "IT_ENGINEER" ? cto.employeeId : null }); if (role === "BRANCH_MANAGER") bm = emp.employeeId; } }); });

  const insAudit = db.prepare("INSERT INTO bank_audits (id, reference, title, audit_type, branch_id, auditor_id, status, period_start, period_end, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insFinding = db.prepare("INSERT INTO audit_findings (id, audit_id, severity, description, status, remediation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  ["BR002", "BR003", "BR008", "BR013", "BR015", "BR006"].forEach((branchId, i) => { const branch = BRANCHES.find((b) => b.id === branchId); const auditId = `AUD${String(i + 1).padStart(3, "0")}`; const sev = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "MEDIUM", "HIGH"][i]; insAudit.run(auditId, `AUD-2026-${String(i + 1).padStart(4, "0")}`, `${i % 2 ? "Internal" : "KYC/AML"} review - ${branch.name}`, i % 2 ? "Internal Audit" : "KYC/AML Compliance", branchId, auditorIds[i % auditorIds.length], "COMPLETED", "2026-01-01T00:00:00Z", "2026-03-31T00:00:00Z", 68 + i * 5, bankNowIso()); insFinding.run(`FND${String(i + 1).padStart(3, "0")}`, auditId, sev, `Sample ${sev.toLowerCase()} finding for ${branch.name} KYC evidence and branch controls.`, i % 3 === 0 ? "OPEN" : i % 3 === 1 ? "IN_REMEDIATION" : "CLOSED", "Branch manager to upload corrected evidence and compliance officer to verify closure.", bankNowIso()); });
  db.prepare("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, summary, old_values_json, new_values_json, ip_address, user_agent, created_at) VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?)").run("ALOG_SEED", "SEED", "System", "BVB", "Initial Bharat Vikas Bank organisation, RBAC, and audit data seeded", JSON.stringify({ branches: 15, employees: 107, roles: Object.keys(ROLES).length }), bankNowIso());
}
function getUserContext(db, userId) {
  const user = db.prepare(`SELECT u.*, e.full_name, e.emp_code, e.branch_id, b.name AS branch_name, b.region_id, rg.name AS region_name, des.title AS designation, dep.name AS department FROM users u LEFT JOIN employees e ON e.id = u.employee_id LEFT JOIN branches b ON b.id = e.branch_id LEFT JOIN regions rg ON rg.id = b.region_id LEFT JOIN designations des ON des.id = e.designation_id LEFT JOIN departments dep ON dep.id = e.department_id WHERE u.id = ?`).get(userId);
  if (!user || !user.is_active) return null;
  const roles = db.prepare("SELECT r.* FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ? ORDER BY r.name").all(userId);
  const permissions = db.prepare("SELECT DISTINCT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id JOIN user_roles ur ON ur.role_id = rp.role_id WHERE ur.user_id = ?").all(userId).map((r) => r.code);
  const scopes = roles.map((r) => r.scope);
  let scope = "BRANCH", accessible = user.branch_id ? [user.branch_id] : [];
  if (permissions.includes("system.admin") || scopes.includes("GLOBAL")) { scope = "GLOBAL"; accessible = null; }
  else if (scopes.includes("REGION")) { scope = "REGION"; accessible = db.prepare("SELECT id FROM branches WHERE region_id = ? ORDER BY id").all(user.region_id).map((r) => r.id); }
  return { id: user.id, username: user.username, email: user.email, employee_id: user.employee_id, full_name: user.full_name, emp_code: user.emp_code, designation: user.designation, department: user.department, branch_id: user.branch_id, branch_name: user.branch_name, region_id: user.region_id, region_name: user.region_name, roles: roles.map((r) => ({ name: r.name, scope: r.scope, description: r.description })), permissions, scope, accessible_branch_ids: accessible };
}
function getUserFromRequest(db, req) { const auth = req.headers.authorization || ""; const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""; const payload = verifyAccessToken(token); return payload ? getUserContext(db, payload.sub) : null; }
function hasPermission(user, permission) { return Boolean(user && (user.permissions.includes("system.admin") || user.permissions.includes(permission))); }
function requireUser(db, req) { const user = getUserFromRequest(db, req); if (!user) throw Object.assign(new Error("Authentication required"), { status: 401 }); return user; }
function writeLoginLog(db, userId, username, success, reason, req) { db.prepare("INSERT INTO login_logs (id, user_id, username_attempted, success, failure_reason, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(makeId("llog", `${username}:${Date.now()}:${success}`), userId, username, success ? 1 : 0, reason || null, req.socket.remoteAddress || null, req.headers["user-agent"] || null, bankNowIso()); }
function writeActionLog(db, userId, action, entityType, entityId, summary, newValues, req) { db.prepare("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, summary, old_values_json, new_values_json, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)").run(makeId("alog", `${action}:${entityType}:${entityId}:${Date.now()}`), userId || null, action, entityType, entityId || null, summary, newValues ? JSON.stringify(newValues) : null, req.socket.remoteAddress || null, req.headers["user-agent"] || null, bankNowIso()); }

function issueSession(db, user, req, usernameAttempted = user.username, summary = "User logged in") {
  db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?").run(bankNowIso(), user.id);
  writeLoginLog(db, user.id, usernameAttempted, true, null, req);
  writeActionLog(db, user.id, "LOGIN", "User", user.id, summary, { username: user.username }, req);
  const refreshToken = crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, user_agent, ip_address, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)").run(makeId("rtok", refreshToken), user.id, sha256(refreshToken), new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(), req.headers["user-agent"] || null, req.socket.remoteAddress || null, bankNowIso());
  return { access_token: signAccessToken(user.id), refresh_token: refreshToken, token_type: "bearer", user: getUserContext(db, user.id) };
}
function login(db, payload, req) {
  const username = String(payload.username || payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const user = db.prepare("SELECT * FROM users WHERE lower(username) = ? OR lower(email) = ?").get(username, username);
  if (!user) { writeLoginLog(db, null, username, false, "unknown_user", req); throw Object.assign(new Error("Invalid username or password"), { status: 401 }); }
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) { writeLoginLog(db, user.id, username, false, "locked", req); throw Object.assign(new Error("Account temporarily locked"), { status: 423 }); }
  if (!verifyPassword(password, user.password_hash)) { const attempts = Number(user.failed_login_attempts || 0) + 1; const lockedUntil = attempts >= LOGIN_LOCK_THRESHOLD ? new Date(Date.now() + LOGIN_LOCK_SECONDS * 1000).toISOString() : null; db.prepare("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?").run(attempts, lockedUntil, user.id); writeLoginLog(db, user.id, username, false, "bad_password", req); throw Object.assign(new Error("Invalid username or password"), { status: 401 }); }
  return issueSession(db, user, req, username);
}
function guestLogin(db, req) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get("hubli.staff");
  if (!user) throw Object.assign(new Error("Guest account is not available"), { status: 503 });
  return issueSession(db, user, req, "guest", "Guest session started");
}
function signup(db, payload, req) {
  const username = String(payload.username || "").trim().toLowerCase();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const fullName = String(payload.full_name || payload.fullName || "").trim();
  if (!/^[a-z0-9._-]{4,32}$/.test(username)) throw Object.assign(new Error("Use a 4-32 character username with letters, numbers, dot, underscore, or hyphen"), { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) throw Object.assign(new Error("Enter a valid email address"), { status: 400 });
  if (password.length < 8) throw Object.assign(new Error("Password must be at least 8 characters"), { status: 400 });
  if (fullName.length < 3) throw Object.assign(new Error("Enter your full name"), { status: 400 });
  const existing = db.prepare("SELECT id FROM users WHERE lower(username) = ? OR lower(email) = ?").get(username, email);
  if (existing) throw Object.assign(new Error("An account with that username or email already exists"), { status: 409 });
  const suffix = sha256(`${username}:${email}:${Date.now()}`).slice(0, 8).toUpperCase();
  const empId = `EMP_SIGNUP_${suffix}`;
  const userId = `USR_${empId}`;
  db.prepare("INSERT INTO employees (id, emp_code, full_name, email, phone, gender, date_of_joining, status, designation_id, department_id, branch_id, manager_id, functional_manager_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(empId, `BVB${suffix}`, fullName, email, "+910000000000", null, bankNowIso(), "ACTIVE", "CLERK", "OPS", "BR001", null, null);
  db.prepare("INSERT INTO users (id, username, email, password_hash, is_active, employee_id, last_login_at, failed_login_attempts, locked_until, created_at) VALUES (?, ?, ?, ?, 1, ?, NULL, 0, NULL, ?)")
    .run(userId, username, email, hashPassword(password), empId, bankNowIso());
  db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").run(userId, makeId("role", "BANK_STAFF"));
  writeActionLog(db, userId, "SIGNUP", "User", userId, "New demo user created", { username, email }, req);
  return login(db, { username, password }, req);
}
function refresh(db, payload, req) { const token = String(payload.refresh_token || ""); const row = db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0").get(sha256(token)); if (!row || new Date(row.expires_at).getTime() < Date.now()) throw Object.assign(new Error("Invalid refresh token"), { status: 401 }); db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?").run(row.id); const next = crypto.randomBytes(32).toString("base64url"); db.prepare("INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, user_agent, ip_address, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)").run(makeId("rtok", next), row.user_id, sha256(next), new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(), req.headers["user-agent"] || null, req.socket.remoteAddress || null, bankNowIso()); return { access_token: signAccessToken(row.user_id), refresh_token: next, token_type: "bearer", user: getUserContext(db, row.user_id) }; }
function logout(db, payload, req) { const token = String(payload.refresh_token || ""); if (token) db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?").run(sha256(token)); const user = getUserFromRequest(db, req); if (user) writeActionLog(db, user.id, "LOGOUT", "User", user.id, "User logged out", null, req); return { ok: true }; }

function branchFilter(user, alias = "e") { if (!user || user.accessible_branch_ids === null) return { clause: "", params: [] }; if (!user.accessible_branch_ids.length) return { clause: " AND 1=0", params: [] }; return { clause: ` AND ${alias}.branch_id IN (${user.accessible_branch_ids.map(() => "?").join(",")})`, params: user.accessible_branch_ids }; }
function getBankOverview(db) { const counts = { regions: db.prepare("SELECT COUNT(*) AS n FROM regions").get().n, branches: db.prepare("SELECT COUNT(*) AS n FROM branches").get().n, employees: db.prepare("SELECT COUNT(*) AS n FROM employees").get().n, users: db.prepare("SELECT COUNT(*) AS n FROM users").get().n, roles: db.prepare("SELECT COUNT(*) AS n FROM roles").get().n, permissions: db.prepare("SELECT COUNT(*) AS n FROM permissions").get().n, bank_audits: db.prepare("SELECT COUNT(*) AS n FROM bank_audits").get().n, open_findings: db.prepare("SELECT COUNT(*) AS n FROM audit_findings WHERE status != 'CLOSED'").get().n }; const by_role = db.prepare("SELECT r.name, COUNT(ur.user_id) AS users FROM roles r LEFT JOIN user_roles ur ON ur.role_id = r.id GROUP BY r.id ORDER BY r.name").all(); const branches = db.prepare("SELECT b.*, rg.name AS region_name FROM branches b LEFT JOIN regions rg ON rg.id = b.region_id ORDER BY b.branch_code").all(); return { counts, by_role, branches, sample_logins: SAMPLE_LOGINS.map(([role, username]) => ({ role, username })) }; }
function getOrgTree(db) { const employees = db.prepare("SELECT e.id, e.emp_code, e.full_name, e.manager_id, e.functional_manager_id, des.title AS designation, dep.name AS department, b.name AS branch, b.region_id FROM employees e JOIN designations des ON des.id = e.designation_id JOIN departments dep ON dep.id = e.department_id JOIN branches b ON b.id = e.branch_id ORDER BY des.rank DESC, e.emp_code").all(); const direct_reports = {}; employees.forEach((e) => { const k = e.manager_id || "ROOT"; direct_reports[k] = direct_reports[k] || []; direct_reports[k].push(e.id); }); return { employees, direct_reports, roots: direct_reports.ROOT || [] }; }
function getEmployees(db, user) { const f = branchFilter(user, "e"); return db.prepare(`SELECT e.id, e.emp_code, e.full_name, e.email, e.phone, e.status, des.title AS designation, des.scale, dep.name AS department, b.id AS branch_id, b.name AS branch_name, b.region_id, m.full_name AS manager_name, fm.full_name AS functional_manager_name, GROUP_CONCAT(r.name) AS roles FROM employees e JOIN designations des ON des.id = e.designation_id JOIN departments dep ON dep.id = e.department_id JOIN branches b ON b.id = e.branch_id LEFT JOIN employees m ON m.id = e.manager_id LEFT JOIN employees fm ON fm.id = e.functional_manager_id LEFT JOIN users u ON u.employee_id = e.id LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id WHERE 1=1 ${f.clause} GROUP BY e.id ORDER BY b.branch_code, des.rank DESC, e.emp_code`).all(...f.params); }
function getBankAudits(db, user) { const where = user.accessible_branch_ids === null ? "" : `WHERE ba.branch_id IN (${user.accessible_branch_ids.map(() => "?").join(",") || "''"})`; const params = user.accessible_branch_ids === null ? [] : user.accessible_branch_ids; const audits = db.prepare(`SELECT ba.*, b.name AS branch_name, e.full_name AS auditor_name FROM bank_audits ba JOIN branches b ON b.id = ba.branch_id LEFT JOIN employees e ON e.id = ba.auditor_id ${where} ORDER BY ba.reference`).all(...params); const findings = db.prepare("SELECT * FROM audit_findings ORDER BY severity DESC, created_at DESC").all(); return audits.map((a) => ({ ...a, findings: findings.filter((f) => f.audit_id === a.id) })); }
function getRoles(db) { return db.prepare("SELECT r.*, GROUP_CONCAT(p.code) AS permissions FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id LEFT JOIN permissions p ON p.id = rp.permission_id GROUP BY r.id ORDER BY r.name").all().map((r) => ({ ...r, permissions: r.permissions ? r.permissions.split(",") : [] })); }
function getLogs(db, table) { const safe = table === "login_logs" ? "login_logs" : "audit_logs"; return db.prepare(`SELECT * FROM ${safe} ORDER BY created_at DESC LIMIT 100`).all(); }

async function handleBankRoute(db, req, url, parseBody) {
  const p = url.pathname;
  if (req.method === "POST" && p === "/auth/login") return login(db, await parseBody(req), req);
  if (req.method === "POST" && p === "/auth/guest") return guestLogin(db, req);
  if (req.method === "POST" && p === "/auth/signup") return signup(db, await parseBody(req), req);
  if (req.method === "POST" && p === "/auth/refresh") return refresh(db, await parseBody(req), req);
  if (req.method === "POST" && p === "/auth/logout") return logout(db, await parseBody(req), req);
  if (req.method === "GET" && p === "/auth/me") return requireUser(db, req);
  if (req.method === "GET" && p === "/auth/scope-demo") { const u = requireUser(db, req); return { username: u.username, scope: u.scope, accessible_branch_ids: u.accessible_branch_ids, roles: u.roles, permissions: u.permissions }; }
  if (req.method === "GET" && p === "/api/bank/overview") return getBankOverview(db);
  if (req.method === "GET" && p === "/api/bank/org") return getOrgTree(db);
  if (req.method === "GET" && p === "/api/bank/employees") return getEmployees(db, requireUser(db, req));
  if (req.method === "GET" && p === "/api/bank/audits") return getBankAudits(db, requireUser(db, req));
  if (req.method === "GET" && p === "/api/bank/login-logs") { const u = requireUser(db, req); if (!hasPermission(u, "loginlog.view")) throw Object.assign(new Error("Missing permission loginlog.view"), { status: 403 }); return getLogs(db, "login_logs"); }
  if (req.method === "GET" && p === "/api/bank/audit-logs") { const u = requireUser(db, req); if (!hasPermission(u, "auditlog.view")) throw Object.assign(new Error("Missing permission auditlog.view"), { status: 403 }); return getLogs(db, "audit_logs"); }
  if (req.method === "GET" && p === "/api/rbac/roles") return getRoles(db);
  return null;
}
function getBankState(db) { return getBankOverview(db); }
module.exports = { BRANCHES, ensureBankSchema, seedBank, handleBankRoute, getBankState, getUserFromRequest, hasPermission, writeActionLog };
