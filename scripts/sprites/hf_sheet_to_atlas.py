#!/usr/bin/env python3
"""Cut a Higgsfield (or any image-model) sprite sheet into a runtime atlas.

The model renders a grid of equal cells on a flat magenta key. This tool keys the magenta,
downsamples each cell to the runtime cell size with hard alpha, quantizes the palette so the
result stays pixel-crisp, aligns every frame to a shared baseline, writes the atlas PNG + JSON in
the repo's `<typeKey>/<anim>/<index>` convention, and upserts the manifest entry.

Example:
  .venv/bin/python scripts/sprites/hf_sheet_to_atlas.py \
    --in assets/sprites/source/bosses/boss_tide_reaver_sheet_hf_v1_20260910_b.png \
    --type-key tide_reaver --category bosses --grid 4x3 --cell 64 \
    --anims "idle=0-3,move=4-7,shoot=8-11" --baseline 60
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MAGENTA = (255, 0, 255)


def key_magenta(cell: Image.Image, tolerance: int) -> Image.Image:
    rgba = cell.convert("RGBA")
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if a and abs(r - MAGENTA[0]) <= tolerance and g <= tolerance + 40 and abs(b - MAGENTA[2]) <= tolerance:
                px[x, y] = (0, 0, 0, 0)
            elif a and r > 150 and b > 150 and g < 120:
                # Magenta fringe around the outline: treat as background.
                px[x, y] = (0, 0, 0, 0)
    return rgba


def quantize_rgba(image: Image.Image, colors: int) -> Image.Image:
    alpha = image.getchannel("A")
    rgb = image.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert("RGBA")
    rgb.putalpha(alpha)
    return rgb


def hard_alpha(image: Image.Image, threshold: int = 110) -> Image.Image:
    px = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a >= threshold else 0)
    return image


def content_bounds(image: Image.Image):
    return image.getchannel("A").point(lambda v: 255 if v > 0 else 0).getbbox()


def cut(args: argparse.Namespace) -> None:
    sheet = Image.open(args.input_path).convert("RGBA")
    cols, rows = (int(v) for v in args.grid.lower().split("x"))
    cell_w, cell_h = sheet.width // cols, sheet.height // rows
    target = int(args.cell)
    anims = []
    for part in args.anims.split(","):
        name, span = part.split("=")
        start, end = (int(v) for v in span.split("-"))
        anims.append((name.strip(), start, end))
    name_by_index = {}
    for name, start, end in anims:
        for i in range(start, end + 1):
            name_by_index[i] = f"{args.type_key}/{name}/{i - start:03d}"

    frames = []
    for index in range(cols * rows):
        c, r = index % cols, index // cols
        cell = sheet.crop((c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h))
        keyed = key_magenta(cell, args.tolerance)
        small = keyed.resize((target, target), Image.Resampling.BOX)
        small = hard_alpha(small)
        small = quantize_rgba(small, args.colors)
        frame = Image.new("RGBA", (target, target), (0, 0, 0, 0))
        bounds = content_bounds(small)
        if bounds:
            content = small.crop(bounds)
            x = max(0, (target - content.width) // 2)
            y = max(0, min(target - content.height, args.baseline - content.height))
            frame.paste(content, (x, y), content)
        frames.append(frame)

    out_dir = ROOT / args.out_dir if args.out_dir else ROOT / "assets" / "sprites" / args.category
    out_dir.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (target * len(frames), target), (0, 0, 0, 0))
    entries = {}
    for i, frame in enumerate(frames):
        atlas.paste(frame, (i * target, 0))
        entries[name_by_index.get(i, f"{args.type_key}/misc/{i:03d}")] = {
            "frame": {"x": i * target, "y": 0, "w": target, "h": target},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": target, "h": target},
            "sourceSize": {"w": target, "h": target},
        }
    image_path = out_dir / f"{args.type_key}.png"
    json_path = out_dir / (f"{args.type_key}.json" if args.category == "bosses" else f"{args.type_key}.atlas.json")
    atlas.save(image_path)
    json.dump({
        "frames": entries,
        "meta": {"app": "scripts/sprites/hf_sheet_to_atlas.py", "version": "1.0", "image": image_path.name,
                 "format": "RGBA8888", "size": {"w": atlas.width, "h": atlas.height}, "scale": "1",
                 "source": str(Path(args.input_path).as_posix()), "generator": args.generator},
    }, json_path.open("w"), indent=2)

    manifest_path = ROOT / args.manifest
    manifest = json.load(manifest_path.open())
    entry_id = f"{'boss' if args.category == 'bosses' else args.category}-{args.type_key.replace('_', '-') if args.category == 'bosses' else args.type_key}"
    atlas_key = f"atlas_{args.type_key}"
    payload = {
        "id": entry_id, "atlasKey": atlas_key, "frame": {"width": target, "height": target}, "status": "ready",
        "source": {
            "runtimeImage": f"/{image_path.relative_to(ROOT).as_posix()}", "runtimeData": f"/{json_path.relative_to(ROOT).as_posix()}",
            "localImagePath": image_path.relative_to(ROOT).as_posix(), "localDataPath": json_path.relative_to(ROOT).as_posix(),
        },
        "notes": f"Original generated sheet ({args.generator}) cut by scripts/sprites/hf_sheet_to_atlas.py from {Path(args.input_path).name}.",
    }
    if args.category == "bosses":
        payload["bossId"] = args.type_key
    existing = next((e for e in manifest["entries"] if e.get("atlasKey") == atlas_key), None)
    if existing:
        existing.update(payload)
    else:
        manifest["entries"].append(payload)
    manifest["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    json.dump(manifest, manifest_path.open("w"), indent=2)
    manifest_path.open("a").write("\n")
    compat = ROOT / "assets" / "sprites" / "manifest.json"
    if compat.exists():
        json.dump(manifest, compat.open("w"), indent=2)
        compat.open("a").write("\n")
    print(f"Wrote {image_path.relative_to(ROOT)} ({len(frames)} frames of {target}px) and updated {args.manifest}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--in", dest="input_path", required=True)
    parser.add_argument("--type-key", dest="type_key", required=True)
    parser.add_argument("--category", default="bosses", choices=["bosses", "enemies", "player", "effects"])
    parser.add_argument("--grid", required=True, help="COLSxROWS, for example 4x3")
    parser.add_argument("--cell", default="64", help="Runtime cell size in pixels (square)")
    parser.add_argument("--anims", required=True, help="name=start-end,... over the cell indices, row-major")
    parser.add_argument("--baseline", type=int, default=60, help="Row the bottom of the content sits on")
    parser.add_argument("--tolerance", type=int, default=60)
    parser.add_argument("--colors", type=int, default=32)
    parser.add_argument("--out-dir", dest="out_dir", default=None)
    parser.add_argument("--manifest", default="assets/sprites/manifest.v1.json")
    parser.add_argument("--generator", default="Higgsfield gpt_image_2")
    cut(parser.parse_args())


if __name__ == "__main__":
    main()
