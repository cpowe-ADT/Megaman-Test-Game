#!/usr/bin/env python3
"""Make a palette skin of an enemy atlas: a hue, saturation and value shift under a new type key (prompt 12 part 12c).

Frame names are renamed (`<base>/idle/000` -> `<skin>/idle/000`), sizes and positions kept, alpha untouched. Pixels
whose hue falls in `--keep-hue` (for example the orange seams, 10-45 degrees) keep their colour, so a skin changes
the plating and leaves the tell colours alone.

  .venv/bin/python scripts/sprites/palette_skin.py --base custodian_walker --skin custodian_walker_basalt \
      --hue 0 --sat 0.35 --val 0.95 --keep-hue 10:45
"""
from __future__ import annotations

import argparse
import colorsys
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def shift_pixel(r: int, g: int, b: int, hue: float, sat: float, val: float, tint: tuple[float, float, float] | None,
                keep: tuple[float, float] | None) -> tuple[int, int, int]:
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if keep and s > 0.25 and keep[0] <= h * 360 <= keep[1]:
        return r, g, b
    h = (h + hue / 360) % 1.0
    s = max(0.0, min(1.0, s * sat))
    v = max(0.0, min(1.0, v * val))
    nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
    if tint:
        # Blend towards a tint by luminance, for skins whose base is grey (stone, ice).
        lum = 0.299 * nr + 0.587 * ng + 0.114 * nb
        amount = 0.45
        nr = nr * (1 - amount) + tint[0] * lum * amount * 1.4
        ng = ng * (1 - amount) + tint[1] * lum * amount * 1.4
        nb = nb * (1 - amount) + tint[2] * lum * amount * 1.4
    return tuple(max(0, min(255, round(c * 255))) for c in (nr, ng, nb))  # type: ignore[return-value]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", required=True, help="enemy type key under assets/sprites/enemies/")
    parser.add_argument("--skin", required=True, help="the new type key")
    parser.add_argument("--hue", type=float, default=0.0, help="degrees")
    parser.add_argument("--sat", type=float, default=1.0)
    parser.add_argument("--val", type=float, default=1.0)
    parser.add_argument("--tint", default=None, help="r,g,b in 0..1 blended by luminance (for grey bases)")
    parser.add_argument("--keep-hue", default=None, help="lo:hi degrees kept as drawn (the tell colours)")
    args = parser.parse_args()
    src_dir = ROOT / "assets" / "sprites" / "enemies" / args.base
    out_dir = ROOT / "assets" / "sprites" / "enemies" / args.skin
    out_dir.mkdir(parents=True, exist_ok=True)
    atlas = json.load((src_dir / f"{args.base}.atlas.json").open())
    image = Image.open(src_dir / f"{args.base}.png").convert("RGBA")
    tint = tuple(float(x) for x in args.tint.split(",")) if args.tint else None
    keep = tuple(float(x) for x in args.keep_hue.split(":")) if args.keep_hue else None
    px = image.load()
    cache: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            key = (r, g, b)
            if key not in cache:
                cache[key] = shift_pixel(r, g, b, args.hue, args.sat, args.val, tint, keep)  # type: ignore[arg-type]
            px[x, y] = (*cache[key], a)
    image.save(out_dir / f"{args.skin}.png")
    frames = {name.replace(f"{args.base}/", f"{args.skin}/", 1): entry for name, entry in atlas["frames"].items()}
    meta = dict(atlas.get("meta", {}))
    meta.update({"image": f"{args.skin}.png", "paletteSkinOf": args.base, "app": "scripts/sprites/palette_skin.py",
                 "paletteSkin": {"hue": args.hue, "sat": args.sat, "val": args.val, "tint": args.tint, "keepHue": args.keep_hue}})
    json.dump({"frames": frames, "meta": meta}, (out_dir / f"{args.skin}.atlas.json").open("w"), indent=2)
    print(f"{args.skin}: {len(frames)} frames from {args.base} (hue {args.hue}, sat {args.sat}, val {args.val}, tint {args.tint}, keep {args.keep_hue})")


if __name__ == "__main__":
    main()
