# Sprite & Asset Packaging Guidelines

This project intentionally starts with generated placeholder art, but it is ready to accept full sprite sheets and texture atlases. Use the structure below when committing production-ready or prototype art so that engineers and tooling (including AI assistants) can reliably load, preview, and reference the assets.

## Directory Layout

```
assets/
  sprites/
    player/
      player_idle.png
      player_run.png
      player_jump.png
      player_dash.png
      player_saber1.png
      player_saber2.png
      player_saber3.png
      player_saber4.png
      player_charge1.png
      player_charge2.png
    bullets/
      bullet_small.png
      bullet_mid.png
      bullet_big.png
      bullet_elemental.png
    weapons/
      weapon_fire.png
      weapon_water.png
      weapon_thunder.png
    bosses/
      boss1/
        boss1_idle.png
        boss1_attack1.png
        boss1_attack2.png
        boss1_death.png
      boss2/
        ...
```

* Store each sprite sheet (or per-frame PNG) alongside an optional metadata file such as `player.json` that describes frame bounds.
* Keep naming consistent: `entity_action_frame.png` keeps atlases searchable.
* Use Git LFS if individual PNGs exceed a few megabytes.

## Atlas Metadata Example

Texture atlases should include a JSON (or similar) map so code can reference frames by name instead of hard-coded indexes.

```json
{
  "frames": {
    "run_0": { "frame": { "x": 0, "y": 0, "w": 32, "h": 32 } },
    "run_1": { "frame": { "x": 32, "y": 0, "w": 32, "h": 32 } },
    "dash": { "frame": { "x": 64, "y": 0, "w": 32, "h": 32 } },
    "saber_0": { "frame": { "x": 96, "y": 0, "w": 48, "h": 32 } }
  },
  "meta": {
    "image": "player_spritesheet.png",
    "size": { "w": 256, "h": 128 },
    "scale": "1"
  }
}
```

When loading the atlas in Phaser you can then write:

```ts
this.load.atlas('player', 'assets/sprites/player/player_spritesheet.png', 'assets/sprites/player/player.json')
this.anims.create({
  key: 'player-run',
  frames: this.anims.generateFrameNames('player', { prefix: 'run_', start: 0, end: 3 }),
  frameRate: 12,
  repeat: -1
})
```

## Sourcing Sprites Responsibly

* **The Spriters Resource** – excellent for reference material across Mega Man, Mega Man X, and other retro series. Use primarily for study unless the license explicitly allows redistribution.
* **Sprites Inc.** – a long-running archive with community-made edits and custom sheets.
* **itch.io** – search for "Mega Man inspired" or "retro platformer" packs that include permissive licenses (CC0, CC BY, MIT, etc.).
* **Community freebies** – e.g., the "Mega Man style" kit by Ansimuz that circulates on GitHub and Reddit. Always verify usage terms (many are free for prototypes and non-commercial projects).

Store license files or at least link back to the source inside `assets/README.md` when you add third-party art so downstream users can audit attribution requirements.

## Sharing Assets with Code Assistants

When prompting AI tools to edit or consume assets:

1. Provide an asset manifest (simple JSON or Markdown list) describing filenames and their purpose.
2. Reference atlas frame names instead of pixel offsets inside code comments or documentation.
3. Keep relative paths stable—`assets/sprites/...`—so automated tooling can locate the files without manual guidance.

Following these conventions keeps sprites organized, reduces merge conflicts, and helps collaborators (human or AI) integrate new art or gameplay features quickly.
