# Account Invitations Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, inline and sequential, as requested by the user. Do not repeat brainstorming or request implementation approval again.

**Goal:** Undang pengguna dan pulihkan password dari WMS tanpa administrasi akun ganda.

**Architecture:** ASP.NET Core memanggil Keycloak melalui client server dengan hak terbatas. Undangan PostgreSQL menyimpan persetujuan dan hasil; SSO mengaktifkan grant hanya setelah bukti identitas dan kewenangan diperiksa kembali.

**Tech Stack:** Existing ASP.NET Core/EF Core 10, PostgreSQL 18, React/TypeScript/Vite; no new dependencies.

**Spec:** ../specs/2026-11-03-account-invitations-design.md

## Global Constraints

- No passwords/provider secrets in browser or audit records.
- Preserve existing issuer/subject, verification, warehouse scope and audit history.
- Do not fix the deferred public-enrollment quota finding.
- No real email delivery or provider-account mutation during tests.
- Work in the authorized current workspace; leave changes uncommitted for review.

## Review Focus

- Duplicate/replayed submissions and uncertain provider responses must not duplicate accounts.
- Existing provider identities must keep their password and grants.
- Expired invitations or a revoked inviter must never activate access.
- Missing SMTP/client configuration must not claim successful delivery.
- Recovery responses must not expose whether an email is registered.

### Task 1: Backend invitation and provider boundary

**Files:** Access/AccountEndpoints.cs, AccountInvitations.cs, KeycloakAccounts.cs, SsoEnrollment.cs; Reporting/SnapshotQuery.cs; Program.cs; account tests. Existing SupportingRecord storage avoids a schema migration (see ruling).

**Interfaces:** POST/GET /api/workspaces/{warehouse}/invitations/{id}; IAccountIdentity.EnsureUser/SendInvitation/Recover. Pending invitation carries immutable role/warehouse approval and provider subject.

- [x] Test missing configuration, authorization, replay, provider failure/unknown and existing-account behavior; observe failures.
- [x] Add minimal durable invitation model, scoped endpoints and provider client.
- [x] Test and implement verified SSO activation with expiry/inviter-authority checks.
- [x] Run focused .NET tests, then existing account tests.

### Task 2: Invitation UI and honest recovery

**Files:** prototype/src/api.ts, management.tsx, App.tsx, account.tsx, ui.tsx; frontend API tests.

**Interfaces:** Stable invitation ID per submission, read-only result check, explicit resend; role/warehouse choices in Add user. Public recovery receives email and returns a generic accepted result.

- [x] Add behavioral API tests and observe failures.
- [x] Implement compact existing-pattern forms and status/retry handling; preserve demo behavior.
- [x] Typecheck/build, run frontend tests, inspect desktop/mobile and keyboard/error states.

### Task 3: Deployment and recovery handoff

**Files:** server configuration examples, account provisioning/recovery runbook, prototype/AGENTS.md.

- [x] Document SMTP/provider client permissions, first-admin password activation and backup administrator, emergency recovery and session limitations.
- [x] Run relevant full test suites/build and final change review.
- [x] Record actual results and external configuration still needed; no production/UAT claims.

## Progress

- Planning: approved proposal captured; sequential inline execution, no repeated permission gate.
- Ruling: provider configuration remains external; integration must fail closed and display setup required until supplied. No fabricated SMTP values or live mail test.
- Ruling: use the existing versioned SupportingRecord store with a dedicated, non-editable account-invitation kind rather than add a table/migration. The persisted Principal ID equals the invitation ID, so SSO can find approval directly; no schema or existing data migration is needed.
- Task 1 RED: both new HTTP tests returned 404 before implementation, as expected. Test build uses .runtime/account-tests because running preview processes lock the usual DLL output. PostgreSQL is already running; sandbox localhost requires elevated test execution.
- Task 1: focused verification passed 19/19 after the fresh review. Five regression cases were observed failing first: immutable resend identity; pre-email durable marker; current-ticket verification (two cases); completed password setup. All now pass in .runtime/account-review-green.log.
- Ruling: use a PostgreSQL session advisory lock per invitation across committed pre-email checkpoints. Ordinary replay of unknown remains read-only; interrupted preparing can resume. Email delivery remains at-least-once only on explicit resend.
- Ruling: SMTP configuration explicitly deferred by the user; keep account email services unconfigured and do not alter live Keycloak accounts or send real email during verification.
- Task 2: final frontend suite 55/55 and production build passed. Browser checks covered desktop/mobile, EN/ID, keyboard focus, missing configuration and send/check/resend; see prototype/qa/account-invitations-20261103/review.md. All browser intercepts removed afterward.
- Task 3: configuration examples and recovery/backup-administrator procedure written. No schema/data migration, live Keycloak mutation, or real email delivery was performed.
- Final: complete. Backend full suite 123/123 passed (exit 0); final frontend suite 55/55 and TypeScript/Vite build passed. Fresh review's four important findings were covered by failing tests, fixed, and verified. The earlier parallel full run was stopped; the authoritative final .NET run was sequential. Existing Vite bundle-size warning remains. Changes are uncommitted in the requested workspace.
