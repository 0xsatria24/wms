# Stock spacing correction, 1 November 2026

final result: passed

Scope: the Stock by location panel in the user's latest screenshot. This is component-level visual verification, using the production Stock component and an isolated in-memory fixture. The local API was unavailable; this pass makes no backend or production-readiness claim. Earlier reviews below retain their original scope.

## Source and evidence

- Source: `C:/Users/muham/AppData/Local/Temp/codex-clipboard-72bacfd0-8086-4635-a00e-0589a333bfcd.png`, 922 × 539 pixels. The user requested smaller, more consistent gaps; the source spacing is the defect to correct, while its content, typography, alignment and state remain the reference.
- Implementation: `/qa/stock-spacing-fixture.html`, importing `src/Stock.tsx` and `src/styles.css`. The five labelled simulation rows reproduce the source's visible values, locations, conditions and SKU-A selection. No API/database writes.
- Comparison: `qa/stock-spacing-20261101/comparison.png`, source and updated panel together. Updated crop: `after.png`, 922 × 511 pixels; full rendered page: `final-page.png`. CSS viewport 1340 × 1000, capture density approximately 1.0, panel width 922 CSS px. Equal-width crops are compared without rescaling; the shorter panel is the intended footer-margin correction.
- Focused comparison is the entire readable table panel. It already exposes all headers, rows, badges, selected markers and footer text; an additional magnified crop is unnecessary.
- Other captures: `desktop-sidebar.png` (636px panel), `phone.png` / `phone-dark-id.png` (390 × 844 viewport), `tablet-dark-id.png` (900 × 1000 viewport). `metrics.json`, `contrast.json` and `console.json` hold measured evidence.

## Findings and correction history

1. P2, table column rhythm: the source's short Location column and broad Condition/Reserved span produce uneven visible gaps. An initial fixed-width quantity proposal moved too much unused space into Item and Location and was rejected during screenshot review. The final wide-panel proportions are 26/22/12/11/21/8 percent, accounting for the right-aligned quantities and keeping Unit adjacent to Available. Panels at or below 720px protect status/quantity/unit widths and let Item fill the remainder. The final combined comparison has no remaining actionable P0/P1/P2 spacing finding.
2. P2, footer: independent pagination, notice and parent margins accumulate beneath the table and after the final notice. Replaced them with a grid: measured 12px after the table, 8px between footer text blocks, 12px before the simulation notice and zero notice bottom margin. The matched-width panel is 28px shorter.
3. P2, selected item marker at desktop breakpoints: a 140px ProductName minimum pushed the check away from short names. Removed that override; the existing shared row-select gap now places the check beside the product text. Shared table spacing stays unchanged.

## Required visual surfaces

- Typography: existing local Source Sans 3, semibold names, smaller muted SKU, tabular quantities and header/body alignment preserved. Names, units and warning labels remain readable in the inspected widths and languages.
- Spacing/layout: shared 48px row, 44px header, 12px horizontal and 2px vertical cell-padding tokens preserved. The browser measured uniform 48.67px body rows and 44.33px headers including collapsed borders/display rounding. Footer gaps are measured above. No document-level horizontal overflow in the inspected phone, tablet or desktop states.
- Colors/tokens: existing light/dark semantic roles preserved. Ten checked text/background pairings have a minimum contrast of 5.457:1 (`contrast.json`); this is a scoped check, not full WCAG certification.
- Images/icons: existing Phosphor selection, sorting, warning and information icons preserved. No new product photos or image assets. The adjacent detail view keeps its existing optional-image placeholder.
- Copy/content: source row values and meaning reproduced in the fixture; no production data changes. Existing English and Bahasa Indonesia copy, simulation notice and SKU-scoped selection remain intact.

## Interaction and build evidence

- Enter on Product B updates the details scope to SKU-B; selecting Product A restores SKU-A across its locations.
- Available descending returns 126, 0, 0, 0, 0. Location ascending returns A-01, QC, QC, Staging, Staging. Item sorting remains operable.
- Phone sort dropdown returns the same descending quantities. Unmatched search opens No matching items; Clear filters restores the five rows.
- Filter opens/closes; Not good returns two rows; clearing restores five. Language and theme selectors render the same table in Indonesian/dark mode.
- Phone document client/scroll widths both 375px; tablet widths both 900px. The 636px desktop panel protects Condition 104px, Reserved 80px, Available 88px and Unit 56px without overflow.
- A development hot-update produced a duplicate-createRoot diagnostic in the fixture during editing. A fresh final browser tab reports no console errors (`console.json`).
- `npm run build`: passed after the final CSS change, including TypeScript and production packaging. Only the pre-existing SignalR annotation warnings were emitted.

## Scoped antislop delivery gate

