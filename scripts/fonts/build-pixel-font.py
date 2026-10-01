#!/usr/bin/env python3
"""Build OmegaPixel, the game's original pixel font, from its glyph table (part 12i, EVAL-P8-003).

Input:  assets/fonts/source/omega-pixel.glyphs.txt (8 rows per glyph; see its header)
Output: assets/fonts/omega-pixel.woff  web font for Phaser Text (fontTools; 1 font pixel = 128 units, em = 8 px)
        assets/fonts/omega-pixel.png   BMFont page (Pillow; white glyphs, one texel per font pixel)
        assets/fonts/omega-pixel.xml   BMFont descriptor for Phaser's load.bitmapFont (key 'font', size 8)

WOFF rather than WOFF2: fontTools needs the `brotli` module for WOFF2 and the project venv has only fontTools
and Pillow (D-021). Outputs are byte-for-byte reproducible (fixed head timestamps, no PNG metadata).

Usage: .venv/bin/python scripts/fonts/build-pixel-font.py [--check] [--preview output/fonts/omega-pixel-preview.png]
  --check    rebuild in memory and exit 1 if a committed output differs
  --preview  also write a preview: the BMFont and the rasterised TTF at 8px and 16px, for eyeballing
"""
import argparse
import io
import pathlib
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/fonts/source/omega-pixel.glyphs.txt'
OUT_DIR = ROOT / 'assets/fonts'
BASENAME = 'omega-pixel'
FAMILY = 'OmegaPixel'
ROWS = 8        # em height in font pixels
ASCENT = 6      # rows 0-5 sit above the baseline
DESCENT = ROWS - ASCENT
UNIT = 128      # font units per font pixel
FIXED_TIMESTAMP = 3_840_000_000  # seconds since 1904 (2025-09); fixed so rebuilds are identical
ATLAS_WIDTH = 128


def parse_glyphs(text):
    glyphs = {}
    lines = [line.rstrip('\n') for line in text.splitlines()]
    index = 0
    while index < len(lines):
        line = lines[index]
        index += 1
        if not line.strip() or line == '#' or line.startswith('# '):
            continue  # blank or comment; a glyph with too few rows fails below when a header lands in its rows
        if not line.startswith('U+'):
            raise ValueError(f'expected a U+XXXX header at line {index}: {line!r}')
        codepoint = int(line.split()[0][2:], 16)
        rows = lines[index:index + ROWS]
        index += ROWS
        if len(rows) != ROWS or any(set(row) - {'#', '.'} for row in rows):
            raise ValueError(f'U+{codepoint:04X}: need {ROWS} rows of # and .')
        width = len(rows[0])
        if width == 0 or any(len(row) != width for row in rows):
            raise ValueError(f'U+{codepoint:04X}: rows must share one non-zero width')
        if codepoint in glyphs:
            raise ValueError(f'U+{codepoint:04X} is defined twice')
        glyphs[codepoint] = rows
    missing = [cp for cp in range(32, 127) if cp not in glyphs]
    if missing:
        raise ValueError('missing ASCII glyphs: ' + ' '.join(f'U+{cp:04X}' for cp in missing))
    return dict(sorted(glyphs.items()))


def rectangles(rows):
    """Ink as rectangles: horizontal runs per row, merged down while a run repeats exactly."""
    open_runs = {}
    out = []
    for y, row in enumerate(rows + ['.' * len(rows[0])]):
        runs = set()
        x = 0
        while x < len(row):
            if row[x] == '#':
                start = x
                while x < len(row) and row[x] == '#':
                    x += 1
                runs.add((start, x))
            else:
                x += 1
        for run in sorted(set(open_runs) - runs):
            out.append((run[0], open_runs.pop(run), run[1], y))
        for run in sorted(runs - set(open_runs)):
            open_runs[run] = y
    return out


def glyph_name(codepoint):
    return 'space' if codepoint == 32 else f'uni{codepoint:04X}'


