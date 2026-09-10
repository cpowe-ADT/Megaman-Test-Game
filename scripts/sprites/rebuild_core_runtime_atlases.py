#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import deque
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "assets/sprites/manifest.v1.json"
TEMPLATE_PATH = ROOT / "assets/sprites/bosses/sentinel_rook.png"
PLAYER_SOURCE_PATH = ROOT / "assets/sprites/source/player/player_full_combat_sheet_v1_20260207_201355.png"
PROJECTILE_SOURCE_PATH = ROOT / "assets/sprites/source/projectiles/projectile_fx_sheet_v1_20260207_203656.png"
FREE_PROJECTILE_OBJECTS_PATH = (
    ROOT / "assets/sprites/source/projectiles/projectile_robotfree_objects_sheet_v1_20260310_180000.png"
)
FREE_EXPLOSION_SOURCE_PATH = (
    ROOT / "assets/sprites/source/projectiles/effects_explosion03_sheet_v1_20260310_180000.png"
)
FREE_RING_SOURCE_PATH = ROOT / "assets/sprites/source/projectiles/effects_ring95_sheet_v1_20260310_180000.png"
FREE_AURA_SOURCE_PATH = ROOT / "assets/sprites/source/projectiles/effects_aura38_sheet_v1_20260310_180000.png"

PLAYER_IMAGE_PATH = ROOT / "assets/sprites/player/main/player_main.png"
PLAYER_JSON_PATH = ROOT / "assets/sprites/player/main/player_main.atlas.json"
PROJECTILE_IMAGE_PATH = ROOT / "assets/sprites/projectiles/projectiles_core/projectiles_core.png"
PROJECTILE_JSON_PATH = ROOT / "assets/sprites/projectiles/projectiles_core/projectiles_core.atlas.json"
EFFECT_IMAGE_PATH = ROOT / "assets/sprites/effects/effects_core/effects_core.png"
EFFECT_JSON_PATH = ROOT / "assets/sprites/effects/effects_core/effects_core.atlas.json"

PLAYER_OUTPUT_FRAME_W = 48
PLAYER_OUTPUT_FRAME_H = 48
PLAYER_BASELINE_Y = 46

DEFAULT_PLAYER_POSE_LAYOUT: Dict[str, int] = {
    "target_height": 40,
    "baseline_y": PLAYER_BASELINE_Y,
    "max_width": PLAYER_OUTPUT_FRAME_W - 4,
    "offset_x": 0,
}

PLAYER_POSE_LAYOUTS: Dict[str, Dict[str, int]] = {
    "crouch_in": {"target_height": 34},
    "crouch_hold": {"target_height": 30},
    "crouch_out": {"target_height": 34},
    "land": {"target_height": 38},
    "wall_slide": {"target_height": 40, "max_width": 34, "offset_x": -4},
    "wall_jump": {"target_height": 40, "max_width": 40, "offset_x": 3},
    "dash_start": {"target_height": 34},
    "dash_loop": {"target_height": 30},
    "dash_end": {"target_height": 34},
    "airdash_start": {"target_height": 34},
    "airdash_loop": {"target_height": 34},
    "airdash_end": {"target_height": 34},
    "dash_shoot": {"target_height": 34},
    "knockdown": {"target_height": 32, "baseline_y": PLAYER_BASELINE_Y - 2},
    "getup": {"target_height": 34},
    "death": {"target_height": 34, "baseline_y": PLAYER_BASELINE_Y - 2},
    "respawn": {"target_height": 36},
}

