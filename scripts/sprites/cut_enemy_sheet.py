#!/usr/bin/env python3
"""Re-skin an enemy atlas from a Higgsfield sheet, keeping its frame names, frame size and feet row (phase 6.P).

The sheet is 4 columns x 5 rows: idle 0-2 and hurt 0 / move 0-3 / windup 0-2 (+ spare) / active 0-2 (+ spare) /
death 0-3. Every frame is sized so the new idle content matches the old idle content box (height and width), sits
with its lowest pixel on the old idle frame's lowest row, and is centred on the body. Frame size and names stay as
they were, so the sword (which reads the frame size) and shots (which read the physics body) behave as before.

  cd scripts/sprites && ../../.venv/bin/python cut_enemy_sheet.py --in <sheet.png> --type-key enemy_gunner_bot
"""
from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

from PIL import Image

import hf_sheet_to_atlas as cutter

ROOT = Path(__file__).resolve().parents[2]
# Sheet cell -> (group role, index); the move group is `run` for walkers and `hover` for flyers.
CELL_ROLES = {0: ("idle", 0), 1: ("idle", 1), 2: ("idle", 2), 3: ("hurt", 0),
              4: ("move", 0), 5: ("move", 1), 6: ("move", 2), 7: ("move", 3),
              8: ("attack_windup", 0), 9: ("attack_windup", 1), 10: ("attack_windup", 2),
              12: ("attack_active", 0), 13: ("attack_active", 1), 14: ("attack_active", 2),
              16: ("death", 0), 17: ("death", 1), 18: ("death", 2), 19: ("death", 3)}


# Boss layout (4x3): idle 0-3, move 0-3, shoot 0-3, as the September boss sheets (src/bosses reads these groups).
BOSS_CELL_ROLES = {i: (("idle", "move", "shoot")[i // 4], i % 4) for i in range(12)}


def old_idle_box(atlas: Image.Image, frames: dict, type_key: str) -> tuple[int, int, int]:
    """(content width, content height, lowest row + 1) of the old idle frames (medians)."""
    widths, heights, bottoms = [], [], []
    for name, entry in frames.items():
        if f"{type_key}/idle/" not in name:
            continue
        f = entry["frame"]
        box = atlas.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])).getchannel("A").getbbox()
        if box:
            widths.append(box[2] - box[0]); heights.append(box[3] - box[1]); bottoms.append(box[3])
    return int(statistics.median(widths)), int(statistics.median(heights)), int(statistics.median(bottoms))


