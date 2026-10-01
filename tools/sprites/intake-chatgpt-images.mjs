#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const defaultSourceDir = "/Users/thristannewman/Downloads";
const sourceDir = process.env.SPRITE_SOURCE_DIR || defaultSourceDir;
const overwrite = process.argv.includes("--overwrite");

/**
 * Naming convention:
 * <category>_<subject>_sheet_<variant>_<yyyymmdd>_<hhmmss>.png
 */
const intakeMap = [
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_02_24 PM.png",
    dest: "assets/sprites/source/bosses/boss_roster_sheet_v1_20260207_200224.png",
    notes: "Boss+enemy reference roster sheet",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_04_37 PM.png",
    dest: "assets/sprites/source/bosses/boss_roster_sheet_alt01_20260207_200437.png",
    notes: "Roster variant",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_05_58 PM.png",
    dest: "assets/sprites/source/bosses/boss_roster_sheet_alt02_20260207_200558.png",
    notes: "Roster variant",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_06_00 PM.png",
    dest: "assets/sprites/source/player/player_actions_sheet_v1_20260207_200600.png",
    notes: "Player action sheet",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_08_05 PM.png",
    dest: "assets/sprites/source/player/player_actions_sheet_alt01_20260207_200805.png",
    notes: "Player action variant",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_10_17 PM.png",
    dest: "assets/sprites/source/bosses/sentinel_rook_actions_sheet_v1_20260207_201017.png",
    notes: "Sentinel Rook action sheet",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_13_55 PM.png",
    dest: "assets/sprites/source/player/player_full_combat_sheet_v1_20260207_201355.png",
    notes: "Player+projectile combined sheet",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_21_15 PM.png",
    dest: "assets/sprites/source/enemies/enemy_gunner_bot_sheet_v1_20260207_202115.png",
    notes: "Green mech enemy sheet",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_23_14 PM.png",
    dest: "assets/sprites/source/enemies/enemy_shield_drone_sheet_v1_20260207_202314.png",
    notes: "Shield drone enemy sheet",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_36_43 PM.png",
    dest: "assets/sprites/source/enemies/enemy_shield_drone_sheet_alt01_20260207_203643.png",
    notes: "Shield drone variant",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_36_46 PM.png",
    dest: "assets/sprites/source/enemies/enemy_gunner_bot_sheet_alt01_20260207_203646.png",
    notes: "Green mech variant",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_36_56 PM.png",
    dest: "assets/sprites/source/projectiles/projectile_fx_sheet_v1_20260207_203656.png",
    notes: "Projectile and impact FX sheet",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_38_47 PM.png",
    dest: "assets/sprites/source/enemies/enemy_rock_cluster_sheet_v1_20260207_203847.png",
    notes: "Rock crawler/turret cluster",
  },
  {
    source: "ChatGPT Image Feb 7, 2026 at 08_48_57 PM.png",
    dest: "assets/sprites/source/enemies/enemy_laser_turret_sheet_v1_20260207_204857.png",
    notes: "Laser turret variants",
  },
];

const outputManifestPath = path.join(
  repoRoot,
  "assets/sprites/source/source-images.manifest.json",
);

const sha1 = async (absolutePath) => {
  const buf = await fs.readFile(absolutePath);
  return createHash("sha1").update(buf).digest("hex");
};

const exists = async (absolutePath) => {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
};

const main = async () => {
  const copied = [];
  const skipped = [];
  const missing = [];

  for (const entry of intakeMap) {
    const src = path.join(sourceDir, entry.source);
    const dst = path.join(repoRoot, entry.dest);
    const dstDir = path.dirname(dst);
    const srcExists = await exists(src);

    if (!srcExists) {
      missing.push({ ...entry, sourceAbsolute: src });
      continue;
    }

    await fs.mkdir(dstDir, { recursive: true });

    const dstExists = await exists(dst);
    if (dstExists && !overwrite) {
      skipped.push(entry);
      continue;
    }

    await fs.copyFile(src, dst);
    copied.push({
      ...entry,
      sourceAbsolute: src,
      // Repo-relative (05c): absolute paths carried the machine's folder name into the repo.
      dest: path.relative(repoRoot, dst),
      sha1: await sha1(dst),
      copiedAt: new Date().toISOString(),
    });
  }

  const manifest = {
    namingConvention:
      "<category>_<subject>_sheet_<variant>_<yyyymmdd>_<hhmmss>.png",
    sourceDir,
    copiedCount: copied.length,
    skippedCount: skipped.length,
    missingCount: missing.length,
    copied,
    skipped,
    missing,
    generatedAt: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(outputManifestPath), { recursive: true });
  await fs.writeFile(outputManifestPath, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`sprite-intake copied=${copied.length} skipped=${skipped.length} missing=${missing.length}`);
  console.log(`manifest: ${path.relative(repoRoot, outputManifestPath)}`);

  if (missing.length > 0) {
    console.warn("Missing source files:");
    for (const entry of missing) {
      console.warn(`- ${entry.sourceAbsolute}`);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
