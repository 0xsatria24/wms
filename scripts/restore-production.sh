#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
archive="${1:?Supply the verified backup archive}"
[[ "${2:-}" == '--replace' && "${3:-}" == 'wms' ]] || { printf '%s\n' 'Restoring replaces the wms database. Supply --replace wms after approving the maintenance window.' >&2; exit 2; }
archive="$(cd -- "$(dirname -- "$archive")" && pwd -P)/$(basename -- "$archive")"
test -s "$archive"
test -s "$archive.sha256"
(cd -- "$(dirname -- "$archive")" && sha256sum -c "$(basename -- "$archive").sha256")
dc() { docker compose --project-directory "$project_root" -f "$project_root/compose.yaml" "$@"; }
dc exec -T db pg_restore --list < "$archive" > /dev/null
dc stop web worker api
dc exec -T db sh -c 'exec pg_restore --clean --if-exists --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$archive"
dc exec -T db sh -c 'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
INSERT INTO "SupportingRecords" ("Id", "CompanyId", "WarehouseId", "Kind", "PayloadJson", "Version")
VALUES ('outbox-recovery-hold', 'demo', '', 'outbox-pause', '{}', 1)
ON CONFLICT ("Id") DO UPDATE SET "Kind" = 'outbox-pause', "Version" = "SupportingRecords"."Version" + 1;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM "StockPositions" WHERE "OnHand" < 0 OR "Committed" < 0 OR "Committed" > "OnHand") THEN
    RAISE EXCEPTION 'Restored stock balances violate inventory invariants';
END IF;
END $$;
SQL
dc up -d api worker web
printf '%s\n' 'Restore completed with outbox held. Reconcile WMS request/event IDs against ERP before releasing delivery.'
