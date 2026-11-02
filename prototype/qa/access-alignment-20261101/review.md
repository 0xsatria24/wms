# Access table alignment, 1 November 2026

Result: passed for this scoped visual fix.

The supplied Access management screenshot showed left-aligned Role/Status/Actions headers, right-aligned action buttons and mid-word badge wrapping. The Access panel now has a scoped class: Role, Warehouse access, Status and Actions headers/cells are centered at desktop/tablet widths; Name and Work email remain left aligned. Explicit column proportions reserve space for badges and row actions. Badges wrap at word boundaries, and action buttons are centered in their column.

Browser evidence: `desktop.png`, `pending-desktop.png`, `pending-phone.png`, `checks.json` and `phone-checks.json`. All four targeted column headers and values have computed `text-align: center`. Active and supervisor each occupy one text line. Pending approvals retain the complete Awaiting approval label. Phone document width and scroll width both equal 375px. Browser console error log was empty. TypeScript checking and `git diff --check` passed. No access decision or user mutation was performed.

The existing responsive record layout is retained below 768px. This is a table layout correction, not full accessibility or access-workflow validation. Other in-progress changes in the working tree were preserved.
