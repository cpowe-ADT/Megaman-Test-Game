#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "assets/sprites/manifest.v1.json"
TEMPLATE_PATH = ROOT / "assets/sprites/bosses/sentinel_rook.png"
ENEMIES_DIR = ROOT / "assets/sprites/enemies"

FRAME_W = 48
FRAME_H = 48
COLS = 8
ROWS = 3

ENEMY_HUES: Dict[str, int] = {
    "enemy_gunner_bot": 0,
    "enemy_rocket_bot": 28,
    "enemy_slicer_bot": 70,
    "enemy_armored_bot": 120,
    "enemy_shock_hopper": 165,
    "enemy_bouncer": 200,
    "enemy_mine_bot": 235,
    "enemy_frost_turret": 255,
    "enemy_laser_eye": 285,
    "enemy_drone": 315,
    "enemy_fly_trap": 340,
    "enemy_shield_drone": 18,
}


def hue_shift_rgba(img: Image.Image, hue_degrees: int) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.getchannel("A")
    rgb = img.convert("RGB")
    hsv = rgb.convert("HSV")
    h, s, v = hsv.split()
    shift = int((hue_degrees % 360) * 255 / 360) % 256
    h2 = h.point(lambda p: (p + shift) % 256)
    shifted = Image.merge("HSV", (h2, s, v)).convert("RGB")
    return Image.merge("RGBA", (*shifted.split(), alpha))


def split_template_frames(img: Image.Image) -> List[Image.Image]:
    if img.size[1] != FRAME_H or img.size[0] % FRAME_W != 0:
        raise ValueError(f"Unexpected template size {img.size}; expected Nx{FRAME_H} with {FRAME_W}px frames")
    frame_count = img.size[0] // FRAME_W
    return [img.crop((i * FRAME_W, 0, (i + 1) * FRAME_W, FRAME_H)).convert("RGBA") for i in range(frame_count)]


def build_enemy_frame_sequence(template_frames: List[Image.Image]) -> List[Tuple[str, int, Image.Image]]:
    groups: List[Tuple[str, List[int]]] = [
        ("attack", [4, 5, 6, 7, 8, 9]),
        ("death", [10, 11, 10, 11, 10, 11]),
        ("idle", [0, 1, 2, 3]),
        ("run", [0, 1, 2, 3, 4, 5, 6, 7]),
    ]
    sequence: List[Tuple[str, int, Image.Image]] = []
    for group, indices in groups:
        for local_index, src_index in enumerate(indices):
            if src_index >= len(template_frames):
                raise ValueError(f"Template frame index {src_index} is out of range ({len(template_frames)} frames)")
            sequence.append((group, local_index, template_frames[src_index]))
    return sequence


def build_sheet_and_atlas(enemy_id: str, hue: int, sequence: List[Tuple[str, int, Image.Image]]) -> None:
    out_dir = ENEMIES_DIR / enemy_id
    out_dir.mkdir(parents=True, exist_ok=True)

    sheet = Image.new("RGBA", (COLS * FRAME_W, ROWS * FRAME_H), (0, 0, 0, 0))
    frames_payload = {}

    for idx, (group, local_index, base_frame) in enumerate(sequence):
        x = (idx % COLS) * FRAME_W
        y = (idx // COLS) * FRAME_H
        tinted = hue_shift_rgba(base_frame, hue)
        sheet.paste(tinted, (x, y), tinted)

        frame_name = f"{enemy_id}/{group}/{local_index:03d}"
        frames_payload[frame_name] = {
            "frame": {"x": x, "y": y, "w": FRAME_W, "h": FRAME_H},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME_W, "h": FRAME_H},
            "sourceSize": {"w": FRAME_W, "h": FRAME_H},
        }

    image_path = out_dir / f"{enemy_id}.png"
    json_path = out_dir / f"{enemy_id}.atlas.json"

    sheet.save(image_path, format="PNG", optimize=True)
    atlas = {
        "frames": frames_payload,
        "meta": {
            "app": "codex.rebuild_enemy_runtime_atlases",
            "version": "1.0",
            "image": image_path.name,
            "format": "RGBA8888",
            "size": {"w": sheet.size[0], "h": sheet.size[1]},
            "scale": "1",
        },
    }
    json_path.write_text(json.dumps(atlas, indent=2) + "\n", encoding="utf-8")


def update_manifest() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    entries = manifest.get("entries", [])
    for enemy_id in ENEMY_HUES:
        entry_id = f"enemies-{enemy_id}"
        for entry in entries:
            if entry.get("id") != entry_id:
                continue
            entry["frame"] = {"width": FRAME_W, "height": FRAME_H}
            entry["status"] = "ready"
            entry["source"] = {
                "runtimeImage": f"/assets/sprites/enemies/{enemy_id}/{enemy_id}.png",
                "runtimeData": f"/assets/sprites/enemies/{enemy_id}/{enemy_id}.atlas.json",
                "localImagePath": f"assets/sprites/enemies/{enemy_id}/{enemy_id}.png",
                "localDataPath": f"assets/sprites/enemies/{enemy_id}/{enemy_id}.atlas.json",
            }
            entry["notes"] = (
                "Generated from sentinel_rook pixel template via deterministic hue remap. "
                "Replace with bespoke enemy sheets when available."
            )
            break

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Template not found: {TEMPLATE_PATH}")

    template = Image.open(TEMPLATE_PATH).convert("RGBA")
    template_frames = split_template_frames(template)
    sequence = build_enemy_frame_sequence(template_frames)

    for enemy_id, hue in ENEMY_HUES.items():
        build_sheet_and_atlas(enemy_id, hue, sequence)

    update_manifest()
    print(f"[sprites] Rebuilt {len(ENEMY_HUES)} enemy runtime atlases from {TEMPLATE_PATH}")


if __name__ == "__main__":
    main()
