#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import urllib.request
from collections import Counter, deque
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = ROOT / "scripts/sprites/private_megaman_override_spec.json"
BASE_MANIFEST_PATH = ROOT / "assets/sprites/manifest.v1.json"
PLAYER_BASE_ATLAS_IMAGE = ROOT / "assets/sprites/player/main/player_main.png"
PLAYER_BASE_ATLAS_JSON = ROOT / "assets/sprites/player/main/player_main.atlas.json"

PRIVATE_SOURCE_ROOT = ROOT / "assets/private/source"
PRIVATE_RUNTIME_ROOT = ROOT / "assets/private/runtime"
PRIVATE_PLAYER_DIR = PRIVATE_RUNTIME_ROOT / "player"
PRIVATE_BOSS_DIR = PRIVATE_RUNTIME_ROOT / "bosses"
PRIVATE_MANIFEST_PATH = PRIVATE_RUNTIME_ROOT / "private-sprite-overrides.manifest.json"

PLAYER_FRAME_W = 48
PLAYER_FRAME_H = 48
PLAYER_BASELINE_Y = 46
PLAYER_SWORD_FX_FRAME_W = 96
PLAYER_SWORD_FX_FRAME_H = 96


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_dirs() -> None:
    PRIVATE_SOURCE_ROOT.mkdir(parents=True, exist_ok=True)
    PRIVATE_RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    PRIVATE_PLAYER_DIR.mkdir(parents=True, exist_ok=True)
    PRIVATE_BOSS_DIR.mkdir(parents=True, exist_ok=True)


def download_if_missing(url: str, destination: Path) -> None:
    if destination.exists():
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CodexPrivateSpriteBuilder/1.0"
        },
    )
    with urllib.request.urlopen(request) as response:
        destination.write_bytes(response.read())


def determine_background_color(image: Image.Image) -> Tuple[int, int, int]:
    samples = []
    pixels = image.load()
    for x in range(image.width):
        samples.append(pixels[x, 0])
        samples.append(pixels[x, image.height - 1])
    for y in range(image.height):
        samples.append(pixels[0, y])
        samples.append(pixels[image.width - 1, y])
    opaque_samples = [sample for sample in samples if sample[3] > 0]
    if not opaque_samples:
        for y in range(image.height):
            for x in range(image.width):
                sample = pixels[x, y]
                if sample[3] > 0:
                    opaque_samples.append(sample)
    if not opaque_samples:
        return (0, 0, 0)
    rgb_samples = [(sample[0], sample[1], sample[2]) for sample in opaque_samples]
    return Counter(rgb_samples).most_common(1)[0][0]


HIGHLIGHT_BOX_COLOR: Tuple[int, int, int] = (84, 165, 75)


def keyed_transparent(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    bg = determine_background_color(rgba)
    out = rgba.copy()
    pixels = out.load()
    visited = [[False for _ in range(out.width)] for _ in range(out.height)]

    def close_enough(pixel: Tuple[int, int, int, int], target: Tuple[int, int, int], tolerance: int = 26) -> bool:
        return (
            abs(int(pixel[0]) - target[0]) <= tolerance
            and abs(int(pixel[1]) - target[1]) <= tolerance
            and abs(int(pixel[2]) - target[2]) <= tolerance
        )

    queue = deque()
    for x in range(out.width):
        queue.append((x, 0))
        queue.append((x, out.height - 1))
    for y in range(out.height):
        queue.append((0, y))
        queue.append((out.width - 1, y))

    while queue:
        x, y = queue.popleft()
        if not (0 <= x < out.width and 0 <= y < out.height):
            continue
        if visited[y][x]:
            continue
        visited[y][x] = True
        pixel = pixels[x, y]
        if not close_enough(pixel, bg):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))

    # Some sheets draw a flat green highlight box behind certain frames; the flood fill never reaches
    # it because sprites enclose it. Key that exact green everywhere (tight tolerance, flat color).
    for y in range(out.height):
        for x in range(out.width):
            pixel = pixels[x, y]
            if pixel[3] and close_enough(pixel, HIGHLIGHT_BOX_COLOR, tolerance=8):
                pixels[x, y] = (0, 0, 0, 0)

    return out


