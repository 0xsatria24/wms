# Multiple selection

The eight approved areas use a checkbox column, page-local select-all, action review and individual outcomes. Checkboxes do not open details or expand stock positions.

| Area | Actions |
| --- | --- |
| Item master | Activate, deactivate with reason, delete subject to references/version checks, download labels |
| Stock position | CSV of selected warehouse/SKU groups and matching positions, including condition, hold, frozen/pickable restrictions, quantities, units and last movement |
| Labels | Search/page active items and download one printable HTML sheet with one Code 128 label per selected item |
| Orders | Submit drafts, approve eligible orders, return for review with reason, release approved orders; each remains separate |
| Users and access | Approve verified pending requests, reject pending requests, revoke active access; admin only |
| Pending transactions | Send unsent requests, read scoped receipts for unknown results, explicitly retry original unknown requests |
| ERP integration | Schedule eligible original events for retry; accepted/acknowledged events are excluded |
| RFID pilot | Exclude selected unresolved observations with a reason in the current simulation |

## Selection and failures

User, role, warehouse, page, filter, sort or tab changes invalidate selection and any open review. Returning to an earlier scope cannot reopen an old review. Language/theme changes retain selection. Live snapshots are checked before every dispatch so rows that leave the page or become ineligible are skipped.

Requests execute sequentially. Validation conflicts are reported per row. Lost authorization or an uncertain result stops subsequent requests. Failed, pending and skipped rows remain selected while visible and eligible. A CSV/label file-production failure marks affected output rows as failed and retains selection. List-refresh failures are separate from successful mutations.

Unknown-result checks use `GET /api/requests/{type}/{originalKey}` and never post a command. A missing receipt retains the unknown request. Explicit retry preserves the ID, principal, warehouse, payload, version and occurrence/capture times. Previously unknown requests never become unsent just because the device goes offline. Queue changes are published to local UI state even when the first row has an uncertain outcome.

## Server contracts

- `master-status`: existing SKU, exact version, active flag and a reason for deactivation. Cannot create an item or overwrite other fields.
- `access-status`: target ID, expected previous status, desired status and reason. Allows pending-to-active/rejected or active-to-revoked; preserves each individual warehouse role/grant. A verified approval without grants initializes only Operator in the acting warehouse. Self-decisions and targets outside the actor's administrative scope are rejected.
- Versioned `labelHistory` requests carry the reviewed item version and barcode. Both are validated before recording the output request, preventing a stale reviewed identity from silently diverging from the current one.

Inventory Core authority, idempotency, audit identity, warehouse authorization and blind-count rules remain in force. Physical stock confirmations remain per document.

## Verification scope

Node tests cover eligibility, partial failures, uncertain outcomes, original identity, read-only receipt lookup and CSV safety. HTTP regressions use isolated PostgreSQL test databases. The browser fixture uses generated in-memory data and blocks API calls. This is prototype verification, not operational UAT or physical scanner/printer testing.

Label history records a validated output request. A browser file failure does not prove a downloaded file, and a history entry does not prove physical printing.
