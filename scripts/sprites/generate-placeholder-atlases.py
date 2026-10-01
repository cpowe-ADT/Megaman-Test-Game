#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Tuple

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "assets" / "sprites" / "manifest.v1.json"
OUT_DIR = ROOT / "assets" / "sprites" / "bosses"
FRAMES_PER_ATLAS = 12


def clamp(v: int) -> int:
    return max(0, min(255, v))


def theme_from_id(text: str) -> Tuple[Tuple[int, int, int, int], Tuple[int, int, int, int], Tuple[int, int, int, int]]:
    seed = sum(ord(ch) for ch in text)
    primary = (clamp(55 + (seed * 17) % 130), clamp(75 + (seed * 29) % 120), clamp(95 + (seed * 43) % 120), 255)
    accent = (clamp(primary[0] + 70), clamp(primary[1] + 60), clamp(primary[2] + 55), 255)
    dark = (clamp(primary[0] - 55), clamp(primary[1] - 55), clamp(primary[2] - 55), 255)
    return primary, accent, dark


def draw_pixel_robot(draw: ImageDraw.ImageDraw, ox: int, oy: int, fw: int, fh: int, frame_i: int, colors):
    primary, accent, dark = colors
    bob = 1 if frame_i % 4 in (1, 2) else 0
    arm_phase = frame_i % 8
    action_phase = frame_i % 12

    cx = ox + fw // 2
    floor_y = oy + fh - 5 - bob

    head_w = max(12, fw // 3 + 2)
    head_h = max(9, fh // 5 + 1)
    body_w = max(14, fw // 3 + 4)
    body_h = max(15, fh // 3 + 1)

    head_x0 = cx - head_w // 2
    head_y0 = floor_y - body_h - head_h - 2
    head_x1 = head_x0 + head_w
    head_y1 = head_y0 + head_h

    body_x0 = cx - body_w // 2
    body_y0 = floor_y - body_h
    body_x1 = body_x0 + body_w
    body_y1 = floor_y

    # Ground haze
    draw.ellipse([cx - body_w, floor_y + 2, cx + body_w, floor_y + 5], fill=(accent[0], accent[1], accent[2], 70))

    # Back silhouette
    draw.rounded_rectangle([head_x0 - 2, head_y0 - 2, head_x1 + 2, head_y1 + 2], radius=2, fill=dark)
    draw.rounded_rectangle([body_x0 - 2, body_y0 - 2, body_x1 + 2, body_y1 + 2], radius=3, fill=dark)

    # Head / visor
    draw.rounded_rectangle([head_x0, head_y0, head_x1, head_y1], radius=2, fill=primary)
    visor_y = head_y0 + max(2, head_h // 3)
    draw.rounded_rectangle([head_x0 + 2, visor_y, head_x1 - 2, visor_y + 3], radius=1, fill=(20, 26, 35, 255))
    draw.rectangle([cx - 3, visor_y + 1, cx - 1, visor_y + 2], fill=accent)
    draw.rectangle([cx + 1, visor_y + 1, cx + 3, visor_y + 2], fill=accent)

    # Crest / horn variation
    crest_h = 2 + (frame_i % 2)
    draw.rectangle([cx - 1, head_y0 - crest_h, cx + 1, head_y0], fill=accent)

    # Torso plates
    draw.rounded_rectangle([body_x0, body_y0, body_x1, body_y1], radius=2, fill=primary)
    draw.rectangle([body_x0 + 1, body_y0 + body_h // 2, body_x1 - 1, body_y0 + body_h // 2 + 1], fill=accent)
    draw.rectangle([body_x0 + 2, body_y0 + 2, body_x0 + body_w // 2, body_y0 + 3], fill=(255, 255, 255, 80))

    # Shoulder pads
    sh_w = max(4, body_w // 3)
    draw.rounded_rectangle([body_x0 - sh_w + 1, body_y0 + 1, body_x0 + 1, body_y0 + sh_w], radius=2, fill=primary)
    draw.rounded_rectangle([body_x1 - 1, body_y0 + 1, body_x1 + sh_w - 1, body_y0 + sh_w], radius=2, fill=primary)

    # Legs
    stride = -1 if frame_i % 4 in (0, 3) else 1
    leg_w = max(4, body_w // 4)
    leg_h = max(6, fh // 7)
    left_leg_x = body_x0 + 1 + stride
    right_leg_x = body_x1 - leg_w - 1 - stride
    leg_y0 = body_y1 + 1
    leg_y1 = min(oy + fh - 1, leg_y0 + leg_h)
    draw.rounded_rectangle([left_leg_x, leg_y0, left_leg_x + leg_w, leg_y1], radius=1, fill=dark)
    draw.rounded_rectangle([right_leg_x, leg_y0, right_leg_x + leg_w, leg_y1], radius=1, fill=dark)

    # Arms
    arm_y = body_y0 + 2
    left_arm_x = body_x0 - max(4, body_w // 4)
    right_arm_x = body_x1 + 1
    draw.rounded_rectangle([left_arm_x, arm_y, left_arm_x + 4, arm_y + 4], radius=1, fill=dark)
    draw.rounded_rectangle([right_arm_x, arm_y, right_arm_x + 4, arm_y + 4], radius=1, fill=dark)

    # Weapon hand with animated glow
    shot_power = 0
    if action_phase in (4, 5, 6):
        shot_power = 1
    elif action_phase in (7, 8):
        shot_power = 2
    elif action_phase == 9:
        shot_power = 3

    muzzle_x = right_arm_x + 5 + (1 if arm_phase in (3, 4) else 0)
    muzzle_y = arm_y + 2
    if shot_power > 0:
        glow_r = 2 + shot_power
        draw.ellipse([muzzle_x - glow_r, muzzle_y - glow_r, muzzle_x + glow_r, muzzle_y + glow_r], fill=(accent[0], accent[1], accent[2], 180))
        draw.ellipse([muzzle_x - 1, muzzle_y - 1, muzzle_x + 1, muzzle_y + 1], fill=(255, 255, 255, 255))
        if shot_power >= 2:
            draw.rectangle([muzzle_x + 2, muzzle_y - 1, min(ox + fw - 1, muzzle_x + 7), muzzle_y + 1], fill=accent)

    # Shield / blade variation on off-hand
    if arm_phase in (1, 2):
        draw.rounded_rectangle([left_arm_x - 4, arm_y - 1, left_arm_x, arm_y + 5], radius=2, fill=(accent[0], accent[1], accent[2], 210))
    elif arm_phase in (5, 6):
        draw.polygon([(left_arm_x - 4, arm_y + 1), (left_arm_x, arm_y - 1), (left_arm_x + 1, arm_y + 4)], fill=accent)

    # Motion streaks
    streak_y = min(oy + fh - 2, floor_y + 1)
    for t in range(0, fw, max(3, fw // 11)):
        alpha = 110 if (t + frame_i) % 2 == 0 else 60
        draw.point((ox + t, streak_y), fill=(accent[0], accent[1], accent[2], alpha))


def build_atlas(entry: Dict):
    boss_id = entry.get("bossId") or entry["id"]
    atlas_key = entry["atlasKey"]
    fw = int(entry["frame"]["width"])
    fh = int(entry["frame"]["height"])

    image = Image.new("RGBA", (fw * FRAMES_PER_ATLAS, fh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    colors = theme_from_id(str(boss_id))

    frames = {}
    for i in range(FRAMES_PER_ATLAS):
        ox = i * fw
        oy = 0
        draw_pixel_robot(draw, ox, oy, fw, fh, i, colors)
        frame_name = f"{atlas_key}_{i:02d}"
        frames[frame_name] = {
            "frame": {"x": ox, "y": 0, "w": fw, "h": fh},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": fw, "h": fh},
            "sourceSize": {"w": fw, "h": fh}
        }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    png_path = OUT_DIR / f"{boss_id}.png"
    json_path = OUT_DIR / f"{boss_id}.json"

    image.save(png_path)

    atlas = {
        "frames": frames,
        "meta": {
            "app": "omega-relay-placeholder-generator",
            "version": "1.0.0",
            "image": png_path.name,
            "format": "RGBA8888",
            "size": {"w": fw * FRAMES_PER_ATLAS, "h": fh},
            "scale": "1"
        }
    }

    json_path.write_text(json.dumps(atlas, indent=2), encoding="utf-8")


def main():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    entries = manifest.get("entries", [])

    for entry in entries:
        build_atlas(entry)

    print(f"Generated {len(entries)} placeholder atlases in {OUT_DIR}")


if __name__ == "__main__":
    main()
