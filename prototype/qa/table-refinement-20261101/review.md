# Shared table refinement, 1 November 2026

final result: passed

The six reviewed changes are implemented: quieter type, no empty row thumbnails, clearer SKU-wide selection, text/quantity alignment, compact Reserved header and adjacent sort controls, and clearer hold/quality exceptions. Existing catalogue workflows and centered Access management columns are retained. No inventory command or balance logic changed.

The user's final correction supersedes intermediate density variations: every table uses shared spacing tokens. CSS standard rows are 48px, headers 44px, horizontal cell padding 12px and vertical body padding 2px. Access actions are inline. Per-stock desktop padding overrides were removed. Selection marks follow the item so identity text begins at the same inset. Reserved/Available have distinct column space and a subtle separator, with the same cell padding as other columns.

## Evidence and comparison

- `stock-before.png`: actual application before the six-point refinement, 1440 × 1000 CSS viewport.
- `stock-first-pass.png`, `stock-desktop.png`: intermediate comparison evidence. The detail-image helper wrapped awkwardly after the table gained more space; its helper text was moved to its own line.
- `stock-tight-desktop.png`: response to the user's Reserved/Available and stock-density feedback.
- `stock-unified-final.png`: final application after the user requested consistency across all tables.
- `unified-spacing-checks.json`: fresh DOM measurements of Stock, Item Master, Access and Purchase Orders at 1440 × 1000. All inspected cells report padding `2px 12px`, and primary headers report `0px 12px` with 44px height. Rows containing 44px controls render about 49px including collapsed borders; static rows render 48px. There are no separate per-table padding rules. All four screens have no page overflow.
- `stock-tight-phone.png` and `checks.json`: 390 × 844 CSS viewport, 375px document/client width, visible mobile sorting, preserved 44px selection controls. The 1280px check reports no header overflow. Source and full-page implementation captures preserve their proportions; screenshots are comparison evidence rather than a claim to copy the rejected original layout pixel for pixel.
- `master-desktop.png`, `access-desktop.png`, `receiving-dark-id.png`: shared table anatomy, existing catalogue controls, Access alignment, and document quantities retained.
- `stock-dark-id.png` and `contrast.json`: dark/Indonesian review and 11 measured text/background pairs, all above 4.5:1 (minimum checked ratio 5.457:1). The final spacing change does not alter those colors.

## Checks

PASS, source/direction: user review plus latest spacing corrections applied with existing Source Sans 3 and Clear Operations roles; ENERGY 1 / RHYTHM 1 / MOTION 1.

PASS, typography/layout/assets/content: semibold names, secondary SKUs, shared density/padding, actual photos only in rows, unchanged product/document identifiers and quantities, quiet successful status and labelled warning icons. No fabricated assets or operational claims.

PASS, interaction: keyboard selection changes the correct SKU and explicit all-location detail scope; desktop available sorting toggles correctly; the new mobile sort changes the first item to SKU-C in descending item order; Item Master Edit opens and Escape closes without saving; unit conversion factors remain numeric/right aligned. Access headers remain centered and role/status labels remain intact. Browser console error checks were empty.

PASS, verification: production build and TypeScript passed during the refinement; the final shared-spacing correction was checked in the live browser and by TypeScript. Existing catalogue (3), work-queue (4) and autocomplete (4) model checks passed. `git diff --check` passed. No new tests were added for CSS values.

PASS, scoped Anti Slop gate: R-04/R-06/R-09 visual decisions serve identification, reading and real status; R-03/R-32/R-39 preserve responsive access, native controls, visible selection and keyboard use; R-25 checked pairs pass; R-33 source was edited directly; R-35 browser/build/type evidence recorded; R-36 no invented claims; R-37/R-05/R-20/R-31 direction and spacing are explicit and shared. This is not full WCAG, production, physical-device or end-to-end transaction certification.

No actionable P0/P1/P2 issue remains in the reviewed table spacing and hierarchy scope. No transaction, access decision or stock adjustment was posted. Existing unrelated work was preserved.
