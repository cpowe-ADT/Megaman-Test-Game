#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import deque
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[2]
ROSTER_SOURCE_PATH = ROOT / "assets/sprites/source/bosses/boss_roster_sheet_v1_20260207_200224.png"
FREE_ROSTER_SOURCE_PATH = ROOT / "assets/sprites/source/bosses/boss_roster_sheet_free_v1_20260310_180000.png"
MANIFEST_PATH = ROOT / "assets/sprites/manifest.v1.json"

BOSSES_DIR = ROOT / "assets/sprites/bosses"
ENEMIES_DIR = ROOT / "assets/sprites/enemies"

BossMap = Dict[str, Tuple[int, int]]
EnemyMap = Dict[str, Tuple[int, int]]

BOSS_SOURCE_CENTERS: BossMap = {
    "sentinel_rook": (128, 210),
    "pyro_maw": (384, 210),
    "tide_reaver": (640, 210),
    "volt_hopper": (896, 210),
    "basalt_titan": (128, 430),
    "ferro_blade": (640, 430),
    "mire_wraith": (128, 650),
    "gale_vixen": (896, 430),
    "glacier_ronin": (896, 650),
}

ENEMY_SOURCE_CENTERS: EnemyMap = {
    "enemy_gunner_bot": (128, 1030),
    "enemy_rocket_bot": (384, 1030),
    "enemy_slicer_bot": (640, 1030),
    "enemy_armored_bot": (896, 1030),
    "enemy_shock_hopper": (128, 1235),
    "enemy_bouncer": (384, 1235),
    "enemy_mine_bot": (640, 1235),
    "enemy_frost_turret": (896, 1235),
    "enemy_laser_eye": (128, 1420),
    "enemy_drone": (384, 1420),
    "enemy_shield_drone": (640, 1420),
    "enemy_fly_trap": (896, 1420),
}

BOSS_FRAME_SIZES: Dict[str, Tuple[int, int]] = {
    "sentinel_rook": (48, 48),
    "pyro_maw": (56, 48),
    "tide_reaver": (52, 50),
    "volt_hopper": (48, 46),
    "basalt_titan": (60, 56),
    "ferro_blade": (50, 48),
    "mire_wraith": (48, 48),
    "gale_vixen": (46, 46),
    "glacier_ronin": (50, 48),
}


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def brighten_rgba(image: Image.Image, factor: float) -> Image.Image:
    if abs(factor - 1.0) < 1e-6:
        return image.copy()
    rgb = image.convert("RGB")
    alpha = image.getchannel("A")
    bright = ImageEnhance.Brightness(rgb).enhance(factor)
    return Image.merge("RGBA", (*bright.split(), alpha))


def place_sprite(base: Image.Image, frame_size: Tuple[int, int], dx: int = 0, dy: int = 0, brighten: float = 1.0) -> Image.Image:
    sprite = brighten_rgba(base, brighten)
    frame_w, frame_h = frame_size
    out = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    x = clamp((frame_w - sprite.width) // 2 + dx, 0, max(0, frame_w - sprite.width))
    y = clamp(frame_h - sprite.height + dy, 0, max(0, frame_h - sprite.height))
    out.paste(sprite, (x, y), sprite)
    return out


def extract_component_bbox(crop: Image.Image, alpha_threshold: int, label_ignore_ratio: float) -> Tuple[int, int, int, int] | None:
    alpha = crop.getchannel("A")
    width, height = crop.size
    alpha_px = alpha.load()
    visited = [[False for _ in range(width)] for _ in range(height)]
    cutoff_y = int(height * (1.0 - label_ignore_ratio))
    center_x = width / 2
    center_y = height * 0.42

    best_bbox = None
    best_score = -1.0

    for y in range(height):
        for x in range(width):
            if visited[y][x] or alpha_px[x, y] < alpha_threshold:
                continue

            queue = deque([(x, y)])
            visited[y][x] = True

            min_x = max_x = x
            min_y = max_y = y
            area = 0
            sum_x = 0.0
            sum_y = 0.0

            while queue:
                cx, cy = queue.popleft()
                area += 1
                sum_x += cx
                sum_y += cy
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)

                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    if visited[ny][nx] or alpha_px[nx, ny] < alpha_threshold:
                        continue
                    visited[ny][nx] = True
                    queue.append((nx, ny))

            if area < 100:
                continue

            centroid_x = sum_x / area
            centroid_y = sum_y / area
            distance_penalty = abs(centroid_x - center_x) * 2.0 + abs(centroid_y - center_y) * 3.5
            label_penalty = 0.0
            if centroid_y > cutoff_y:
                label_penalty += (centroid_y - cutoff_y) * 18.0

            score = float(area) - distance_penalty - label_penalty
            if score > best_score:
                best_score = score
                best_bbox = (min_x, min_y, max_x + 1, max_y + 1)

    return best_bbox