def strip_matte_color(image: Image.Image, *, tolerance: int = 18) -> Image.Image:
    rgba = image.convert("RGBA")
    bg = determine_background_color(rgba)
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if (
                abs(int(r) - bg[0]) <= tolerance
                and abs(int(g) - bg[1]) <= tolerance
                and abs(int(b) - bg[2]) <= tolerance
            ):
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def crop_alpha_bounds(image: Image.Image, alpha_threshold: int = 8) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value >= alpha_threshold else 0).getbbox()
    return image.crop(bbox) if bbox else image


def extract_components(image: Image.Image, *, alpha_threshold: int = 16, min_area: int = 60) -> List[Image.Image]:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    visited = [[False for _ in range(image.width)] for _ in range(image.height)]
    components: List[Tuple[int, int, int, int]] = []

    for y in range(image.height):
        for x in range(image.width):
            if visited[y][x] or pixels[x, y] < alpha_threshold:
                continue
            queue = deque([(x, y)])
            visited[y][x] = True
            points: List[Tuple[int, int]] = []
            while queue:
                cx, cy = queue.popleft()
                points.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < image.width and 0 <= ny < image.height and not visited[ny][nx] and pixels[nx, ny] >= alpha_threshold:
                        visited[ny][nx] = True
                        queue.append((nx, ny))
            if len(points) < min_area:
                continue
            xs = [point[0] for point in points]
            ys = [point[1] for point in points]
            components.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1))

    components.sort(key=lambda bounds: (bounds[1], bounds[0]))
    extracted: List[Image.Image] = []
    for bounds in components:
        crop = crop_alpha_bounds(image.crop(bounds))
        crop = keyed_transparent(crop)
        crop = strip_matte_color(crop)
        extracted.append(crop_alpha_bounds(crop))
    return extracted


