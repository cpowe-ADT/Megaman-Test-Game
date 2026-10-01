#!/usr/bin/env python3
"""Cut a Higgsfield parallax layer into a seamless, game-sized background layer (phase 6.P).

Finds the horizontal repeat period the model drew (the column offset where the image best matches itself),
crops one period so the layer tiles without a seam, keys magenta (for layers with sky showing through),
defringes, and downscales by an integer factor with the pixel-art mode filter from hf_sheet_to_atlas.

  .venv/bin/python scripts/sprites/cut_background_layer.py --in assets/backgrounds/source/relay/relay_far_v1.png \
    --out assets/backgrounds/relay/relay_far.png --factor 3 [--key]
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

import hf_sheet_to_atlas as cutter


def column_signature(image: Image.Image, x: int, step: int = 4) -> list[int]:
    px = image.load()
    return [sum(px[x, y][:3]) for y in range(0, image.height, step)]


def find_period(image: Image.Image, lo: int, hi: int) -> tuple[int, float]:
    """The period p in [lo, hi] minimising the mean difference between column x and x + p (sampled)."""
    rgb = image.convert("RGB")
    cols = [column_signature(rgb, x) for x in range(rgb.width)]
    best, best_err = hi, float("inf")
    for p in range(lo, min(hi, rgb.width - 8) + 1):
        xs = range(0, rgb.width - p, 3)
        err = sum(sum(abs(a - b) for a, b in zip(cols[x], cols[x + p])) for x in xs) / max(1, len(xs))
        if err < best_err:
            best, best_err = p, err
    return best, best_err


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--in", dest="input_path", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--factor", type=int, default=3)
    parser.add_argument("--key", action="store_true", help="key the magenta background to transparency")
    parser.add_argument("--min-period", type=int, default=320)
    args = parser.parse_args()

    image = Image.open(args.input_path).convert("RGBA")
    if args.key:
        image = cutter.defringe(cutter.key_magenta(image, 60))
    # At least 300 compared columns: near the full width the error is averaged over too few and wins by accident.
    period, err = find_period(image, args.min_period, image.width - 300)
    # Snap the period to the downscale factor so the cut layer's width is a whole number of game pixels.
    period -= period % args.factor
    tile = image.crop((0, 0, period, image.height))
    small = cutter.decast_image(cutter.hard_alpha(cutter.mode_downscale(tile, 1 / args.factor, colors=40)))
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    small.save(args.out)
    print(f"{args.out}: period {period}px (error {err:.1f}) -> {small.width}x{small.height}")


if __name__ == "__main__":
    main()
