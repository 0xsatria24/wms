# Operational export implementation plan

Spec: [approved PRD](../../planning/prd-export-operasional.md).

Scope: seven export groups only, server-authoritative snapshots, XLSX/CSV/PDF, existing page controls, blind-count protection and separate export audit. Preserve unrelated working changes. No deployment or commits requested.

- [x] Build file writers with metadata, safe text, exact identifiers and paginated PDF; verify real file structures.
- [x] Build authenticated export queries/events API with limits, versions, partial transaction evidence and separate audit; test access and quantities.
- [x] Store minimal transaction/document evidence atomically for new operational documents; never backfill guesses.
- [x] Connect export review/download controls in the existing seven workflows; check TypeScript/build and UI states.
- [x] Review integration, run focused regression checks, and document actual verification and remaining UAT limits.

Review focus: pagination completeness; blind count via indirect exports; original partial quantities on reprint; formula/identifier handling; no additional stock/ERP events from export.

Verification: Release backend build and 10/10 consolidated tests passed; frontend typecheck/build and 5/5 download tests passed; PDF/XLSX parsed independently. Browser visual smoke remains unverified due local connection restrictions; details in docs/implementation/operational-export.md. No client UAT or deployment performed.
