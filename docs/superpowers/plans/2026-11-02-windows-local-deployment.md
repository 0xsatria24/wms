# Windows Local Deployment Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task.

**Goal:** Add a Windows x64 installer/build option without removing Docker/Linux deployment.
**Architecture:** Opt-in static frontend and direct HTTPS in the API; native Windows Service lifecycle for API and worker. Self-contained publish, external client configuration, Inno Setup installer.
**Tech Stack:** .NET 10, React/Vite, PostgreSQL 18, PowerShell, Inno Setup.
**Spec:** ../specs/2026-11-02-windows-local-deployment-design.md

## Global Constraints
- Keep company SSO, secure cookies and CSRF. No production demo auth.
- PostgreSQL 18 and a trusted HTTPS certificate are prerequisites.
- Preserve Docker/Linux and existing uncommitted work.
- Uninstall preserves database and ProgramData.

## Review Focus
- Unknown API routes must not return the SPA.
- Direct HTTPS requires an explicit HTTPS endpoint and persistent keys.
- Service accounts need config/key access without exposing secrets to ordinary users.
- Install/upgrade must refuse replacing existing service paths or deploying into a running service.
- Missing client configuration/tooling must fail clearly rather than create a fake successful installer.

## Task 1: Runtime hosting
- [x] Add failing production integration tests for direct HTTPS and opt-in static frontend, including reserved paths.
- [x] Run tests RED; add opt-in hosting, config-file loading and Windows service lifecycle.
- [x] Run relevant deployment tests GREEN (8/8).

## Task 2: Windows packaging
- [x] Add build script publishing self-contained API/worker and frontend into an isolated output directory.
- [x] Add prerequisite/config validation and service install/uninstall scripts; validate before service mutations, preserve data, use restricted accounts and ACLs.
- [x] Add Inno Setup source and shortcut/configuration template; compile Setup.exe with Inno Setup 6.7.4.
- [x] Exercise invalid config and packaging behavior; parse PowerShell and compile installer.

## Task 3: Delivery verification
- [x] Document preparation, SSO callback, TLS, database bootstrap/migration, upgrade and uninstall.
- [x] Run backend suite (73/73), frontend build and Windows publish/installer checks; record concrete limitations.
- [x] Independent review completed; fixed ACL, machine certificate trust, uninstall confirmation issues and shortcut cleanup. Docker configuration preserved.

## Execution record

Implemented in the existing workspace to preserve the user's uncommitted runtime changes; no branch, commit, push or deployment performed. Review used a dedicated read-only reviewer. Native Windows service installation and real company SSO were not exercised because this session has no administrator token or client identity/certificate configuration. These are acceptance checks for the target machine, not claimed results.
