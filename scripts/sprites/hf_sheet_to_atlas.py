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
import statistics
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MAGENTA = (255, 0, 255)


# --- Pure helpers (no PIL, no disk IO): unit-tested in test_hf_sheet_to_atlas.py ---------------------


def parse_grid(grid: str) -> tuple[int, int]:
    """'COLSxROWS' -> (cols, rows)."""
    cols_s, rows_s = grid.lower().split("x")
    return int(cols_s), int(rows_s)


def cell_rect(index: int, cols: int, cell_w: int, cell_h: int) -> tuple[int, int, int, int]:
    """Row-major linear cell index -> (x0, y0, x1, y1) in source pixels."""
    c, r = index % cols, index // cols
    return c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h


def parse_anims(anims: str) -> list[tuple[str, int, int]]:
    """'idle=0-3,turn=4-4' -> [('idle', 0, 3), ('turn', 4, 4)]."""
    result = []
    for part in anims.split(","):
        name, span = part.split("=")
        start_s, end_s = span.split("-")
        result.append((name.strip(), int(start_s), int(end_s)))
    return result


def anim_names_by_index(anims: list[tuple[str, int, int]], type_key: str) -> dict[int, str]:
    """Expand parsed anim spans into '<type_key>/<name>/<local index>' per cell index."""
    mapping: dict[int, str] = {}
    for name, start, end in anims:
        for i in range(start, end + 1):
            mapping[i] = f"{type_key}/{name}/{i - start:03d}"
    return mapping


def parse_ref_cells(spec: str) -> list[int]:
    """'2,7' -> [2, 7]."""
    return [int(v) for v in spec.split(",") if v.strip() != ""]


def scale_from_reference_heights(reference_heights: list[float], body_height: float) -> float:
    """Global scale so the median of the reference cells' content heights becomes body_height."""
    if not reference_heights:
        raise ValueError("scale_from_reference_heights requires at least one reference height")
    median_height = statistics.median(reference_heights)
    if median_height <= 0:
        raise ValueError("median reference height must be positive")
    return body_height / median_height


def fit_scale_to_cell(content_w: int, content_h: int, cell: int) -> float:
    """1.0 if content already fits the cell; otherwise the uniform shrink factor that makes it fit."""
    if content_w <= cell and content_h <= cell:
        return 1.0
    return min(cell / content_w, cell / content_h)


