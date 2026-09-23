#!/usr/bin/env python3
"""Slice a concept sheet into a Phaser atlas and register it in sprite manifest.

Usage example:
python3 tools/sprites/slice_sheet_to_atlas.py \
  --in assets/sprites/source/enemies/enemy_gunner_bot_sheet_v1_20260207_202115.png \
  --out assets/sprites/enemies/enemy_gunner_bot \
  --typeKey enemy_gunner_bot \
  --grid 8x6 \
  --anims "idle=0-5,run=6-13,attack=14-19"
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

from PIL import Image


BOSS_IDS = {
    "sentinel_rook",
    "pyro_maw",
    "tide_reaver",
    "volt_hopper",
    "basalt_titan",
    "ferro_blade",
    "mire_wraith",
    "gale_vixen",
    "glacier_ronin",
}


@dataclass(frozen=True)
class FrameRect:
    x: int
    y: int
    w: int
    h: int


def parse_grid(raw: str) -> Tuple[int, int]:
    match = re.fullmatch(r"\s*(\d+)x(\d+)\s*", raw)
    if not match:
        raise ValueError(f"Invalid --grid value '{raw}'. Expected CxR (example 8x6).")
    cols, rows = int(match.group(1)), int(match.group(2))
    if cols <= 0 or rows <= 0:
        raise ValueError("--grid must use positive integers.")
    return cols, rows


def parse_cell(raw: str) -> Tuple[int, int]:
    return parse_grid(raw)


def parse_slices(raw: str) -> List[FrameRect]:
    parts = [part.strip() for part in raw.split(";") if part.strip()]
    if not parts:
        raise ValueError("--slice must contain at least one x,y,w,h rectangle.")
    rects: List[FrameRect] = []
    for part in parts:
        values = [v.strip() for v in part.split(",")]
        if len(values) != 4:
            raise ValueError(f"Invalid slice '{part}'. Expected x,y,w,h.")
        x, y, w, h = map(int, values)
        if w <= 0 or h <= 0:
            raise ValueError(f"Invalid slice '{part}'. Width and height must be > 0.")
        rects.append(FrameRect(x=x, y=y, w=w, h=h))
    return rects


def build_grid_rects(image_w: int, image_h: int, cols: int, rows: int) -> List[FrameRect]:
    if image_w % cols != 0 or image_h % rows != 0:
        raise ValueError(
            f"Image size {image_w}x{image_h} is not divisible by grid {cols}x{rows}. "
            "Use --cell or --slice if frames are irregular."
        )
    frame_w = image_w // cols
    frame_h = image_h // rows
    return build_cell_rects(image_w, image_h, frame_w, frame_h)


def build_cell_rects(image_w: int, image_h: int, frame_w: int, frame_h: int) -> List[FrameRect]:
    if frame_w <= 0 or frame_h <= 0:
        raise ValueError("--cell width and height must be > 0.")
    cols = image_w // frame_w
    rows = image_h // frame_h
    rects: List[FrameRect] = []
    for row in range(rows):
        for col in range(cols):
            x = col * frame_w
            y = row * frame_h
            if x + frame_w <= image_w and y + frame_h <= image_h:
                rects.append(FrameRect(x=x, y=y, w=frame_w, h=frame_h))
    if not rects:
        raise ValueError("No frames generated. Check --cell values for the source image.")
    return rects


def parse_anims(raw: str) -> List[Tuple[str, int, int]]:
    result: List[Tuple[str, int, int]] = []
    chunks = [chunk.strip() for chunk in raw.split(",") if chunk.strip()]
    for chunk in chunks:
        if "=" not in chunk:
            raise ValueError(f"Invalid anim chunk '{chunk}'. Expected name=start-end.")
        name, rng = chunk.split("=", 1)
        match = re.fullmatch(r"\s*(\d+)\s*-\s*(\d+)\s*", rng)
        if not match:
            raise ValueError(f"Invalid range '{rng}' in '{chunk}'. Expected start-end.")
        start, end = int(match.group(1)), int(match.group(2))
        if end < start:
            raise ValueError(f"Invalid range '{rng}' in '{chunk}': end < start.")
        result.append((name.strip(), start, end))
    return result


def build_frame_name_map(type_key: str, frame_count: int, anim_spec: Sequence[Tuple[str, int, int]]) -> Dict[int, str]:
    mapping: Dict[int, str] = {}
    for anim_name, start, end in anim_spec:
        if start >= frame_count:
            continue
        bounded_end = min(end, frame_count - 1)
        for i in range(start, bounded_end + 1):
            local_index = i - start
            mapping[i] = f"{type_key}/{anim_name}/{local_index:03d}"
    for i in range(frame_count):
        if i not in mapping:
            mapping[i] = f"{type_key}/misc/{i:03d}"
    return mapping


def infer_category(out_dir: Path) -> str:
    parts = out_dir.as_posix().split("/")
    if "sprites" in parts:
        idx = parts.index("sprites")
        if idx + 1 < len(parts):
            return parts[idx + 1]
    return "enemies"


def relative_from_root(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def load_manifest(manifest_path: Path) -> dict:
    if not manifest_path.exists():
        return {"version": "1", "generatedAt": "", "entries": []}
    with manifest_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def upsert_manifest_entry(
    manifest: dict,
    *,
    category: str,
    type_key: str,
    frame_w: int,
    frame_h: int,
    runtime_image: str,
    runtime_data: str,
    local_image: str,
    local_data: str,
) -> None:
    if "entries" not in manifest or not isinstance(manifest["entries"], list):
        manifest["entries"] = []

    entry_id = f"{category}-{type_key}"
    atlas_key = f"atlas_{type_key}"
    existing = None
    for entry in manifest["entries"]:
        if entry.get("id") == entry_id or entry.get("atlasKey") == atlas_key:
            existing = entry
            break

    payload = {
        "id": entry_id,
        "atlasKey": atlas_key,
        "frame": {"width": frame_w, "height": frame_h},
        "status": "ready",
        "source": {
            "runtimeImage": runtime_image,
            "runtimeData": runtime_data,
            "localImagePath": local_image,
            "localDataPath": local_data,
        },
        "notes": "Generated via tools/sprites/slice_sheet_to_atlas.py",
    }
    if category == "bosses" and type_key in BOSS_IDS:
        payload["bossId"] = type_key

    if existing is None:
        manifest["entries"].append(payload)
    else:
        existing.update(payload)

    manifest["version"] = "1"
    manifest["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")


def write_manifest(path: Path, manifest: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Slice concept sheets into Phaser atlas files.")
    parser.add_argument("--in", dest="input_path", required=True, help="Input concept PNG path.")
    parser.add_argument("--out", dest="out_dir", required=True, help="Output folder for atlas files.")
    parser.add_argument("--typeKey", dest="type_key", required=True, help="Type key (example enemy_gunner_bot).")
    parser.add_argument("--grid", dest="grid", default=None, help="Grid definition CxR (example 8x6).")
    parser.add_argument("--cell", dest="cell", default=None, help="Cell size WxH (example 64x64).")
    parser.add_argument("--slice", dest="slice_spec", default=None, help="Semicolon list x,y,w,h;...")
    parser.add_argument("--anims", dest="anims", default="", help="Anim mapping string.")
    parser.add_argument("--manifest", dest="manifest_path", default="assets/sprites/manifest.v1.json")

    args = parser.parse_args()

    input_path = Path(args.input_path).expanduser().resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    if input_path.suffix.lower() != ".png":
        raise ValueError("Input must be a PNG file.")

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    selectors = [bool(args.grid), bool(args.cell), bool(args.slice_spec)]
    if sum(1 for value in selectors if value) != 1:
        raise ValueError("Specify exactly one of --grid, --cell, or --slice.")

    image = Image.open(input_path).convert("RGBA")
    image_w, image_h = image.size

    if args.grid:
        cols, rows = parse_grid(args.grid)
        rects = build_grid_rects(image_w, image_h, cols, rows)
    elif args.cell:
        cell_w, cell_h = parse_cell(args.cell)
        rects = build_cell_rects(image_w, image_h, cell_w, cell_h)
    else:
        rects = parse_slices(args.slice_spec)

    if not rects:
        raise ValueError("No frames parsed from input.")

    frame_w = rects[0].w
    frame_h = rects[0].h
    for rect in rects:
        if rect.w != frame_w or rect.h != frame_h:
            raise ValueError("All frames must share the same size for current atlas workflow.")
        if rect.x < 0 or rect.y < 0 or rect.x + rect.w > image_w or rect.y + rect.h > image_h:
            raise ValueError(f"Frame out of bounds: {rect}")

    anim_spec = parse_anims(args.anims) if args.anims.strip() else []
    frame_name_map = build_frame_name_map(args.type_key, len(rects), anim_spec)

    atlas_image_path = out_dir / f"{args.type_key}.png"
    atlas_json_path = out_dir / f"{args.type_key}.atlas.json"
    image.save(atlas_image_path)

    frames_payload = {}
    for i, rect in enumerate(rects):
        name = frame_name_map[i]
        frames_payload[name] = {
            "frame": {"x": rect.x, "y": rect.y, "w": rect.w, "h": rect.h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": rect.w, "h": rect.h},
            "sourceSize": {"w": rect.w, "h": rect.h},
        }

    atlas_payload = {
        "frames": frames_payload,
        "meta": {
            "app": "codex.slice_sheet_to_atlas",
            "version": "1.0",
            "image": atlas_image_path.name,
            "format": "RGBA8888",
            "size": {"w": image_w, "h": image_h},
            "scale": "1",
        },
    }

    with atlas_json_path.open("w", encoding="utf-8") as f:
        json.dump(atlas_payload, f, indent=2)
        f.write("\n")

    root = Path.cwd()
    category = infer_category(out_dir)
    manifest_path = Path(args.manifest_path).resolve()
    manifest = load_manifest(manifest_path)

    runtime_image = "/" + relative_from_root(atlas_image_path, root)
    runtime_data = "/" + relative_from_root(atlas_json_path, root)
    local_image = relative_from_root(atlas_image_path, root)
    local_data = relative_from_root(atlas_json_path, root)

    upsert_manifest_entry(
        manifest,
        category=category,
        type_key=args.type_key,
        frame_w=frame_w,
        frame_h=frame_h,
        runtime_image=runtime_image,
        runtime_data=runtime_data,
        local_image=local_image,
        local_data=local_data,
    )

    write_manifest(manifest_path, manifest)

    compatibility_manifest = manifest_path.with_name("manifest.json")
    write_manifest(compatibility_manifest, manifest)

    print(f"[sprites] Wrote atlas image: {atlas_image_path}")
    print(f"[sprites] Wrote atlas data : {atlas_json_path}")
    print(f"[sprites] Updated manifest: {manifest_path}")
    print(f"[sprites] Updated manifest: {compatibility_manifest}")
    print(f"[sprites] Frames: {len(rects)} @ {frame_w}x{frame_h}")


if __name__ == "__main__":
    main()
