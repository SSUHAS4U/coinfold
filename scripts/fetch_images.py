"""Download the site's photography from Pexels and record its provenance.

Pexels Licence: free for commercial use, no attribution required, modification
allowed. The manifest written alongside the files records every source URL, so
the provenance of each asset is auditable rather than folklore.

Fetched at 2400px wide: these are full-bleed backgrounds on displays up to
1920 logical pixels, often at 2x DPR, so anything smaller visibly softens.

    python scripts/fetch_images.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "img"

# 2400px, minimal compression. These carry the whole visual weight of the site.
SUFFIX = "?auto=compress&cs=tinysrgb&w=2400"

ASSETS: dict[str, str] = {
    # --- Landing scroll story, in narrative order --------------------------
    # Every image is checked for third-party branding before it ships. Two
    # earlier candidates were rejected for exactly that: one carried a real
    # VISA Infinite card with an XP Investimentos logo, another a "GENTCREATE"
    # wallet. Someone else's brand has no place in this product's hero.
    #
    # 1. The coin, spotlit on black. The product's own symbol.
    "story-1-coin": "https://images.pexels.com/photos/14856617/pexels-photo-14856617.jpeg",
    # 2. Where the money goes: the city, after dark.
    "story-2-city": "https://images.pexels.com/photos/26732100/pexels-photo-26732100.jpeg",
    # 3. The sorting: abstract, warm, no subject to argue with the type.
    "story-3-flow": "https://images.pexels.com/photos/21031387/pexels-photo-21031387.jpeg",
    # 4. The payoff: coins, many of them.
    "story-4-coins": "https://images.pexels.com/photos/7584354/pexels-photo-7584354.jpeg",

    # --- Auth ---------------------------------------------------------------
    "auth-signin": "https://images.pexels.com/photos/8358039/pexels-photo-8358039.jpeg",
    "auth-signup": "https://images.pexels.com/photos/7584362/pexels-photo-7584362.jpeg",

    # --- App chrome ---------------------------------------------------------
    "app-banner": "https://images.pexels.com/photos/28795083/pexels-photo-28795083.jpeg",
}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict[str, object]] = {}
    failures: list[str] = []

    for name, url in ASSETS.items():
        target = OUT / f"{name}.jpg"
        try:
            request = urllib.request.Request(
                url + SUFFIX,
                headers={"User-Agent": "Mozilla/5.0 (coinfold asset fetch)"},
            )
            with urllib.request.urlopen(request, timeout=90) as response:  # noqa: S310
                data = response.read()
        except Exception as exc:  # noqa: BLE001 - report every failure by name
            failures.append(f"{name}: {type(exc).__name__} {exc}")
            continue

        target.write_bytes(data)
        manifest[name] = {
            "file": f"/img/{name}.jpg",
            "source": url,
            "provider": "Pexels",
            "licence": "Pexels Licence — free for commercial use, no attribution required",
            "bytes": len(data),
        }
        print(f"  {name:<16} {len(data) / 1024:>7.0f} KB")

    (OUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )

    print(f"\n{len(manifest)} images in {OUT}")
    if failures:
        print(f"{len(failures)} failed:")
        for line in failures:
            print(f"  {line}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