PLAYER_POSE_BOXES: Dict[str, List[Tuple[int, int, int, int, bool]]] = {
    "idle": [(16, 132, 86, 116, False), (100, 132, 86, 116, False), (184, 132, 86, 116, False), (268, 132, 86, 116, False)],
    "turn": [(184, 132, 86, 116, False)],
    "run": [(100, 132, 86, 116, False), (268, 132, 86, 116, False), (352, 132, 86, 116, False), (436, 132, 88, 116, False), (520, 132, 90, 116, False), (604, 132, 90, 116, False)],
    "crouch_in": [(260, 252, 94, 112, False)],
    "crouch_hold": [(344, 252, 94, 112, False)],
    "crouch_out": [(428, 252, 94, 112, False)],
    "jump_start": [(604, 132, 90, 116, False)],
    "jump_rise": [(688, 132, 92, 116, False)],
    "jump_apex": [(772, 132, 96, 116, False)],
    "fall": [(940, 132, 84, 116, False)],
    "wall_slide": [(940, 132, 84, 116, False)],
    "wall_jump": [(604, 132, 90, 116, False)],
    "land": [(856, 252, 88, 112, False)],
    "dash_start": [(16, 252, 94, 112, False)],
    "dash_loop": [(100, 252, 94, 112, False)],
    "dash_end": [(184, 252, 94, 112, False)],
    "airdash_start": [(520, 252, 92, 112, False)],
    "airdash_loop": [(604, 252, 92, 112, False)],
    "airdash_end": [(688, 252, 92, 112, False)],
    "shoot_ground": [(688, 132, 92, 116, False), (772, 132, 92, 116, False)],
    "shoot_run": [(184, 378, 112, 110, False), (268, 378, 112, 110, False)],
    "shoot_air": [(16, 378, 112, 110, False)],
    "dash_shoot": [(100, 378, 112, 110, False)],
    "charge_start": [(352, 378, 112, 110, False)],
    "charge_hold": [(436, 378, 112, 110, False), (520, 378, 112, 110, False)],
    "charge_release_lv1": [(604, 378, 112, 110, False)],
    "charge_release_lv2": [(688, 378, 112, 110, False)],
    "charge_release_lv3": [(772, 378, 112, 110, False)],
    "charge_release_lv4": [(852, 378, 156, 110, False)],
    "slash_ground_e": [(16, 536, 120, 128, False)],
    "slash_ground_ne": [(104, 536, 120, 128, False)],
    "slash_ground_n": [(184, 536, 120, 128, False)],
    "slash_ground_se": [(352, 536, 144, 128, False)],
    "slash_ground_s": [(16, 692, 136, 116, False)],
    "slash_air_e": [(600, 536, 148, 128, False)],
    "slash_air_ne": [(852, 536, 144, 128, False)],
    "slash_air_n": [(352, 692, 188, 116, False)],
    "slash_air_se": [(184, 692, 160, 116, False)],
    "slash_air_s": [(100, 692, 140, 116, False)],
    "hurt_light": [(596, 692, 92, 116, False)],
    "hurt_heavy": [(680, 692, 92, 116, False)],
    "knockdown": [(764, 692, 104, 116, False)],
    "getup": [(16, 986, 120, 110, False)],
    "death": [(100, 986, 124, 110, False), (184, 986, 124, 110, False)],
    "respawn": [(432, 986, 140, 110, False), (520, 986, 140, 110, False), (604, 986, 140, 110, False)],
}

# Component ids derived deterministically from PROJECTILE_SOURCE_PATH
# (sorted by component area descending, alpha>=90).
PROJECTILE_COMPONENT_SEQUENCE: List[int] = [
    31, 32, 33, 29, 27, 25, 34, 35,
    31, 32, 33, 29, 27, 25, 34, 35,
    36, 35, 34, 30, 29, 27, 25, 36,
]
EFFECT_COMPONENT_SEQUENCE: List[int] = [
    26, 28, 30, 37, 38, 39, 34, 35,
    26, 28, 30, 37, 38, 39, 34, 35,
    26, 28, 30, 37, 38, 39, 34, 35,
]


def crop_alpha_bounds(img: Image.Image, alpha_threshold: int = 8) -> Image.Image:
    alpha = img.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value >= alpha_threshold else 0).getbbox()
    return img.crop(bbox) if bbox else img