def baseline_position(content_w: int, content_h: int, cell: int, baseline: int) -> tuple[int, int]:
    """Top-left (x, y) to paste content into a cell x cell square, feet on the baseline row, centred."""
    x = max(0, (cell - content_w) // 2)
    y = max(0, min(cell - content_h, baseline - content_h))
    return x, y


def atlas_grid_position(index: int, atlas_columns: int, cell: int) -> tuple[int, int]:
    """Frame order index -> (x, y) top-left in the output atlas grid."""
    c, r = index % atlas_columns, index // atlas_columns
    return c * cell, r * cell


def atlas_grid_size(frame_count: int, atlas_columns: int, cell: int) -> tuple[int, int]:
    """Pixel size of an atlas holding frame_count frames, atlas_columns wide, cell px square."""
    if frame_count == 0:
        return 0, 0
    cols = min(atlas_columns, frame_count)
    rows = -(-frame_count // atlas_columns)  # ceil division
    return cols * cell, rows * cell


def connected_component_areas(mask: list[list[bool]]) -> list[list[tuple[int, int]]]:
    """4-connected components of True cells in a 2D boolean grid; each is a list of (x, y) pixels."""
    h = len(mask)
    w = len(mask[0]) if h else 0
    visited = [[False] * w for _ in range(h)]
    components: list[list[tuple[int, int]]] = []
    for y in range(h):
        for x in range(w):
            if mask[y][x] and not visited[y][x]:
                stack = [(x, y)]
                visited[y][x] = True
                coords: list[tuple[int, int]] = []
                while stack:
                    cx, cy = stack.pop()
                    coords.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not visited[ny][nx]:
                            visited[ny][nx] = True
                            stack.append((nx, ny))
                components.append(coords)
    return components


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


def measure_content_height(image: Image.Image) -> int:
    bounds = content_bounds(image)
    if not bounds:
        return 0
    return bounds[3] - bounds[1]


def drop_small_components(image: Image.Image, min_area: int) -> Image.Image:
    """Zero the alpha of any connected opaque speck smaller than min_area pixels (keying artefacts)."""
    if min_area <= 0:
        return image
    alpha = image.getchannel("A")
    w, h = alpha.size
    alpha_px = alpha.load()
    mask = [[alpha_px[x, y] > 0 for x in range(w)] for y in range(h)]
    components = connected_component_areas(mask)
    out = image.copy()
    out_px = out.load()
    for coords in components:
        if len(coords) < min_area:
            for x, y in coords:
                r, g, b, _a = out_px[x, y]
                out_px[x, y] = (r, g, b, 0)
    return out


def update_manifest(args: argparse.Namespace, image_path: Path, json_path: Path, target: int,
                    sources: list[str] | None = None) -> None:
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
        "notes": f"Original generated sheet ({args.generator}) cut by scripts/sprites/hf_sheet_to_atlas.py from "
                 f"{', '.join(Path(p).name for p in (sources or [args.input_path]))}.",
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


def cut_legacy(args: argparse.Namespace) -> None:
    """Bosses, enemies, effects: unchanged behaviour (single-row atlas, per-frame quantize)."""
    sheet = Image.open(args.input_path).convert("RGBA")
    cols, rows = parse_grid(args.grid)
    cell_w, cell_h = sheet.width // cols, sheet.height // rows
    target = int(args.cell)
    name_by_index = anim_names_by_index(parse_anims(args.anims), args.type_key)

    frames = []
    for index in range(cols * rows):
        x0, y0, x1, y1 = cell_rect(index, cols, cell_w, cell_h)
        cell = sheet.crop((x0, y0, x1, y1))
        keyed = key_magenta(cell, args.tolerance)
        small = keyed.resize((target, target), Image.Resampling.BOX)
        small = hard_alpha(small)
        small = quantize_rgba(small, args.colors)
        frame = Image.new("RGBA", (target, target), (0, 0, 0, 0))
        bounds = content_bounds(small)
        if bounds:
            content = small.crop(bounds)
            x, y = baseline_position(content.width, content.height, target, args.baseline)
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
                 "source": str(Path(args.input_path).as_posix()), "sources": sources, "generator": args.generator},
    }, json_path.open("w"), indent=2)

    update_manifest(args, image_path, json_path, target, sources)
    print(f"Wrote {image_path.relative_to(ROOT)} ({len(frames)} frames of {target}px) and updated {args.manifest}")


def load_existing_atlas(image_path: Path, json_path: Path) -> dict[str, Image.Image]:
    if not image_path.exists() or not json_path.exists():
        raise FileNotFoundError(
            f"--append requires an existing atlas at {image_path} and {json_path}; run once without --append first."
        )
    atlas = Image.open(image_path).convert("RGBA")
    data = json.load(json_path.open())
    frames: dict[str, Image.Image] = {}
    for name, entry in data["frames"].items():
        f = entry["frame"]
        frames[name] = atlas.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    return frames


def keep_largest_component(image: Image.Image) -> Image.Image:
    """Zero the alpha of everything but the largest connected opaque shape (the body): drops muzzle flashes and
    charge rings the model drew beside the cannon, which the runtime draws itself (05c, hero sheet B)."""
    alpha = image.getchannel("A")
    w, h = alpha.size
    alpha_px = alpha.load()
    mask = [[alpha_px[x, y] > 0 for x in range(w)] for y in range(h)]
    components = connected_component_areas(mask)
    if len(components) <= 1:
        return image
    keep = set(max(components, key=len))
    out = image.copy()
    out_px = out.load()
    for coords in components:
        if len(coords) == len(keep) and coords[0] in keep:
            continue
        for x, y in coords:
            r, g, b, _a = out_px[x, y]
            out_px[x, y] = (r, g, b, 0)
    return out


