#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

printf "Access checks (tools, logins, resource groups, extensions)\n"

declare -A ENV_FILE_VALUES=()
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

required_tools=(
  az
  gh
  node
  npm
  python3
  pip3
  docker
  func
  azurite
)

missing_tools=()
for tool in "${required_tools[@]}"; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    missing_tools+=("$tool")
  fi
done

if (( ${#missing_tools[@]} > 0 )); then
  printf "WARN: Missing CLI tools: %s\n" "${missing_tools[*]}"
fi

if command -v az >/dev/null 2>&1; then
  if az account show >/dev/null 2>&1; then
    current_sub_id="$(az account show --query id -o tsv 2>/dev/null || true)"
    desired_sub_id="$(get_env_value "AZURE_SUBSCRIPTION_ID")"
    if [[ -n "$desired_sub_id" ]] && [[ -n "$current_sub_id" ]] && [[ "$desired_sub_id" != "$current_sub_id" ]]; then
      printf "WARN: AZURE_SUBSCRIPTION_ID does not match active Azure CLI subscription (%s).\n" "$current_sub_id"
    fi

    rg_vars=(AZURE_RESOURCE_GROUP NBA_RESOURCE_GROUP NCAAM_RESOURCE_GROUP NFL_RESOURCE_GROUP NCAAF_RESOURCE_GROUP)
    for rg_var in "${rg_vars[@]}"; do
      rg_value="$(get_env_value "$rg_var")"
      if [[ -n "$rg_value" ]]; then
        if ! az group show --name "$rg_value" >/dev/null 2>&1; then
          printf "WARN: Azure Resource Group not found or inaccessible: %s=%s\n" "$rg_var" "$rg_value"
        fi
      fi
    done
  else
    printf "WARN: Azure CLI is installed but not authenticated (run: az login).\n"
  fi
fi

if command -v gh >/dev/null 2>&1; then
  if ! gh auth status -h github.com >/dev/null 2>&1; then
    gh_token="$(get_env_value "GH_TOKEN")"
    github_token="$(get_env_value "GITHUB_TOKEN")"
    if [[ -n "$gh_token" || -n "$github_token" ]]; then
      printf "WARN: GitHub CLI not authenticated (token present but not configured). Run: gh auth login --with-token\n"
    else
      printf "WARN: GitHub CLI not authenticated (run: gh auth login).\n"
    fi
  fi
fi

required_extensions=(
  charliermarsh.ruff
  ckolkman.vscode-postgres
  dbaeumer.vscode-eslint
  editorconfig.editorconfig
  esbenp.prettier-vscode
  GitHub.copilot
  GitHub.copilot-chat
  github.vscode-github-actions
  golang.go
  humao.rest-client
  mikestead.dotenv
  ms-azuretools.vscode-azurefunctions
  ms-azuretools.vscode-azure-static-web-apps
  ms-azuretools.vscode-azureresourcegroups
  ms-azuretools.vscode-bicep
  ms-azuretools.vscode-cosmosdb
  ms-azuretools.vscode-docker
  ms-python.python
  ms-python.vscode-pylance
  ms-vscode.azure-account
  ms-vscode.azurecli
  ms-vscode.live-server
  ms-vscode.vscode-node-azure-pack
  redhat.vscode-yaml
  ritwickdey.LiveServer
  rust-lang.rust-analyzer
  Azurite.azurite
)

installed_exts=""
if command -v code >/dev/null 2>&1; then
  installed_exts="$(code --list-extensions 2>/dev/null || true)"
elif [ -d "$HOME/.vscode-server/extensions" ]; then
  installed_exts="$(ls "$HOME/.vscode-server/extensions" 2>/dev/null | sed -E 's/-[0-9].*$//' | sort -u)"
elif [ -d "$HOME/.vscode-remote/extensions" ]; then
  installed_exts="$(ls "$HOME/.vscode-remote/extensions" 2>/dev/null | sed -E 's/-[0-9].*$//' | sort -u)"
fi

if [[ -n "$installed_exts" ]]; then
  missing_exts=()
  for ext in "${required_extensions[@]}"; do
    if ! printf "%s\n" "$installed_exts" | grep -qi -x -F "$ext"; then
      missing_exts+=("$ext")
    fi
  done

  if (( ${#missing_exts[@]} > 0 )); then
    printf "WARN: Missing VS Code extensions (will auto-install in Codespaces):\n"
    printf "  - %s\n" "${missing_exts[@]}"
  fi
else
  printf "INFO: Unable to verify VS Code extensions (code server not detected).\n"
fi

printf "Access checks complete.\n"
