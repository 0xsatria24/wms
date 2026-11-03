# Prototype Instructions

- Organization setup, 3 November 2026: user approved a company/warehouse/storage-location form after first administrator login. Keep it in Settings → Company & warehouses, outside the activation/identity/review wizard. Persist company branding in the application. Create new warehouses and initial locations transactionally; preserve names/identities of existing operational warehouses.

- Account flow, 3 November 2026: user approved WMS-managed invitations with Keycloak owning passwords. In OIDC mode, Add user captures name/email/role/warehouses once; verified sign-in activates only the stored, still-authorized invitation. Keep explicit status/check/resend, generic password-recovery responses, and EN/ID copy. Preserve the existing demo path. The low-risk public-enrollment quota finding is explicitly deferred; do not bundle its remediation into this work.

- Admin wizard scope correction, 3 November 2026: only Activation, Administrator/SSO and Review remain (numbered 1–3). Do not show a warehouse/location form or warehouse summary in the wizard. Initial warehouse provisioning belongs to IT configuration; review only the verified administrator and company.

- Admin setup wizard polish, 3 November 2026: the user rejected disorganized text and boxes. Keep a compact step navigation with a visible active step, aligned form/summary labels, restrained introductory copy, and clearly separated primary, back and status-check actions. Use Product Design, antislop during, and Impeccable for this refinement; preserve the approved setup flow and backend contracts.

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
- Stock columns must align headers and values according to the approved table refinement below. Sidebar scrollbars must not be visible, with keyboard/touch access preserved and one navigation group expanded at a time. Items use a searchable/filterable/paginated catalogue with separate detail editing, rather than an unbounded card list. Preserve draft edits when background snapshots refresh.

## Document lists, 1 November 2026

- The user clarified that Item Master is the visual and interaction reference. Convert card-shaped document/task lists (such as Purchase orders) to its catalogue-table format. Do not redesign Item Master as part of this request.
- Purchase orders, inspections, putaway, orders, reservations, picking and shipping use one full-width document catalogue with search, status/item filters, sort and 10/25/50-row pages. Detail forms follow below the catalogue. Selection/opening must not confirm a transaction or change stock.
- On narrow screens keep these document lists as tables with horizontal scrolling confined to a labelled, keyboard-focusable region. Toolbar and pagination reflow. Preserve domain filters, warehouse scope, draft state and permissions.

- Access management: center Role, Warehouse access, Status and Actions headers and values on desktop/tablet. Keep Name and Work email left aligned. Allow status badges to wrap at word boundaries, never in the middle of labels such as Active; keep row action buttons centered under their header.

## Reusable input, 1 November 2026

- The user requested autocomplete across important search/input fields and autofill for related details. Reuse saved master and document values within the current access and warehouse scope. Selecting an item fills its known details in the draft. Actual scans, physical counts, quantities, reasons and confirmations remain explicit operator input.

## Approved table review refinement, 1 November 2026

- The user explicitly resumed the earlier six-point table review and authorized its redesign. Keep the approved catalogue workflows and the centered Access management columns while refining shared table density, typography and selection cues.
- For Stock position, text columns are left aligned and quantities/headers are right aligned with tabular numerals. This supersedes the previous all-centered stock-column choice. Reserved is the compact visual label; its full order-reservation meaning remains accessible and in the explanatory copy.
- The latest user correction requires one spacing system across all tables: 48px standard rows, 44px headers/controls, 12px horizontal cell padding, 2px vertical body-cell padding and 8px control gaps. Use shared CSS tokens and remove per-table spacing overrides. Access row actions sit on one line. Stock column proportions reduce empty Item/Condition space and separate Reserved/Available; semantic column widths and approved alignment can differ, spacing cannot. Use semibold item names, smaller muted SKUs, subtle selected/hover fills, and real photos only in product rows. Optional image management remains available in detail views.
- Stock selection stays at SKU scope. Explicitly show that details cover all locations and use a check marker for selected items. Normal Good/Active status is quiet; quality/hold/frozen exceptions retain their true labels with clearer warning treatment. Never reinterpret Not good as a specific defect type.
- Keep a usable mobile sort control for stock when table headers are visually hidden. Do not add stock columns, fabricate pagination controls or change inventory commands as part of visual refinement.
- Stock spacing correction: balance the visible gaps between item, location, condition and right-aligned quantities, allowing for the different text/number alignments. Keep Condition compact and Unit next to Available; at narrow panel widths, protect status/quantity/unit column widths and let Item fill the remaining space. Keep shared cell/row spacing; use a 12px gap after the table, 8px between footer text blocks and 12px before the simulation notice, with no accumulated notice margins.

- Stock grouping, 2 November 2026: show one parent per warehouse/SKU with independent, initially collapsed inline position tables. Single-position items show their location, physical condition and stock restrictions directly. Keep condition separate from stock status. Filters/search operate on positions before grouping; totals describe matching positions, preserve Available rules and separate units. Paginate parents, report both item/position counts, and keep SKU-level selection separate from expansion. This supersedes the earlier restriction against adding stock columns/pagination for this explicitly requested grouping change.

- Item Master actions, 2 November 2026: the user requested smaller Edit/Delete buttons proportionate to the table. Use compact 32px buttons with 16px icons for pointer input; retain 44px touch targets. This scoped refinement supersedes the shared 44px control height for these row actions only. Deletion confirmation uses Yes/No without a reason field.

- Date/time placement correction, 2 November 2026: put operational dates/times inside the corresponding table rows, including the Stock by item parent rows and expanded position rows. Do not substitute a page-level loaded timestamp or a detached date panel above the table. Use the actual meaning of each timestamp (last posted stock movement, document date, planned date, capture, submission, approval, completion). Keep date/time cells compact and warehouse-zone aware; unknown values stay unknown. A stock item's time covers only its matching positions and must not be inferred from refresh time.

- Queue table correction, 2 November 2026: use stable semantic column widths; never squeeze Source into a character stack or let identifiers inflate row height. Preserve 48px rows, numeric alignment, date/time columns, status labels and contained horizontal scrolling. The full-ID correction below supersedes the earlier ellipsis treatment.

- Full reference correction, 3 November 2026: the user rejected ellipsis/abbreviation and chose real new IDs of 16 characters. New transaction/audit IDs and automatically created warehouse task/document IDs use the complete Base64URL encoding of 12 random bytes (16 characters total, no prefix/padding). Existing IDs and external ERP/business references stay unchanged. Display every ID verbatim; long legacy IDs use contained table scrolling or wrapping in details, never text-overflow ellipsis. Typed infrastructure UUIDs (event/request/identity) retain their contracts and are also displayed in full. Preserve all canonical selection, source, retry, export and search values.

## Multiple selection, 3 November 2026

- The user approved checkboxes and useful bulk actions in Item master, Stock position, Labels, Orders, Users and access, Pending transactions, ERP integration and the RFID simulation.
- Checkbox selection is separate from opening details/expansion. Select-all covers the current page. User, role, warehouse, filter, sort, tab or page changes invalidate selection and open review; language/theme changes retain it.
- Review and validate each action, show per-item outcomes and retain unsuccessful selections. Verify current page membership/eligibility before each dispatch. Preserve versions and original pending IDs; stop on uncertain results or lost authorization.
- Bulk item/access status operations must not overwrite other fields or existing individual warehouse roles/grants. Grantless verified approvals initialize only Operator in the acting warehouse. Unknown-result checks are read-only; explicit retry preserves the original request.
- Physical stock confirmation remains per document. Label output is a downloadable printable sheet; RFID exclusion remains simulation-only.
