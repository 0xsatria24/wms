# Operational dates and times

Implement the placements approved in chat: live warehouse clock; document dates and schedules; document lifecycle times; stock ledger occurrence/posting; count lifecycle; dashboard period; report period/generation; pending capture and server acknowledgement.

Use existing React/.NET/PostgreSQL architecture. Store instants in UTC and date-only fields without timezone conversion. Display instants in the configured warehouse timezone with explicit zone labels. Existing documents retain null unknown dates. Keep capture, occurrence, posting, document date and schedule distinct. Schedule/date edits require supervisor access, version checks and audit. No inventory mutations from date edits. Period filtering happens before server pagination. Stock snapshots remain current; dashboard period applies to activity only.

Approach: persisted document metadata plus shared frontend formatting, rather than cosmetic timestamps or dates inferred from IDs. Add nullable columns with a migration; stamp future lifecycle transitions on server. Preserve blind-count and idempotency behavior.

Validation: date/time unit tests, timezone boundary tests, backend date permissions/concurrency/lifecycle tests, frontend typecheck/build and browser review. Local checks are development evidence only.
