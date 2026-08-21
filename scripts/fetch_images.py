"""Download the site's photography from Pexels and record its provenance.

Pexels Licence: free for commercial use, no attribution required, modification
allowed. The manifest written alongside the files records every source URL, so
the provenance of each asset is auditable rather than folklore.

Every image is checked for third-party branding before it ships. Earlier
candidates were rejected for exactly that — one carried a real VISA Infinite
card with an XP Investimentos logo, another a GENTCREATE wallet. Someone
else's brand has no place in this product.

    python scripts/fetch_images.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "img"

# 1800px is enough for a card that is never full-bleed, and keeps the page
# weight sane. The hero and auth panels take 2400.
def suffix(width: int) -> str:
    return f"?auto=compress&cs=tinysrgb&w={width}"


# Category imagery, one per spending category. Bright and airy to sit on the
# light canvas — the dark set that suited the old near-black theme would fight
# it. Keyed by the category slug the database uses.
CATEGORIES: dict[str, str] = {
    "food-dining": "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
    "travel": "https://images.pexels.com/photos/1008155/pexels-photo-1008155.jpeg",
    "shopping": "https://images.pexels.com/photos/5872361/pexels-photo-5872361.jpeg",
    "groceries": "https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg",
    "health": "https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg",
    "fuel": "https://images.pexels.com/photos/9800029/pexels-photo-9800029.jpeg",
    "education": "https://images.pexels.com/photos/5905445/pexels-photo-5905445.jpeg",
    "entertainment": "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg",
    "utilities": "https://images.pexels.com/photos/3306057/pexels-photo-3306057.jpeg",
    "insurance": "https://images.pexels.com/photos/7731375/pexels-photo-7731375.jpeg",
}

# Editorial imagery for the landing and auth screens.
FEATURE: dict[str, str] = {
    "auth-signin": "https://images.pexels.com/photos/4386370/pexels-photo-4386370.jpeg",
    "auth-signup": "https://images.pexels.com/photos/5900226/pexels-photo-5900226.jpeg",
    "story-pay": "https://images.pexels.com/photos/6963944/pexels-photo-6963944.jpeg",
    "story-review": "https://images.pexels.com/photos/6289065/pexels-photo-6289065.jpeg",
    "story-reward": "https://images.pexels.com/photos/6289028/pexels-photo-6289028.jpeg",
}


# Hero band photography. Full-bleed at 2560 — these carry the whole opening,
# and anything smaller visibly softens on a 1440 display at 2x.
#
# One image per band of the scroll story, chosen so the ENTRANCE can echo what
# the picture is doing (the echo principle): a warm room to open on, a lit
# street for volume, a quiet desk for the sort, gold for the payoff.
HERO: dict[str, str] = {
    "hero-1-evening": "https://images.pexels.com/photos/13663208/pexels-photo-13663208.jpeg",
    "hero-2-street": "https://images.pexels.com/photos/29446768/pexels-photo-29446768.jpeg",
    "hero-3-desk": "https://images.pexels.com/photos/30473581/pexels-photo-30473581.jpeg",
    "hero-4-gold": "https://images.pexels.com/photos/7584362/pexels-photo-7584362.jpeg",
}


def fetch(name: str, url: str, width: int, manifest: dict, failures: list[str]) -> None:
    target = OUT / f"{name}.jpg"
    try:
        request = urllib.request.Request(
            url + suffix(width),
            headers={"User-Agent": "Mozilla/5.0 (coinfold asset fetch)"},
        )
        with urllib.request.urlopen(request, timeout=90) as response:  # noqa: S310
            data = response.read()
    except Exception as exc:  # noqa: BLE001 - report every failure by name
        failures.append(f"{name}: {type(exc).__name__} {exc}")
        return

    target.write_bytes(data)
    manifest[name] = {
        "file": f"/img/{name}.jpg",
        "source": url,
        "provider": "Pexels",
        "licence": "Pexels Licence — free for commercial use, no attribution required",
        "bytes": len(data),
    }
    print(f"  {name:<16} {len(data) / 1024:>7.0f} KB")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict[str, object]] = {}
    failures: list[str] = []

    print("categories:")
    for name, url in CATEGORIES.items():
        fetch(f"cat-{name}", url, 1200, manifest, failures)

    print("\nhero bands:")
    for name, url in HERO.items():
        fetch(name, url, 2560, manifest, failures)

    print("\nfeature:")
    for name, url in FEATURE.items():
        fetch(name, url, 2000, manifest, failures)

    (OUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )

    total = sum(int(v["bytes"]) for v in manifest.values())
    print(f"\n{len(manifest)} images, {total / 1024 / 1024:.1f} MB, in {OUT}")
    if failures:
        print(f"{len(failures)} failed:")
        for line in failures:
            print(f"  {line}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
