# Settings priority one, 2 November 2026

Implemented in the existing React/.NET pilot. Changes are local, uncommitted and undeployed.

## Delivered behavior

- Personal: per-principal API persistence for language, theme, accessible default warehouse, start page and 10/25/50 catalogue rows. Applies on session restoration/sign-in. Stock, Item Master and document catalogues use the default row count. Saving default warehouse/start page does not interrupt the current workspace.
- Warehouse: stable name/ID, address, display timezone and actual registered locations. Admin can save address/timezone with a reason; admin/supervisor can add a pickable storage location through the existing location API. Operational location roles remain Receiving/QC/Staging; transit stays per transfer. Timezone currently affects the workspace's last-loaded display only, as the field explains. It does not change stored transaction timestamps or ledger date filters.
- Rules: displays enforced PO remainder limit, six-decimal technical quantity precision and mandatory reasons for exceptions. These remain read-only. D02 remains open; partial reservation/shipment remains a Development-only admin simulation switch.
- Approvals: admin configures order review and stock-count adjustment review per warehouse, choosing supervisor/admin or admin-only. Inventory Core enforces the choice; UI disables restricted review buttons. Creator/counter self-review checks, separate release/unfreeze, blind counts and inventory authority remain intact.
- Shared configuration uses versioned SupportingRecords and before/after audit with actor, warehouse, reason and version. Preferences are private records outside warehouse snapshots. No schema migration or dependency added.
- Settings drafts are not replaced by background snapshots. Stale saves receive 409 and require explicit reload; reload explains that settings drafts will be replaced. Settings writes are online API operations, separate from inventory pending transactions.

## Verification performed

- API build: succeeded with 0 warnings/errors using single-node build and shared compilation disabled.
- Scoped Settings HTTP integration tests: 4 passed, 0 failed, PostgreSQL 18 in a new isolated project-local cluster on port 55434. Report: `backend/Wms.Tests/TestResults/settings.trx`.
- Tests cover private preference persistence, accessible default warehouse validation, revoked-default fallback, invalid route values, stale writes, warehouse configuration permissions and scope, timezone persistence, audit, invalid timezone, reviewer-role validation, admin-only command enforcement and count self-review rejection.
- Frontend production build succeeded; existing SignalR annotation and bundle-size warnings remain. Final frontend typecheck passed after the small feedback/copy refinements.
- Native browser UI at isolated preview `http://127.0.0.1:4174/` with copied API on port 5082, seeded solely with simulation data in the temporary cluster. Existing preview was left running.

### Browser actions and results

| Action | Observed result |
|---|---|
| Sign in with the local demo admin | Session opens workspace selection. |
| Open Settings and each section | Personal, warehouse/locations, transaction rules and approvals render. |
| Save 25 catalogue rows | API GET returns 25 and incremented preference version. |
| Save Bahasa Indonesia, dark theme and Stock start page | UI changes language/theme. Subsequent browser document reload restores preferences and opens Stock; Stock page-size selector shows 25. |
| Save QA-labelled address and Asia/Makassar | API GET returns the saved address/timezone/version; workspace footer displays WITA. |
| Add QA-SETTINGS storage location | Location appears in settings API and visible location table. |
| Save admin-only order/count review | Reopening approvals after document reload retains both admin-only selections. |
| Simulate another admin saving, then submit old open draft | Server responds 409; visible conflict explanation and reload action appear; Save is disabled; existing draft remains visible. |
| Render English/light desktop | Full-page screenshot visually inspected inline. |
| Render Bahasa Indonesia/dark mobile, 390 x 844 | Approval screenshot visually inspected inline. All four sections measured document width 390 with viewport width 390, without page overflow. |
| Inspect browser console before intentional conflict | No error/warning messages. Intentional stale-save 409 was exercised afterward. |

Screenshots were inspected inline. Saving screenshots via Chrome's configured filesystem roots was denied, so no screenshot file is claimed here. The browser later reconnected before the planned additional operator/keyboard UI checks; operator write restrictions were verified by the HTTP tests, and native controls were inspected in source. Full keyboard traversal, full cross-browser checks, physical devices, client SSO, production deployment and UAT were not performed.

## Execution limits

The existing development database required crash recovery. A sandboxed cluster attempt could not initialize normally; the completed validation used a separate local cluster outside the sandbox. The first normal test build encountered a running worker assembly lock, and skipping reference builds exposed stale worker assemblies. The successful test run used `.runtime/settings-build` artifacts, leaving running services untouched.

No business decision D01-D05 or hardware decision T01-T08 is closed by these settings. Date/number-format preferences, editable receiving tolerances, location-role remapping and automatic approval thresholds were not added in this first stage.
