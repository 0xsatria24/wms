# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Inventory/WMS project choices, 30 October 2026

- Implement Clear Operations from `../design-system/redesign-2026-10-29-v2/complete-suite/`. Auth uses board05; stock uses the revised individual Stock position image. Older Ledger HTML was intentionally removed.
- Stack selected by the user: ASP.NET Core 10, EF Core/Npgsql 10, PostgreSQL 18, React/TypeScript/Vite, modular monolith, database outbox and .NET worker, OIDC, IndexedDB pending capture, Linux Docker Compose. RFID SDK selection remains open.
- Inventory commands go through the .NET API. Client captures, RFID observations, pending requests and scan totals never authorize stock changes.
- English is the default. Indonesian uses “Dipesan” for Reserved for orders. Product codes, document numbers and warehouse master names stay unchanged.
- This full stack needs API, worker and PostgreSQL hosting. A static frontend-only Sites deployment would not host the backend.
- Admin access management must include Add user and Delete user actions. New users follow pending verification/approval; deletion revokes access while preserving transaction/audit identity. The language option must read "Bahasa Indonesia", without "(santai)".