def render_to_frame(
    sprite: Image.Image,
    *,
    frame_w: int,
    frame_h: int,
    baseline_y: int,
    target_height: int,
    max_width: int | None = None,
    squash_x: float = 1.0,
    squash_y: float = 1.0,
    brighten: float = 1.0,
    offset_x: int = 0,
) -> Image.Image:
    rendered = crop_alpha_bounds(sprite.convert("RGBA"))
    if abs(squash_x - 1.0) > 1e-6 or abs(squash_y - 1.0) > 1e-6:
        rendered = rendered.resize(
            (
                max(1, int(round(rendered.width * squash_x))),
                max(1, int(round(rendered.height * squash_y))),
            ),
            Image.Resampling.NEAREST,
        )

    if abs(brighten - 1.0) > 1e-6:
        rgba = rendered.load()
        for y in range(rendered.height):
            for x in range(rendered.width):
                r, g, b, a = rgba[x, y]
                if a == 0:
                    continue
                rgba[x, y] = (
                    max(0, min(255, int(round(r * brighten)))),
                    max(0, min(255, int(round(g * brighten)))),
                    max(0, min(255, int(round(b * brighten)))),
                    a,
                )

    fit = target_height / max(1, rendered.height)
    if max_width is not None and rendered.width * fit > max_width:
        fit = max_width / max(1, rendered.width)

    scaled = rendered.resize(
        (
            max(1, int(round(rendered.width * fit))),
            max(1, int(round(rendered.height * fit))),
        ),
        Image.Resampling.NEAREST,
    )

    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    paste_x = max(0, min(frame_w - scaled.width, (frame_w - scaled.width) // 2 + offset_x))
    paste_y = max(0, min(frame_h - scaled.height, baseline_y - scaled.height))
    frame.paste(scaled, (paste_x, paste_y), scaled)
    return frame


def render_effect_to_frame(
    sprite: Image.Image,
    *,
    frame_w: int,
    frame_h: int,
    target_height: int,
    max_width: int | None = None,
    brighten: float = 1.0,
    offset_x: int = 0,
    offset_y: int = 0,
) -> Image.Image:
    rendered = crop_alpha_bounds(sprite.convert("RGBA"))

    if abs(brighten - 1.0) > 1e-6:
        rgba = rendered.load()
        for y in range(rendered.height):
            for x in range(rendered.width):
                r, g, b, a = rgba[x, y]
                if a == 0:
                    continue
                rgba[x, y] = (
                    max(0, min(255, int(round(r * brighten)))),
                    max(0, min(255, int(round(g * brighten)))),
                    max(0, min(255, int(round(b * brighten)))),
                    a,
                )

    fit = target_height / max(1, rendered.height)
    if max_width is not None and rendered.width * fit > max_width:
        fit = max_width / max(1, rendered.width)

    scaled = rendered.resize(
        (
            max(1, int(round(rendered.width * fit))),
            max(1, int(round(rendered.height * fit))),
        ),
        Image.Resampling.NEAREST,
    )

    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    paste_x = max(0, min(frame_w - scaled.width, (frame_w - scaled.width) // 2 + offset_x))
    paste_y = max(0, min(frame_h - scaled.height, (frame_h - scaled.height) // 2 + offset_y))
    frame.paste(scaled, (paste_x, paste_y), scaled)
    return frame


def isolate_arc_pixels(sprite: Image.Image, *, keep_components: int = 2) -> Image.Image:
    rgba = sprite.convert("RGBA")
    src = rgba.load()
    mask = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    dst = mask.load()

    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = src[x, y]
            if a == 0:
                continue
            is_green_arc = g >= 90 and g >= r + 18 and g >= b - 10
            is_bright_arc = r >= 205 and g >= 220 and b >= 205
            if is_green_arc or is_bright_arc:
                dst[x, y] = (r, g, b, a)

    cropped = crop_alpha_bounds(mask)
    alpha = cropped.getchannel("A")
    pixels = alpha.load()
    visited = [[False for _ in range(cropped.width)] for _ in range(cropped.height)]
    components: List[List[Tuple[int, int]]] = []

    for y in range(cropped.height):
        for x in range(cropped.width):
            if visited[y][x] or pixels[x, y] == 0:
                continue
            queue = deque([(x, y)])
            visited[y][x] = True
            component: List[Tuple[int, int]] = []
            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < cropped.width and 0 <= ny < cropped.height and not visited[ny][nx] and pixels[nx, ny] > 0:
                        visited[ny][nx] = True
                        queue.append((nx, ny))
            components.append(component)

    if not components:
        return cropped

    keep = set()
    for component in sorted(components, key=len, reverse=True)[: max(1, keep_components)]:
        keep.update(component)

    out = Image.new("RGBA", cropped.size, (0, 0, 0, 0))
    out_pixels = out.load()
    cropped_pixels = cropped.load()
    for x, y in keep:
        out_pixels[x, y] = cropped_pixels[x, y]
    return crop_alpha_bounds(out)


def atlas_payload(
    frame_names: Sequence[str],
    *,
    frame_w: int,
    frame_h: int,
    columns: int,
    image_name: str,
    image_w: int,
    image_h: int,
) -> Dict:
    frames = {}
    for index, name in enumerate(frame_names):
        x = (index % columns) * frame_w
        y = (index // columns) * frame_h
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
            "app": "codex.private_megaman_override_builder",
            "version": "1.0",
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": image_w, "h": image_h},
            "scale": "1",
        },
    }


def write_atlas(frame_images: Dict[str, Image.Image], image_path: Path, json_path: Path, *, frame_w: int, frame_h: int) -> None:
    names = sorted(frame_images.keys())
    columns = max(1, math.ceil(math.sqrt(len(names))))
    rows = math.ceil(len(names) / columns)
    atlas = Image.new("RGBA", (columns * frame_w, rows * frame_h), (0, 0, 0, 0))
    for index, name in enumerate(names):
        frame = frame_images[name]
        x = (index % columns) * frame_w
        y = (index // columns) * frame_h
        atlas.paste(frame, (x, y), frame)
    atlas.save(image_path)
    json_path.write_text(
        json.dumps(
            atlas_payload(
                names,
                frame_w=frame_w,
                frame_h=frame_h,
                columns=columns,
                image_name=image_path.name,
                image_w=atlas.width,
                image_h=atlas.height,
            ),
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def load_base_player_frames() -> Dict[str, Image.Image]:
    atlas_image = Image.open(PLAYER_BASE_ATLAS_IMAGE).convert("RGBA")
    atlas_data = load_json(PLAYER_BASE_ATLAS_JSON)
    frames: Dict[str, Image.Image] = {}
    for name, payload in atlas_data["frames"].items():
        frame = payload["frame"]
        x = int(frame["x"])
        y = int(frame["y"])
        w = int(frame["w"])
        h = int(frame["h"])
        frames[name] = atlas_image.crop((x, y, x + w, y + h)).copy()
    return frames


def load_base_player_groups(frame_images: Dict[str, Image.Image]) -> List[str]:
    return sorted({name.split("/")[1] for name in frame_images if name.startswith("player_main/") and name.count("/") >= 2})


def sorted_group_frame_names(frame_images: Dict[str, Image.Image], prefix: str) -> List[str]:
    return sorted((name for name in frame_images.keys() if name.startswith(prefix)), key=lambda name: name)


def replace_player_group(
    frame_images: Dict[str, Image.Image],
    components: Sequence[Image.Image],
    group_name: str,
    group_spec: dict,
) -> None:
    prefix = f"player_main/{group_name}/"
    target_names = sorted_group_frame_names(frame_images, prefix)
    target_count = max(len(target_names), len(group_spec["indices"]))
    if len(target_names) < target_count:
        target_names.extend([f"{prefix}{index:03d}" for index in range(len(target_names), target_count)])

    for stale_name in target_names[len(group_spec["indices"]) :]:
        frame_images.pop(stale_name, None)

    for position, component_index in enumerate(group_spec["indices"]):
        if position >= len(target_names):
            break
        component = components[component_index]
        if group_spec.get("flipX"):
            # Some rows of the ripped sheet (the dash set) are stored facing left; the runtime flips
            # by facing, so mirror them here to match the right-facing convention of every other pose.
            component = ImageOps.mirror(component)
        frame_images[target_names[position]] = render_to_frame(
            component,
            frame_w=PLAYER_FRAME_W,
            frame_h=PLAYER_FRAME_H,
            baseline_y=PLAYER_BASELINE_Y,
            target_height=int(group_spec.get("targetHeight", 42)),
            max_width=int(group_spec.get("maxWidth", PLAYER_FRAME_W - 4)),
            squash_x=float(group_spec.get("squashX", 1.0)),
            squash_y=float(group_spec.get("squashY", 1.0)),
            offset_x=int(group_spec.get("offsetX", 0)),
            brighten=float(group_spec.get("brighten", 1.0)),
        )


def build_player_sword_fx_override(spec: dict, components_by_source: Dict[str, List[Image.Image]]) -> dict:
    source_id = str(spec["sourceId"])
    components = components_by_source.get(source_id)
    if components is None:
        raise ValueError(f"Player sword FX override references unknown sourceId '{source_id}'")

    frame_images: Dict[str, Image.Image] = {}
    for position, component_index in enumerate(spec["indices"]):
        source_sprite = components[component_index]
        if bool(spec.get("arcOnly", False)):
            source_sprite = isolate_arc_pixels(source_sprite, keep_components=int(spec.get("keepComponents", 2)))
        frame_images[f"player_sword_fx/core/{position:03d}"] = render_effect_to_frame(
            source_sprite,
            frame_w=int(spec.get("frameWidth", PLAYER_SWORD_FX_FRAME_W)),
            frame_h=int(spec.get("frameHeight", PLAYER_SWORD_FX_FRAME_H)),
            target_height=int(spec.get("targetHeight", 56)),
            max_width=int(spec.get("maxWidth", PLAYER_SWORD_FX_FRAME_W - 4)),
            brighten=float(spec.get("brighten", 1.0)),
            offset_x=int(spec.get("offsetX", 0)),
            offset_y=int(spec.get("offsetY", 0)),
        )

    image_path = PRIVATE_PLAYER_DIR / "player_sword_fx.png"
    json_path = PRIVATE_PLAYER_DIR / "player_sword_fx.atlas.json"
    write_atlas(
        frame_images,
        image_path,
        json_path,
        frame_w=int(spec.get("frameWidth", PLAYER_SWORD_FX_FRAME_W)),
        frame_h=int(spec.get("frameHeight", PLAYER_SWORD_FX_FRAME_H)),
    )

    return {
        "id": "private-player-sword-fx",
        "atlasKey": "atlas_player_sword_fx",
        "frame": {
            "width": int(spec.get("frameWidth", PLAYER_SWORD_FX_FRAME_W)),
            "height": int(spec.get("frameHeight", PLAYER_SWORD_FX_FRAME_H)),
        },
        "status": "ready",
        "source": {
            "runtimeImage": "/assets/private/runtime/player/player_sword_fx.png",
            "runtimeData": "/assets/private/runtime/player/player_sword_fx.atlas.json",
            "localImagePath": "assets/private/runtime/player/player_sword_fx.png",
            "localDataPath": "assets/private/runtime/player/player_sword_fx.atlas.json",
        },
        "notes": (
            "Private local sword FX override built from the Command Mission PS1-style X saber arcs. "
            "Used to make slash impacts visibly larger and more readable without changing gameplay balance."
        ),
    }


def build_player_override_entries(spec: dict, base_manifest: dict) -> List[dict]:
    source_path = PRIVATE_SOURCE_ROOT / spec["source"]["targetFile"]
    download_if_missing(spec["source"]["imageUrl"], source_path)
    source_ids = {str(spec["source"]["id"]): source_path}
    for extra in spec.get("extras", []):
        extra_path = PRIVATE_SOURCE_ROOT / extra["targetFile"]
        download_if_missing(extra["imageUrl"], extra_path)
        source_ids[str(extra["id"])] = extra_path

    components_by_source: Dict[str, List[Image.Image]] = {}
    component_min_area = int(spec.get("componentMinArea", 100))
    for source_id, path in source_ids.items():
        components_by_source[source_id] = extract_components(
            keyed_transparent(Image.open(path)),
            min_area=component_min_area,
        )

    default_source_id = str(spec["source"]["id"])
    frame_images = load_base_player_frames()
    required_groups = load_base_player_groups(frame_images)
    declared_groups = set(spec["groups"].keys())
    missing_groups = [group for group in required_groups if group not in declared_groups]
    if missing_groups:
        raise ValueError(
            "Player override spec is missing explicit group rules for: " + ", ".join(missing_groups)
        )

    explicit_fallbacks: Dict[str, str] = {}
    for group_name in required_groups:
        group_spec = spec["groups"][group_name]
        mode = group_spec.get("mode", "source")
        if mode == "base":
            explicit_fallbacks[group_name] = str(group_spec.get("note", "Explicit base-atlas fallback"))
            continue
        source_id = str(group_spec.get("sourceId", default_source_id))
        components = components_by_source.get(source_id)
        if components is None:
            raise ValueError(f"Player override group '{group_name}' references unknown sourceId '{source_id}'")
        replace_player_group(frame_images, components, group_name, group_spec)

    image_path = PRIVATE_PLAYER_DIR / "player_main.png"
    json_path = PRIVATE_PLAYER_DIR / "player_main.atlas.json"
    write_atlas(frame_images, image_path, json_path, frame_w=PLAYER_FRAME_W, frame_h=PLAYER_FRAME_H)

    base_entry = next(entry for entry in base_manifest["entries"] if entry["atlasKey"] == "atlas_player_main")
    entries = [{
        "id": base_entry["id"],
        "atlasKey": "atlas_player_main",
        "frame": {"width": PLAYER_FRAME_W, "height": PLAYER_FRAME_H},
        "status": "ready",
        "source": {
            "runtimeImage": "/assets/private/runtime/player/player_main.png",
            "runtimeData": "/assets/private/runtime/player/player_main.atlas.json",
            "localImagePath": "assets/private/runtime/player/player_main.png",
            "localDataPath": "assets/private/runtime/player/player_main.atlas.json",
            "remoteImageUrl": spec["source"]["imageUrl"],
        },
        "notes": (
            "Private local override built from Mega Man X4/X5/X6 plus the custom Command Mission PS1-style X sheet on The Spriters Resource. "
            "All player atlas groups are now explicitly assigned through the private override spec. "
            "Player locomotion and combat states now resolve through the private Mega Man sheet mappings rather than legacy atlas carry-over, including dedicated X-authored saber poses."
        ),
        "groupFallbacks": explicit_fallbacks,
    }]

    sword_fx_spec = spec.get("swordFx")
    if sword_fx_spec:
        entries.append(build_player_sword_fx_override(sword_fx_spec, components_by_source))

    return entries


def build_boss_override(boss_id: str, spec: dict, base_manifest: dict) -> dict:
    source_path = PRIVATE_SOURCE_ROOT / spec["targetFile"]
    download_if_missing(spec["imageUrl"], source_path)
    components = extract_components(
        keyed_transparent(Image.open(source_path)),
        min_area=int(spec.get("componentMinArea", 60)),
    )

    base_entry = next(entry for entry in base_manifest["entries"] if entry["atlasKey"] == f"atlas_{boss_id}")
    frame_w = int(base_entry["frame"]["width"])
    frame_h = int(base_entry["frame"]["height"])
    frame_images: Dict[str, Image.Image] = {}

    for group_name in ("idle", "move", "shoot"):
        indices = spec["groups"][group_name]
        target_height = frame_h - 4 if group_name != "move" else frame_h - 6
        for position, component_index in enumerate(indices):
            frame_name = f"{boss_id}/{group_name}/{position:03d}"
            frame_images[frame_name] = render_to_frame(
                components[component_index],
                frame_w=frame_w,
                frame_h=frame_h,
                baseline_y=frame_h - 2,
                target_height=target_height,
                max_width=frame_w - 2,
            )

    image_path = PRIVATE_BOSS_DIR / f"{boss_id}.png"
    json_path = PRIVATE_BOSS_DIR / f"{boss_id}.json"
    write_atlas(frame_images, image_path, json_path, frame_w=frame_w, frame_h=frame_h)

    return {
        "id": base_entry["id"],
        "bossId": boss_id,
        "atlasKey": f"atlas_{boss_id}",
        "frame": {"width": frame_w, "height": frame_h},
        "status": "ready",
        "source": {
            "runtimeImage": f"/assets/private/runtime/bosses/{boss_id}.png",
            "runtimeData": f"/assets/private/runtime/bosses/{boss_id}.json",
            "localImagePath": f"assets/private/runtime/bosses/{boss_id}.png",
            "localDataPath": f"assets/private/runtime/bosses/{boss_id}.json",
            "remoteImageUrl": spec["imageUrl"],
        },
        "notes": (
            f"Private local override built from {spec['canonicalName']} on The Spriters Resource. "
            "Gameplay behavior is unchanged; this atlas only reskins the existing boss slot."
        ),
    }


def main() -> None:
    ensure_dirs()
    spec = load_json(SPEC_PATH)
    base_manifest = load_json(BASE_MANIFEST_PATH)

    override_entries = build_player_override_entries(spec["player"], base_manifest)
    for boss_id, boss_spec in spec["bosses"].items():
        override_entries.append(build_boss_override(boss_id, boss_spec, base_manifest))

    PRIVATE_MANIFEST_PATH.write_text(
        json.dumps(
            {
                "version": "1",
                "generatedAt": "2026-03-11",
                "entries": override_entries,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"[private-sprites] wrote {PRIVATE_MANIFEST_PATH}")
    for entry in override_entries:
        print(f"  - {entry['atlasKey']}")


if __name__ == "__main__":
    main()
