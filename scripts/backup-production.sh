#!/usr/bin/env bash
set -euo pipefail
umask 077
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
backup_dir="${1:?Supply an absolute backup directory on the backup storage}"
[[ "$backup_dir" = /* ]] || { printf '%s\n' 'Backup directory must be absolute.' >&2; exit 2; }
mkdir -p -- "$backup_dir"
backup_dir="$(cd -- "$backup_dir" && pwd -P)"
mountpoint -q -- "$backup_dir" || { printf '%s\n' 'Backup destination must be a mounted backup volume. Verify that its source is off-host.' >&2; exit 2; }
archive="$backup_dir/wms-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
temporary="$archive.tmp"
dc() { docker compose --project-directory "$project_root" -f "$project_root/compose.yaml" "$@"; }
trap 'rm -f -- "$temporary"' EXIT
dc exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$temporary"
test -s "$temporary"
dc exec -T db pg_restore --list < "$temporary" > /dev/null
mv -- "$temporary" "$archive"
(cd -- "$backup_dir" && sha256sum "$(basename -- "$archive")" > "$(basename -- "$archive").sha256")
checksum="$(sha256sum "$archive" | cut -d ' ' -f 1)"
completed="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
dc exec -T db sh -c 'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<SQL
INSERT INTO "SupportingRecords" ("Id", "CompanyId", "WarehouseId", "Kind", "PayloadJson", "Version")
VALUES ('ops-backup', 'demo', '', 'ops-status', '{"completedAt":"$completed","sha256":"$checksum"}', 1)
ON CONFLICT ("Id") DO UPDATE SET "PayloadJson" = EXCLUDED."PayloadJson", "Version" = "SupportingRecords"."Version" + 1;
SQL
printf '%s\n' "$archive"
