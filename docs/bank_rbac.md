# Bank, Database, and Access Control

NiyamSetu includes a synthetic Bharat Vikas Bank (BVB) system for the compliance demo.

## What Was Seeded

- 3 regions: South, West, North & East.
- 15 branches with IFSC-like codes, city/state, language, tier, region, KYC pendency.
- 107 synthetic employees.
- Reporting hierarchy: MD & CEO -> HO leaders -> regional managers -> branch managers -> officers/clerks.
- Functional dotted-line hierarchy for compliance and IT.
- 10 access roles and a permission catalog.
- Users, password hashes, refresh tokens, login logs, audit logs.
- Bank audits and audit findings.

All people are synthetic. No real employee/customer data is used.

## Access Roles

- `SUPER_ADMIN`: global, wildcard `system.admin`.
- `EXECUTIVE`: global read-heavy oversight.
- `CHIEF_COMPLIANCE_OFFICER`: global compliance control.
- `COMPLIANCE_MANAGER`: regional compliance assignment and approval.
- `REGIONAL_MANAGER`: region scoped.
- `BRANCH_MANAGER`: branch scoped.
- `COMPLIANCE_OFFICER`: branch scoped evidence and audit work.
- `AUDITOR`: audit/reporting access.
- `IT_ENGINEER`: user/system support.
- `BANK_STAFF`: frontline branch tasks.

Scope is enforced from the authenticated user's branch/region:

- `GLOBAL`: all branches.
- `REGION`: all branches in the employee's region.
- `BRANCH`: only the employee's branch.

## Auth APIs

- `POST /auth/login`
- `POST /auth/guest`
- `POST /auth/signup`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/scope-demo`

Bank APIs:

- `GET /api/bank/overview`
- `GET /api/bank/org`
- `GET /api/bank/employees` authenticated, scoped
- `GET /api/bank/audits` authenticated, scoped
- `GET /api/bank/login-logs` requires `loginlog.view`
- `GET /api/bank/audit-logs` requires `auditlog.view`
- `GET /api/rbac/roles`

## Database Decision

The runnable project uses SQLite now because Node 24 includes `node:sqlite`; no package install or internet is needed. The schema is normalized so it can be migrated to Postgres later.

Recommended paths:

| Use case | DB | Account/key needed |
|---|---|---|
| Current local demo | SQLite | No |
| Offline finale with heavier DB | Local PostgreSQL in Docker | No |
| Cloud/team dev | Neon or Supabase Postgres | Account + connection string |

Cloud Postgres usually uses a connection string. Do not paste connection strings into the repo. Put them in `.env` when a Postgres adapter is added.

## Seeded Role Accounts


Stable seeded usernames exist for these role accounts:

```text
SUPER_ADMIN
EXECUTIVE
CHIEF_COMPLIANCE_OFFICER
AUDITOR
REGIONAL_MANAGER
BRANCH_MANAGER
COMPLIANCE_OFFICER
IT_ENGINEER
BANK_STAFF
```