- Hard Gate PASS: real native table/controls retained, matched screenshot content remains explicitly labelled simulation, inspected breakpoints have no document overflow, checked contrast exceeds 4.5:1, keyboard selection/search/sort/filter work, final fresh-tab error log is empty, build passes.
- Purpose Gate PASS: existing source typography, semantic colors, icons and restrained surfaces retained for readability and inventory-state recognition; no decorative assets, effects, cards or motion added.
- Liveliness PASS: existing DESIGN.md direction, ENERGY 1 / RHYTHM 1 / MOTION 1; the stock table remains the focal point, selected SKU uses the existing blue marker, whitespace groups the table and explanatory footer deliberately.
- Craftsmanship/Quality Locks PASS: the scoped spacing findings were corrected and recaptured, existing alignment and content meaning remain intact, phone/tablet/desktop and light/dark states were inspected. This gate does not extend to unrelated application screens or unavailable API workflows.

Implementation checklist: column rhythm corrected; narrow-container fallback verified; footer margins consolidated; selected marker gap restored; responsive/locale/theme/interaction checks recorded; build passed. No outstanding scoped P0/P1/P2 findings.

---

# Document catalogue verification, 1 November 2026

final result: passed

Scope: convert all existing operational card selectors to the supplied Item Master catalogue pattern. This review covers Purchase orders, Quality inspection, Putaway, Orders, Reservations, Picking and Shipping. It does not certify the full application or transaction processing.

## Visual source and comparison

- Source: `qa/document-catalogue-20261101/source-item-master.png` (1468 × 577), supplied by the user as the positive reference.
- Rejected format: `qa/document-catalogue-20261101/source-card-list.png` (390 × 723), supplied by the user.
- Application evidence: `application-receiving-desktop.png` (1424 × 1778 full-page capture), English/light, Main Warehouse, existing local API snapshot. PO-SIM-100 retains Ordered 100, Received 60 and Remaining 40.
- CSS viewport: 1440 × 1000; document client width 1425. `desktop-metrics.json` records the component rectangle. `application-table-focus.png` is the 1133 × 467 component crop.
- Full component comparison: `comparison-item-master-and-documents.png` places the actual reference and implementation together. Their aspect ratios are preserved. Source zoom/CSS viewport is unknown, so this is a structural/component comparison rather than a claim of pixel identity. One document versus several items is a data-state difference.
- The focused crop makes labels, controls, selection, quantity alignment and row actions readable. Full-page captures retain the application context and separate transaction form.

## Comparison history

1. The original card selector and its narrow desktop column did not match the requested catalogue format. Replaced the shared selector with `WorkQueue`, using the existing `DataTable`, `ProductName`, `Field`, `Tag`, catalogue toolbar and pagination styles. All seven workflows use a full-width list above their original detail forms. Separate desktop captures cover each workflow.
2. The first phone capture retained real columns and contained scrolling but lacked a clear horizontal-scroll instruction. Added the mobile instruction and recaptured `application-receiving-phone.png`. The real application has 375px client/scroll width; its table region has 311px available width with 820px scrollable content. ArrowRight changes the region's scrollLeft without widening the document. Focus is visible.
3. Rechecked the paired reference/implementation and `tablet-dark-focus.png` after these changes. No actionable P0/P1/P2 findings remain in the document-list scope.

## Required visual surfaces

- Typography: existing local Source Sans 3, inherited table/control sizes and product/SKU hierarchy. Document identifiers are semibold; Selected has a smaller text label and check icon. No new font system.
- Layout and spacing: same labelled four-field toolbar, result count, shaded header, row separators, outlined actions and 10/25/50-row pagination as Item Master. A wide catalogue replaces the sidebar cards. Detail forms follow below it. On phones, controls reflow while actual table columns remain available through local scrolling.
- Colors/tokens: existing Clear Operations tokens in light and dark themes. `contrast.json` records 11 text/background pairings, all above 4.5:1; the minimum checked text ratio is 5.359:1. This is not a complete WCAG conformance assessment.
- Images/icons: reuse the existing optional product thumbnail treatment and Phosphor icons from the reference. No invented product photos, logos or bitmap UI replacements.
- Copy/content: document, task, source and SKU identifiers remain unchanged. Remaining quantities and receiving progress come from the original workflow data. Quality/source columns appear only where relevant. English and Bahasa Indonesia were inspected. No new operational claims or statistics.

## Browser interaction evidence

The isolated `/qa/work-queue-fixture.html` imports the production Operations component and uses explicitly labelled synthetic data in memory, without API/database writes. `browser-checks.json` and the workflow PNGs retain evidence.

