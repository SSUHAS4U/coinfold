"""Download the site's photography from Pexels and record its provenance.

Pexels Licence: free for commercial use, no attribution required, modification
allowed. The manifest written alongside the files records every source URL so
the provenance of each asset is auditable rather than folklore.

    python scripts/fetch_images.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "img"

# Requested at 1600px wide and compressed by the CDN, which is the largest size
# a full-bleed background needs on a 1920 viewport once it is darkened.
SUFFIX = "?auto=compress&cs=tinysrgb&w=1600"

ASSETS: dict[str, str] = {
    # Hero / coin chapters
    "coin-hero": "https://images.pexels.com/photos/8358039/pexels-photo-8358039.jpeg",
    "coin-stack": "https://images.pexels.com/photos/12198523/pexels-photo-12198523.jpeg",
    "coin-float": "https://images.pexels.com/photos/12198528/pexels-photo-12198528.jpeg",
    "coin-macro": "https://images.pexels.com/photos/14856617/pexels-photo-14856617.jpeg",
    "crypto-dark": "https://images.pexels.com/photos/20534452/pexels-photo-20534452.jpeg",
    # Payment
    "card-tap": "https://images.pexels.com/photos/5239804/pexels-photo-5239804.jpeg",
    "card-hand": "https://images.pexels.com/photos/4968635/pexels-photo-4968635.jpeg",
    "card-desk": "https://images.pexels.com/photos/50987/money-card-business-credit-card-50987.jpeg",
    # Spend categories, for the story chapters
    "market-night": "https://images.pexels.com/photos/16005658/pexels-photo-16005658.jpeg",
    "market-street": "https://images.pexels.com/photos/16247340/pexels-photo-16247340.jpeg",
    # Texture / atmosphere
    "texture-dark": "https://images.pexels.com/photos/6485524/pexels-photo-6485524.jpeg",
    "texture-flow": "https://images.pexels.com/photos/7505924/pexels-photo-7505924.jpeg",
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
            with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
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
        print(f"  {name:<14} {len(data) / 1024:>7.0f} KB")

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
