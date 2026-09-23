#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Sequence

from PIL import Image, ImageColor, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / 'assets/sprites/source/enemies'
RUNTIME_DIR = ROOT / 'assets/sprites/enemies'
SLICER_PATH = ROOT / 'tools/sprites/slice_sheet_to_atlas.py'

PLATFORMER_SOURCE = SOURCE_DIR / 'enemy_robot_platformer_sheet_free_v1_20260312_120000.png'
ROBOT_PACK_RED_BODY = SOURCE_DIR / 'enemy_robot_pack_red_body_free_v1_20260312_120000.png'
ROBOT_PACK_RED_DRIVE1 = SOURCE_DIR / 'enemy_robot_pack_red_drive1_free_v1_20260312_120000.png'
ROBOT_PACK_RED_DRIVE2 = SOURCE_DIR / 'enemy_robot_pack_red_drive2_free_v1_20260312_120000.png'
ROBOT_PACK_RED_HURT = SOURCE_DIR / 'enemy_robot_pack_red_hurt_free_v1_20260312_120000.png'
ROBOT_PACK_RED_DAMAGE1 = SOURCE_DIR / 'enemy_robot_pack_red_damage1_free_v1_20260312_120000.png'
ROBOT_PACK_RED_DAMAGE2 = SOURCE_DIR / 'enemy_robot_pack_red_damage2_free_v1_20260312_120000.png'
PLANT_MONSTER_FRAME1 = SOURCE_DIR / 'enemy_plant_monster_frame1_free_v1_20260312_184600.png'
PLANT_MONSTER_FRAME2 = SOURCE_DIR / 'enemy_plant_monster_frame2_free_v1_20260312_184600.png'
BLOB_STRIP = SOURCE_DIR / 'enemy_jumping_blob_strip_free_v1_20260312_184600.png'
SCORPION_WALK_SHEET = SOURCE_DIR / 'enemy_scorpy_scorp_walk_sheet_free_v1_20260312_184600.png'
SCORPION_STAB_SHEET = SOURCE_DIR / 'enemy_scorpy_scorp_stab_sheet_free_v1_20260312_184600.png'
SLIME_SHEET = SOURCE_DIR / 'enemy_slime_first_gen_weak_free_v1_20260312_190900.png'
EYE_MONSTER_SHEET = SOURCE_DIR / 'enemy_eye_monster_sheet_free_v1_20260312_190900.png'
CANNON_SHEET = SOURCE_DIR / 'enemy_cannon_gun_sheet_free_v1_20260312_191500.png'
TANK_GREY_FRAMES = [
  SOURCE_DIR / 'enemy_kenney_tank_grey1_free_v1_20260312_194000.png',
  SOURCE_DIR / 'enemy_kenney_tank_grey2_free_v1_20260312_194000.png',
  SOURCE_DIR / 'enemy_kenney_tank_grey3_free_v1_20260312_194000.png',
  SOURCE_DIR / 'enemy_kenney_tank_grey4_free_v1_20260312_194000.png',
  SOURCE_DIR / 'enemy_kenney_tank_grey5_free_v1_20260312_194000.png'
]

OUTPUT_STAMP = '20260312_120000'

PLATFORMER_BOXES = {
  'humanoid_idle': (149, 67, 175, 94),
  'humanoid_stride': (176, 64, 198, 94),
  'humanoid_attack': (200, 67, 229, 94),
  'humanoid_hurt': (149, 98, 175, 125),
  'humanoid_death': (177, 98, 189, 122),
  'drone': (233, 42, 259, 54)
}

SLIME_GREEN_BOXES = {
  'hop': [
    (8, 12, 24, 34),
    (27, 12, 43, 34),
    (49, 12, 66, 34),
    (72, 12, 91, 34),
    (97, 12, 112, 34),
    (117, 12, 134, 34),
    (139, 12, 158, 34),
    (166, 12, 185, 34),
    (188, 12, 207, 34)
  ],
  'splash': [
    (8, 39, 24, 51),
    (25, 39, 43, 51),
    (44, 39, 62, 51)
  ]
}


@dataclass(frozen=True)
class VariantSpec:
  type_key: str
  output_path: Path
  cell_size: tuple[int, int]
  anims: str
  builder: Callable[[], Sequence[Image.Image]]


def require_sources(paths: Iterable[Path]) -> None:
  missing = [path for path in paths if not path.exists()]
  if missing:
    joined = '\n'.join(f'- {path}' for path in missing)
    raise FileNotFoundError(f'Missing free-source inputs:\n{joined}')


def load_rgba(path: Path) -> Image.Image:
  return Image.open(path).convert('RGBA')


def trim_transparent(image: Image.Image) -> Image.Image:
  trimmed = image.getbbox()
  return image.crop(trimmed) if trimmed else image


def crop_platformer_component(image: Image.Image, bbox: tuple[int, int, int, int]) -> Image.Image:
  background = image.getpixel((0, 0))
  crop = image.crop(bbox).convert('RGBA')
  pixels = crop.load()
  for y in range(crop.height):
    for x in range(crop.width):
      if pixels[x, y] == background:
        pixels[x, y] = (0, 0, 0, 0)
  return trim_transparent(crop)


def slice_strip_frames(image: Image.Image, frame_size: tuple[int, int]) -> list[Image.Image]:
  frames: list[Image.Image] = []
  columns = image.width // frame_size[0]
  rows = image.height // frame_size[1]
  for row in range(rows):
    for column in range(columns):
      frame = image.crop(
        (
          column * frame_size[0],
          row * frame_size[1],
          (column + 1) * frame_size[0],
          (row + 1) * frame_size[1]
        )
      ).convert('RGBA')
      frames.append(trim_transparent(frame))
  return frames


def resize_sprite(image: Image.Image, scale: float) -> Image.Image:
  return image.resize(
    (
      max(1, int(round(image.width * scale))),
      max(1, int(round(image.height * scale)))
    ),
    Image.Resampling.NEAREST
  )


