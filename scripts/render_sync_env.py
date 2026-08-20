"""Push environment variables to the Render service, then optionally deploy.

Saves hand-typing secrets into the Render dashboard. Reads a local, gitignored
env file; the Render credentials themselves are never uploaded.

    RENDER_API_KEY=<key> python scripts/render_sync_env.py
    RENDER_API_KEY=<key> python scripts/render_sync_env.py --deploy

Create an API key at https://dashboard.render.com/u/settings#api-keys
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.render.com/v1"
ENV_PATH = Path(__file__).resolve().parents[1] / "apps" / "api" / ".env"

# Tooling and platform-managed keys that must never be uploaded.
EXCLUDE = {"RENDER_API_KEY", "RENDER_SERVICE_ID", "RENDER_SERVICE_NAME", "PORT"}


def parse_env(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value
    return values


def call(path: str, token: str, method: str = "GET", body: dict | list | None = None):
    request = urllib.request.Request(
        f"{API}{path}",
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if body is not None else {}),
        },
        data=json.dumps(body).encode() if body is not None else None,
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
            payload = response.read().decode()
            return json.loads(payload) if payload else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()[:400]
        raise SystemExit(f"Render API {method} {path} -> {exc.code}: {detail}") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deploy", action="store_true", help="trigger a deploy after syncing")
    parser.add_argument("--env-file", type=Path, default=ENV_PATH)
    args = parser.parse_args()

    if not args.env_file.exists():
        raise SystemExit(f"No env file at {args.env_file}. Copy .env.example and fill it in.")

    file_env = parse_env(args.env_file.read_text(encoding="utf-8"))
    token = os.environ.get("RENDER_API_KEY") or file_env.get("RENDER_API_KEY")
    if not token:
        raise SystemExit(
            "RENDER_API_KEY is not set. Export it, or add it to the env file.\n"
            "Create one at https://dashboard.render.com/u/settings#api-keys"
        )

    service_id = os.environ.get("RENDER_SERVICE_ID") or file_env.get("RENDER_SERVICE_ID")
    wanted_name = (
        os.environ.get("RENDER_SERVICE_NAME") or file_env.get("RENDER_SERVICE_NAME") or "coinfold-api"
    )

    if not service_id:
        services = call("/services?limit=100", token) or []
        matches = [s["service"] for s in services if s["service"]["name"] == wanted_name]
        if not matches:
            names = ", ".join(sorted(s["service"]["name"] for s in services)) or "(none)"
            raise SystemExit(f"No Render service named {wanted_name!r}. Found: {names}")
        service_id = matches[0]["id"]

    payload = [
        {"key": key, "value": value}
        for key, value in sorted(file_env.items())
        if key not in EXCLUDE and value
    ]
    if not payload:
        raise SystemExit("Nothing to upload: the env file has no non-excluded values.")

    call(f"/services/{service_id}/env-vars", token, method="PUT", body=payload)
    # Names only. Values are never printed.
    print(f"Synced {len(payload)} variables to {service_id}:")
    for item in payload:
        print(f"  {item['key']}")

    if args.deploy:
        deploy = call(f"/services/{service_id}/deploys", token, method="POST", body={})
        print(f"\nDeploy triggered: {deploy.get('id') if deploy else 'ok'}")
    else:
        print("\nRender auto-deploys on env change. Pass --deploy to force one.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
