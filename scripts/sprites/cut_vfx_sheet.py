#!/usr/bin/env python3
"""Cut Higgsfield effect and projectile sheets (square cells on magenta) into one atlas per spec (hero combat v1).

A spec (JSON) names the output atlas and its groups; each group takes cells from a sheet at one scale, so the
relative sizes the model drew within a row survive (a pellet stays smaller than the charged blast). Every frame of
a group gets the same size (the group's largest content plus a pixel of padding), centred, so an animation does not
jitter. Small components are kept: sparks are the effect.

  .venv/bin/python scripts/sprites/cut_vfx_sheet.py --spec scripts/sprites/vfx_hero_v1.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

import hf_sheet_to_atlas as cutter

ROOT = Path(__file__).resolve().parents[2]


def cut_cell(sheet: Image.Image, index: int, cols: int, rows: int, scale: float, inset: float, shift_y: float = 0.0) -> Image.Image:
    cell_w, cell_h = sheet.width / cols, sheet.height / rows
    c, r = index % cols, index // cols
    # shift_y moves the crop box down by a fraction of a cell, for a row the model drew below its cell line
    dy = cell_h * shift_y
    box = (round(c * cell_w + cell_w * inset), max(0, round(r * cell_h + cell_h * inset + dy)),
           round((c + 1) * cell_w - cell_w * inset), min(sheet.height, round((r + 1) * cell_h - cell_h * inset + dy)))
    keyed = cutter.defringe(cutter.key_magenta(sheet.crop(box), 60))
    small = cutter.hard_alpha(cutter.mode_downscale(keyed, scale, colors=32), threshold=90)
    bbox = small.getchannel("A").getbbox()
    return small.crop(bbox) if bbox else Image.new("RGBA", (1, 1), (0, 0, 0, 0))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--spec", required=True)
    args = parser.parse_args()
    spec = json.loads(Path(args.spec).read_text())
    sheets: dict[str, Image.Image] = {}
    frames: list[tuple[str, Image.Image]] = []
    for group in spec["groups"]:
        path = group["sheet"]
        if path not in sheets:
            sheets[path] = Image.open(ROOT / path).convert("RGBA")
        cols, rows = cutter.parse_grid(group.get("grid", "4x4"))
        cuts = [cut_cell(sheets[path], i, cols, rows, group["scale"], group.get("inset", 0.02), group.get("shiftY", 0.0)) for i in group["cells"]]
        if "size" in group:  # a tile that must repeat exactly (for example 16x16): resize the cut content to it
            cuts = [c.resize(tuple(group["size"]), Image.Resampling.NEAREST) for c in cuts]
        pad = group.get("pad", 1)  # 0 for tiles that repeat edge to edge (slag surface and fill)
        w = max(c.width for c in cuts) + 2 * pad
        h = max(c.height for c in cuts) + 2 * pad
        if pad:
            w, h = w + (w % 2), h + (h % 2)
        align = group.get("align", "center")  # "bottom": a floor hazard keeps its base on the frame's bottom row
        for i, content in enumerate(cuts):
            frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            y = h - pad - content.height if align == "bottom" else (h - content.height) // 2
            frame.paste(content, ((w - content.width) // 2, y), content)
            frames.append((f"{spec['key']}/{group['name']}/{i:03d}", frame))

    # Shelf packing, rows of at most `width` pixels.
    width = spec.get("atlasWidth", 256)
    x = y = shelf = 0
    placed = []
    for name, frame in frames:
        if x + frame.width > width:
            x, y, shelf = 0, y + shelf, 0
        placed.append((name, frame, x, y))
        x += frame.width
        shelf = max(shelf, frame.height)
    atlas = Image.new("RGBA", (width, y + shelf), (0, 0, 0, 0))
    entries = {}
    for name, frame, fx, fy in placed:
        atlas.paste(frame, (fx, fy))
        entries[name] = {"frame": {"x": fx, "y": fy, "w": frame.width, "h": frame.height}, "rotated": False,
                         "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": frame.width, "h": frame.height},
                         "sourceSize": {"w": frame.width, "h": frame.height}}
    out_dir = ROOT / spec["outDir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    image_path = out_dir / f"{spec['key']}.png"
    json_path = out_dir / f"{spec['key']}.atlas.json"
    atlas.save(image_path)
    json.dump({"frames": entries, "meta": {"app": "scripts/sprites/cut_vfx_sheet.py", "version": "1.0", "image": image_path.name,
               "format": "RGBA8888", "size": {"w": atlas.width, "h": atlas.height}, "scale": "1",
               "source": sorted(sheets), "generator": "Higgsfield gpt_image_2", "spec": Path(args.spec).as_posix()}},
              json_path.open("w"), indent=2)
    sizes = {}
    for name, frame, _, _ in placed:
        sizes.setdefault(name.rsplit("/", 1)[0], f"{frame.width}x{frame.height}")
    print(f"Wrote {image_path.relative_to(ROOT)} {atlas.size}: " + ", ".join(f"{k.split('/', 1)[1]} {v}" for k, v in sizes.items()))


if __name__ == "__main__":
    main()
