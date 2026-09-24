#!/usr/bin/env python3
"""Cut the Higgsfield portrait sheet (4x3 busts) into a 48px portrait atlas (finish plan, 7.5 surfaces).

  .venv/bin/python scripts/sprites/cut_portraits.py --in assets/ui/source/portraits_v1_a.png
Writes assets/ui/portraits/portraits.{png,atlas.json}; frame names are speaker ids in row-major order.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hf_sheet_to_atlas as cutter  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
NAMES = ["wren", "iona", "rook", "pyro_maw", "tide_reaver", "volt_hopper", "basalt_titan", "ferro_blade",
         "mire_wraith", "gale_vixen", "glacier_ronin", "omega_core"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--in", dest="input_path", required=True)
    parser.add_argument("--size", type=int, default=48)
    parser.add_argument("--inset", type=float, default=0.03)
    args = parser.parse_args()
    sheet = Image.open(args.input_path).convert("RGBA")
    cols, rows, t = 4, 3, args.size
    cw, ch = sheet.width / cols, sheet.height / rows
    atlas = Image.new("RGBA", (cols * t, rows * t), (0, 0, 0, 0))
    frames = {}
    for i, name in enumerate(NAMES):
        c, r = i % cols, i // cols
        dx, dy = cw * args.inset, ch * args.inset
        cell = sheet.crop((round(c * cw + dx), round(r * ch + dy), round((c + 1) * cw - dx), round((r + 1) * ch - dy)))
        side = min(cell.width, cell.height)
        cell = cell.crop(((cell.width - side) // 2, (cell.height - side) // 2, (cell.width - side) // 2 + side, (cell.height - side) // 2 + side))
        small = cutter.mode_downscale(cell, t / side, colors=40)
        small = small.resize((t, t), Image.Resampling.NEAREST) if small.size != (t, t) else small
        atlas.paste(small, (c * t, r * t))
        frames[name] = {"frame": {"x": c * t, "y": r * t, "w": t, "h": t}, "rotated": False, "trimmed": False,
                        "spriteSourceSize": {"x": 0, "y": 0, "w": t, "h": t}, "sourceSize": {"w": t, "h": t}}
    out = ROOT / "assets" / "ui" / "portraits"
    out.mkdir(parents=True, exist_ok=True)
    atlas.save(out / "portraits.png")
    json.dump({"frames": frames, "meta": {"app": "scripts/sprites/cut_portraits.py", "image": "portraits.png",
               "format": "RGBA8888", "size": {"w": atlas.width, "h": atlas.height}, "scale": "1",
               "source": Path(args.input_path).as_posix(), "generator": "Higgsfield gpt_image_2"}},
              (out / "portraits.atlas.json").open("w"), indent=2)
    print(f"Wrote assets/ui/portraits/portraits.png ({len(NAMES)} portraits of {t}px)")


if __name__ == "__main__":
    main()