def build_ttf(glyphs):
    names = ['.notdef'] + [glyph_name(cp) for cp in glyphs]
    fb = FontBuilder(UNIT * ROWS, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap({cp: glyph_name(cp) for cp in glyphs})
    outlines = {}
    advances = {}
    notdef = ['....', '####', '#..#', '#..#', '#..#', '####', '....', '....']
    for name, rows in [('.notdef', notdef)] + [(glyph_name(cp), rows) for cp, rows in glyphs.items()]:
        pen = TTGlyphPen(None)
        for x0, y0, x1, y1 in rectangles(rows):
            left, right = x0 * UNIT, x1 * UNIT
            top, bottom = (ASCENT - y0) * UNIT, (ASCENT - y1) * UNIT
            # Clockwise (TrueType outer contour): up the left edge, across the top, down the right.
            pen.moveTo((left, bottom))
            pen.lineTo((left, top))
            pen.lineTo((right, top))
            pen.lineTo((right, bottom))
            pen.closePath()
        outlines[name] = pen.glyph()
        advances[name] = (len(rows[0]) + 1) * UNIT
    fb.setupGlyf(outlines)
    glyf = fb.font['glyf']
    fb.setupHorizontalMetrics({name: (advances[name], getattr(glyf[name], 'xMin', 0)) for name in names})
    fb.setupHorizontalHeader(ascent=ASCENT * UNIT, descent=-DESCENT * UNIT, lineGap=0)
    fb.setupNameTable({
        'familyName': FAMILY,
        'styleName': 'Regular',
        'uniqueFontIdentifier': f'{FAMILY}-Regular-1.000',
        'fullName': f'{FAMILY} Regular',
        'psName': f'{FAMILY}-Regular',
        'version': 'Version 1.000',
        'copyright': 'Original font for OMEGA Relay, drawn as a glyph table in assets/fonts/source',
    })
    fb.setupOS2(
        sTypoAscender=ASCENT * UNIT, sTypoDescender=-DESCENT * UNIT, sTypoLineGap=0,
        usWinAscent=ASCENT * UNIT, usWinDescent=DESCENT * UNIT,
        sxHeight=4 * UNIT, sCapHeight=5 * UNIT, usWeightClass=400, fsType=0,
        fsSelection=0x40 | 0x80, achVendID='OMGA', version=4,
    )
    fb.setupPost(keepGlyphNames=False)
    fb.font.recalcTimestamp = False
    fb.font['head'].created = FIXED_TIMESTAMP
    fb.font['head'].modified = FIXED_TIMESTAMP
    ttf = io.BytesIO()
    fb.font.save(ttf)
    fb.font.flavor = 'woff'
    woff = io.BytesIO()
    fb.font.save(woff)
    return ttf.getvalue(), woff.getvalue()


def build_bmfont(glyphs):
    placements = {}
    x = y = 0
    for cp, rows in glyphs.items():
        width = len(rows[0])
        if x + width > ATLAS_WIDTH:
            x, y = 0, y + ROWS + 1
        placements[cp] = (x, y)
        x += width + 1
    height = 1
    while height < y + ROWS:
        height *= 2
    image = Image.new('P', (ATLAS_WIDTH, height), 0)
    image.putpalette([0, 0, 0, 255, 255, 255])
    for cp, rows in glyphs.items():
        gx, gy = placements[cp]
        for row_index, row in enumerate(rows):
            for col, cell in enumerate(row):
                if cell == '#':
                    image.putpixel((gx + col, gy + row_index), 1)
    png = io.BytesIO()
    image.save(png, 'PNG', optimize=True, transparency=0)
    chars = '\n'.join(
        f'<char id="{cp}" x="{placements[cp][0]}" y="{placements[cp][1]}" width="{len(rows[0])}" height="{ROWS}" '
        f'xoffset="0" yoffset="0" xadvance="{len(rows[0]) + 1}" page="0"/>'
        for cp, rows in glyphs.items()
    )
    xml = (
        '<?xml version="1.0"?>\n<font>\n'
        f'<info face="{FAMILY}" size="{ROWS}"/>\n'
        f'<common lineHeight="{ROWS}" base="{ASCENT}" scaleW="{ATLAS_WIDTH}" scaleH="{height}" pages="1"/>\n'
        f'<pages><page id="0" file="{BASENAME}.png"/></pages>\n'
        f'<chars count="{len(glyphs)}">\n{chars}\n</chars>\n</font>\n'
    )
    return png.getvalue(), xml.encode('utf-8'), image


def write_preview(path, glyphs, ttf_bytes, atlas):
    sample = ['OMEGA RELAY  PRESS START', 'Stage Select: 8/8 · RETRY ×03 …', 'weapon • buster 28/28 — ● ○ → É', '|MÉqgy 0123456789 !?#%&*+=<>']
    scale_view = 3
    canvas = Image.new('RGB', (300, 12 + len(sample) * 44), (8, 20, 40))
    draw = ImageDraw.Draw(canvas)
    placements = {}
    x = y = 0
    for cp, rows in glyphs.items():
        width = len(rows[0])
        if x + width > ATLAS_WIDTH:
            x, y = 0, y + ROWS + 1
        placements[cp] = (x, y, width)
        x += width + 1
    for line_index, line in enumerate(sample):
        pen_x, top = 4, 4 + line_index * 44
        for ch in line:
            gx, gy, width = placements.get(ord(ch), placements[ord('?')])
            canvas.paste((255, 255, 255), (pen_x, top), atlas.crop((gx, gy, gx + width, gy + ROWS)).convert('L'))
            pen_x += width + 1
        for size, offset in ((8, 10), (16, 20)):
            font = ImageFont.truetype(io.BytesIO(ttf_bytes), size)
            draw.text((4, top + offset), line, font=font, fill=(125, 232, 255))
    canvas = canvas.resize((canvas.width * scale_view, canvas.height * scale_view), Image.NEAREST)
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--preview', type=pathlib.Path)
    args = parser.parse_args()
    glyphs = parse_glyphs(SOURCE.read_text(encoding='utf-8'))
    ttf, woff = build_ttf(glyphs)
    png, xml, atlas = build_bmfont(glyphs)
    outputs = {OUT_DIR / f'{BASENAME}.woff': woff, OUT_DIR / f'{BASENAME}.png': png, OUT_DIR / f'{BASENAME}.xml': xml}
    if args.check:
        stale = [str(path.relative_to(ROOT)) for path, data in outputs.items() if not path.exists() or path.read_bytes() != data]
        if stale:
            print('stale font outputs: ' + ', '.join(stale) + ' (run scripts/fonts/build-pixel-font.py)')
            return 1
        print(f'font outputs match {SOURCE.relative_to(ROOT)} ({len(glyphs)} glyphs)')
        return 0
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for path, data in outputs.items():
        path.write_bytes(data)
        print(f'{path.relative_to(ROOT)}: {len(data)} bytes')
    print(f'{len(glyphs)} glyphs; TTF before WOFF compression: {len(ttf)} bytes')
    if args.preview:
        write_preview(args.preview, glyphs, ttf, atlas)
        print(f'preview: {args.preview}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