OUTLINE_RGB = (0x14, 0x1A, 0x26)


def is_magenta_fringe(r: int, g: int, b: int) -> bool:
    """A keyed edge pixel still tinted by the magenta background: red and blue both clearly above green."""
    return r > 70 and b > 70 and g < min(r, b) - 45


def defringe(image: Image.Image) -> Image.Image:
    """Clear magenta-tinted pixels the key left on the outline (they read as purple specks at 48px)."""
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and is_magenta_fringe(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    return out


UNDERSUIT_GREYS = ((0x8A, 0x94, 0xA6), (0x55, 0x5E, 0x6E), (0x30, 0x38, 0x48))


def has_magenta_cast(r: int, g: int, b: int) -> bool:
    """A grey or dark pixel pulled purple by the magenta key (red and blue both above green, red at least half of
    blue). The slate-blue armour (red about a third of blue) and the amber accents do not match."""
    return min(r, b) - g > 10 and r >= b * 0.55 and not (r > 150 and g > 90)


def decast(r: int, g: int, b: int) -> tuple[int, int, int]:
    """Map a purple-cast pixel onto the hero brief's undersuit greys or the outline, by brightness (05c art review:
    the joint rings read as red specks at 48px)."""
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    if lum >= 110:
        return UNDERSUIT_GREYS[0]
    if lum >= 62:
        return UNDERSUIT_GREYS[1]
    if lum >= 30:
        return UNDERSUIT_GREYS[2]
    return OUTLINE_RGB


def decast_image(image: Image.Image) -> Image.Image:
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and has_magenta_cast(r, g, b):
                px[x, y] = (*decast(r, g, b), a)
    return out


# The hero brief's accent and undersuit tones (docs/art/hero-brief.md). A plain median cut over the whole atlas
# let the small amber cluster merge into the greys (05c: the chest stripe turned grey-green), so the player
# atlas keeps these six as fixed palette entries.
HERO_FIXED_PALETTE = (
    (0xF2, 0xA9, 0x3B), (0xB8, 0x74, 0x1C), (0xFF, 0xD2, 0x7A),
    (0x8A, 0x94, 0xA6), (0x55, 0x5E, 0x6E), (0xC4, 0xCB, 0xD6),
)


def quantize_with_fixed(image: Image.Image, colors: int, fixed: tuple[tuple[int, int, int], ...]) -> Image.Image:
    """Median cut to `colors - len(fixed)` colours plus the fixed entries, mapped to the nearest colour, no dither."""
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    cut = rgb.quantize(colors=max(1, colors - len(fixed)), method=Image.Quantize.MEDIANCUT)
    cut_palette = cut.getpalette()[: 3 * max(1, colors - len(fixed))]
    palette = list(cut_palette) + [c for rgb3 in fixed for c in rgb3]
    palette += [0] * (768 - len(palette))
    pal_image = Image.new("P", (1, 1))
    pal_image.putpalette(palette)
    out = rgb.quantize(palette=pal_image, dither=Image.Dither.NONE).convert("RGBA")
    out.putalpha(alpha)
    return out


def mode_block_color(samples: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int]:
    """Most common opaque colour in a block, transparent when at most half the block is opaque."""
    opaque = [p[:3] for p in samples if p[3] > 0]
    if len(opaque) * 2 <= len(samples):
        return (0, 0, 0, 0)
    counts: dict[tuple[int, int, int], int] = {}
    for c in opaque:
        counts[c] = counts.get(c, 0) + 1
    best = max(counts.items(), key=lambda item: (item[1], -sum(item[0])))[0]
    return (best[0], best[1], best[2], 255)


def mode_downscale(image: Image.Image, scale: float, colors: int = 24) -> Image.Image:
    """Pixel-art downscale: quantize the source cell, then take the most common colour of each source block, so
    flat colours and hard edges survive instead of being averaged across the model's pixel grid (05c)."""
    if scale >= 1.0:
        return image
    # The fixed accent tones keep a small amber stripe or lamp from merging into the blues (05c art review).
    flat = quantize_with_fixed(image, colors + len(HERO_FIXED_PALETTE), HERO_FIXED_PALETTE)
    src = flat.load()
    out_w, out_h = max(1, round(image.width * scale)), max(1, round(image.height * scale))
    out = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    dst = out.load()
    for oy in range(out_h):
        y0, y1 = int(oy / scale), max(int(oy / scale) + 1, int((oy + 1) / scale))
        for ox in range(out_w):
            x0, x1 = int(ox / scale), max(int(ox / scale) + 1, int((ox + 1) / scale))
            samples = [src[x, y] for y in range(y0, min(y1, image.height)) for x in range(x0, min(x1, image.width))]
            dst[ox, oy] = mode_block_color(samples) if samples else (0, 0, 0, 0)
    return out


def add_outline(image: Image.Image, rgb: tuple[int, int, int] = OUTLINE_RGB) -> Image.Image:
    """A 1px outline outside the silhouette (4-neighbourhood), grown by one pixel on every side first."""
    grown = Image.new("RGBA", (image.width + 2, image.height + 2), (0, 0, 0, 0))
    grown.paste(image, (1, 1))
    src = grown.copy().load()
    dst = grown.load()
    for y in range(grown.height):
        for x in range(grown.width):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < grown.width and 0 <= ny < grown.height and src[nx, ny][3]:
                    dst[x, y] = (rgb[0], rgb[1], rgb[2], 255)
                    break
    return grown


def is_flash(r: int, g: int, b: int) -> bool:
    """A drawn muzzle flash or charge ring: pale yellow to white. The body's amber accents stay under g 210."""
    return r >= 224 and g >= 224


def clear_flash(image: Image.Image) -> Image.Image:
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and is_flash(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    return out


def dominant_component(image: Image.Image):
    """(bbox of the largest opaque shape, its share of all opaque pixels), or (None, 0.0) for an empty image."""
    alpha = image.getchannel("A")
    w, h = alpha.size
    alpha_px = alpha.load()
    mask = [[alpha_px[x, y] > 0 for x in range(w)] for y in range(h)]
    components = connected_component_areas(mask)
    if not components:
        return None, 0.0, components
    largest = max(components, key=len)
    xs = [x for x, _ in largest]
    ys = [y for _, y in largest]
    total = sum(len(c) for c in components)
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1), len(largest) / total, components


def drop_shadows(image: Image.Image) -> Image.Image:
    """Drop small shapes lying below the body's feet (drawn ground shadows); they lifted frames off the baseline.
    Only when one shape clearly is the body (half the opaque pixels or more), so scattered fragments stay."""
    bbox, share, components = dominant_component(image)
    if bbox is None or share < 0.5:
        return image
    largest_area = max(len(c) for c in components)
    body_bottom = bbox[3]
    out = image.copy()
    px = out.load()
    for coords in components:
        if len(coords) >= largest_area * 0.08:
            continue
        if min(y for _, y in coords) >= body_bottom - max(2, (bbox[3] - bbox[1]) // 10):
            for x, y in coords:
                r, g, b, _a = px[x, y]
                px[x, y] = (r, g, b, 0)
    return out


def body_anchor_x(content: Image.Image) -> float:
    """Horizontal centre of the body (the dominant shape) inside the cropped content, else the content centre."""
    bbox, share, _components = dominant_component(content)
    if bbox is None or share < 0.5:
        return content.width / 2
    return (bbox[0] + bbox[2]) / 2


def build_player_frame(
    sheet: Image.Image,
    index: int,
    cols: int,
    cell_w: int,
    cell_h: int,
    global_scale: float,
    target: int,
    baseline: int,
    tolerance: int,
    min_component_area: int,
    body_only: bool = False,
    outline: bool = True,
    flash: bool = False,
) -> tuple[Image.Image, bool]:
    """One player cell -> a target x target frame, feet on baseline. Returns (frame, was_shrunk_to_fit)."""
    x0, y0, x1, y1 = cell_rect(index, cols, cell_w, cell_h)
    keyed = defringe(key_magenta(sheet.crop((x0, y0, x1, y1)), tolerance))
    if min_component_area > 0:
        keyed = drop_small_components(keyed, min_component_area)
    if flash:
        keyed = clear_flash(keyed)
    if body_only or flash:
        keyed = keep_largest_component(keyed)
    keyed = drop_shadows(keyed)
    if global_scale != 1.0:
        keyed = mode_downscale(keyed, global_scale)
    keyed = decast_image(hard_alpha(keyed))
    if outline:
        bounds = content_bounds(keyed)
        if bounds:
            keyed = add_outline(keyed.crop(bounds))

    frame = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    bounds = content_bounds(keyed)
    if not bounds:
        return frame, False

    content = keyed.crop(bounds)
    # Nothing shrinks: content wider than the cell or taller than the baseline is clipped at the cell edge (a
    # raised blade tip, the beam-in column), so the body keeps one size across an animation; a whole-frame
    # shrink made slash frames pulse. The frame is reported so the audit can check it is an effect group.
    shrunk = content.height > baseline or content.width > target
    if content.height > baseline:
        content = content.crop((0, content.height - baseline, content.width, content.height))

    # Anchor on the body, not the whole drawing: a cannon held forward or a blade would shift the body sideways.
    x = round(target / 2 - body_anchor_x(content))
    y = baseline - content.height
    frame.paste(content, (x, y), content)
    return frame, shrunk


def cut_player(args: argparse.Namespace) -> None:
    """Player: grid atlas (--atlas-columns), optional body-height normalisation, one global quantize,
    --append merges into the existing atlas by frame name."""
    sheet = Image.open(args.input_path).convert("RGBA")
    cols, rows = parse_grid(args.grid)
    cell_w, cell_h = sheet.width // cols, sheet.height // rows
    target = int(args.cell)
    name_by_index = anim_names_by_index(parse_anims(args.anims), args.type_key)

    global_scale = 1.0
    if args.body_height is not None:
        heights = []
        for i in parse_ref_cells(args.scale_ref_cells):
            x0, y0, x1, y1 = cell_rect(i, cols, cell_w, cell_h)
            heights.append(measure_content_height(key_magenta(sheet.crop((x0, y0, x1, y1)), args.tolerance)))
        global_scale = scale_from_reference_heights(heights, args.body_height)

    body_only_cells = set(parse_ref_cells(args.body_only_cells)) if args.body_only_cells else set()
    flash_cells = set(parse_ref_cells(args.flash_cells)) if args.flash_cells else set()
    new_frames: dict[str, Image.Image] = {}
    shrunk_names: list[str] = []
    for index in range(cols * rows):
        name = name_by_index.get(index)
        if name is None:
            continue
        frame, shrunk = build_player_frame(
            sheet, index, cols, cell_w, cell_h, global_scale, target, args.baseline, args.tolerance,
            args.min_component_area, index in body_only_cells, not args.no_outline, index in flash_cells,
        )
        new_frames[name] = frame
        if shrunk:
            shrunk_names.append(name)

    out_dir = ROOT / args.out_dir if args.out_dir else ROOT / "assets" / "sprites" / "player" / "main"
    out_dir.mkdir(parents=True, exist_ok=True)
    image_path = out_dir / f"{args.type_key}.png"
    json_path = out_dir / f"{args.type_key}.atlas.json"

    sources = [Path(args.input_path).as_posix()]
    if args.append:
        frames = load_existing_atlas(image_path, json_path)
        # A group this run cuts replaces that whole group (5.5 review: a re-cut with fewer frames kept the old
        # tail frames and mixed two sheets in one animation).
        new_groups = {name.rsplit("/", 1)[0] + "/" for name in new_frames}
        frames = {name: frame for name, frame in frames.items() if name.rsplit("/", 1)[0] + "/" not in new_groups}
        order = list(frames.keys())
        frames.update(new_frames)
        if json_path.exists():
            previous = json.load(json_path.open()).get("meta", {}).get("sources")
            previous = previous or [json.load(json_path.open()).get("meta", {}).get("source")]
            sources = [p for p in previous if p and p != sources[0]] + sources
        for name in new_frames:
            if name not in order:
                order.append(name)
    else:
        frames = new_frames
        order = list(new_frames.keys())

    atlas_w, atlas_h = atlas_grid_size(len(order), args.atlas_columns, target)
    atlas = Image.new("RGBA", (max(atlas_w, target), max(atlas_h, target)), (0, 0, 0, 0))
    entries = {}
    for i, name in enumerate(order):
        gx, gy = atlas_grid_position(i, args.atlas_columns, target)
        atlas.paste(frames[name], (gx, gy))
        entries[name] = {
            "frame": {"x": gx, "y": gy, "w": target, "h": target},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": target, "h": target},
            "sourceSize": {"w": target, "h": target},
        }

    atlas = quantize_with_fixed(atlas, args.colors, HERO_FIXED_PALETTE)
    atlas.save(image_path)
    json.dump({
        "frames": entries,
        "meta": {"app": "scripts/sprites/hf_sheet_to_atlas.py", "version": "1.0", "image": image_path.name,
                 "format": "RGBA8888", "size": {"w": atlas.width, "h": atlas.height}, "scale": "1",
                 "source": str(Path(args.input_path).as_posix()), "sources": sources, "generator": args.generator},
    }, json_path.open("w"), indent=2)

    update_manifest(args, image_path, json_path, target, sources)

    if shrunk_names:
        print(f"Clipped at the {target}px cell edge: {', '.join(shrunk_names)}")
    print(
        f"Wrote {image_path.relative_to(ROOT)} ({len(order)} frames total, {len(new_frames)} from this sheet) "
        f"and updated {args.manifest}"
    )


def cut(args: argparse.Namespace) -> None:
    if (args.body_height is None) != (args.scale_ref_cells is None):
        raise SystemExit("--body-height and --scale-ref-cells must be given together")
    if args.category == "player":
        cut_player(args)
    else:
        cut_legacy(args)


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
    parser.add_argument("--body-height", dest="body_height", type=float, default=None,
                         help="Player only: target body height in cell px; scales the sheet by "
                              "body-height / median content height of --scale-ref-cells")
    parser.add_argument("--scale-ref-cells", dest="scale_ref_cells", default=None,
                         help="Player only: comma-separated linear cell indices used to measure body height")
    parser.add_argument("--atlas-columns", dest="atlas_columns", type=int, default=16,
                         help="Player only: output atlas grid width in frames")
    parser.add_argument("--append", action="store_true",
                         help="Player only: merge into the existing atlas (same names replaced, others kept)")
    parser.add_argument("--no-outline", dest="no_outline", action="store_true",
                        help="player: skip the 1px #141A26 outline added outside the silhouette")
    parser.add_argument("--flash-cells", dest="flash_cells", default=None,
                        help="i,j,...: clear drawn muzzle flashes and charge rings (pale yellow) and keep the body")
    parser.add_argument("--body-only-cells", dest="body_only_cells", default=None,
                        help="i,j,...: keep only the largest connected shape in these cells (drops drawn muzzle flashes)")
    parser.add_argument("--min-component-area", dest="min_component_area", type=int, default=0,
                         help="Player only: drop isolated keyed specks under this many pixels")
    cut(parser.parse_args())


if __name__ == "__main__":
    main()
