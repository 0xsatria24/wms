# Inventory design system

**Acuan aktif 30 Oktober 2026:** [Clear Operations complete suite](redesign-2026-10-29-v2/complete-suite/README.md), dengan [revisi Stock position](redesign-2026-10-29-v2/revisions/01-stock-trends/README.md). [Aplikasi baru](../prototype/README.md) menggantikan HTML katalog lama yang dihapus atas permintaan pengguna. Bagian Ledger berikut adalah arsip, bukan spesifikasi aplikasi aktif.

**Usulan terbaru, 29 Oktober 2026:** [blueprint desain per fungsi](blueprint-2026-10-29/README.md). Berisi fondasi, 21 spesifikasi dan papan desain statis yang mengikuti PRD/WMS/tracker serta referensi terbaru. Tidak ada implementasi aplikasi pada revisi ini. Mulai peninjauan dari paket tersebut; katalog interaktif di bawah tetap draf historis.

Status: revised local draft, not ready for design acceptance. The user clarified that the screenshot is inspiration only. The previous close-reference composition is superseded. Production backend and device validation remain separate.

Antislop mode: `during`, from the user's session choice. Core, UI, copywriting, human accessibility and responsive-layout rules apply. ENERGY 1 / RHYTHM 1 / MOTION 1. The reference and reasons are recorded in [DESIGN.md](../DESIGN.md).

Design Read: inventory operations and review tools for warehouse operators and supervisors, using a calm document-oriented visual language. Quantity, location, condition and confirmation outcome determine the hierarchy.

## Revised composition

Ledger retains the reference's readable tables and useful density. The revised shell uses a left module navigation, a page heading with a primary receiving action, and three filter groups above the records. Deep teal identifies the primary action; neutral selected rows retain checked checkboxes. Warm white separates the page from its working table.

The screenshot does not prescribe composition, colors or domain data. Product naming, company logo and real device constraints remain open. Product A through F are explicit simulation placeholders. No brand assets were added.

## What makes this an inventory system

- Physical, committed and available quantities have distinct labels and a shared numeric alignment pattern.
- Document number, warehouse and condition remain visible before confirmation.
- A result that has not reached the server differs from a response whose outcome is unknown.
- A quarantine or stock conflict shows the blocked action, reason and next step.
- Desktop supports comparison across rows; a narrow operator screen keeps item, actual quantity and action together.

## Starter assets

- [Base tokens](tokens.base.css): typography, spacing, sizes and interaction geometry.
- [Theme tokens](themes.css): semantic colors with light and dark appearances.
- [Component styles](components.css): shared components composed from semantic tokens.
- [Aplikasi aktif](../prototype/README.md): frontend React/TypeScript yang memakai API .NET dan database pengembangan.
- [Component contracts](components.md): responsibilities, states and acceptance checks.
- [Review and verification](review.md): recorded checks and limits.

The preview uses no backend, accounts, production data or ERP connection. Rows, references and actions are labeled simulation. Local interaction never creates accounting evidence. Existing screenshots depict superseded compositions and must not be used to assess the current draft.

## Design decisions and reasons

| Decision | Reason |
|---|---|
| System font beginning with Segoe UI | Familiar reading on the target Windows workstation and no dependency on a remote font service |
| Tabular numerals | Quantity comparisons remain aligned as values change |
| References, quantity rows and thin horizontal rules as a repeated motif | The interface follows documents and their physical effects |
| One emphasized action within a task | Operators can identify the next confirmation without competing decoration |
| Functional status text | Color supports meaning; it is not the only explanation |
| Small component radii and no routine shadow | Fields, rows and dialogs have distinct boundaries without decorative elevation |
| Explicit comfortable and compact density | Operator touch targets remain usable while supervisors can scan more data |
| Light and dark appearances share semantic tokens | Color roles remain stable; dark mode is a supported choice rather than a different design |
| Hover, focus and pressed feedback only | Interaction receives feedback without continuous motion or distractions |

## Verification and next implementation checks

The revised composition has not been rendered or clicked through. Earlier browser verification stopped after a canceled download, an unreachable loopback preview and Browser Use's explicit rejection of the local file protocol. No alternate browser route was used after that policy rejection. CSV download completion, the interaction suite, theme checks and narrow-screen checks require a permitted browser environment.

The current prototype is a review candidate, not a release with a complete antislop delivery pass. Source syntax and static token/document checks are recorded separately in the review. Product components still require independent integration, access, database and device checks in the chosen application framework.
