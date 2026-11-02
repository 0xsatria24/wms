# Multiple selection in Inventory/WMS

The user approved implementing the important functions from the eight proposed areas: item master, stock position, labels, order review, access management, pending requests, ERP events, and the RFID simulation.

Use a dedicated checkbox column and a page-local select-all checkbox. Opening a detail remains independent. Clear selection when user, warehouse, filters, sort, tab or page changes; never act on hidden rows. Keep shared 48px rows, 44px headers, 12px cell padding and existing responsive tables.

Bulk actions have an explicit review with eligible and skipped items, reasons when required, sequential requests, and per-item outcomes. Retain unsuccessful selections. Reuse existing server authorization, versions and validation. Stop after an uncertain network result or lost authorization; never retry automatically. Pending recovery keeps original request identity and separates unsent from unknown outcomes. Approval and release remain separate; physical stock confirmation remains per document.

Provide item activation/deactivation/deletion and label output; stock CSV for selected SKU groups and matching positions; printable label sheets; submit/approve/reject/release for eligible orders; approve/reject/revoke access without granting extra privileges; original pending-request recovery; retry of eligible ERP events; reasoned exclusion of selected RFID observations in the simulation only.

All UI text supports English and Indonesian. Do not claim physical printing, scanner tests, or production validation.