def crop_and_scale_sprite(
    source: Image.Image,
    center: Tuple[int, int],
    sample_size: Tuple[int, int],
    output_size: Tuple[int, int],
    alpha_threshold: int = 70,
    label_ignore_ratio: float = 0.22,
) -> Image.Image:
    sample_w, sample_h = sample_size
    cx, cy = center
    x0 = clamp(int(cx - sample_w // 2), 0, source.width - sample_w)
    y0 = clamp(int(cy - sample_h // 2), 0, source.height - sample_h)
    x1 = clamp(x0 + sample_w, 0, source.width)
    y1 = clamp(y0 + sample_h, 0, source.height)

    crop = source.crop((x0, y0, x1, y1)).convert("RGBA")
    bbox = extract_component_bbox(crop, alpha_threshold, label_ignore_ratio)

    if bbox is None:
        alpha = crop.getchannel("A")
        fallback = alpha.point(lambda value: 255 if value >= alpha_threshold else 0).getbbox()
        if fallback is None:
            return Image.new("RGBA", output_size, (0, 0, 0, 0))
        bbox = fallback

    sprite = crop.crop(bbox)
    if sprite.width == 0 or sprite.height == 0:
        return Image.new("RGBA", output_size, (0, 0, 0, 0))

    target_w, target_h = output_size
    scale = min(target_w / sprite.width, target_h / sprite.height)
    scaled_w = max(1, int(round(sprite.width * scale)))
    scaled_h = max(1, int(round(sprite.height * scale)))
    scaled = sprite.resize((scaled_w, scaled_h), Image.Resampling.NEAREST)

    out = Image.new("RGBA", output_size, (0, 0, 0, 0))
    out.paste(scaled, ((target_w - scaled_w) // 2, target_h - scaled_h), scaled)
    return out


def write_atlas(
    image_path: Path,
    json_path: Path,
    frame_size: Tuple[int, int],
    frame_names: Sequence[str],
    frames: Sequence[Image.Image],
    cols: int,
) -> None:
    frame_w, frame_h = frame_size
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * frame_w, rows * frame_h), (0, 0, 0, 0))
    payload_frames = {}

    for index, (name, frame) in enumerate(zip(frame_names, frames)):
        x = (index % cols) * frame_w
        y = (index // cols) * frame_h
        sheet.paste(frame, (x, y), frame)
        payload_frames[name] = {
            "frame": {"x": x, "y": y, "w": frame_w, "h": frame_h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": frame_w, "h": frame_h},
            "sourceSize": {"w": frame_w, "h": frame_h},
        }

    image_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(image_path, format="PNG", optimize=True)
    atlas = {
        "frames": payload_frames,
        "meta": {
            "app": "codex.rebuild_roster_runtime_atlases",
            "version": "1.0",
            "image": image_path.name,
            "format": "RGBA8888",
            "size": {"w": sheet.size[0], "h": sheet.size[1]},
            "scale": "1",
        },
    }
    json_path.write_text(json.dumps(atlas, indent=2) + "\n", encoding="utf-8")


def build_boss_frames(base: Image.Image, frame_size: Tuple[int, int]) -> Tuple[List[str], List[Image.Image]]:
    frame_names: List[str] = []
    frames: List[Image.Image] = []
    idle = [
        place_sprite(base, frame_size, 0, 0, 1.00),
        place_sprite(base, frame_size, 0, -1, 1.00),
        place_sprite(base, frame_size, 0, 0, 1.00),
        place_sprite(base, frame_size, 0, 1, 0.98),
    ]
    move = [
        place_sprite(base, frame_size, -1, 0, 0.98),
        place_sprite(base, frame_size, 0, -1, 1.00),
        place_sprite(base, frame_size, 1, 0, 1.00),
        place_sprite(base, frame_size, 0, 1, 1.02),
    ]
    shoot = [
        place_sprite(base, frame_size, 0, 0, 1.10),
        place_sprite(base, frame_size, 1, 0, 1.16),
        place_sprite(base, frame_size, 0, 0, 1.14),
        place_sprite(base, frame_size, -1, 0, 1.08),
    ]

    for group, group_frames in (("idle", idle), ("move", move), ("shoot", shoot)):
        for idx, frame in enumerate(group_frames):
            frame_names.append(f"{group}/{idx:03d}")
            frames.append(frame)
    return frame_names, frames


def build_enemy_frames(base: Image.Image, frame_size: Tuple[int, int]) -> Tuple[List[str], List[Image.Image]]:
    frame_names: List[str] = []
    frames: List[Image.Image] = []
    groups: List[Tuple[str, Sequence[Tuple[int, int, float]]]] = [
        ("attack", [(0, 0, 1.08), (1, 0, 1.12), (0, 0, 1.10), (-1, 0, 1.08), (0, -1, 1.06), (0, 0, 1.02)]),
        ("death", [(0, 0, 1.00), (0, 0, 0.92), (0, 1, 0.82), (0, 2, 0.70), (0, 3, 0.58), (0, 4, 0.48)]),
        ("idle", [(0, 0, 1.00), (0, -1, 1.00), (0, 0, 1.00), (0, 1, 0.98)]),
        ("run", [(-1, 0, 0.99), (0, -1, 1.00), (1, 0, 1.02), (0, 1, 1.00), (-1, 0, 1.00), (0, -1, 1.01), (1, 0, 1.02), (0, 1, 1.00)]),
    ]

    for group, variants in groups:
        for idx, (dx, dy, bright) in enumerate(variants):
            frame_names.append(f"{group}/{idx:03d}")
            frames.append(place_sprite(base, frame_size, dx, dy, bright))
    return frame_names, frames


def update_manifest_notes() -> None:
    roster_notes = (
        "Generated from source/bosses/boss_roster_sheet_free_v1_20260310_180000.png "
        "built from free OpenGameArt mech sprites via deterministic component extraction and rigged frame synthesis."
        if FREE_ROSTER_SOURCE_PATH.exists()
        else "Generated from source/bosses/boss_roster_sheet_v1_20260207_200224.png "
        "via deterministic component extraction and rigged frame synthesis."
    )
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    for entry in manifest.get("entries", []):
        entry_id = str(entry.get("id", ""))
        if entry_id.startswith("boss-"):
            entry["notes"] = roster_notes.replace("rigged frame synthesis.", "rigged idle/move/shoot frame synthesis.")
        if entry_id.startswith("enemies-enemy_"):
            entry["notes"] = roster_notes.replace("rigged frame synthesis.", "rigged idle/run/attack/death frame synthesis.")
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    active_roster_path = FREE_ROSTER_SOURCE_PATH if FREE_ROSTER_SOURCE_PATH.exists() else ROSTER_SOURCE_PATH
    if not active_roster_path.exists():
        raise FileNotFoundError(f"Missing roster source sheet: {active_roster_path}")

    source = Image.open(active_roster_path).convert("RGBA")

    for boss_id, center in BOSS_SOURCE_CENTERS.items():
        frame_size = BOSS_FRAME_SIZES[boss_id]
        base = crop_and_scale_sprite(
            source,
            center=center,
            sample_size=(230, 180),
            output_size=frame_size,
            alpha_threshold=70,
            label_ignore_ratio=0.22,
        )
        names, frames = build_boss_frames(base, frame_size)
        names = [f"{boss_id}/{name}" for name in names]
        image_path = BOSSES_DIR / f"{boss_id}.png"
        json_path = BOSSES_DIR / f"{boss_id}.json"
        write_atlas(image_path, json_path, frame_size, names, frames, cols=12)

    for enemy_id, center in ENEMY_SOURCE_CENTERS.items():
        frame_size = (48, 48)
        base = crop_and_scale_sprite(
            source,
            center=center,
            sample_size=(190, 150),
            output_size=frame_size,
            alpha_threshold=70,
            label_ignore_ratio=0.24,
        )
        names, frames = build_enemy_frames(base, frame_size)
        names = [f"{enemy_id}/{name}" for name in names]
        out_dir = ENEMIES_DIR / enemy_id
        image_path = out_dir / f"{enemy_id}.png"
        json_path = out_dir / f"{enemy_id}.atlas.json"
        write_atlas(image_path, json_path, frame_size, names, frames, cols=8)

    update_manifest_notes()
    print("[sprites] Rebuilt boss + enemy runtime atlases from roster sheet source")


if __name__ == "__main__":
    main()
