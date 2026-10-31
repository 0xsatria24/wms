# Component contracts

Status: component contracts for the revised Ledger draft in [DESIGN.md](../DESIGN.md). They build on the [design brief](../docs/planning/04-design-brief.md) and [application flow](../docs/planning/03-app-flow.md). The screenshot is inspiration only. Scanner hardware behavior remains planned.

| Component | Job | Required states | Key acceptance check |
|---|---|---|---|
| Scope header | Identify warehouse and document being acted on | Current scope, changing scope, access denied | Pending work remains tied to its original scope |
| Quantity group | Distinguish planned, actual and remaining; physical/committed/available when relevant | Known, loading, unavailable | Label and unit remain visible; numeric columns align |
| Scan field | Recognize a barcode and make correction possible | Idle, recognized, unknown, pending, error | Keyboard and scanner input share an accessible labeled field |
| Quantity field | Capture actual quantity in a stated unit | Empty, valid, invalid, read-only | Error identifies the invalid value and valid condition |
| Status label | Communicate one type of state | Document, quality, reservation, integration | Color never carries the state alone; namespaces are not merged |
| Confirmation summary | Make the physical effect clear before posting | Review, sending, unknown outcome, rejected, confirmed | Retry preserves the original intent when the result is unknown |
| Exception message | Explain a blocked action and recovery | Warning, blocking, resolved | The message names the object, reason and next action |
| Data table / record list | Compare documents or item lines | Data, loading, first-use empty, filtered empty, error | Narrow layout retains identity, quantity, status and available action |
| Review dialog | Confirm a consequential action with context | Open, submitting, invalid, completed | Focus is contained, Escape closes when safe, focus returns to its trigger |
| Pending queue | Separate local capture from server confirmation | Unsent, awaiting result, rejected, confirmed | Pending is never represented as a successful stock movement |

## Geometry and density

Typography uses a system font with rem-based sizes. Essential labels and values remain readable without compacting them into metadata size. Tabular numerals are applied to quantities, not to every heading.

Spacing follows a small scale from 4 to 48 CSS pixels at the default root size. The regular control height is at least 44 CSS pixels. Narrow operator layouts use larger quantity and confirmation controls. Compact density reduces row spacing while keeping interactive targets reachable.

The desktop draft puts module navigation on the left and three filter groups above the operational table. A separate page heading establishes the task and receiving action. At intermediate widths filters move into a dialog and modules wrap above the page. Narrow screens use a labeled menu and records that retain product, location, quantities, condition and actions. These revised layouts still require rendered verification.

## Quantity and result language

Use actual units and a consistent locale. Production arithmetic must follow the backend decimal and unit policy. The preview intentionally demonstrates integer receiving only; it does not define precision or rounding for the product.

Use **Penerimaan tercatat; ERP menunggu** only for a known successful local result. Use **Hasil konfirmasi belum diketahui** when a response is lost. Use **Scan pending; stok belum dikonfirmasi** when the request has not been sent. A general failure message cannot replace these distinct states.

## Verification boundaries

The local preview provides presentation and interaction examples. Verification of the current reference implementation is incomplete because browser policy restricted execution. Static checks and the initial captured desktop render have narrower scope. Persistence, authentication, authorization, database idempotency, ERP delivery and scanner hardware remain application requirements and UAT work.
