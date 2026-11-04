# Standalone client local-test verification — 4 November 2026

## Artifact

- `outputs/windows-local/standalone-1.1.0-20261104-153215/InventoryWms-LocalTest-Setup.exe`
- Size: 451,460,893 bytes.
- SHA-256: `460C93B29DA04EEB5A177BFDDB47B16BD76EB5EFCC925BA9E8D66B192D8F9636`.
- Unsigned local-test installer, not a production release.
- Includes PostgreSQL 18.4, Java 25.0.5+8, Keycloak 26.8.1, WinSW 2.12.0, Microsoft-signed Visual C++ x64 runtime, self-contained .NET API/worker and frontend. Per-file hashes and vendor/legal notices accompany the payload.

## Completed evidence

- Frontend typecheck and production build passed.
- Fresh Release win-x64 self-contained API/worker publish passed after allowing required NuGet access; no audit setting was disabled.
- Three `WindowsHostingTests` passed (0 failures).
- Standalone model tests passed in PowerShell 7 and Windows PowerShell 5.1: isolated origins/ports, invalid inputs, independent random secrets, consistent identity subject, confidential PKCE client, provisioning service identity, configuration without the user password, and script parsing.
- Observed failing regression for a padded reserved location (`Receiving `); normalized provisioning fields and confirmed passing tests. Password is not trimmed.
- Existing Windows configuration tests and activation-provisioning tests passed.
- Published executable smoke test passed: HTTPS SPA, reserved routes, absent demo login, 503 readiness for an unavailable fixture database, and worker heartbeat. The old smoke assertion attempted an organization-backed session endpoint without a database; replaced it with the correct fail-closed readiness contract. Real database-backed OIDC session verification remains a separate installation check.
- Full payload tests passed: required executables, libraries, license notices, no packaged runtime configuration/PFX/identity database, and file SHA-256 verification.
- Inno Setup compilation passed, with final output and installer SHA-256 read back.
- One fresh scoped source review completed. Fixed its two findings: inherited `KC_*` environment overrides and whitespace-normalized reserved locations.
- Tracked runtime code changes are limited to configurable service names with existing defaults in API/worker. No main push or deployment over the old installation was performed for this task.

## Pending administrator installation test

The QA helper was launched with Windows elevation to exercise a separate empty `InventoryWmsLocalTest` profile. At the last check, Windows `consent.exe` was present and the helper had not started: UAC consent is still required.

Do **not** claim that database initialization, four Windows services, native TLS provisioning, actual administrator OIDC login, service restart, uninstall/reinstall, or clean-client installation have passed yet. The helper will report to `.runtime/full-client-install-status.json` after consent. Its generated fixture credentials and installer logs remain in administrator-only ProgramData, outside the public artifact.

Windows Sandbox is unavailable on this machine. A genuine clean-machine/VM test, OS reboot, SMTP delivery, certificate renewal and client UAT are not verified by these build tests. Existing source-dependent development installation is separate and was not migrated by this package.
