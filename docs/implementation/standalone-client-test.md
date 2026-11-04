# Windows full local-test package

This is an independent **one-PC local test** package. It is not the shared-server/client distribution and is not evidence of production readiness. The company-SSO installer remains available separately.

The installer also carries the Microsoft-signed x64 Visual C++ redistributable required by PostgreSQL on a clean PC. Its Authenticode publisher is verified at build and install time. Windows 10/11 must provide .NET Framework 4.6.1+ for the WinSW service wrapper. The shortcut waits for database-backed WMS readiness and SSO discovery before opening the browser; it shows a service diagnostic if startup cannot complete.

## Build

`scripts/build-standalone-client.ps1 -Version 1.1.0` publishes the .NET applications and frontend, copies allowlisted PostgreSQL 18 binary/library/share components with license notices, Java 25 with legal notices, Keycloak 26.8.1 without data/configuration and pinned WinSW 2.12.0. Keycloak is built for PostgreSQL before packaging. A SHA-256 payload manifest and build provenance/version manifest accompany the installer. No development account, database, PFX, client configuration or secret is packaged. Inputs already present on the build host must originate from the vendors; the manifest records packaged content rather than asserting independent upstream signature verification for every dependency.

## Install

Run `InventoryWms-LocalTest-Setup.exe` as Administrator. Enter company, first warehouse and location, and choose the initial administrator email/name/password (12–128 characters). The installer provisions empty databases and a fresh Keycloak realm. Email ownership is asserted only for this local-test account; no real verification email is sent. Do not reuse this mode as company identity verification.

For version 1.1.1, extract **all** files from the delivery ZIP first. Keep the small Setup EXE and its companion BIN together; do not run Setup from inside the ZIP. The small bootstrap avoids putting the entire server bundle into the initial EXE. Setup shows database/migration/SSO stages and phase progress. Shortcuts now use the native GUI launcher instead of PowerShell. Actual fix verification and limitations are recorded in `standalone-client-1.1.1-verification.md`.

- Application: `https://127.0.0.1:5444`
- Identity: `https://127.0.0.1:8444/realms/wms-test`
- PostgreSQL: loopback port 5544; identity management: loopback 9004
- Binaries: `%ProgramFiles%\Inventory WMS Local Test`
- Data/configuration/logs: `%ProgramData%\InventoryWmsLocalTest`
- Services: `InventoryWmsTest.Database`, `.Identity`, `.Api`, `.Worker`

The IP origin separates browser cookies from the existing localhost WMS. The installer creates a one-year certificate for 127.0.0.1 and trusts this exact certificate in Local Computer. This is explicit test-only local TLS provisioning, not a public CA certificate. Certificate renewal must be implemented before longer-term use. The installer and binaries are unsigned.

Application and worker run under separate virtual service accounts. PostgreSQL and identity each have their own virtual account, mutable directories and database credentials. The WMS runtime is not a PostgreSQL superuser or schema owner; a private migration role owns WMS schema. Keycloak is isolated in a separate database. The identity service uses a junction to its own ProgramData directory; it never uses checkout paths or the development identity database.

The first WMS administrator is created through the existing bootstrap CLI with the imported Keycloak subject. First sign-in therefore goes directly through SSO; a second activation wizard is unnecessary in this test package. Company and warehouse inputs are provisioning facts for this test, not a copy of development operations.

## Operation, recovery and retained data

The four services start automatically with recovery actions; dependency ordering and endpoint readiness are checked at install time. SCM running status alone does not prove SSO readiness. `deployment/verify-standalone.ps1` verifies all services, database-backed health, discovery and login redirect.

Use the password chosen in the installer. SMTP remains deliberately unconfigured: invitation and reset emails will not deliver until SMTP is added in Keycloak. An administrator-only `installation.json` includes recovery and infrastructure secrets. A temporary Keycloak recovery administrator `wms-test-recovery` exists in the master realm for test administration; harden/remove bootstrap administration before any real deployment. Keep the entire ProgramData directory private and back it up with database dumps.

Reinstall requires all four owned test services to be stopped before files are replaced. Saved settings and identities are reused; input passwords are ignored for an already completed installation. Never use reinstall as password reset. Recognized interrupted provisioning resumes using saved secrets and non-overwriting bootstrap/import operations. A failed profile with no database files or services can be archived before a new initialization; an existing database is never discarded automatically. Unrecognized state is refused for administrator review. Uninstall removes only owned services and the identity-data junction. It preserves databases, accounts, configuration and the exact local-test certificate so reinstall can reuse them. Remove those manually only after backups and an explicit decision to discard this test installation.

## Validation limits

Record actual build, service install/restart, OIDC login and source-independence evidence in the task verification report. This host has no Windows Sandbox executable. A clean PC/VM installation, real OS reboot, SMTP delivery, hardware integrations and client UAT remain separate checks; do not infer them from a successful local build.

References: [Keycloak production configuration](https://www.keycloak.org/server/configuration-production), [WinSW 2.12.0](https://github.com/winsw/winsw/releases/tag/v2.12.0), [PostgreSQL Windows distribution](https://www.postgresql.org/download/windows/).
