#!/usr/bin/env python3
"""Cut a Higgsfield tileset sheet (one enlarged tile per grid cell) into a 16px tile atlas (phase 6.P).

Each cell is cropped with a small inset (the model draws a dark border between cells), keyed on magenta where the
tile has transparency, defringed, downscaled with the pixel-art mode filter from hf_sheet_to_atlas, and packed into
`assets/sprites/tiles/<biome>/tiles_<biome>.{png,atlas.json}` with the frame names the engine's tile contract uses
(`src/stage/tileSkin.ts`).

Example:
  .venv/bin/python scripts/sprites/cut_tileset.py --in assets/sprites/source/tiles/tiles_relay_v1_a.png \
    --biome relay --grid 6x4 --names "ground_top_0,ground_top_1,..."
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

import hf_sheet_to_atlas as cutter

ROOT = Path(__file__).resolve().parents[2]


def inset_rect(index: int, cols: int, cell_w: float, cell_h: float, inset: float) -> tuple[int, int, int, int]:
    """The crop box of cell `index` shrunk by `inset` (a fraction of the cell) on every side."""
    c, r = index % cols, index // cols
    dx, dy = cell_w * inset, cell_h * inset
    return (round(c * cell_w + dx), round(r * cell_h + dy), round((c + 1) * cell_w - dx), round((r + 1) * cell_h - dy))


def cut_tile(sheet: Image.Image, box: tuple[int, int, int, int], tile: int, tolerance: int) -> Image.Image:
    cell = cutter.defringe(cutter.key_magenta(sheet.crop(box), tolerance))
    scale = tile / max(cell.width, cell.height)
    small = cutter.mode_downscale(cell, scale, colors=24)
    small = cutter.decast_image(cutter.hard_alpha(small))
    out = Image.new("RGBA", (tile, tile), (0, 0, 0, 0))
    out.paste(small.resize((tile, tile), Image.Resampling.NEAREST) if small.size != (tile, tile) else small, (0, 0))
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--in", dest="input_path", required=True)
    parser.add_argument("--biome", required=True)
    parser.add_argument("--grid", required=True, help="COLSxROWS")
    parser.add_argument("--names", required=True, help="comma-separated frame names, row-major; '-' skips a cell, 'a|b' gives one cell two names")
    parser.add_argument("--tile", type=int, default=16)
    parser.add_argument("--inset", type=float, default=0.035)
    parser.add_argument("--tolerance", type=int, default=60)
    parser.add_argument("--columns", type=int, default=8)
    args = parser.parse_args()

    sheet = Image.open(args.input_path).convert("RGBA")
    cols, rows = cutter.parse_grid(args.grid)
    cell_w, cell_h = sheet.width / cols, sheet.height / rows
    names = [n.strip() for n in args.names.split(",")]
    tiles: list[tuple[str, Image.Image]] = []
    for index, name in enumerate(names[: cols * rows]):
        if name in ("", "-"):
            continue
        tile = cut_tile(sheet, inset_rect(index, cols, cell_w, cell_h, args.inset), args.tile, args.tolerance)
        for alias in name.split("|"):  # one cell may serve two frame names (a plain fill used for two variants)
            tiles.append((alias, tile))

    t = args.tile
    atlas_rows = (len(tiles) + args.columns - 1) // args.columns
    atlas = Image.new("RGBA", (args.columns * t, max(1, atlas_rows) * t), (0, 0, 0, 0))
    frames = {}
    for i, (name, tile) in enumerate(tiles):
        x, y = (i % args.columns) * t, (i // args.columns) * t
        atlas.paste(tile, (x, y))
        frames[name] = {"frame": {"x": x, "y": y, "w": t, "h": t}, "rotated": False, "trimmed": False,
                        "spriteSourceSize": {"x": 0, "y": 0, "w": t, "h": t}, "sourceSize": {"w": t, "h": t}}
    atlas = cutter.quantize_with_fixed(atlas, 32, cutter.HERO_FIXED_PALETTE[:3])

    out_dir = ROOT / "assets" / "sprites" / "tiles" / args.biome
    out_dir.mkdir(parents=True, exist_ok=True)
    image_path = out_dir / f"tiles_{args.biome}.png"
    json_path = out_dir / f"tiles_{args.biome}.atlas.json"
    atlas.save(image_path)
    json.dump({"frames": frames, "meta": {"app": "scripts/sprites/cut_tileset.py", "version": "1.0", "image": image_path.name,
               "format": "RGBA8888", "size": {"w": atlas.width, "h": atlas.height}, "scale": "1",
               "source": Path(args.input_path).as_posix(), "generator": "Higgsfield gpt_image_2"}},
              json_path.open("w"), indent=2)
    print(f"Wrote {image_path.relative_to(ROOT)} ({len(tiles)} tiles of {t}px)")


if __name__ == "__main__":
    main()
