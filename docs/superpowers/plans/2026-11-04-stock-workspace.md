# Stock workspace implementation plan

> **For agentic workers:** Use superpowers:executing-plans. The user authorized implementation, delegated routine choices and requested token-efficient native execution with one final independent review.

**Goal:** Implement the approved workflow PRD while preserving the working catalogue, authorization and inventory controls.

**Architecture:** Extend Inventory Core with manual receipt and relocation commands; reuse versioned SupportingRecords for additive receipt headers, scoped drafts and item proposals, and OperationalDocuments for receipt lines/tasks. Provide a scoped workflow query and a stock-side-panel React workspace. Keep legacy routes as entry points and repair audited correctness issues in their owning modules.

**Tech Stack:** Existing .NET 10, EF/Npgsql, PostgreSQL 18, React/TypeScript/Vite; no new package dependency.

**Spec:** `docs/planning/2026-11-04-stock-workspace-prd.md`, `docs/superpowers/specs/2026-11-04-stock-workspace-design.md` and the linked audit.

## Global constraints

- Original checkout and inherited dirty work remain intact; work on codex/stock-workspace.
- No ERP PO fabrication, opening-balance workaround, broad role grants, automatic stock confirmation, deployment or external writes.
- Stock writes preserve scope, original pending identity, optimistic versions, locks, immutable evidence and ledger/outbox atomicity.
- Blind counts never leak through lookup, previews, history, export or capability responses.
- Use true units and six-place wire precision; retain full canonical identifiers.
- Follow incumbent Clear Operations tokens, catalogue spacing, language/theme behavior and selected side-panel design.
- Client business policy still open in PRD remains conservative/configured: no auto partial fulfilment, no reserved/held relocation, no invented lot identity.

## Review focus

- Replayed manual receipt or concurrent duplicate document must post once (Task 1 tests).
- Two same-SKU receipts must retain distinct task lineage (Task 1/4 tests).
- Role, warehouse, stale version or unknown-result transitions must preserve owner and prevent duplicate writes (Tasks 2/4 tests).
- Zero-stock and active blind-count items must keep permitted history without exposing forbidden quantities (Task 3 tests).
- Unknown item creation/proposal and nested panel navigation must retain the receipt draft (Task 4 tests).

## Task 1: Inventory commands and correctness

Files: `backend/Wms.Core/Modules/Inventory/WorkflowCommands.cs`, `CommandProcessor.cs`, `Modules/Outbound/OutboundCommands.cs`, `backend/Wms.Tests/StockWorkspaceTests.cs`.

Interfaces: `manual-receive` consumes a stable document ID, source metadata and lines `{id,sku,scan,qty,unit,version}`; produces header/line records and QC tasks. `relocate` consumes source position/version, destination/locationScan, sku/scan/qty. `reserve-plan` consumes order/version and position/quantity/version entries. Existing CommandResult remains compatible.

- [x] Add failing PostgreSQL tests for atomic multi-line receipt, QC hold/lineage, replay, invalid line rollback, unreserved relocation and 6+4 allocation for an order of 10 with partial=false.
- [x] Run focused tests, implement commands inside the existing transaction/lock pipeline, rerun focused tests.
- [x] Add revise/resubmit and deactivation-dependency tests; fix owning edit/outbound paths without changing reviewer policy.

## Task 2: Scoped workflow persistence and read model

Files: `backend/Wms.Api/Modules/Workflow/WorkflowEndpoints.cs`, workflow service/query files, `Program.cs`, `backend/Wms.Tests/WorkflowWorkspaceTests.cs`.

Interfaces: authenticated `/api/workspaces/{warehouse}/workflow` for paginated items/documents/tasks/history, `/workflow/drafts/{id}` for owner-scoped versioned save/read, and item proposal create/review. Resolve access on every request; read model supplies canonical line/task IDs, versions and eligibility/blockers without blind quantities.

- [x] Test wrong owner/warehouse/viewer, stale draft and item proposal approve/reject/duplicate mapping before implementation.
- [x] Implement additive SupportingRecords persistence, bounded validation, idempotent stable identities and read-only recovery paths.
- [x] Return persistent completed lineage and per-warehouse capabilities; verify tests.

## Task 3: Audited supporting correctness

Files: `SnapshotQuery.cs`, `WorkspaceQuery.cs`, `EditService.cs`, focused reporting/access tests; frontend `controls.tsx`, `management.tsx`, `server-catalogue.ts`, `api.ts`.

Interfaces: ledger totals describe the entire matching filter per unit; history is independent of positive current balance; ERP catalogue exposes all filtered cases through pages; access editor persists exact per-warehouse grants; supporting saves return actual outcomes.

- [x] Add regression tests for ledger pagination totals, zero-stock history, old ERP case and unchanged mixed-role grants.
- [x] Fix server projection/scope and UI consumers together; preserve individual/bulk policy equivalence.
- [x] Await label/follow-up persistence, expose all package details, contextual return-source lookup and safe individual pending recovery.
- [x] Test changed read/persistence paths, plus existing export/access/pending checks.

## Task 4: Stock panel and connected journeys

Files: `prototype/src/StockWorkspace.tsx`, `workflow-model.ts`, `workflow-api.ts`, `App.tsx`, `Stock.tsx`, `Operations.tsx`, `management.tsx`, `styles.css`, `prototype/tests/workflow-model.test.mjs`.

Interfaces: StockWorkspace consumes current actor/warehouse, scoped workflow query, selected canonical entity context and existing queued command dispatch; panel actions never mutate stock locally. Draft persistence and command responses carry task lineage. All new reads are cancellable; commands retain original IDs on uncertainty.

- [x] Test action eligibility, decimal locale parsing, multi-position source selection, unknown-item resolution and dirty context changes before UI code.
- [x] Implement docked desktop panel/full-screen narrow subview, manual/PO receipt, quick-create/propose item, QC/putaway, relocation and connected order stages.
- [x] Integrate stock/master/header entry points, exact task links and legacy route aliases without replacing effective tables.
- [x] Replace misleading empty states, generic units, pretend draft saves and route-leaking notices; retain error/unknown distinction.
- [x] Run frontend tests/typecheck/build and verify real rendered flows, keyboard, both themes and narrow screens.

## Task 5: Integration verification and final review

Files: scope-specific live fixture/check script, `docs/implementation/stock-workspace-verification.md`, plan ledger.

- [x] Run PostgreSQL suite, frontend domain/pending/catalogue/export tests and production build; inspect every result.
- [x] Verify receipt -> QC -> rack, unknown item/proposal, relocation and order -> multi-bin -> picking/shipping on an isolated test database with API authority.
- [x] Run Impeccable detector once after UI is complete; inspect screenshots and antislop delivery gate.
- [x] Obtain one independent whole-change review, fix material issues, repeat only affected checks.
- [x] Record AC01-AC36 coverage and remaining external/UAT limits accurately; leave implementation on the feature branch without pushing or deploying.

## Rulings

- User explicitly delegated choices/approvals: execute without a plan-review pause.
- Native execution chosen for lower context/reviewer overhead; one final independent review remains required.
- SupportingRecords are the existing versioned JSON store, so additive receipt headers/proposals/drafts do not require a destructive schema migration. Child OperationalDocuments retain canonical lineage and stock accounting.
- Old checkout contains concurrent/uncommitted work: copied only current source dependencies and approved specs to an isolated baseline commit; do not remove old edits or auto-merge them.
