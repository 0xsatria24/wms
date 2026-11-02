# Three-step admin wizard

3 November 2026. User removed the warehouse step. Current flow: Activation → Administrator/SSO → Review → Success. Review contains only verified administrator and company; numbering is 1–3. Back returns to the SSO step.

Initial warehouse/location values come exclusively from private IT configuration (`Setup:Warehouse`). Empty or invalid configuration disables setup. The complete endpoint ignores warehouse fields in the HTTP body; PostgreSQL integration tests verify that the configured warehouse/location is created instead.

Verification:
- `npm run build`: passed, including TypeScript. Existing SignalR annotation/chunk-size warnings remain.
- SetupWizardTests + ProductionReadinessTests + DeploymentTests: 20 passed, 0 failed.
- `git diff --check`: passed.
- Updated UI fixture preview and regression script for three steps/direct SSO-to-review.

Fresh browser capture was blocked: in-app browser reported unavailable browser-user capability; the fallback Chrome window could not be activated. No visual pass or new screenshot is claimed for this revision. Prior four-step screenshots are historical and do not depict the current flow. Real provider SSO and client deployment remain unverified.
