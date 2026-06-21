#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
service_root="$repo_root/../diagnosis-demo-service"

mkdir -p "$repo_root/artifacts"
git -C "$service_root" diff -- src > "$repo_root/artifacts/service.diff" || true

if [[ ! -s "$repo_root/artifacts/service.diff" && -f "$service_root/bug-restrict-customer-email.patch" ]]; then
  cp "$service_root/bug-restrict-customer-email.patch" "$repo_root/artifacts/service.diff"
fi

if docker compose -f "$repo_root/docker-compose.yml" ps service >/dev/null 2>&1; then
  docker compose -f "$repo_root/docker-compose.yml" logs --no-color service > "$repo_root/artifacts/service.log" || true
fi