def extract_grid_cell(image: Image.Image, cols: int, rows: int, index: int) -> Image.Image:
    cell_w = image.width // cols
    cell_h = image.height // rows
    safe_index = max(0, min(index, cols * rows - 1))
    x = (safe_index % cols) * cell_w
    y = (safe_index // cols) * cell_h
    return image.crop((x, y, x + cell_w, y + cell_h)).convert("RGBA")


def render_sprite_in_frame(
    sprite: Image.Image,
    frame_w: int,
    frame_h: int,
    *,
    scale: float = 1.0,
    rotate: int = 0,
    squash_x: float = 1.0,
    squash_y: float = 1.0,
    brighten: float = 1.0,
    hue_shift: int = 0,
) -> Image.Image:
    rendered = crop_alpha_bounds(sprite.convert("RGBA"))
    if hue_shift:
        rendered = hue_shift_rgba(rendered, hue_shift)
    if abs(brighten - 1.0) > 1e-6:
        rendered = brighten_rgba(rendered, brighten)
    if rotate:
        rendered = rendered.rotate(rotate, expand=True, resample=Image.Resampling.NEAREST)
    if abs(squash_x - 1.0) > 1e-6 or abs(squash_y - 1.0) > 1e-6:
        rendered = rendered.resize(
            (
                max(1, int(round(rendered.width * squash_x))),
                max(1, int(round(rendered.height * squash_y))),
            ),
            Image.Resampling.NEAREST,
        )
    fit = min(frame_w / max(1, rendered.width), frame_h / max(1, rendered.height)) * scale
    scaled = rendered.resize(
        (
            max(1, int(round(rendered.width * fit))),
            max(1, int(round(rendered.height * fit))),
        ),
        Image.Resampling.NEAREST,
    )
    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    frame.paste(scaled, ((frame_w - scaled.width) // 2, (frame_h - scaled.height) // 2), scaled)
    return frame


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


def brighten_rgba(img: Image.Image, factor: float) -> Image.Image:
    if abs(factor - 1.0) < 1e-6:
        return img.copy()
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.getchannel("A")
    rgb = img.convert("RGB")
    bright = ImageEnhance.Brightness(rgb).enhance(factor)
    return Image.merge("RGBA", (*bright.split(), alpha))


def split_strip_frames(path: Path, frame_w: int, frame_h: int) -> List[Image.Image]:
    image = Image.open(path).convert("RGBA")
    if image.size[1] != frame_h or image.size[0] % frame_w != 0:
        raise ValueError(f"Unexpected template size for {path}: {image.size}")
    count = image.size[0] // frame_w
    return [image.crop((i * frame_w, 0, (i + 1) * frame_w, frame_h)).convert("RGBA") for i in range(count)]


def build_atlas_payload(
    image_size: Tuple[int, int],
    image_name: str,
    names: Sequence[str],
    frame_w: int,
    frame_h: int,
    cols: int,
) -> Dict:
    frames = {}
    for idx, name in enumerate(names):
        x = (idx % cols) * frame_w
        y = (idx // cols) * frame_h
        frames[name] = {
            "frame": {"x": x, "y": y, "w": frame_w, "h": frame_h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": frame_w, "h": frame_h},
            "sourceSize": {"w": frame_w, "h": frame_h},
        }
    return {
        "frames": frames,
        "meta": {
            "app": "codex.rebuild_core_runtime_atlases",
            "version": "1.0",
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": image_size[0], "h": image_size[1]},
            "scale": "1",
        },
    }


def extract_player_pose_frame(
    source_image: Image.Image,
    pose_group: str,
    pose: Tuple[int, int, int, int, bool],
    alpha_threshold: int = 20,
    min_component_area: int = 80,
) -> Image.Image:
    x, y, w, h, mirror = pose
    if w <= 0 or h <= 0:
        return Image.new("RGBA", (PLAYER_OUTPUT_FRAME_W, PLAYER_OUTPUT_FRAME_H), (0, 0, 0, 0))

    crop = source_image.crop((x, y, x + w, y + h)).convert("RGBA")
    alpha = crop.getchannel("A")
    px = alpha.load()
    visited = [[False for _ in range(crop.width)] for _ in range(crop.height)]
    components: List[Tuple[int, int, int, int, int]] = []

    for cy in range(crop.height):
        for cx in range(crop.width):
            if visited[cy][cx] or px[cx, cy] < alpha_threshold:
                continue

            queue = deque([(cx, cy)])
            visited[cy][cx] = True
            min_x = max_x = cx
            min_y = max_y = cy
            area = 0

            while queue:
                qx, qy = queue.popleft()
                area += 1
                min_x = min(min_x, qx)
                max_x = max(max_x, qx)
                min_y = min(min_y, qy)
                max_y = max(max_y, qy)

                for nx, ny in ((qx + 1, qy), (qx - 1, qy), (qx, qy + 1), (qx, qy - 1)):
                    if 0 <= nx < crop.width and 0 <= ny < crop.height and not visited[ny][nx] and px[nx, ny] >= alpha_threshold:
                        visited[ny][nx] = True
                        queue.append((nx, ny))

            if area >= min_component_area:
                components.append((area, min_x, min_y, max_x, max_y))

    if components:
        largest_area = max(component[0] for component in components)
        relevant = [
            component
            for component in components
            if component[0] >= max(min_component_area, int(largest_area * 0.12)) and component[2] <= int(h * 0.82)
        ]
        if not relevant:
            relevant = [max(components, key=lambda component: component[0])]

        min_x = min(component[1] for component in relevant)
        min_y = min(component[2] for component in relevant)
        max_x = max(component[3] for component in relevant)
        max_y = max(component[4] for component in relevant)
        sprite = crop.crop((min_x, min_y, max_x + 1, max_y + 1))
    else:
        sprite = crop

    if mirror:
        sprite = sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

    layout = dict(DEFAULT_PLAYER_POSE_LAYOUT)
    layout.update(PLAYER_POSE_LAYOUTS.get(pose_group, {}))
    target_height = max(1, int(layout["target_height"]))
    baseline_y = int(layout["baseline_y"])
    max_width = max(1, int(layout["max_width"]))
    offset_x = int(layout["offset_x"])

    scale = min(target_height / sprite.height, max_width / sprite.width)
    scaled_w = max(1, int(round(sprite.width * scale)))
    scaled_h = max(1, int(round(sprite.height * scale)))
    scaled = sprite.resize((scaled_w, scaled_h), Image.Resampling.NEAREST)

    frame = Image.new("RGBA", (PLAYER_OUTPUT_FRAME_W, PLAYER_OUTPUT_FRAME_H), (0, 0, 0, 0))
    paste_x = max(0, min(PLAYER_OUTPUT_FRAME_W - scaled_w, ((PLAYER_OUTPUT_FRAME_W - scaled_w) // 2) + offset_x))
    paste_y = max(0, min(PLAYER_OUTPUT_FRAME_H - scaled_h, baseline_y - scaled_h))
    frame.paste(scaled, (paste_x, paste_y), scaled)
    return frame


def rebuild_player_atlas_from_source() -> bool:
    if not PLAYER_SOURCE_PATH.exists():
        return False

    source_image = Image.open(PLAYER_SOURCE_PATH).convert("RGBA")
    names: List[str] = []
    frames: List[Image.Image] = []
    for group, poses in PLAYER_POSE_BOXES.items():
        for local_index, pose in enumerate(poses):
            names.append(f"player_main/{group}/{local_index:03d}")
            frames.append(extract_player_pose_frame(source_image, group, pose))

    cols = 8
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * PLAYER_OUTPUT_FRAME_W, rows * PLAYER_OUTPUT_FRAME_H), (0, 0, 0, 0))
    for idx, frame in enumerate(frames):
        x = (idx % cols) * PLAYER_OUTPUT_FRAME_W
        y = (idx // cols) * PLAYER_OUTPUT_FRAME_H
        sheet.paste(frame, (x, y), frame)

    PLAYER_IMAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PLAYER_IMAGE_PATH, format="PNG", optimize=True)
    atlas = build_atlas_payload(
        sheet.size,
        PLAYER_IMAGE_PATH.name,
        names,
        PLAYER_OUTPUT_FRAME_W,
        PLAYER_OUTPUT_FRAME_H,
        cols,
    )
    PLAYER_JSON_PATH.write_text(json.dumps(atlas, indent=2) + "\n", encoding="utf-8")
    return True


def rebuild_player_atlas_from_template() -> None:
    template_frames = split_strip_frames(TEMPLATE_PATH, PLAYER_OUTPUT_FRAME_W, PLAYER_OUTPUT_FRAME_H)
    sequence_indices = {
        "idle": [0, 1, 2, 3],
        "run": [0, 1, 2, 3, 4, 5, 6, 7],
        "shoot": [4, 5, 6, 7],
        "sword": [8, 9, 10, 11],
        "hurt": [10, 11],
        "defeat": [10, 11],
    }
    names: List[str] = []
    frames: List[Image.Image] = []
    for group in ("idle", "run", "shoot", "sword", "hurt", "defeat"):
        for local_index, src_index in enumerate(sequence_indices[group]):
            names.append(f"player_main/{group}/{local_index:03d}")
            frames.append(hue_shift_rgba(template_frames[src_index], 220))

    cols = 8
    sheet = Image.new("RGBA", (cols * PLAYER_OUTPUT_FRAME_W, 3 * PLAYER_OUTPUT_FRAME_H), (0, 0, 0, 0))
    for idx, frame in enumerate(frames):
        x = (idx % cols) * PLAYER_OUTPUT_FRAME_W
        y = (idx // cols) * PLAYER_OUTPUT_FRAME_H
        sheet.paste(frame, (x, y), frame)

    PLAYER_IMAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PLAYER_IMAGE_PATH, format="PNG", optimize=True)
    atlas = build_atlas_payload(
        sheet.size,
        PLAYER_IMAGE_PATH.name,
        names,
        PLAYER_OUTPUT_FRAME_W,
        PLAYER_OUTPUT_FRAME_H,
        cols,
    )
    PLAYER_JSON_PATH.write_text(json.dumps(atlas, indent=2) + "\n", encoding="utf-8")


def draw_projectile_frame(draw: ImageDraw.ImageDraw, idx: int, frame_w: int, frame_h: int, ox: int, oy: int) -> None:
    cx = ox + frame_w // 2
    cy = oy + frame_h // 2
    if idx <= 7:
        radius = 2 + (idx % 3)
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(90, 220, 255, 230))
        draw.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=(255, 255, 255, 255))
    elif idx <= 15:
        radius = 3 + ((idx - 8) % 4)
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(255, 195, 80, 220))
        draw.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=(255, 255, 240, 255))
    else:
        width = 4 + ((idx - 16) % 4)
        draw.rounded_rectangle([cx - width, cy - 2, cx + width, cy + 2], radius=2, fill=(140, 235, 255, 220))
        draw.rectangle([cx + width, cy - 1, cx + width + 2, cy + 1], fill=(255, 255, 255, 240))


def draw_effect_frame(draw: ImageDraw.ImageDraw, idx: int, frame_w: int, frame_h: int, ox: int, oy: int) -> None:
    cx = ox + frame_w // 2
    cy = oy + frame_h // 2
    if idx <= 7:
        radius = 1 + idx // 2
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(255, 220, 120, 220))
    elif idx == 4:
        draw.polygon(
            [(ox + 2, oy + frame_h - 2), (ox + 6, oy + 4), (ox + 10, oy + frame_h - 2)],
            fill=(170, 230, 255, 220),
        )
        draw.polygon(
            [(ox + 8, oy + frame_h - 2), (ox + 12, oy + 4), (ox + 16, oy + frame_h - 2)],
            fill=(170, 230, 255, 220),
        )
    else:
        r = 3 + (idx % 3)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(120, 255, 255, 220), width=1)


