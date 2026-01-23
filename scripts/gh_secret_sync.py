#!/usr/bin/env python3

import argparse
import getpass
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


def run(cmd, check=True):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result.stdout


def detect_repo():
    repo = os.environ.get("GITHUB_REPOSITORY")
    if repo:
        return repo

    try:
        remote = run(["git", "remote", "get-url", "origin"], check=False).strip()
    except Exception:
        return None

    if not remote:
        return None

    # Handle git@github.com:owner/repo.git or https://github.com/owner/repo.git
    match = re.search(r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/.]+)", remote)
    if match:
        return f"{match.group('owner')}/{match.group('repo')}"

    return None


def list_secrets(app, repo):
    output = run(["gh", "secret", "list", "--app", app, "--json", "name", "--repo", repo])
    if not output.strip():
        return []
    data = json.loads(output)
    return [item["name"] for item in data]


def load_env_lines(env_path):
    if not env_path.exists():
        return [], {}

    lines = env_path.read_text().splitlines()
    key_index = {}
    for idx, line in enumerate(lines):
        match = re.match(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
        if match:
            key_index[match.group(1)] = idx
    return lines, key_index


def format_value(value):
    if re.search(r"\s|#", value):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f"\"{escaped}\""
    return value


def main():
    parser = argparse.ArgumentParser(
        description="Sync GitHub secrets into a local .env file for development."
    )
    parser.add_argument(
        "--repo",
        default=None,
        help="GitHub repo in owner/name format. Defaults to GITHUB_REPOSITORY or git origin.",
    )
    parser.add_argument(
        "--apps",
        default="actions,codespaces",
        help="Comma-separated apps to pull secrets from (actions,codespaces).",
    )
    parser.add_argument(
        "--env",
        default=".env",
        help="Path to .env file to write.",
    )
    parser.add_argument(
        "--env-example",
        default=".env.example",
        help="Path to .env.example file for bootstrap if .env is missing.",
    )
    args = parser.parse_args()

    if shutil.which("gh") is None:
        print("ERROR: GitHub CLI (gh) is required. Install it or run in the devcontainer.")
        sys.exit(1)

    repo = args.repo or detect_repo()
    if not repo:
        print("ERROR: Could not determine GitHub repo. Use --repo owner/name.")
        sys.exit(1)

    apps = [app.strip() for app in args.apps.split(",") if app.strip()]
    env_path = Path(args.env).expanduser()
    env_example_path = Path(args.env_example).expanduser()

    if not env_path.exists() and env_example_path.exists():
        env_path.write_text(env_example_path.read_text())
        print(f"Created {env_path} from {env_example_path}.")

    env_lines, key_index = load_env_lines(env_path)

    secret_names = set()
    for app in apps:
        try:
            names = list_secrets(app, repo)
            secret_names.update(names)
        except Exception as exc:
            print(f"WARN: Failed to list {app} secrets: {exc}")

    if not secret_names:
        print("WARN: No secrets found. Check GH auth or repo permissions.")
        sys.exit(1)

    updated = False
    for name in sorted(secret_names):
        existing_value = None
        if name in key_index:
            line = env_lines[key_index[name]]
            match = re.match(r"^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)$", line)
            if match:
                existing_value = match.group(1).strip().strip('"').strip("'")

        if existing_value:
            continue

        value = getpass.getpass(f"Enter value for {name} (leave blank to skip): ")
        if not value:
            continue

        formatted_value = format_value(value)
        new_line = f"{name}={formatted_value}"

        if name in key_index:
            env_lines[key_index[name]] = new_line
        else:
            env_lines.append(new_line)
            key_index[name] = len(env_lines) - 1

        updated = True

    if updated:
        env_path.write_text("\n".join(env_lines) + "\n")
        print(f"Updated {env_path} with GitHub secrets.")
    else:
        print("INFO: No updates made; .env already had values for listed secrets.")


if __name__ == "__main__":
    main()
