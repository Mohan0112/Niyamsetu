# NiyamSetu

Offline-first, end-to-end prototype for SuRaksha PS2: Agentic Regulatory Intelligence & Compliance for Indian banks.

NiyamSetu takes a regulatory circular from intake to proof of compliance:

1. Classifies the circular.
2. Extracts clause-level interpretation.
3. Converts obligations into SMART Measurable Action Points.
4. Drafts policy, system, customer, and training artifacts.
5. Routes ownership through Niyam-Jaal.
6. Pushes branch checklists to the branch execution view.
7. Validates completion against a mock Core Banking System.
8. Writes a tamper-evident audit chain.

The runnable build is intentionally lightweight: a Node backend, static frontend, and local SQLite database. No CDN or external model call is required for the default demo path.

## Run Locally

Requires Node.js 24+ because the backend uses Node's built-in `node:sqlite`.

```powershell
npm start
```

Then open:

```text
http://127.0.0.1:8765
```

PowerShell alternative:

```powershell
.\scripts\start.ps1
```

## Run With Docker

```powershell
npm run docker:build
npm run docker:run
```

Then open:

```text
http://127.0.0.1:8765
```

Docker keeps the SQLite database in the named volume `niyamsetu_data`.

## Render Deployment

This repo includes:

- `render.yaml` for Render Blueprint deployment with the native Node runtime.
- `Dockerfile` and `docker-compose.yml` for local Docker or alternate cloud deployment.
- `.env.example` for local environment variable names only.
- `docs/deployment_render.md` for the full deployment checklist.


Render injects `PORT`; the app reads it automatically and binds to `0.0.0.0` in cloud deployments.

## Smoke Test

```powershell
npm run offline-check
```

The check starts a local server with generated per-run secrets and verifies:

- 15 bank branches
- 107 employees
- 6 MAPs
- 45 branch dispatches
- Partial / Validated / Not Validated CBS scenarios
- valid audit hash chain

## Demo Flow

1. Open the console.
2. Use Guest Access or create a demo account.
3. Click `Execute Pipeline`.
4. Review generated MAPs and draft artifacts.
5. Open `Branch PWA`, choose a branch, and upload evidence.
6. Switch CBS scenario and run `Pramanik`.
7. Open `Audit Trail` and export the chain.

## What Is Implemented

- Node backend with SQLite persistence.
- Static frontend served by the backend.
- Deterministic six-agent golden-path pipeline.
- Human gates for MAP/draft approval.
- Branch PWA with readable branch checklist text.
- Mock CBS scenarios: `validated`, `partial`, `not_validated`.
- Tamper-evident audit chain using `prev_hash` and `hash`.
- Niyam-Jaal impact graph rendered in-console.
- Synthetic Bharat Vikas Bank system with 15 branches, 107 employees, roles, scoped access, login logs, action logs, bank audits, and findings.

## Database Choice

Current runnable build uses SQLite through Node 24's built-in `node:sqlite`, with a normalized schema. For Render, the SQLite file is stored on a persistent disk at `NIYAMSETU_DATA_DIR=/var/data/niyamsetu`.

For a heavier deployment, move the same schema to PostgreSQL. For this hackathon preview, SQLite plus a Render disk is the fastest stable path.