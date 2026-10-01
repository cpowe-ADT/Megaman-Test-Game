#!/bin/sh
# Tracked copy of the 05c 5.5 hero cut (docs/art/hero-sheets.md). Run from the repo root.
# 05c 5.5: cut the four picked hero sheets into assets/sprites/player/main/player_main.{png,atlas.json}.
set -e
P=".venv/bin/python scripts/sprites/hf_sheet_to_atlas.py --type-key player_main --category player --cell 48 --baseline 46 --body-height 37 --min-component-area 40"
S=assets/sprites/source/player
$P --in $S/hero_sheet_v1_2026-09-24_a2_clean.png --grid 6x4 --scale-ref-cells 0,1,2,3 --body-height 40 \
  --anims "idle=0-3,turn=4-4,land=5-5,run=6-11,crouch_in=12-12,crouch_hold=13-13,crouch_out=14-14,jump_start=15-15,jump_rise=16-16,jump_apex=17-17,fall=18-18,wall_slide=19-19,wall_jump=20-20,dash_start=21-21,dash_loop=22-22,dash_end=23-23"
$P --append --in $S/hero_sheet_v1_2026-09-24_b2.png --grid 6x4 --scale-ref-cells 6,7 --flash-cells 3,4,5,6,7,8,9,10,11,12,13,14,15 \
  --anims "airdash_start=0-0,airdash_loop=1-1,airdash_end=2-2,dash_shoot=3-3,shoot_air=4-4,charge_start=5-5,shoot_ground=6-7,shoot_run=8-9,charge_hold=10-11,charge_release_lv1=12-12,charge_release_lv2=13-13,charge_release_lv3=14-14,charge_release_lv4=15-15,hurt_light=16-16,hurt_heavy=17-17,knockdown=18-18,getup=19-19,death=20-23"
$P --append --in $S/hero_sheet_v1_2026-09-24_c2.png --grid 4x6 --scale-ref-cells 23 --body-only-cells 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19 \
  --anims "slash_ground_e=0-3,slash_ground_ne=4-7,slash_ground_n=8-11,slash_ground_se=12-15,slash_ground_s=16-19,respawn=20-23"
$P --append --in $S/hero_sheet_v1_2026-09-24_d3.png --grid 4x6 --scale-ref-cells 20,21,22,23 --body-only-cells 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19 \
  --anims "slash_air_e=0-3,slash_air_ne=4-7,slash_air_n=8-11,slash_air_se=12-15,slash_air_s=16-19,victory=20-23"
# Corrective sheet E1 (2026-09-24): upright jump and dash poses, a sitting knockdown, charge recoils without flashes.
$P --append --in $S/hero_sheet_v1_2026-09-24_e1.png --grid 4x4 --scale-ref-cells 6 --body-height 39 \
  --anims "jump_rise=0-0,jump_apex=1-1,knockdown=3-3,dash_start=4-4,dash_loop=5-5,dash_end=6-6,dash_shoot=7-7,airdash_start=8-8,airdash_loop=9-9,airdash_end=10-10,hurt_light=11-11,charge_release_lv1=12-12,charge_release_lv2=13-13,charge_release_lv3=14-14,charge_release_lv4=15-15"
# Combo sheet F4 (2026-09-24, combat lane): rising cut and overhead finisher, blade in front; the air spin keeps
# cells 8-9 only (10-11 lose the body to the ring at the cut; the runtime draws the ring from effects_hero slash_air).
$P --append --in $S/hero_sheet_v1_2026-09-24_f4.png --grid 4x3 --scale-ref-cells 3 --body-only-cells 0,1,2,3,4,5,6,7,8,9 \
  --anims "slash_combo2=0-3,slash_combo3=4-7,slash_air_spin=8-9"