def extract_source_components(path: Path, alpha_threshold: int = 90) -> List[Tuple[int, int, int, int]]:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    px = alpha.load()
    width, height = image.size
    visited = [[False for _ in range(width)] for _ in range(height)]
    components: List[Tuple[int, int, int, int, int]] = []

    for y in range(height):
        for x in range(width):
            if visited[y][x] or px[x, y] < alpha_threshold:
                continue

            queue = deque([(x, y)])
            visited[y][x] = True
            min_x = max_x = x
            min_y = max_y = y
            area = 0

            while queue:
                cx, cy = queue.popleft()
                area += 1
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)

                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    if visited[ny][nx] or px[nx, ny] < alpha_threshold:
                        continue
                    visited[ny][nx] = True
                    queue.append((nx, ny))

            w = max_x - min_x + 1
            h = max_y - min_y + 1
            if area < 120 or w < 8 or h < 8:
                continue
            components.append((area, min_x, min_y, max_x + 1, max_y + 1))

    components.sort(key=lambda entry: entry[0], reverse=True)
    return [(x0, y0, x1, y1) for _, x0, y0, x1, y1 in components]


def place_component_in_frame(
    source_image: Image.Image, rect: Tuple[int, int, int, int], frame_w: int, frame_h: int
) -> Image.Image:
    x0, y0, x1, y1 = rect
    sprite = source_image.crop((x0, y0, x1, y1)).convert("RGBA")
    if sprite.width == 0 or sprite.height == 0:
        return Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))

    scale = min(frame_w / sprite.width, frame_h / sprite.height)
    scaled_w = max(1, int(round(sprite.width * scale)))
    scaled_h = max(1, int(round(sprite.height * scale)))
    scaled = sprite.resize((scaled_w, scaled_h), Image.Resampling.NEAREST)

    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    frame.paste(scaled, ((frame_w - scaled_w) // 2, frame_h - scaled_h), scaled)
    return frame


def rebuild_core_sheet(
    image_path: Path,
    json_path: Path,
    prefix: str,
    draw_fn,
    frame_w: int = 20,
    frame_h: int = 20,
    cols: int = 8,
    rows: int = 3,
) -> None:
    total = cols * rows
    sheet = Image.new("RGBA", (cols * frame_w, rows * frame_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sheet)
    names = [f"{prefix}/core/{idx:03d}" for idx in range(total)]
    for idx in range(total):
        x = (idx % cols) * frame_w
        y = (idx // cols) * frame_h
        draw_fn(draw, idx, frame_w, frame_h, x, y)

    image_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(image_path, format="PNG", optimize=True)
    atlas = build_atlas_payload(sheet.size, image_path.name, names, frame_w, frame_h, cols)
    json_path.write_text(json.dumps(atlas, indent=2) + "\n", encoding="utf-8")


def rebuild_core_sheet_from_source_components(
    image_path: Path,
    json_path: Path,
    prefix: str,
    component_sequence: Sequence[int],
    frame_w: int = 20,
    frame_h: int = 20,
    cols: int = 8,
) -> bool:
    if not PROJECTILE_SOURCE_PATH.exists():
        return False

    source_image = Image.open(PROJECTILE_SOURCE_PATH).convert("RGBA")
    components = extract_source_components(PROJECTILE_SOURCE_PATH, alpha_threshold=90)
    if not components:
        return False

    names = [f"{prefix}/core/{idx:03d}" for idx in range(len(component_sequence))]
    frames: List[Image.Image] = []
    for component_index in component_sequence:
        safe_index = max(0, min(component_index, len(components) - 1))
        frames.append(place_component_in_frame(source_image, components[safe_index], frame_w, frame_h))

    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * frame_w, rows * frame_h), (0, 0, 0, 0))
    for idx, frame in enumerate(frames):
        x = (idx % cols) * frame_w
        y = (idx // cols) * frame_h
        sheet.paste(frame, (x, y), frame)

    image_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(image_path, format="PNG", optimize=True)
    atlas = build_atlas_payload(sheet.size, image_path.name, names, frame_w, frame_h, cols)
    json_path.write_text(json.dumps(atlas, indent=2) + "\n", encoding="utf-8")
    return True


def rebuild_projectiles_from_free_sources(
    image_path: Path,
    json_path: Path,
    prefix: str,
    frame_w: int = 20,
    frame_h: int = 20,
    cols: int = 8,
) -> bool:
    required = [
        FREE_PROJECTILE_OBJECTS_PATH,
        FREE_EXPLOSION_SOURCE_PATH,
        FREE_RING_SOURCE_PATH,
        FREE_AURA_SOURCE_PATH,
    ]
    if not all(path.exists() for path in required):
        return False

    objects = Image.open(FREE_PROJECTILE_OBJECTS_PATH).convert("RGBA")
    explosion = Image.open(FREE_EXPLOSION_SOURCE_PATH).convert("RGBA")
    ring = Image.open(FREE_RING_SOURCE_PATH).convert("RGBA")
    aura = Image.open(FREE_AURA_SOURCE_PATH).convert("RGBA")

    bullets = [extract_grid_cell(objects, 10, 1, index) for index in range(5)]
    muzzles = [extract_grid_cell(objects, 10, 1, 5 + index) for index in range(5)]
    ring_cells = [extract_grid_cell(ring, 4, 4, index) for index in range(16)]
    explosion_cells = [extract_grid_cell(explosion, 4, 4, index) for index in range(16)]
    aura_cells = [extract_grid_cell(aura, 8, 4, index) for index in range(32)]

    frames = [
        render_sprite_in_frame(bullets[0], frame_w, frame_h, scale=0.78, hue_shift=185, brighten=1.05),
        render_sprite_in_frame(bullets[1], frame_w, frame_h, scale=0.78, hue_shift=205, brighten=1.08),
        render_sprite_in_frame(bullets[2], frame_w, frame_h, scale=0.8, hue_shift=200),
        render_sprite_in_frame(bullets[3], frame_w, frame_h, scale=0.86, hue_shift=28, brighten=1.06),
        render_sprite_in_frame(bullets[4], frame_w, frame_h, scale=0.86, hue_shift=115, brighten=1.04),
        render_sprite_in_frame(bullets[0], frame_w, frame_h, scale=0.94, hue_shift=240, brighten=1.1),
        render_sprite_in_frame(bullets[1], frame_w, frame_h, scale=0.98, hue_shift=260, brighten=1.12),
        render_sprite_in_frame(bullets[2], frame_w, frame_h, scale=1.02, hue_shift=285, brighten=1.14),
        render_sprite_in_frame(bullets[3], frame_w, frame_h, scale=1.06, hue_shift=300, brighten=1.16),
        render_sprite_in_frame(bullets[1], frame_w, frame_h, scale=0.82, hue_shift=2, brighten=1.08),
        render_sprite_in_frame(bullets[2], frame_w, frame_h, scale=0.84, hue_shift=18, brighten=1.1),
        render_sprite_in_frame(muzzles[0], frame_w, frame_h, scale=0.8, rotate=-90, hue_shift=30, brighten=1.06),
        render_sprite_in_frame(muzzles[1], frame_w, frame_h, scale=0.84, rotate=-90, hue_shift=12, brighten=1.1),
        render_sprite_in_frame(muzzles[2], frame_w, frame_h, scale=0.88, rotate=-90, hue_shift=185, brighten=1.08),
        render_sprite_in_frame(ring_cells[6], frame_w, frame_h, scale=0.84, hue_shift=162, brighten=1.08),
        render_sprite_in_frame(ring_cells[10], frame_w, frame_h, scale=0.9, hue_shift=200, brighten=1.12),
        render_sprite_in_frame(explosion_cells[1], frame_w, frame_h, scale=0.72, brighten=1.08),
        render_sprite_in_frame(explosion_cells[4], frame_w, frame_h, scale=0.82, brighten=1.04),
        render_sprite_in_frame(explosion_cells[6], frame_w, frame_h, scale=0.92),
        render_sprite_in_frame(explosion_cells[8], frame_w, frame_h, scale=1.02, brighten=0.96),
        render_sprite_in_frame(aura_cells[2], frame_w, frame_h, scale=0.92, squash_x=0.9, squash_y=0.7),
        render_sprite_in_frame(aura_cells[6], frame_w, frame_h, scale=0.9, rotate=90, squash_x=1.1, squash_y=0.52),
        render_sprite_in_frame(ring_cells[13], frame_w, frame_h, scale=1.0, hue_shift=36, brighten=1.04),
        render_sprite_in_frame(explosion_cells[10], frame_w, frame_h, scale=0.86, brighten=0.92),
    ]

    names = [f"{prefix}/core/{idx:03d}" for idx in range(len(frames))]
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * frame_w, rows * frame_h), (0, 0, 0, 0))
    for idx, frame in enumerate(frames):
        x = (idx % cols) * frame_w
        y = (idx // cols) * frame_h
        sheet.paste(frame, (x, y), frame)

    image_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(image_path, format="PNG", optimize=True)
    atlas = build_atlas_payload(sheet.size, image_path.name, names, frame_w, frame_h, cols)
    json_path.write_text(json.dumps(atlas, indent=2) + "\n", encoding="utf-8")
    return True


def rebuild_effects_from_free_sources(
    image_path: Path,
    json_path: Path,
    prefix: str,
    frame_w: int = 20,
    frame_h: int = 20,
    cols: int = 8,
) -> bool:
    required = [
        FREE_PROJECTILE_OBJECTS_PATH,
        FREE_EXPLOSION_SOURCE_PATH,
        FREE_RING_SOURCE_PATH,
        FREE_AURA_SOURCE_PATH,
    ]
    if not all(path.exists() for path in required):
        return False

    objects = Image.open(FREE_PROJECTILE_OBJECTS_PATH).convert("RGBA")
    explosion = Image.open(FREE_EXPLOSION_SOURCE_PATH).convert("RGBA")
    ring = Image.open(FREE_RING_SOURCE_PATH).convert("RGBA")
    aura = Image.open(FREE_AURA_SOURCE_PATH).convert("RGBA")

    muzzles = [extract_grid_cell(objects, 10, 1, 5 + index) for index in range(5)]
    ring_cells = [extract_grid_cell(ring, 4, 4, index) for index in range(16)]
    explosion_cells = [extract_grid_cell(explosion, 4, 4, index) for index in range(16)]
    aura_cells = [extract_grid_cell(aura, 8, 4, index) for index in range(32)]

    frames = [
        render_sprite_in_frame(explosion_cells[0], frame_w, frame_h, scale=0.7),
        render_sprite_in_frame(explosion_cells[1], frame_w, frame_h, scale=0.82),
        render_sprite_in_frame(explosion_cells[2], frame_w, frame_h, scale=0.96),
        render_sprite_in_frame(explosion_cells[3], frame_w, frame_h, scale=1.08),
        render_sprite_in_frame(aura_cells[0], frame_w, frame_h, scale=1.0, squash_x=0.72, squash_y=0.46),
        render_sprite_in_frame(aura_cells[4], frame_w, frame_h, scale=1.0, squash_x=0.84, squash_y=0.44),
        render_sprite_in_frame(ring_cells[0], frame_w, frame_h, scale=0.62, hue_shift=168, brighten=1.04),
        render_sprite_in_frame(ring_cells[3], frame_w, frame_h, scale=0.78, hue_shift=192, brighten=1.06),
        render_sprite_in_frame(muzzles[0], frame_w, frame_h, scale=0.86, rotate=-90, hue_shift=24, brighten=1.08),
        render_sprite_in_frame(muzzles[1], frame_w, frame_h, scale=0.9, rotate=-90, hue_shift=18, brighten=1.08),
        render_sprite_in_frame(muzzles[3], frame_w, frame_h, scale=0.96, rotate=-90, hue_shift=8, brighten=1.1),
        render_sprite_in_frame(explosion_cells[5], frame_w, frame_h, scale=0.88, brighten=1.04),
        render_sprite_in_frame(ring_cells[8], frame_w, frame_h, scale=0.92, hue_shift=188),
        render_sprite_in_frame(aura_cells[8], frame_w, frame_h, scale=1.06, squash_x=0.88, squash_y=0.46),
        render_sprite_in_frame(ring_cells[10], frame_w, frame_h, scale=1.0, hue_shift=174, brighten=1.1),
        render_sprite_in_frame(ring_cells[12], frame_w, frame_h, scale=1.1, hue_shift=204, brighten=1.12),
        render_sprite_in_frame(muzzles[4], frame_w, frame_h, scale=1.0, rotate=-90, hue_shift=32, brighten=1.1),
        render_sprite_in_frame(explosion_cells[7], frame_w, frame_h, scale=0.96, brighten=0.96),
        render_sprite_in_frame(ring_cells[14], frame_w, frame_h, scale=1.08, hue_shift=12, brighten=1.04),
        render_sprite_in_frame(explosion_cells[9], frame_w, frame_h, scale=1.02, brighten=0.94),
        render_sprite_in_frame(aura_cells[12], frame_w, frame_h, scale=1.08, squash_x=0.92, squash_y=0.48),
        render_sprite_in_frame(aura_cells[16], frame_w, frame_h, scale=1.12, squash_x=0.9, squash_y=0.46),
        render_sprite_in_frame(ring_cells[15], frame_w, frame_h, scale=1.18, hue_shift=28),
        render_sprite_in_frame(explosion_cells[10], frame_w, frame_h, scale=0.92, brighten=0.9),
    ]

    names = [f"{prefix}/core/{idx:03d}" for idx in range(len(frames))]
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * frame_w, rows * frame_h), (0, 0, 0, 0))
    for idx, frame in enumerate(frames):
        x = (idx % cols) * frame_w
        y = (idx // cols) * frame_h
        sheet.paste(frame, (x, y), frame)

    image_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(image_path, format="PNG", optimize=True)
    atlas = build_atlas_payload(sheet.size, image_path.name, names, frame_w, frame_h, cols)
    json_path.write_text(json.dumps(atlas, indent=2) + "\n", encoding="utf-8")
    return True


def update_manifest(player_from_source: bool, projectile_mode: str, effects_mode: str) -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    for entry in manifest.get("entries", []):
        atlas_key = entry.get("atlasKey")
        if atlas_key == "atlas_player_main":
            entry["frame"] = {"width": PLAYER_OUTPUT_FRAME_W, "height": PLAYER_OUTPUT_FRAME_H}
            if player_from_source:
                entry["notes"] = (
                    "Generated from source/player/player_full_combat_sheet_v1_20260207_201355.png "
                    "via deterministic pose-window extraction."
                )
            else:
                entry["notes"] = (
                    "Generated from sentinel_rook pixel template via deterministic hue remap. "
                    "Fallback active because player source sheet was missing."
                )
        elif atlas_key == "atlas_projectiles_core":
            entry["frame"] = {"width": 20, "height": 20}
            entry["notes"] = (
                "Generated from "
                + (
                    "free-source pack inputs (RobotFree objects + OpenGameArt FX sheets)."
                    if projectile_mode == "free-source"
                    else "source/projectiles/projectile_fx_sheet_v1_20260207_203656.png via deterministic component extraction."
                )
            )
        elif atlas_key == "atlas_effects_core":
            entry["frame"] = {"width": 20, "height": 20}
            entry["notes"] = (
                "Generated from "
                + (
                    "free-source pack inputs (RobotFree muzzle frames + OpenGameArt explosion/ring/aura sheets)."
                    if effects_mode == "free-source"
                    else "source/projectiles/projectile_fx_sheet_v1_20260207_203656.png via deterministic component extraction."
                )
            )
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    player_from_source = rebuild_player_atlas_from_source()
    if not player_from_source:
        rebuild_player_atlas_from_template()

    projectile_mode = "free-source"
    effect_mode = "free-source"
    projectile_built = rebuild_projectiles_from_free_sources(PROJECTILE_IMAGE_PATH, PROJECTILE_JSON_PATH, "projectiles_core")
    effect_built = rebuild_effects_from_free_sources(EFFECT_IMAGE_PATH, EFFECT_JSON_PATH, "effects_core")

    if not projectile_built:
        projectile_built = rebuild_core_sheet_from_source_components(
            PROJECTILE_IMAGE_PATH,
            PROJECTILE_JSON_PATH,
            "projectiles_core",
            PROJECTILE_COMPONENT_SEQUENCE,
        )
        projectile_mode = "component-source" if projectile_built else "procedural-fallback"
    if not effect_built:
        effect_built = rebuild_core_sheet_from_source_components(
            EFFECT_IMAGE_PATH,
            EFFECT_JSON_PATH,
            "effects_core",
            EFFECT_COMPONENT_SEQUENCE,
        )
        effect_mode = "component-source" if effect_built else "procedural-fallback"

    if not projectile_built:
        rebuild_core_sheet(PROJECTILE_IMAGE_PATH, PROJECTILE_JSON_PATH, "projectiles_core", draw_projectile_frame)
    if not effect_built:
        rebuild_core_sheet(EFFECT_IMAGE_PATH, EFFECT_JSON_PATH, "effects_core", draw_effect_frame)

    update_manifest(player_from_source, projectile_mode, effect_mode)
    player_mode = "source-sheet extraction" if player_from_source else "template fallback"
    core_mode = f"projectiles={projectile_mode}, effects={effect_mode}"
    print(f"[sprites] Rebuilt player/projectile/effects runtime atlases ({player_mode}, {core_mode})")


if __name__ == "__main__":
    main()
