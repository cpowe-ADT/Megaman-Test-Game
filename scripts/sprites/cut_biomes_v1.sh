#!/bin/sh
# Finish plan (2026-09-24): cut every district's Higgsfield tileset and parallax layers. Run from the repo root.
# Provenance: assets/sprites/source/tiles/tiles_biomes_v1.prompts.md, assets/backgrounds/source/<biome>/*.prompts.md.
set -e
cd scripts/sprites
PY=../../.venv/bin/python
N="ground_top_0,ground_top_1,ground_top_2,ground_fill_2,-,wall_fill,ledge_top_l,ledge_top_m,ledge_top_r,ledge_fill_l,ledge_fill_m,ledge_fill_r,plank_l,plank_m,plank_r,wall_face_l,wall_face_r,spike,decor_0,decor_1,decor_2,decor_3,-,ground_fill_0|ground_fill_1"
for b in tide volt basalt ferro mire gale glacier omega; do
  $PY cut_tileset.py --in ../../assets/sprites/source/tiles/tiles_${b}_v1_a.png --biome $b --grid 6x4 --brighten 1.15 --names "$N"
  if [ -f ../../assets/backgrounds/source/$b/${b}_far_v1.png ]; then
    $PY cut_background_layer.py --in ../../assets/backgrounds/source/$b/${b}_far_v1.png --out ../../assets/backgrounds/$b/${b}_far.png --factor 3
  fi
  if [ -f ../../assets/backgrounds/source/$b/${b}_mid_v1.png ]; then
    $PY cut_background_layer.py --in ../../assets/backgrounds/source/$b/${b}_mid_v1.png --out ../../assets/backgrounds/$b/${b}_mid.png --factor 4 --key
  fi
done
