#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_EXAMPLE="$ROOT_DIR/.env.example"
ENV_FILE="$ROOT_DIR/.env"

printf "\nRunning post-start checks...\n"

# Start background heartbeat to keep codespace alive
nohup bash -c 'while true; do echo "Heartbeat: $(date)" >> /tmp/keep_alive.log; sleep 600; done' > /dev/null 2>&1 &
printf "Started background heartbeat process\n"

declare -A ENV_FILE_VALUES=()

if [ -f "$ENV_EXAMPLE" ] && [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  printf "Created .env from .env.example\n"
fi

if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^\s*# ]] && continue
    if [[ "$line" =~ ^\s*export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
    elif [[ "$line" =~ ^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
    else
      continue
    fi

    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    ENV_FILE_VALUES["$key"]="$value"
  done < "$ENV_FILE"
fi

get_env_value() {
  local key="$1"
  local value="${!key-}"
  if [[ -z "$value" ]]; then
    value="${ENV_FILE_VALUES[$key]-}"
  fi
  printf "%s" "$value"
}

is_placeholder_value() {
  local value="$1"
  [[ -z "$value" ]] && return 0
  if [[ "$value" =~ ^(your-|your_|YOUR_|replace-|REPLACE_|changeme|CHANGE_ME|TODO|TBD|<.+>) ]]; then
    return 0
  fi
  if [[ "$value" == *"..."* ]]; then
    return 0
  fi
  return 1
}

if [ -f "$ENV_EXAMPLE" ]; then
  missing=()
  placeholders=()

  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^\s*# ]] && continue

    if [[ "$line" =~ ^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      example_value="${BASH_REMATCH[2]}"

      # Treat blank example values as optional.
      if [[ -z "$example_value" ]]; then
        continue
      fi

      env_value="$(get_env_value "$key")"

      if [[ -z "$env_value" ]]; then
        missing+=("$key")
        continue
      fi

      if [[ "$env_value" =~ ^(your-|your_|YOUR_|replace-|REPLACE_|changeme|CHANGE_ME|TODO|TBD|<.+>) ]]; then
        placeholders+=("$key")
      elif [[ "$env_value" == *"..."* ]]; then
        placeholders+=("$key")
      fi
    fi
  done < "$ENV_EXAMPLE"

  if (( ${#missing[@]} > 0 )); then
    printf "WARN: Missing required env vars (not set in env or .env):\n"
    printf "  - %s\n" "${missing[@]}"
  fi

  if (( ${#placeholders[@]} > 0 )); then
    printf "WARN: Env vars look like placeholders (review values):\n"
    printf "  - %s\n" "${placeholders[@]}"
  fi

  if [[ "${ENV_CHECK_STRICT:-0}" == "1" ]] && (( ${#missing[@]} > 0 )); then
    printf "ERROR: ENV_CHECK_STRICT=1 and missing vars were detected.\n"
    exit 1
  fi
fi

if command -v az >/dev/null 2>&1; then
  if ! az account show >/dev/null 2>&1; then
    use_mi="$(get_env_value "AZURE_USE_MANAGED_IDENTITY")"
    client_id="$(get_env_value "AZURE_CLIENT_ID")"
    tenant_id="$(get_env_value "AZURE_TENANT_ID")"
    client_secret="$(get_env_value "AZURE_CLIENT_SECRET")"
    subscription_id="$(get_env_value "AZURE_SUBSCRIPTION_ID")"

    if [[ "$use_mi" =~ ^(1|true|TRUE|yes|YES)$ ]]; then
      if az login --identity >/dev/null 2>&1; then
        printf "Azure CLI authenticated via managed identity.\n"
      fi
    elif [[ -n "$client_id" && -n "$tenant_id" && -n "$client_secret" ]]; then
      if is_placeholder_value "$client_id" || is_placeholder_value "$tenant_id" || is_placeholder_value "$client_secret"; then
        :
      else
      if az login --service-principal -u "$client_id" -p "$client_secret" --tenant "$tenant_id" >/dev/null 2>&1; then
        printf "Azure CLI authenticated via service principal.\n"
      fi
      fi
    fi

    if az account show >/dev/null 2>&1 && [[ -n "$subscription_id" ]]; then
      az account set --subscription "$subscription_id" >/dev/null 2>&1 || true
    fi
  fi
fi

if command -v gh >/dev/null 2>&1; then
  if ! gh auth status -h github.com >/dev/null 2>&1; then
    gh_token="$(get_env_value "GH_TOKEN")"
    if [[ -z "$gh_token" ]]; then
      gh_token="$(get_env_value "GITHUB_TOKEN")"
    fi

    if [[ -n "$gh_token" ]] && ! is_placeholder_value "$gh_token"; then
      printf "%s" "$gh_token" | gh auth login --with-token >/dev/null 2>&1 || true
    fi
  fi
fi

if [ -x "$ROOT_DIR/scripts/ensure-all-access.sh" ]; then
  "$ROOT_DIR/scripts/ensure-all-access.sh" || true
fi

# Synchronize with Key Vault (Single Source of Truth)
if [ -x "$ROOT_DIR/scripts/load-secrets.sh" ]; then
  if az account show >/dev/null 2>&1; then
    bash "$ROOT_DIR/scripts/load-secrets.sh" || true
  else
    printf "\n⚠️ Azure CLI not logged in. Secrets from Key Vault cannot be pulled automatically.\n"
    printf "   Run 'az login' to enable sustainable secret management.\n"
  fi
fi

printf "Post-start checks complete.\n\n"
