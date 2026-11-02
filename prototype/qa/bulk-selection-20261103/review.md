# QA multi-select, 3 November 2026

- PASS: 50/50 frontend Node tests.
- PASS: 91/91 backend tests on isolated PostgreSQL databases.
- PASS: production frontend build and normal .NET solution build.
- PASS: 16 fixture browser scenarios, including conflicts, stale selection, file failure, permissions, original request identity, and all eight screens at 390px in dark Indonesian mode. Native Space and horizontal keyboard scrolling verified.
- PASS: design detector returned []; diff whitespace check clean.
- Local PostgreSQL recovered; API, worker and web were started through scripts/start-local.ps1 -SkipBuild. Health/readiness and web endpoint checks passed.
- Live application verification: see live-results.json. Only selection/deselection was exercised; no operational transaction was submitted. Empty lists are recorded explicitly.

Design: preserve the existing operational palette, typography and shared table tokens. ENERGY 1 / RHYTHM 1 / MOTION 1. Checkbox column identifies bulk selection; a conditional toolbar groups its actions. Detail opening remains separate.

Scope: prototype and isolated test evidence only; no physical scanner/printer test or field UAT. Build retains upstream SignalR annotation and bundle-size warnings.