def keyed_cell(sheet: Image.Image, index: int, cols: int, cell_w: int, cell_h: int, mirror: bool = False) -> Image.Image:
    x0, y0, x1, y1 = cutter.cell_rect(index, cols, cell_w, cell_h)
    cell = sheet.crop((x0, y0, x1, y1))
    if mirror:  # the model drew the figure facing the other way; flip each cell, not the sheet (order stays)
        cell = cell.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    keyed = cutter.defringe(cutter.key_magenta(cell, 60))
    keyed = cutter.drop_small_components(keyed, 30)
    return cutter.drop_shadows(keyed)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--in", dest="input_path", required=True)
    parser.add_argument("--type-key", required=True)
    parser.add_argument("--move-group", default=None, help="run or hover; read from the old atlas when omitted")
    parser.add_argument("--layout", choices=["enemy", "boss"], default="enemy",
                        help="enemy: 4x5 sheet into assets/sprites/enemies/<key>/<key>.atlas.json; "
                             "boss: 4x3 (idle, move, shoot) into assets/sprites/bosses/<key>.json")
    parser.add_argument("--mirror", action="store_true", help="flip every cell horizontally before cutting")
    parser.add_argument("--cells", action="append", default=[],
                        help="group=i,j,...: take this group's frames from these sheet cells (a cell the model drew "
                             "across a boundary can be skipped, a good one used twice), e.g. shoot=8,10,10,11")
    parser.add_argument("--fill-height", action="store_true",
                        help="size to the frame (height to the feet row, full width, minus the outline) instead of the old idle "
                             "content box; for a new design that should fill a frame the old art under-used")
    args = parser.parse_args()

    if args.layout == "boss":
        out_dir = ROOT / "assets" / "sprites" / "bosses"
        json_path = out_dir / f"{args.type_key}.json"
        cols, rows, roles = 4, 3, BOSS_CELL_ROLES
    else:
        out_dir = ROOT / "assets" / "sprites" / "enemies" / args.type_key
        json_path = out_dir / f"{args.type_key}.atlas.json"
        cols, rows, roles = 4, 5, CELL_ROLES
    image_path = out_dir / f"{args.type_key}.png"
    old = json.load(json_path.open())
    old_atlas = Image.open(image_path).convert("RGBA")
    names = list(old["frames"].keys())
    fw, fh = old["frames"][names[0]]["frame"]["w"], old["frames"][names[0]]["frame"]["h"]
    move = args.move_group or next((n.split("/")[1] for n in names if n.split("/")[1] in ("run", "hover", "move")), "move")
    # The target comes from the atlas this re-skin replaces; it is kept in meta so a rerun (which reads the new
    # atlas) sizes the same way instead of drifting.
    recorded = old.get("meta", {}).get("reskinTarget")
    if recorded:
        target_w, target_h, feet = recorded["idleWidth"], recorded["idleHeight"], recorded["feetRow"]
    else:
        target_w, target_h, feet = old_idle_box(old_atlas, old["frames"], args.type_key)
    reskin_target = {"idleWidth": target_w, "idleHeight": target_h, "feetRow": feet}
    if args.fill_height:
        # Use the frame, not the old art's box: the old sprite filled only part of it (mine bot 26x17 in 42x32).
        target_h = feet - 1
        target_w = fw - 2

    sheet = Image.open(args.input_path).convert("RGBA")
    cell_w, cell_h = sheet.width // cols, sheet.height // rows
    idle = [keyed_cell(sheet, i, cols, cell_w, cell_h, args.mirror) for i in (0, 1, 2)]
    boxes = [im.getchannel("A").getbbox() for im in idle if im.getchannel("A").getbbox()]
    src_h = statistics.median(b[3] - b[1] for b in boxes)
    src_w = statistics.median(b[2] - b[0] for b in boxes)
    # The outline adds a pixel on each side, so aim two pixels inside the old content box.
    scale = min((target_h - 2) / src_h, (target_w - 2) / src_w)

    frames: dict[str, Image.Image] = {}
    roles = dict(roles)
    overrides = {}
    for spec in args.cells:
        group, cells = spec.split("=")
        overrides[group.strip()] = [int(c) for c in cells.split(",")]
    items = [(index, role, i) for index, (role, i) in roles.items() if role not in overrides]
    for group, cells in overrides.items():
        items += [(cell, group, i) for i, cell in enumerate(cells)]
    for index, role, i in items:
        group = move if role == "move" else role
        name = f"{args.type_key}/{group}/{i:03d}"
        if name not in old["frames"]:
            continue
        cell = keyed_cell(sheet, index, cols, cell_w, cell_h, args.mirror)
        small = cutter.decast_image(cutter.hard_alpha(cutter.mode_downscale(cell, scale)))
        box = small.getchannel("A").getbbox()
        frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        if box:
            content = cutter.add_outline(small.crop(box))
            if content.height > feet:
                content = content.crop((0, content.height - feet, content.width, content.height))
            x = round(fw / 2 - cutter.body_anchor_x(content))
            frame.paste(content, (x, feet - content.height), content)
        frames[name] = frame
    missing = [n for n in names if n not in frames]
    if missing:
        raise SystemExit(f"sheet does not cover {missing}")

    per_row = 8
    rows_out = (len(names) + per_row - 1) // per_row
    atlas = Image.new("RGBA", (per_row * fw, rows_out * fh), (0, 0, 0, 0))
    entries = {}
    for k, name in enumerate(names):
        x, y = (k % per_row) * fw, (k // per_row) * fh
        atlas.paste(frames[name], (x, y))
        entries[name] = {"frame": {"x": x, "y": y, "w": fw, "h": fh}, "rotated": False, "trimmed": False,
                         "spriteSourceSize": {"x": 0, "y": 0, "w": fw, "h": fh}, "sourceSize": {"w": fw, "h": fh}}
    # Hazard red, the steel greys, and the explosion's orange and pale yellow (without them the debris snapped to red).
    atlas = cutter.quantize_with_fixed(atlas, 32, ((0xE2, 0x3A, 0x3A), (0x8A, 0x90, 0x9C), (0x3A, 0x3E, 0x47),
                                                   (0xFF, 0x8A, 0x2A), (0xFF, 0xD2, 0x7A)))
    atlas.save(image_path)
    meta = dict(old.get("meta", {}))
    meta.update({"app": "scripts/sprites/cut_enemy_sheet.py", "image": image_path.name,
                 "size": {"w": atlas.width, "h": atlas.height}, "source": Path(args.input_path).as_posix(),
                 "generator": "Higgsfield gpt_image_2", "reskinTarget": reskin_target})
    json.dump({"frames": entries, "meta": meta}, json_path.open("w"), indent=2)
    print(f"{args.type_key}: {len(names)} frames of {fw}x{fh}, idle content {target_w}x{target_h} feet row {feet}, scale {scale:.3f}")


if __name__ == "__main__":
    main()