1. Receiving: search PO-SIM-113 returns its original SKU-B row; unmatched text shows a filter-specific empty state; Clear filters restores records.
2. Status plus item filters: partially-received and SKU-A return the six expected fixture records.
3. Sorting: document A–Z uses natural identifier order, Z–A starts PO-SIM-131, item A–Z starts Product A, and remaining descending starts quantity 100.
4. Pagination: next/previous navigate between pages 1 and 2; page 2 in document order starts PO-SIM-110. Page sizes 25/50 render 25/32 fixture records. Page bounds are disabled correctly.
5. Selection: Open PO-SIM-101 selects that ID and focuses the matching detail panel. Enter on PO-SIM-100 does the same. Selection has a native pressed state, text and icon. CSS declares a 3px focus outline; this browser reported about 2.67px after display scaling.
6. Draft retention: changing table search preserves an entered quantity of 17. Selecting documents uses the existing route-specific draft callback and does not confirm a transaction.
7. Quality, Putaway, Orders, Reservations, Picking and Shipping: each renders a native table with workflow-specific columns; Open reaches the matching detail heading. No `.queue-item` cards remain. Desktop captures show no document-level horizontal overflow.
8. Empty warehouse: activating the fixture's Empty purchase orders control with Enter shows the existing no-PO state and transfer link.
9. Responsive/theme/localization: phone 390 × 844; tablet 900 × 1000 with 885px client/scroll width; desktop 1440 × 1000. `receiving-tablet-dark-id.png` is 884 × 2530 and `tablet-metrics.json` records the actual tablet dimensions. Dark theme and Indonesian labels were inspected, including long condition/progress labels.
10. Local application: API-backed receiving snapshot renders the same new catalogue. Opening a document, table search and selection are view actions. No stock transaction was posted for this verification. The final application tab remains open. Console error logs were empty in the checked application/fixture tabs.

## Automated checks

- `npm run build`: passed, including TypeScript and production packaging. Rollup reported only existing SignalR annotation warnings.
- `npm run test:work-queue`: 4 passed. Covers receiving progress, zero remaining, combined search/filtering, natural/quantity ordering, bounded pages, immutable source records and preservation of order IDs/quantities.
- `npm run test:catalogue`: 3 passed for the existing Item Master model.
- `npm run test:sites`: 4 passed for existing asset routing/build output.
- `git diff --check`: passed.

Concurrent autocomplete work appeared in shared form components during verification. Those edits were preserved, including its integration in WorkQueue; they are not a feature authored by this table-format change. Final type checking and the catalogue smoke check were repeated against the shared working tree. Autocomplete's complete behavior and other app flows are outside this report.

## Anti Slop delivery gate, scoped to this change

- R-02/R-16 PASS: direct operational copy; no promotional claims or em dash in new UI copy.
- R-03 PASS: desktop/tablet/phone evidence above; overflow is confined to the labelled table region.
- R-04/R-06/R-09 PASS: existing icons, type and badges serve document selection, reading and real statuses.
- R-17/R-18/R-23/R-36/R-38 PASS: no invented operational data or assets; synthetic fixtures are visibly labelled; API evidence is identified separately.
- R-25 PASS for the recorded pairings: all 11 checked text/background combinations exceed 4.5:1. Full application contrast is outside scope.
- R-26 PASS: search, filters, sort, paging and Open were exercised. Existing transaction commands were preserved and not triggered as a completion shortcut.
- R-27 PASS for list states: query deferral exposes aria-busy; filtered-empty and warehouse-empty states were checked. API loading/error handling remains in the unchanged parent workspace flow.
- R-32/R-39 PASS for the new list controls: native buttons/selects, labels, table headers, visible pressed state, keyboard activation, focus transfer and keyboard scrolling were checked. No screen-reader conformance claim.
- R-33 PASS: source changed directly; image processing was limited to saved QA crops/comparison images.
- R-34 PASS in scope: dark and light catalogue captures inspected.
- R-35 PASS: build, unit checks, browser interactions, console checks and saved visual comparison completed.
- R-37/R-05/R-20/R-31 PASS: the user's Item Master image supplies direction; ENERGY 1 / RHYTHM 1 / MOTION 1, with typography, spacing, tables and actions serving document lookup and comparison.
- R-40 PASS in scope: reuse dimensioned existing thumbnails, no new third-party scripts or invented performance metrics.
- Craftsmanship PASS in scope: reusable list across seven workflows, bounded pages, explicit selection and preserved transaction/detail boundaries.

## Remaining limits and follow-up

No physical-device, field, scanner/RFID, end-to-end stock transaction, production load or full accessibility test was performed. Existing client-side snapshots remain the source for catalogue filtering/pagination; this change does not add server pagination. Source screenshot zoom is unknown. Long-table use on real warehouse devices remains a field check.

Implementation checklist: shared catalogue wired to seven workflows; obsolete card CSS removed; Item Master pattern retained; responsive region checked; source model and runtime verified; final preview retained. No deployment was requested or performed.
