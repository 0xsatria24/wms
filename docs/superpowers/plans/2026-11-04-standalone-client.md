# Standalone local client implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. The user selected one independent PC for local installation testing.

**Goal:** Produce and exercise a Windows x64 installer that does not depend on the source checkout, development database, or manually started SSO.

**Architecture:** A separate Local Test installation owns PostgreSQL, Keycloak, Java, API and worker. Binaries live in Program Files; private config, databases and logs live in ProgramData. Native Windows services start dependencies automatically. The normal company-SSO installer remains available.

**Tech Stack:** Existing .NET 10 API/worker and React build, PostgreSQL 18, Java 25, Keycloak 26.8.1, WinSW 2.12.0 (.NET Framework 4.6.1+, included in supported Windows 10/11), PowerShell 5.1-compatible provisioning, Inno Setup.

**Spec / approved scope:** User: “1 aja dulu kan cuma buat test local”. One-PC test mode only. No LAN/shared server, SMTP, existing identity migration, or production-readiness claim.

## Global constraints

- Preserve the existing installation, databases, accounts and running source checkout.
- Fixed independent services `InventoryWmsTest.*`, install folder `Inventory WMS Local Test`, data folder `InventoryWmsLocalTest`.
- Loopback-only PostgreSQL 5544, WMS `https://127.0.0.1:5444`, SSO `https://127.0.0.1:8444`. IP origin separates cookies from existing localhost installation.
- New per-installation secrets and certificate, private administrator/service ACLs. No development configs, data, passwords or identity database in installer.
- Administrator explicitly chooses company, initial warehouse/location and first account credentials. Test account email is locally asserted, not proof of real email ownership.
- Fresh setup provisions first administrator using existing bootstrap CLI, no additional account implementation. Passwords remain in Keycloak. SMTP invitations/recovery remain deferred.
- Existing standalone installation can only be repaired using its saved settings; do not reinitialize/overwrite credentials. Uninstall preserves data and certificate and removes only owned services and the identity data link.
- Binary inputs and license notices are recorded with SHA-256 manifests. Test artifact is unsigned.

## Review focus

- Port/name conflicts must stop installation before creating a database or overwriting another service.
- Repair and failed install must not erase existing data or rotate unknown credentials.
- Secrets must not appear in installer logs, command lines, public build artifacts or status output.
- Service accounts must access only their own mutable directories and configuration.
- Source relocation must not change the installed service/config paths.

## Tasks

- [x] 1. Add pure provisioning helpers with failing-then-passing validation/realm/path tests; document native service design. Add configurable Windows service names to API/worker while retaining existing defaults.
- [x] 2. Implement separate standalone provisioning/install/uninstall and Inno UI. Build allowlisted clean dependency payload, version/hash/license manifest and full installer.
- [x] 3. Run parser/config/package tests, build and smoke tests. Exercise an isolated administrator installation with fresh generated test inputs, verify DB/SSO/login and service stop/start independently of source paths. Fresh whole-change review and record actual evidence/limits.

## Execution ledger

- Ruling: work in the user's D checkout, without another branch/worktree — user explicitly rejected branch proliferation and moved this workspace to D. No push/merge is part of this request.
- Ruling: use an independent Local Test profile to exercise fresh installation without migrating the existing H2 identities or changing existing WMS services.
- Clean Windows VM/Sandbox is unavailable on this host. Actual local service installation can be exercised; a machine reboot and clean-client UAT must not be claimed without evidence.
- Ruling: pinned WinSW wraps Java directly with protected runtime configuration, giving child-process stop handling without depending on a batch-file service launcher or storing secrets in service command lines.
- Ruling: shortcuts wait for both WMS and SSO readiness and show a service diagnostic message if startup does not complete. Do not open the login page while SSO is still warming up.
- Completed build/source verification is recorded in `docs/implementation/standalone-client-verification.md`. Task 3 remains open while Windows UAC awaits consent; actual service/SSO tests must run after consent, not be inferred from compilation.
- 1.1.1 follow-up: actual service provisioning, admin OIDC sign-in, restart, completed installer repair and uninstall passed after fixing native execution, initdb ACLs, Desktop module isolation and bootstrap privileges. Final evidence supersedes the earlier pending-UAC note: `docs/implementation/standalone-client-1.1.1-verification.md`. QA data was privately archived, not deleted. Final ZIP uses a small EXE plus companion BIN; no clean-machine or OS-reboot claim.
