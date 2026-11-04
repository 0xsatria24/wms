# Local Test installer 1.1.1 — verified fixes, 4 November 2026

## Fixed defects

- PostgreSQL `initdb` restricts the administrator token. The initial package protected its password file against that restricted token, so initialization failed. The installer now grants the invoking SID access only for initialization, then removes those grants. A real isolated cluster initialized with exit 0; no password was printed.
- Native stderr under Windows PowerShell 5.1 could become a terminating `RemoteException` before the native exit code was handled. A dedicated process runner captures both streams and checks exit codes. Execution, cleanup, and pipe-drain waits are bounded. PowerShell 5.1 regression tests cover stderr, nonzero exits, timeouts, batch paths with spaces and inherited output handles.
- PowerShell 7's inherited module path could prevent Windows PowerShell from loading its security module. Desktop PowerShell now uses its own system modules. The Inno callback launches the native system shell with filesystem redirection handled explicitly.
- The existing bootstrap CLI also migrates schema. Bootstrap now uses the private migration role rather than granting DDL rights to the application runtime.
- Helpers are stored before the large solid-compression block, avoiding full payload decompression just to run preflight. Configuration stages are streamed into the installer status and phase progress bar, replacing the apparent stall at 100%.
- Shortcuts now target a self-contained native Windows GUI launcher. Its PE subsystem is GUI (2), not console. It waits for WMS and SSO readiness, then opens the browser; it does not launch CMD/PowerShell.
- Failed initialization with an entirely empty cluster and no services can be archived safely. Partial provisioning with an existing database resumes using stored secrets; role/database creation is idempotent, initialized administrators are not recreated, and realm import never overrides an existing realm. Private pending realm input survives a failed attempt and is deleted after success.

## Actual runtime evidence

Administrator testing on this Windows machine, using only a synthetic `Local Deployment Test` profile:

- Real PostgreSQL initialization and runtime service startup passed.
- Schema migration, least-privileged application permissions, administrator bootstrap and Keycloak realm import passed.
- Four automatic services, database-backed health, discovery and login redirect passed.
- Full Authorization Code/PKCE/form-post sign-in produced the expected verified WMS administrator session.
- All four services were stopped and restarted; readiness and login passed afterward.
- The full 1.1.1 installer completed with **exit 0**, retaining the identity subject and infrastructure credentials. Installed shortcut target and native launcher probe passed. Measured end-to-end repair time was 659.8 seconds on this host, including EXE startup/file extraction and service startup; it is not a clean-client performance benchmark.
- Native installer/uninstaller functions were tested. QA uninstall completed with **exit 0**, leaving its data intact. The synthetic profile was archived privately at `C:\ProgramData\InventoryWmsLocalTest-QA\verified-profile-20261104-171349`, and its exact test certificate was removed. No fixture services/data directory remain active, so the user can choose their own account on a fresh install. Previously failed configurations were preserved separately.

The final delivery separates the small bootstrap EXE from its companion `.bin`, bundled in one ZIP. Startup smoke reached the expected empty-form validation exit in **15.29 seconds**, creating no services or data. This is a deliberate pre-install negative test, not an installation failure. The final split loader was smoke-tested; complete provisioning/repair/login tests above used the same installer flow in its monolithic test build. Clean-machine fresh-install UAT and a genuine OS reboot are still unverified.

## Deliverable

`outputs/windows-local/standalone-1.1.1-20261104-162019/InventoryWms-LocalTest-1.1.1.zip`

- ZIP: 494,728,502 bytes.
- ZIP SHA-256: `76BF57E026D0D9A658399B5EDFEFE857FA3E6C338952E4DAF49B8F7A6D359342`.
- `InventoryWms-LocalTest-Setup.exe`: 2,464,756 bytes.
- `InventoryWms-LocalTest-Setup-1.bin`: 492,262,698 bytes.
- `START-HERE.txt`: extraction and setup instructions.

Extract the entire ZIP before running Setup. The EXE and BIN must stay together. No client JSON is required. The installer remains unsigned; SMTP, certificate renewal, clean-client UAT, production use and OS reboot validation remain outside this local-test verification.

Unrelated `prototype/src/App.tsx` and `prototype/AGENTS.md` changes were left intact. No GitHub push was requested or performed for these installer fixes.
