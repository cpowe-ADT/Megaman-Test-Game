#!/usr/bin/env python3
"""Cut the part 12i key art (EVAL-P8-003): the OMEGA RELAY logo and the eight story panels.

Sources are Higgsfield gpt_image_2 outputs kept under assets/ui/source/ (not shipped: dist excludes
assets/**/source). Prompts, job ids and result URLs: assets/ui/source/keyart_v1.prompts.md.

- Logo: key the flat magenta (and its fringe), crop to the lettering, box-downsample to LOGO_WIDTH,
  harden alpha, then snap every opaque pixel to the relay palette of docs/art/style-sheet.md.
  Writes assets/ui/logo/omega_relay_logo.png.
- Panels: box-downsample the 1344x752 still to the 448x252 game frame and quantize to 48 colours
  with an octree and no dithering after a small saturation lift. Writes assets/ui/story/<id>.png.

Run: .venv/bin/python scripts/sprites/cut_keyart_v1.py [--preview-logos <dir>]
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/ui/source'
LOGO_SOURCE = 'logo_v1_b.png'
LOGO_OUT = ROOT / 'assets/ui/logo/omega_relay_logo.png'
LOGO_WIDTH = 320
PANEL_SIZE = (448, 252)
# 48, not the 32 of a sprite atlas: at 32 colours the prologue city lost four of its eight district hues.
PANEL_COLOURS = 48
PANEL_SATURATION = 1.2

# Relay biome row of the style sheet plus the cool outline, the frost edge for the brightest shine, and the sky.
RELAY_PALETTE = ['#141A26', '#0E1622', '#1C2E47', '#304A6D', '#5C7FA8', '#8FB8DD', '#F2A93B', '#E23A3A']

PANELS = {
    'prologue_city': 'story_prologue_city_v1.png',
    'prologue_override': 'story_prologue_override_v2.png',
    'prologue_hangar': 'story_prologue_hangar_v1.png',
    'prologue_vale': 'story_prologue_vale_v1.png',
    'epilogue_dawn': 'story_epilogue_dawn_v1.png',
    'epilogue_streets': 'story_epilogue_streets_v1.png',
    'epilogue_archive': 'story_epilogue_archive_v1.png',
    'epilogue_choice': 'story_epilogue_choice_v1.png',
}


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip('#')
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def is_magenta(r: int, g: int, b: int) -> bool:
    # Flat #FF00FF and the anti-aliased fringe between it and the dark outline both have red and blue well above green.
    return min(r, b) - g > 50


def cut_logo(source: Path, width: int = LOGO_WIDTH) -> Image.Image:
    image = Image.open(source).convert('RGBA')
    outline = hex_rgb('#141A26')
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = pixels[x, y]
            if is_magenta(r, g, b):
                # Transparent pixels carry the outline colour so the box filter darkens edges instead of tinting them.
                pixels[x, y] = (*outline, 0)
    bbox = image.getchannel('A').getbbox()
    if bbox is None:
        raise SystemExit(f'{source}: nothing left after keying the magenta')
    image = image.crop(bbox)
    height = max(1, round(image.height * width / image.width))
    image = image.resize((width, height), Image.BOX)
    palette = [hex_rgb(value) for value in RELAY_PALETTE]
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a < 128:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            nearest = min(palette, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
            pixels[x, y] = (*nearest, 255)
    return image


def cut_panel(source: Path) -> Image.Image:
    image = Image.open(source).convert('RGB').resize(PANEL_SIZE, Image.BOX)
    # The 3x box filter averages thin bright lines (relay beams, override rings) into the night around them; a small
    # saturation lift gives them back. Octree keeps small accent hues that median cut merged into the navy.
    image = ImageEnhance.Color(image).enhance(PANEL_SATURATION)
    return image.quantize(colors=PANEL_COLOURS, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--preview-logos', type=Path, help='write every logo variant to this folder and stop')
    args = parser.parse_args()
    if args.preview_logos:
        args.preview_logos.mkdir(parents=True, exist_ok=True)
        for source in sorted(SOURCE.glob('logo_v1_*.png')):
            cut_logo(source).save(args.preview_logos / source.name)
        return
    LOGO_OUT.parent.mkdir(parents=True, exist_ok=True)
    logo = cut_logo(SOURCE / LOGO_SOURCE)
    logo.save(LOGO_OUT, optimize=True)
    print(f'{LOGO_OUT.relative_to(ROOT)} {logo.width}x{logo.height}')
    out_dir = ROOT / 'assets/ui/story'
    out_dir.mkdir(parents=True, exist_ok=True)
    for panel_id, name in PANELS.items():
        target = out_dir / f'{panel_id}.png'
        cut_panel(SOURCE / name).save(target, optimize=True)
        print(f'{target.relative_to(ROOT)} {target.stat().st_size} bytes')


if __name__ == '__main__':
    main()
