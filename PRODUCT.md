# Inventory / WMS

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing application: React/TypeScript/Vite, ASP.NET Core 10, PostgreSQL 18. This design task extends the existing application and does not select a new stack.

## Product Purpose

Manage warehouse item records, receipts, quality inspection, storage, allocations, picking, shipment, transfers, returns, counts and traceability. Catalogue identity and physical stock are different records.

## Users

Current implementation has warehouse-scoped operator, supervisor, administrator and read-only viewer roles. Actual client staffing and device allocation remain open; do not invent a dedicated QC department or named assignees.

## Confirmed Direction, 4 November 2026

- The user finds the path from item registration to QC and shipment confusing.
- Goods may be received manually without an ERP purchase order.
- The user wants stock operations available where the items are visible, with destination/process selection in the same page.
- The user selected a side panel with the stock table remaining visible, rather than expanding a form underneath a row.
- Audit the whole experience; replace inefficient functions and retain effective ones.
- Current deliverables are an audit, new workflow design and PRD. Product implementation is a separate step after review of those deliverables.

## Capabilities and Constraints

Inventory Core authorizes physical stock changes. Browsing, drafts, item registration, observations and RFID read totals do not post inventory. Confirmation, warehouse authorization, document lineage, quantities, units, version checks and retry identity must survive the redesign.

Keep physical quantity, reserved quantity and available quantity distinct. Inspection condition, hold, frozen location and pickability are different concepts. Manual receipt must enter the same receiving/QC controls; it must not masquerade as an ERP PO or opening balance.

Current implementation requires supervisor/admin QC and independent order/count reviewers. These are current source contracts, not newly interviewed client policy. Preserve them unless the user deliberately changes them.

## Brand Commitments

Continue the established Clear Operations visual system recorded in DESIGN.md and implemented in prototype/src/styles.css. Preserve effective catalogue/table behavior, full reference IDs, real product images only, bilingual English/Indonesian support, and existing light/dark preferences. User selected workflow consolidation, not a replacement brand identity.

## Evidence on Hand

- Current source in this workspace and prototype/AGENTS.md.
- Current-run audit screenshots and DOM captures in artifacts/ux-audit-20261104/.
- User-supplied screenshot of a global stock-shortage banner in artifacts/ux-flow-20261104/05-user-stock-warning.png.
- Screenshots and source review are local evidence. Physical scanners, live RFID, ERP client integration, production deployment and UAT are not established by this task.

## Product Principles

- Start from a visible item, position or document and retain its context.
- Explain the next legitimate action and any blocker in ordinary warehouse language.
- Keep confirmations explicit and outcomes traceable.
- Reduce navigation and repeated entry while preserving operational controls.
- Prefer improving a working function over replacing it without evidence.

## Open Decisions

Business precision by unit, production partial fulfilment policy, receipt-lot traceability requirements, attachments/storage limits, device retention policy and production integration mappings remain open. The proposed PRD must label defaults and unresolved decisions rather than claiming user approval.
