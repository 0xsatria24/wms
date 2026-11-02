#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
[[ "${1:-}" == '--reconciled' && -n "${2:-}" ]] || { printf '%s\n' 'Supply --reconciled and the reconciliation reference after ERP/WMS reconciliation is approved.' >&2; exit 2; }
docker compose --project-directory "$project_root" -f "$project_root/compose.yaml" exec -T db sh -c 'exec psql -v ON_ERROR_STOP=1 -v "reference=$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB"' sh "$2" <<'SQL'
BEGIN;
INSERT INTO "Audit" ("Id", "TransactionId", "WarehouseId", "PrincipalId", "Action", "DetailJson", "PostedAt")
SELECT gen_random_uuid(), 'RECOVERY-' || gen_random_uuid()::text, w."Id", 'deployment-operator', 'outbox-recovery-release', jsonb_build_object('reconciliationReference', :'reference'), now()
FROM "Warehouses" w WHERE w."Id" <> 'transit';
DELETE FROM "SupportingRecords" WHERE "Id" = 'outbox-recovery-hold' AND "Kind" = 'outbox-pause';
COMMIT;
SQL
printf '%s\n' 'Recovery hold removed. ERP_DISPATCH_PAUSED remains an independent delivery hold.'
