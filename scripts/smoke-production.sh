#!/usr/bin/env bash
set -euo pipefail
origin="${1:?Supply the HTTPS origin, for example https://warehouse.example.com}"
[[ "$origin" == https://* && "$origin" != */ ]] || { printf '%s\n' 'Supply an HTTPS origin without a trailing slash.' >&2; exit 2; }
session="$(curl --fail --silent --show-error --max-time 15 "$origin/api/session")"
printf '%s' "$session" | python3 -c 'import json,sys; value=json.load(sys.stdin); assert value["mode"]=="oidc"; assert value["user"] is None; assert value["csrfToken"]; assert value["companyName"]'
status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 15 "$origin/api/workspaces/main/snapshot")"
[[ "$status" == 401 ]] || { printf 'Anonymous workspace access returned %s\n' "$status" >&2; exit 1; }
callback="$(curl --silent --show-error --dump-header - --output /dev/null --max-time 15 "$origin/auth/login")"
printf '%s' "$callback" | python3 -c 'import sys,urllib.parse; headers=sys.stdin.read().splitlines(); location=next(row.split(":",1)[1].strip() for row in headers if row.lower().startswith("location:")); values=urllib.parse.parse_qs(urllib.parse.urlsplit(location).query); assert values["redirect_uri"][0].startswith("https://")'
printf '%s\n' 'HTTPS, OIDC redirect, CSRF issuance and anonymous access checks passed. Complete interactive SSO and operational UAT separately.'
