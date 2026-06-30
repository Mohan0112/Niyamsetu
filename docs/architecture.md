# Architecture

NiyamSetu is built around a simple offline demo spine:

```text
Regulatory circular
  -> six-agent pipeline
  -> MAPs
  -> draft artifacts
  -> department routing
  -> branch dispatch
  -> mock CBS validation
  -> tamper-evident audit chain
```

## Runtime

- `backend/server.js`: local HTTP server, APIs, static file serving.
- `node:sqlite`: local SQLite database at `data/niyamsetu.db`.
- `frontend/`: static operator console and branch PWA.
- `scripts/offline_check.js`: end-to-end smoke check.

No runtime dependency installation is required.

## Data Model

- `circulars`: source circular and classification.
- `interpretations`: clause-level scope, applicability, dates, exceptions.
- `maps`: SMART Measurable Action Points.
- `drafts`: policy paragraphs, SOPs, notices, system specs, certificates.
- `assignments`: department owner, role, collaborators, ticket reference.
- `branches`: synthetic BVB branch network.
- `branch_tasks`: localized branch checklist items and evidence state.
- `validation_results`: Pramanik verdicts.
- `audit_events`: append-only audit events chained by hash.

## Agent Pipeline

- `Prahari`: classifies the circular by regulator, domain, urgency, and affected entity.
- `Vyakhya`: extracts structured clause interpretations.
- `Vibhajan`: creates SMART MAPs with confidence scores.
- `Lekhak`: drafts artifacts for the human approval gate.
- `Niyojak`: routes MAPs through department capability ownership and dispatches branch tasks.
- `Pramanik`: validates against mock CBS scenarios and evidence.

## Offline Choices

The build plan calls for Ollama, RAG, graph DB, and IndicTrans2. This first application keeps those as replaceable seams and ships deterministic local implementations so the golden path is reliable on any CPU-only demo machine.

Production or later prototype swaps:

- Deterministic classifier -> Ollama-backed classifier with JSON schema guard.
- Static interpretation -> RAG + local LLM interpretation.
- In-console graph -> Neo4j or NetworkX-backed Niyam-Jaal.
- Curated branch strings -> IndicTrans2 translation cache.
