# Settings priority one

Scope authorized by the user's request to implement the first four recommended settings groups. Extend the existing React/.NET application and Clear Operations design. Preserve unrelated uncommitted changes.

## Design and decisions

- User preferences: API-persisted, private to the current principal, language/theme, accessible default warehouse, start page and default catalogue page size. Apply on sign-in and refresh. No new date/number preference until formatting is consistently supported.
- Warehouse: display stable identity and operational locations, save address and timezone, create storage locations using the existing validated location command. Receiving/QC/Staging and per-transfer transit retain their existing semantics; editing a label must not move inventory.
- Transactions: expose enforced receiving maximum, six-decimal precision and required exception reasons as read-only rules. Partial reservation/shipment remains an explicit development-only assumption (D02 open).
- Approvals: per-warehouse choice between supervisor/admin and admin-only for order review and stock-count adjustment. Persist with version checks and audit; enforce in Inventory Core. Never allow operator approval or self-review. Admin configures; other authorized users can inspect.
- Reuse SupportingRecords for small versioned settings documents, excluding private preferences from shared snapshots. No schema migration or dependency required.
- Each form reports loading/error/success, preserves drafts during background refresh, and refuses stale saves. Changes require an explicit Save action. Offline settings writes fail visibly rather than entering the inventory pending queue.

## Execution

- [x] Add tests for persistence, ownership, warehouse scope, stale edits, validation, current access and approval enforcement. Initial execution was blocked by local database recovery; scoped tests subsequently passed against an isolated cluster.
- [x] Add typed configuration contracts, private preference endpoints and warehouse settings endpoints with access validation, audit and concurrency.
- [x] Enforce configured reviewer scope in existing core approval commands; preserve all independent-review checks.
- [x] Implement Settings sections and integrate saved preferences into login, navigation and catalogue defaults.
- [x] Run scoped backend tests, frontend typecheck/build and meaningful UI verification. Evidence and limitations: `docs/implementation/settings-priority-one.md`.

## Review focus

Account switching cannot apply another user's preferences. Revoked warehouse defaults fall back to currently granted warehouses. A settings save cannot silently overwrite another administrator's change. Approval configuration cannot bypass document state, operator restrictions or self-review. Changing timezone affects display, not stored timestamps or stock.
