# SSO access fixes implementation plan

> Execute inline with Superpowers systematic debugging, TDD and verification before completion.

**Goal:** Fix the three findings in `docs/reviews/2026-11-03-sso-access-review.md`.
**Architecture:** Keep OIDC and existing access commands. Require fresh authentication on explicit login; distinguish administrative warehouse scope in the session; change grants only when approving access.
**Constraints:** Preserve existing identities, transactions, grants, setup activation, CSRF, remember-me and backend authorization. No password reset, identity provisioning or inventory seed. Work in the existing checkout to retain the reviewed uncommitted fixes.

1. Add regression tests before changing implementation: normal/setup OIDC challenges request credentials, mixed-role sessions expose only admin warehouses as manageable, Reject/Revoke do not assign grants. Run and record expected failures.
2. Patch OIDC configuration, session response, frontend administrative choices and decision handling. Keep existing visual layout and use explicit action copy. Re-run the focused tests and frontend build.
3. Request a focused read-only code review. Resolve material findings and verify the final patch.
4. Publish a local Windows payload, back up installed API files, stop only the WMS API service, apply and restart it. Verify readiness, live SSO challenge and installed file hashes. Do not change database contents or Keycloak credentials.

Review focus: pending user account switching; setup Back to another identity; admin in A/viewer in B; unverified invitation rejection with no warehouses; revocation retaining existing roles. Provider SSO sessions remain managed by the identity provider: fresh login prompts enable switching without ending sessions in other company applications.
