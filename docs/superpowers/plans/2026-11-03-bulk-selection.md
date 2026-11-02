# Bulk selection implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** Deliver useful multi-select actions in the eight approved areas.

**Architecture:** Add shared page-local selection, review and outcome components. Execute each selected record through existing API paths sequentially, preserving versions, authorization and request identity.

**Tech Stack:** React 19, TypeScript, Vite, existing ASP.NET Core API, Node tests.

**Spec:** `docs/superpowers/specs/2026-11-03-bulk-selection-design.md`

## Global constraints

- Selection is separate from opening details; select-all covers the current page only.
- Keep user/warehouse scope, server validation, versions, blind counts, pending IDs and ERP/WMS separation.
- Shared rows 48px, headers 44px, horizontal padding 12px, control gaps 8px.
- Preserve all existing uncommitted work; no commit, push, deployment or real data mutation.

## Review focus

- Filtering or pagination must not act on hidden selections.
- Mixed statuses and self-approval must not broaden eligibility.
- Partial failures must retain failed selections and identify each outcome.
- Unknown results must stop later requests and retain original identities.
- Stock export must preserve matching positions, restrictions and units.

## Tasks

- [x] Add failing tests for selection intersection, order/access eligibility, sequential execution and uncertain outcomes; implement `bulk-model.ts`.
- [x] Add `selection.tsx` and `BulkActions.tsx`; extend `DataTable` with an optional checkbox column. Implement review, reasons, progress and individual results.
- [x] Add direct existing-edit wrappers in `api.ts`, selected stock CSV and printable label helpers; integrate Master, Stock, Labels and Access.
- [x] Integrate Order actions through existing command/idempotency handling, and pending/ERP/RFID actions through their existing paths.
- [x] Run all frontend tests, typecheck/build and real browser fixture checks at desktop/mobile in both languages/themes; run the design detector and a fresh code review.

## Execution record

- Baseline: 39 frontend tests passed.
- Working in the supplied checkout to retain its extensive in-progress changes. Source copies for task-only review are in the OS temporary directory; no Git metadata changes.

- Final verification: 50 frontend tests, 91 backend tests, browser fixture scenarios and live read-only checks; see prototype/qa/bulk-selection-20261103/review.md.