def tint_sprite(image: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
  tinted = image.copy()
  pixels = tinted.load()
  for y in range(tinted.height):
    for x in range(tinted.width):
      r, g, b, a = pixels[x, y]
      if a == 0:
        continue
      pixels[x, y] = (
        min(255, int(r * rgb[0] / 255)),
        min(255, int(g * rgb[1] / 255)),
        min(255, int(b * rgb[2] / 255)),
        a
      )
  return tinted


def brighten_sprite(image: Image.Image, factor: float) -> Image.Image:
  sprite = image.copy()
  pixels = sprite.load()
  for y in range(sprite.height):
    for x in range(sprite.width):
      r, g, b, a = pixels[x, y]
      if a == 0:
        continue
      pixels[x, y] = (
        min(255, int(r * factor)),
        min(255, int(g * factor)),
        min(255, int(b * factor)),
        a
      )
  return sprite


def outline_sprite(image: Image.Image, color: tuple[int, int, int, int] = (14, 22, 32, 255)) -> Image.Image:
  alpha = image.getchannel('A')
  expanded = alpha.filter(ImageFilter.MaxFilter(3))
  outline = Image.new('RGBA', image.size, (0, 0, 0, 0))
  outline.putalpha(expanded)
  colored = Image.new('RGBA', image.size, color)
  outline = Image.composite(colored, Image.new('RGBA', image.size, (0, 0, 0, 0)), outline)
  outline.alpha_composite(image)
  return outline


def add_drop_shadow(image: Image.Image, offset: tuple[int, int] = (2, 2), alpha: int = 90) -> Image.Image:
  canvas = Image.new('RGBA', (image.width + abs(offset[0]), image.height + abs(offset[1])), (0, 0, 0, 0))
  shadow = Image.new('RGBA', image.size, (0, 0, 0, alpha))
  shadow.putalpha(image.getchannel('A'))
  shadow = shadow.filter(ImageFilter.GaussianBlur(1))
  shadow_pos = (max(offset[0], 0), max(offset[1], 0))
  image_pos = (max(-offset[0], 0), max(-offset[1], 0))
  canvas.alpha_composite(shadow, shadow_pos)
  canvas.alpha_composite(image, image_pos)
  return canvas


def glow_orb(size: tuple[int, int], color: str, alpha: int = 190) -> Image.Image:
  orb = Image.new('RGBA', size, (0, 0, 0, 0))
  glow = Image.new('RGBA', size, ImageColor.getrgb(color) + (0,))
  mask = Image.new('L', size, 0)
  cx = size[0] // 2
  cy = size[1] // 2
  for y in range(size[1]):
    for x in range(size[0]):
      distance = abs(x - cx) + abs(y - cy)
      mask.putpixel((x, y), max(0, alpha - distance * 26))
  orb = Image.composite(glow, orb, mask)
  return orb.filter(ImageFilter.GaussianBlur(1))


def weapon_flash(size: tuple[int, int], color: str, beam_length: int = 10, thickness: int = 4) -> Image.Image:
  flash = Image.new('RGBA', size, (0, 0, 0, 0))
  orb = glow_orb((10, 10), color, 230)
  flash.alpha_composite(orb, (size[0] // 2 - 5, size[1] // 2 - 5))
  beam = Image.new('RGBA', (beam_length, thickness), ImageColor.getrgb(color) + (220,))
  flash.alpha_composite(beam, (size[0] // 2 + 1, size[1] // 2 - thickness // 2))
  return flash


def diagonal_slash(size: tuple[int, int], color: str, length: int = 18, rise: int = 8) -> Image.Image:
  slash = Image.new('RGBA', size, (0, 0, 0, 0))
  for i in range(length):
    x = min(size[0] - 2, size[0] // 2 - 3 + i)
    y = max(0, size[1] // 2 + rise - i // 2)
    for dy in range(2):
      slash.putpixel((x, max(0, min(size[1] - 1, y + dy))), ImageColor.getrgb(color) + (220,))
  return slash.filter(ImageFilter.GaussianBlur(1))


def energy_ring(size: tuple[int, int], color: str) -> Image.Image:
  ring = Image.new('RGBA', size, (0, 0, 0, 0))
  glow = ImageColor.getrgb(color) + (210,)
  inset_x = max(1, size[0] // 5)
  inset_y = max(1, size[1] // 5)
  for x in range(inset_x, size[0] - inset_x):
    ring.putpixel((x, inset_y), glow)
    ring.putpixel((x, size[1] - inset_y - 1), glow)
  for y in range(inset_y, size[1] - inset_y):
    ring.putpixel((inset_x, y), glow)
    ring.putpixel((size[0] - inset_x - 1, y), glow)
  return ring.filter(ImageFilter.GaussianBlur(1))


def scrap_burst(size: tuple[int, int], color: str) -> Image.Image:
  burst = Image.new('RGBA', size, (0, 0, 0, 0))
  shard = Image.new('RGBA', (6, 2), ImageColor.getrgb(color) + (220,))
  burst.alpha_composite(shard, (size[0] // 2 - 8, size[1] // 2 - 6))
  burst.alpha_composite(ImageOps.mirror(shard), (size[0] // 2 + 2, size[1] // 2 - 2))
  burst.alpha_composite(ImageOps.flip(shard), (size[0] // 2 - 4, size[1] // 2 + 4))
  burst.alpha_composite(glow_orb((14, 14), '#fff59c', 160), (size[0] // 2 - 7, size[1] // 2 - 7))
  return burst


def warning_blink(size: tuple[int, int], color: str) -> Image.Image:
  blink = Image.new('RGBA', size, (0, 0, 0, 0))
  orb = glow_orb((8, 8), color, 230)
  blink.alpha_composite(orb, (size[0] // 2 - 4, max(1, size[1] // 3 - 2)))
  return blink


def toxic_spores(size: tuple[int, int], color: str) -> Image.Image:
  spores = Image.new('RGBA', size, (0, 0, 0, 0))
  puff = glow_orb((8, 8), color, 140)
  positions = [(3, 4), (size[0] - 11, 6), (size[0] // 2 - 4, size[1] - 10)]
  for x, y in positions:
    spores.alpha_composite(puff, (x, y))
  return spores


def electric_arc(size: tuple[int, int], color: str) -> Image.Image:
  arc = Image.new('RGBA', size, (0, 0, 0, 0))
  glow = ImageColor.getrgb(color) + (220,)
  points = [
    (size[0] // 4, size[1] // 2),
    (size[0] // 2 - 2, size[1] // 2 - 5),
    (size[0] // 2 + 2, size[1] // 2 + 1),
    (size[0] - size[0] // 4, size[1] // 2 - 4)
  ]
  for x, y in points:
    for dx in range(2):
      arc.putpixel((min(size[0] - 1, x + dx), max(0, min(size[1] - 1, y))), glow)
  return arc.filter(ImageFilter.GaussianBlur(1))


def place_in_cell(
  sprite: Image.Image,
  cell_size: tuple[int, int],
  *,
  dx: int = 0,
  dy: int = 0,
  flash: Image.Image | None = None,
  extra_overlay: Image.Image | None = None
) -> Image.Image:
  cell = Image.new('RGBA', cell_size, (0, 0, 0, 0))
  sprite = outline_sprite(sprite)
  sprite = add_drop_shadow(sprite)
  x = max(0, (cell_size[0] - sprite.width) // 2 + dx)
  y = max(0, cell_size[1] - sprite.height + dy)
  cell.alpha_composite(sprite, (x, y))
  if flash:
    fx = min(cell_size[0] - flash.width, x + sprite.width - 6)
    fy = y + max(2, sprite.height // 3)
    cell.alpha_composite(flash, (fx, fy))
  if extra_overlay:
    cell.alpha_composite(extra_overlay, (0, 0))
  return cell


def write_sheet(path: Path, cell_size: tuple[int, int], frames: Sequence[Image.Image], columns: int = 6) -> None:
  rows = (len(frames) + columns - 1) // columns
  sheet = Image.new('RGBA', (columns * cell_size[0], rows * cell_size[1]), (0, 0, 0, 0))
  for index, frame in enumerate(frames):
    x = (index % columns) * cell_size[0]
    y = (index // columns) * cell_size[1]
    sheet.alpha_composite(frame, (x, y))
  path.parent.mkdir(parents=True, exist_ok=True)
  sheet.save(path, format='PNG', optimize=True)


def run_slicer(sheet_path: Path, out_dir: Path, type_key: str, cell_size: tuple[int, int], anims: str) -> None:
  cmd = [
    sys.executable,
    str(SLICER_PATH),
    '--in',
    str(sheet_path),
    '--out',
    str(out_dir),
    '--typeKey',
    type_key,
    '--cell',
    f'{cell_size[0]}x{cell_size[1]}',
    '--anims',
    anims
  ]
  subprocess.run(cmd, check=True)


def load_platformer_humanoid() -> dict[str, Image.Image]:
  source = load_rgba(PLATFORMER_SOURCE)
  return {
    name: crop_platformer_component(source, bbox)
    for name, bbox in PLATFORMER_BOXES.items()
    if name != 'drone'
  }


def load_platformer_drone() -> Image.Image:
  source = load_rgba(PLATFORMER_SOURCE)
  return crop_platformer_component(source, PLATFORMER_BOXES['drone'])


def load_robot_pack_tracked() -> dict[str, Image.Image]:
  return {
    'body': load_rgba(ROBOT_PACK_RED_BODY),
    'drive1': load_rgba(ROBOT_PACK_RED_DRIVE1),
    'drive2': load_rgba(ROBOT_PACK_RED_DRIVE2),
    'hurt': load_rgba(ROBOT_PACK_RED_HURT),
    'damage1': load_rgba(ROBOT_PACK_RED_DAMAGE1),
    'damage2': load_rgba(ROBOT_PACK_RED_DAMAGE2)
  }


def load_blob_frames() -> list[Image.Image]:
  return slice_strip_frames(load_rgba(BLOB_STRIP), (32, 32))


def load_slime_frames() -> dict[str, list[Image.Image]]:
  slime = load_rgba(SLIME_SHEET)
  return {
    key: [trim_transparent(slime.crop(box).convert('RGBA')) for box in boxes]
    for key, boxes in SLIME_GREEN_BOXES.items()
  }


def load_plant_frames() -> dict[str, Image.Image]:
  return {
    'idle': trim_transparent(load_rgba(PLANT_MONSTER_FRAME1)),
    'attack': trim_transparent(load_rgba(PLANT_MONSTER_FRAME2))
  }


def load_scorpion_frames() -> dict[str, list[Image.Image]]:
  return {
    'walk': slice_strip_frames(load_rgba(SCORPION_WALK_SHEET), (128, 96)),
    'stab': slice_strip_frames(load_rgba(SCORPION_STAB_SHEET), (128, 96))
  }


def load_eye_frames() -> list[Image.Image]:
  return slice_strip_frames(load_rgba(EYE_MONSTER_SHEET), (16, 16))


def load_cannon_frames() -> list[Image.Image]:
  return slice_strip_frames(load_rgba(CANNON_SHEET), (64, 64))


def load_tank_frames() -> list[Image.Image]:
  return [trim_transparent(load_rgba(path)) for path in TANK_GREY_FRAMES]


def build_humanoid_variant(
  *,
  palette: tuple[int, int, int],
  accent_color: str,
  death_color: str,
  attack_mode: str
) -> Sequence[Image.Image]:
  source = load_platformer_humanoid()
  base = resize_sprite(tint_sprite(source['humanoid_idle'], palette), 1.25)
  stride = resize_sprite(tint_sprite(source['humanoid_stride'], palette), 1.25)
  attack = resize_sprite(tint_sprite(source['humanoid_attack'], palette), 1.25)
  hurt = resize_sprite(tint_sprite(source['humanoid_hurt'], palette), 1.25)
  death = resize_sprite(tint_sprite(source['humanoid_death'], palette), 1.55)
  cell = (40, 40)

  if attack_mode == 'rocket':
    windup = warning_blink(cell, accent_color)
    active = weapon_flash((18, 12), accent_color, 12)
    active_b = weapon_flash((22, 14), '#fff0a5', 16, 5)
  elif attack_mode == 'blade':
    windup = diagonal_slash(cell, accent_color, 12, 3)
    active = diagonal_slash(cell, accent_color, 18, 6)
    active_b = diagonal_slash(cell, '#f7fff9', 20, 7)
  elif attack_mode == 'shock':
    windup = electric_arc(cell, accent_color)
    active = electric_arc(cell, accent_color)
    active_b = glow_orb((16, 16), accent_color, 210)
  else:
    windup = glow_orb((8, 8), accent_color, 180)
    active = weapon_flash((16, 12), accent_color, 10)
    active_b = weapon_flash((16, 12), '#fff0a5', 12)

  burst = scrap_burst(cell, death_color)

  return [
    place_in_cell(base, cell, dy=1),
    place_in_cell(brighten_sprite(base, 1.05), cell),
    place_in_cell(base, cell, dy=-1),
    place_in_cell(stride, cell, dx=-1),
    place_in_cell(base, cell, dy=1),
    place_in_cell(attack, cell, dx=1),
    place_in_cell(base, cell, dy=-1),
    place_in_cell(brighten_sprite(base, 1.08), cell, flash=windup),
    place_in_cell(brighten_sprite(attack, 1.08), cell, flash=active),
    place_in_cell(brighten_sprite(attack, 1.12), cell, flash=active_b),
    place_in_cell(attack, cell, flash=active_b),
    place_in_cell(brighten_sprite(attack, 1.08), cell, dx=1, flash=active),
    place_in_cell(base, cell, flash=glow_orb((10, 10), '#b5f8ff', 110)),
    place_in_cell(brighten_sprite(hurt, 1.18), cell, extra_overlay=glow_orb(cell, '#ffffff', 74)),
    place_in_cell(brighten_sprite(death, 1.18), cell, extra_overlay=burst),
    place_in_cell(tint_sprite(death, palette), cell, extra_overlay=burst),
    place_in_cell(glow_orb((18, 18), death_color, 180), cell, extra_overlay=scrap_burst(cell, '#fff59c')),
    place_in_cell(glow_orb((12, 12), '#f2f8ff', 120), cell)
  ]


def build_tracked_variant(
  *,
  palette: tuple[int, int, int],
  accent_color: str,
  death_color: str,
  compact_scale: float,
  attack_mode: str,
  cell_size: tuple[int, int]
) -> Sequence[Image.Image]:
  tracked = load_robot_pack_tracked()
  body = resize_sprite(tint_sprite(tracked['body'], palette), compact_scale)
  drive1 = resize_sprite(tint_sprite(tracked['drive1'], palette), compact_scale)
  drive2 = resize_sprite(tint_sprite(tracked['drive2'], palette), compact_scale)
  hurt = resize_sprite(tint_sprite(tracked['hurt'], palette), compact_scale)
  damage1 = resize_sprite(tint_sprite(tracked['damage1'], palette), compact_scale)
  damage2 = resize_sprite(tint_sprite(tracked['damage2'], palette), compact_scale)

  if attack_mode == 'charge':
    windup = warning_blink(cell_size, accent_color)
    active = weapon_flash((22, 14), accent_color, 18, 5)
    active_b = weapon_flash((26, 16), '#fff0a5', 20, 6)
  elif attack_mode == 'mine':
    windup = warning_blink(cell_size, accent_color)
    active = glow_orb((14, 14), accent_color, 210)
    active_b = glow_orb((18, 18), '#ffe49d', 200)
  elif attack_mode == 'frost':
    windup = glow_orb((10, 10), accent_color, 180)
    active = weapon_flash((18, 12), accent_color, 12)
    active_b = weapon_flash((22, 14), '#e9fbff', 14)
  else:
    windup = warning_blink(cell_size, accent_color)
    active = glow_orb((12, 12), accent_color, 180)
    active_b = glow_orb((16, 16), '#fff59c', 180)

  burst = scrap_burst(cell_size, death_color)

  return [
    place_in_cell(body, cell_size),
    place_in_cell(brighten_sprite(body, 1.04), cell_size, dy=-1),
    place_in_cell(body, cell_size, dy=1),
    place_in_cell(drive1, cell_size, dx=-1),
    place_in_cell(drive2, cell_size, dx=1),
    place_in_cell(drive1, cell_size, dx=1),
    place_in_cell(drive2, cell_size, dx=-1),
    place_in_cell(brighten_sprite(body, 1.04), cell_size, flash=windup),
    place_in_cell(brighten_sprite(drive1, 1.06), cell_size, dx=1, flash=active),
    place_in_cell(brighten_sprite(drive2, 1.08), cell_size, dx=2, flash=active_b),
    place_in_cell(brighten_sprite(drive2, 1.08), cell_size, dx=2, flash=active_b),
    place_in_cell(brighten_sprite(drive1, 1.04), cell_size, dx=1, flash=active),
    place_in_cell(body, cell_size, flash=glow_orb((10, 10), '#7af0ff', 110)),
    place_in_cell(brighten_sprite(hurt, 1.12), cell_size, extra_overlay=glow_orb(cell_size, '#ffffff', 68)),
    place_in_cell(brighten_sprite(damage1, 1.16), cell_size, extra_overlay=burst),
    place_in_cell(brighten_sprite(damage2, 1.18), cell_size, extra_overlay=burst),
    place_in_cell(glow_orb((18, 18), death_color, 170), cell_size, extra_overlay=scrap_burst(cell_size, '#fff4b4')),
    place_in_cell(glow_orb((12, 12), '#f6fbff', 110), cell_size)
  ]


def build_saucer_variant(
  *,
  palette: tuple[int, int, int],
  accent_color: str,
  death_color: str,
  attack_mode: str,
  scale: float,
  cell_size: tuple[int, int]
) -> Sequence[Image.Image]:
  saucer = resize_sprite(tint_sprite(load_platformer_drone(), palette), scale)

  if attack_mode == 'beam':
    windup = warning_blink(cell_size, accent_color)
    active = weapon_flash((20, 10), accent_color, 16, 3)
    active_b = weapon_flash((24, 10), '#ffffff', 18, 3)
  elif attack_mode == 'shield':
    windup = energy_ring(cell_size, accent_color)
    active = energy_ring(cell_size, accent_color)
    active_b = weapon_flash((16, 10), accent_color, 8, 3)
  elif attack_mode == 'toxic':
    windup = toxic_spores(cell_size, accent_color)
    active = toxic_spores(cell_size, accent_color)
    active_b = glow_orb((14, 14), accent_color, 180)
  else:
    windup = glow_orb((10, 10), accent_color, 180)
    active = weapon_flash((14, 10), accent_color, 10, 3)
    active_b = weapon_flash((14, 10), '#e4fff9', 10, 3)

  burst = scrap_burst(cell_size, death_color)

  return [
    place_in_cell(saucer, cell_size),
    place_in_cell(brighten_sprite(saucer, 1.05), cell_size, dy=-1),
    place_in_cell(saucer, cell_size, dy=1),
    place_in_cell(saucer, cell_size, dx=-1, dy=-1),
    place_in_cell(brighten_sprite(saucer, 1.04), cell_size, dy=1),
    place_in_cell(saucer, cell_size, dx=1, dy=-1),
    place_in_cell(brighten_sprite(saucer, 1.08), cell_size, dx=1, dy=1),
    place_in_cell(brighten_sprite(saucer, 1.08), cell_size, flash=windup),
    place_in_cell(brighten_sprite(saucer, 1.12), cell_size, flash=active),
    place_in_cell(brighten_sprite(saucer, 1.14), cell_size, flash=active_b),
    place_in_cell(brighten_sprite(saucer, 1.12), cell_size, flash=active_b),
    place_in_cell(brighten_sprite(saucer, 1.08), cell_size, flash=active),
    place_in_cell(saucer, cell_size, flash=glow_orb((8, 8), '#7de0ff', 100)),
    place_in_cell(brighten_sprite(saucer, 1.22), cell_size, extra_overlay=glow_orb(cell_size, '#ffffff', 80)),
    place_in_cell(brighten_sprite(saucer, 1.16), cell_size, extra_overlay=burst),
    place_in_cell(glow_orb((16, 16), death_color, 180), cell_size, extra_overlay=scrap_burst(cell_size, '#f7fffd')),
    place_in_cell(glow_orb((12, 12), '#e9fcff', 120), cell_size),
    place_in_cell(glow_orb((8, 8), '#ffffff', 80), cell_size)
  ]


def build_slime_variant(
  *,
  palette: tuple[int, int, int],
  accent_color: str,
  death_color: str,
  cell_size: tuple[int, int],
  scale: float
) -> Sequence[Image.Image]:
  slime = load_slime_frames()
  hop = [resize_sprite(tint_sprite(frame, palette), scale) for frame in slime['hop']]
  splash = [resize_sprite(tint_sprite(frame, palette), scale) for frame in slime['splash']]
  burst = toxic_spores(cell_size, accent_color)
  shock = energy_ring(cell_size, accent_color)
  active = glow_orb((16, 16), accent_color, 190)
  active_b = glow_orb((18, 18), '#fff6ad', 210)

  return [
    place_in_cell(hop[0], cell_size),
    place_in_cell(brighten_sprite(hop[1], 1.05), cell_size, dy=-1),
    place_in_cell(hop[2], cell_size, dy=1),
    place_in_cell(hop[3], cell_size, dy=2),
    place_in_cell(hop[4], cell_size, dy=-1),
    place_in_cell(hop[5], cell_size, dy=1),
    place_in_cell(hop[6], cell_size),
    place_in_cell(brighten_sprite(hop[3], 1.08), cell_size, extra_overlay=shock),
    place_in_cell(brighten_sprite(hop[7], 1.1), cell_size, extra_overlay=active),
    place_in_cell(brighten_sprite(hop[8], 1.12), cell_size, extra_overlay=active_b),
    place_in_cell(brighten_sprite(splash[0], 1.1), cell_size, extra_overlay=active_b),
    place_in_cell(brighten_sprite(splash[1], 1.08), cell_size, extra_overlay=active),
    place_in_cell(hop[0], cell_size, extra_overlay=glow_orb((10, 10), '#93f1ff', 110)),
    place_in_cell(brighten_sprite(splash[2], 1.16), cell_size, extra_overlay=glow_orb(cell_size, '#ffffff', 64)),
    place_in_cell(brighten_sprite(hop[8], 1.12), cell_size, extra_overlay=burst),
    place_in_cell(glow_orb((18, 18), death_color, 180), cell_size, extra_overlay=burst),
    place_in_cell(glow_orb((14, 14), '#f3fbff', 150), cell_size, extra_overlay=toxic_spores(cell_size, '#dfffff')),
    place_in_cell(glow_orb((10, 10), '#ffffff', 110), cell_size)
  ]


def build_scorpion_variant(
  *,
  palette: tuple[int, int, int],
  accent_color: str,
  death_color: str,
  cell_size: tuple[int, int],
  scale: float
) -> Sequence[Image.Image]:
  scorpion = load_scorpion_frames()
  walk = [resize_sprite(tint_sprite(frame, palette), scale) for frame in scorpion['walk']]
  stab = [resize_sprite(tint_sprite(frame, palette), scale) for frame in scorpion['stab']]
  blink = warning_blink(cell_size, accent_color)
  armed = glow_orb((14, 14), accent_color, 210)
  armed_b = glow_orb((18, 18), '#fff4ab', 210)
  burst = scrap_burst(cell_size, death_color)

  return [
    place_in_cell(walk[0], cell_size, dy=1),
    place_in_cell(brighten_sprite(walk[1], 1.04), cell_size),
    place_in_cell(walk[0], cell_size, dy=1),
    place_in_cell(walk[1], cell_size, dx=-1),
    place_in_cell(walk[2], cell_size, dx=1),
    place_in_cell(walk[3], cell_size, dx=-1),
    place_in_cell(walk[2], cell_size, dx=1),
    place_in_cell(brighten_sprite(stab[0], 1.08), cell_size, flash=blink),
    place_in_cell(brighten_sprite(stab[1], 1.12), cell_size, flash=armed),
    place_in_cell(brighten_sprite(stab[2], 1.14), cell_size, flash=armed_b),
    place_in_cell(brighten_sprite(stab[2], 1.12), cell_size, flash=armed_b),
    place_in_cell(brighten_sprite(stab[1], 1.08), cell_size, flash=armed),
    place_in_cell(walk[0], cell_size, extra_overlay=glow_orb((10, 10), '#9ff5d9', 110)),
    place_in_cell(brighten_sprite(stab[1], 1.18), cell_size, extra_overlay=glow_orb(cell_size, '#ffffff', 70)),
    place_in_cell(brighten_sprite(stab[2], 1.16), cell_size, extra_overlay=burst),
    place_in_cell(glow_orb((18, 18), death_color, 180), cell_size, extra_overlay=burst),
    place_in_cell(glow_orb((14, 14), '#f5fbff', 140), cell_size, extra_overlay=scrap_burst(cell_size, '#fff59c')),
    place_in_cell(glow_orb((10, 10), '#ffffff', 110), cell_size)
  ]


def build_plant_variant(
  *,
  palette: tuple[int, int, int],
  accent_color: str,
  death_color: str,
  cell_size: tuple[int, int],
  scale: float
) -> Sequence[Image.Image]:
  plant = load_plant_frames()
  idle = resize_sprite(tint_sprite(plant['idle'], palette), scale)
  attack = resize_sprite(tint_sprite(plant['attack'], palette), scale)
  spores = toxic_spores(cell_size, accent_color)
  bloom = glow_orb((16, 16), accent_color, 180)
  bloom_b = glow_orb((18, 18), '#f8ffcf', 210)

  return [
    place_in_cell(idle, cell_size, dy=1),
    place_in_cell(brighten_sprite(idle, 1.04), cell_size),
    place_in_cell(idle, cell_size, dy=-1),
    place_in_cell(idle, cell_size, dx=-1, dy=1),
    place_in_cell(brighten_sprite(idle, 1.04), cell_size, dy=-1),
    place_in_cell(idle, cell_size, dx=1),
    place_in_cell(brighten_sprite(idle, 1.06), cell_size, dy=1),
    place_in_cell(brighten_sprite(attack, 1.06), cell_size, extra_overlay=spores),
    place_in_cell(brighten_sprite(attack, 1.1), cell_size, extra_overlay=bloom),
    place_in_cell(brighten_sprite(attack, 1.12), cell_size, extra_overlay=bloom_b),
    place_in_cell(brighten_sprite(attack, 1.1), cell_size, extra_overlay=bloom_b),
    place_in_cell(brighten_sprite(attack, 1.06), cell_size, extra_overlay=spores),
    place_in_cell(idle, cell_size, extra_overlay=glow_orb((10, 10), '#8cff8a', 100)),
    place_in_cell(brighten_sprite(attack, 1.16), cell_size, extra_overlay=glow_orb(cell_size, '#ffffff', 72)),
    place_in_cell(brighten_sprite(attack, 1.12), cell_size, extra_overlay=toxic_spores(cell_size, death_color)),
    place_in_cell(glow_orb((18, 18), death_color, 180), cell_size, extra_overlay=toxic_spores(cell_size, '#f7ffcf')),
    place_in_cell(glow_orb((14, 14), '#f5fff0', 150), cell_size, extra_overlay=toxic_spores(cell_size, '#d6ffd5')),
    place_in_cell(glow_orb((10, 10), '#ffffff', 110), cell_size)
  ]


def build_eye_variant(
  *,
  palette: tuple[int, int, int],
  accent_color: str,
  death_color: str,
  cell_size: tuple[int, int],
  scale: float
) -> Sequence[Image.Image]:
  eyes = [resize_sprite(tint_sprite(frame, palette), scale) for frame in load_eye_frames()]
  beam = weapon_flash((20, 10), accent_color, 16, 3)
  beam_b = weapon_flash((24, 10), '#ffffff', 18, 3)
  blink = warning_blink(cell_size, accent_color)
  burst = scrap_burst(cell_size, death_color)

  return [
    place_in_cell(eyes[0], cell_size),
    place_in_cell(brighten_sprite(eyes[1], 1.05), cell_size, dy=-1),
    place_in_cell(eyes[2], cell_size, dy=1),
    place_in_cell(eyes[6], cell_size, dx=-1, dy=-1),
    place_in_cell(brighten_sprite(eyes[7], 1.04), cell_size, dy=1),
    place_in_cell(eyes[8], cell_size, dx=1, dy=-1),
    place_in_cell(brighten_sprite(eyes[12], 1.08), cell_size, dx=1, dy=1),
    place_in_cell(brighten_sprite(eyes[18], 1.08), cell_size, flash=blink),
    place_in_cell(brighten_sprite(eyes[19], 1.12), cell_size, flash=beam),
    place_in_cell(brighten_sprite(eyes[20], 1.14), cell_size, flash=beam_b),
    place_in_cell(brighten_sprite(eyes[24], 1.12), cell_size, flash=beam_b),
    place_in_cell(brighten_sprite(eyes[25], 1.08), cell_size, flash=beam),
    place_in_cell(eyes[0], cell_size, extra_overlay=glow_orb((8, 8), '#7de0ff', 100)),
    place_in_cell(brighten_sprite(eyes[31], 1.22), cell_size, extra_overlay=glow_orb(cell_size, '#ffffff', 80)),
    place_in_cell(brighten_sprite(eyes[32], 1.16), cell_size, extra_overlay=burst),
    place_in_cell(glow_orb((16, 16), death_color, 180), cell_size, extra_overlay=scrap_burst(cell_size, '#f7fffd')),
    place_in_cell(glow_orb((12, 12), '#e9fcff', 120), cell_size),
    place_in_cell(glow_orb((8, 8), '#ffffff', 80), cell_size)
  ]


def build_cannon_variant(
  *,
  palette: tuple[int, int, int],
  accent_color: str,
  death_color: str,
  cell_size: tuple[int, int],
  scale: float
) -> Sequence[Image.Image]:
  cannon = [resize_sprite(tint_sprite(frame, palette), scale) for frame in load_cannon_frames()]
  charge = glow_orb((12, 12), accent_color, 190)
  blast = weapon_flash((20, 12), accent_color, 14, 4)
  blast_b = weapon_flash((24, 14), '#f6ffff', 16, 4)
  burst = scrap_burst(cell_size, death_color)

  return [
    place_in_cell(cannon[0], cell_size),
    place_in_cell(brighten_sprite(cannon[0], 1.04), cell_size, dy=-1),
    place_in_cell(cannon[1], cell_size, dy=1),
    place_in_cell(cannon[2], cell_size, dx=-1),
    place_in_cell(cannon[3], cell_size, dx=1),
    place_in_cell(cannon[2], cell_size, dx=1),
    place_in_cell(cannon[1], cell_size, dx=-1),
    place_in_cell(brighten_sprite(cannon[4], 1.06), cell_size, flash=charge),
    place_in_cell(brighten_sprite(cannon[5], 1.1), cell_size, flash=blast),
    place_in_cell(brighten_sprite(cannon[6], 1.14), cell_size, flash=blast_b),
    place_in_cell(brighten_sprite(cannon[7], 1.1), cell_size, flash=blast_b),
    place_in_cell(brighten_sprite(cannon[5], 1.06), cell_size, flash=blast),
    place_in_cell(cannon[0], cell_size, extra_overlay=glow_orb((8, 8), '#9ff0ff', 100)),
    place_in_cell(brighten_sprite(cannon[4], 1.16), cell_size, extra_overlay=glow_orb(cell_size, '#ffffff', 70)),
    place_in_cell(brighten_sprite(cannon[6], 1.12), cell_size, extra_overlay=burst),
    place_in_cell(brighten_sprite(cannon[7], 1.14), cell_size, extra_overlay=burst),
    place_in_cell(glow_orb((16, 16), death_color, 180), cell_size, extra_overlay=scrap_burst(cell_size, '#f7fffd')),
    place_in_cell(glow_orb((10, 10), '#ffffff', 100), cell_size)
  ]


def build_tank_variant(
  *,
  palette: tuple[int, int, int],
  accent_color: str,
  death_color: str,
  cell_size: tuple[int, int],
  scale: float
) -> Sequence[Image.Image]:
  tank = [resize_sprite(tint_sprite(frame, palette), scale) for frame in load_tank_frames()]
  charge = warning_blink(cell_size, accent_color)
  blast = weapon_flash((22, 14), accent_color, 18, 5)
  blast_b = weapon_flash((26, 16), '#fff4b0', 20, 6)
  burst = scrap_burst(cell_size, death_color)

  return [
    place_in_cell(tank[0], cell_size),
    place_in_cell(brighten_sprite(tank[1], 1.04), cell_size, dy=-1),
    place_in_cell(tank[0], cell_size, dy=1),
    place_in_cell(tank[1], cell_size, dx=-1),
    place_in_cell(tank[2], cell_size, dx=1),
    place_in_cell(tank[3], cell_size, dx=-1),
    place_in_cell(tank[2], cell_size, dx=1),
    place_in_cell(brighten_sprite(tank[3], 1.06), cell_size, flash=charge),
    place_in_cell(brighten_sprite(tank[4], 1.1), cell_size, flash=blast),
    place_in_cell(brighten_sprite(tank[4], 1.14), cell_size, flash=blast_b),
    place_in_cell(brighten_sprite(tank[3], 1.1), cell_size, flash=blast_b),
    place_in_cell(brighten_sprite(tank[2], 1.06), cell_size, flash=blast),
    place_in_cell(tank[0], cell_size, extra_overlay=glow_orb((8, 8), '#9ff0ff', 100)),
    place_in_cell(brighten_sprite(tank[3], 1.18), cell_size, extra_overlay=glow_orb(cell_size, '#ffffff', 70)),
    place_in_cell(brighten_sprite(tank[4], 1.14), cell_size, extra_overlay=burst),
    place_in_cell(glow_orb((18, 18), death_color, 180), cell_size, extra_overlay=burst),
    place_in_cell(glow_orb((14, 14), '#f3fbff', 150), cell_size, extra_overlay=scrap_burst(cell_size, '#fff7c6')),
    place_in_cell(glow_orb((10, 10), '#ffffff', 110), cell_size)
  ]


def humanoid_output(type_key: str) -> Path:
  return SOURCE_DIR / f'{type_key}_sheet_v2_{OUTPUT_STAMP}.png'


def tracked_output(type_key: str) -> Path:
  return SOURCE_DIR / f'{type_key}_sheet_v2_{OUTPUT_STAMP}.png'


def saucer_output(type_key: str) -> Path:
  return SOURCE_DIR / f'{type_key}_sheet_v2_{OUTPUT_STAMP}.png'


def build_specs() -> Sequence[VariantSpec]:
  return [
    VariantSpec(
      'enemy_gunner_bot',
      humanoid_output('enemy_gunner_bot'),
      (40, 40),
      'idle=0-2,run=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_humanoid_variant(
        palette=(192, 196, 150),
        accent_color='#ffd56c',
        death_color='#ffd56c',
        attack_mode='blaster'
      )
    ),
    VariantSpec(
      'enemy_rocket_bot',
      humanoid_output('enemy_rocket_bot'),
      (40, 40),
      'idle=0-2,run=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_humanoid_variant(
        palette=(224, 160, 112),
        accent_color='#ff9b4d',
        death_color='#ffb36c',
        attack_mode='rocket'
      )
    ),
    VariantSpec(
      'enemy_slicer_bot',
      humanoid_output('enemy_slicer_bot'),
      (40, 40),
      'idle=0-2,run=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_humanoid_variant(
        palette=(116, 214, 204),
        accent_color='#7bfff1',
        death_color='#b7fff7',
        attack_mode='blade'
      )
    ),
    VariantSpec(
      'enemy_shock_hopper',
      humanoid_output('enemy_shock_hopper'),
      (40, 40),
      'idle=0-2,run=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_humanoid_variant(
        palette=(170, 120, 206),
        accent_color='#b48cff',
        death_color='#d6b7ff',
        attack_mode='shock'
      )
    ),
    VariantSpec(
      'enemy_armored_bot',
      tracked_output('enemy_armored_bot'),
      (48, 40),
      'idle=0-2,run=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_tank_variant(
        palette=(214, 170, 120),
        accent_color='#ffb36c',
        death_color='#ffe08d',
        cell_size=(48, 40),
        scale=0.55
      )
    ),
    VariantSpec(
      'enemy_bouncer',
      tracked_output('enemy_bouncer'),
      (40, 34),
      'idle=0-2,run=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_slime_variant(
        palette=(88, 204, 110),
        accent_color='#a8ffbd',
        death_color='#dbffe3',
        cell_size=(40, 34),
        scale=1.2
      )
    ),
    VariantSpec(
      'enemy_mine_bot',
      tracked_output('enemy_mine_bot'),
      (42, 32),
      'idle=0-2,run=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_scorpion_variant(
        palette=(116, 184, 112),
        accent_color='#c4ff73',
        death_color='#e7ffb6',
        cell_size=(42, 32),
        scale=0.24
      )
    ),
    VariantSpec(
      'enemy_frost_turret',
      tracked_output('enemy_frost_turret'),
      (42, 34),
      'idle=0-2,hover=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_cannon_variant(
        palette=(168, 216, 248),
        accent_color='#9ff0ff',
        death_color='#e9fbff',
        cell_size=(42, 34),
        scale=0.42
      )
    ),
    VariantSpec(
      'enemy_laser_eye',
      saucer_output('enemy_laser_eye'),
      (38, 28),
      'idle=0-2,hover=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_eye_variant(
        palette=(244, 134, 134),
        accent_color='#ff6767',
        death_color='#ffd1d1',
        scale=1.5,
        cell_size=(38, 28)
      )
    ),
    VariantSpec(
      'enemy_drone',
      saucer_output('enemy_drone'),
      (36, 28),
      'idle=0-2,hover=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_saucer_variant(
        palette=(212, 224, 184),
        accent_color='#7de0ff',
        death_color='#a8fff1',
        attack_mode='blaster',
        scale=1.4,
        cell_size=(36, 28)
      )
    ),
    VariantSpec(
      'enemy_shield_drone',
      saucer_output('enemy_shield_drone'),
      (38, 30),
      'idle=0-2,hover=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_saucer_variant(
        palette=(116, 212, 196),
        accent_color='#9ff7ff',
        death_color='#d7ffff',
        attack_mode='shield',
        scale=1.45,
        cell_size=(38, 30)
      )
    ),
    VariantSpec(
      'enemy_fly_trap',
      saucer_output('enemy_fly_trap'),
      (38, 30),
      'idle=0-2,hover=3-6,attack_windup=7-9,attack_active=10-12,hurt=13-13,death=14-17',
      lambda: build_plant_variant(
        palette=(132, 228, 110),
        accent_color='#8fff88',
        death_color='#ddffb9',
        cell_size=(38, 30),
        scale=0.06
      )
    )
  ]


def build_showcase_pack() -> None:
  require_sources(
    [
      PLATFORMER_SOURCE,
      ROBOT_PACK_RED_BODY,
      ROBOT_PACK_RED_DRIVE1,
      ROBOT_PACK_RED_DRIVE2,
      ROBOT_PACK_RED_HURT,
      ROBOT_PACK_RED_DAMAGE1,
      ROBOT_PACK_RED_DAMAGE2,
      PLANT_MONSTER_FRAME1,
      PLANT_MONSTER_FRAME2,
      BLOB_STRIP,
      SCORPION_WALK_SHEET,
      SCORPION_STAB_SHEET,
      SLIME_SHEET,
      EYE_MONSTER_SHEET,
      CANNON_SHEET,
      *TANK_GREY_FRAMES
    ]
  )

  for spec in build_specs():
    frames = spec.builder()
    write_sheet(spec.output_path, spec.cell_size, frames)
    run_slicer(spec.output_path, RUNTIME_DIR / spec.type_key, spec.type_key, spec.cell_size, spec.anims)
    print(f'updated {spec.type_key}: {spec.output_path}')


if __name__ == '__main__':
  build_showcase_pack()
