#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image


@dataclass(frozen=True)
class DeriveSpec:
    output_name: str
    hue_degrees: int
    sat_mask_threshold: int = 24
    sat_multiplier: float = 1.0
    val_multiplier: float = 1.0
    notes: str = ""


def hue_shift_rgba(
    img: Image.Image,
    hue_degrees: int,
    *,
    sat_mask_threshold: int = 24,
    sat_multiplier: float = 1.0,
    val_multiplier: float = 1.0,
) -> Image.Image:
    """Hue-shift pixels with sufficient saturation; keep low-sat areas unchanged."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    alpha = img.getchannel("A")
    rgb = img.convert("RGB")
    hsv = rgb.convert("HSV")
    h, s, v = hsv.split()

    shift = int((hue_degrees % 360) * 255 / 360) % 256

    h2 = h.point(lambda p: (p + shift) % 256)

    if sat_multiplier != 1.0:
        s2 = s.point(lambda p: max(0, min(255, int(p * sat_multiplier))))
    else:
        s2 = s

    if val_multiplier != 1.0:
        v2 = v.point(lambda p: max(0, min(255, int(p * val_multiplier))))
    else:
        v2 = v

    shifted_rgb = Image.merge("HSV", (h2, s2, v2)).convert("RGB")

    # Mask: only apply hue shift to sufficiently saturated pixels to preserve neutral backgrounds/text.
    mask = s.point(lambda p: 255 if p >= sat_mask_threshold else 0).convert("L")
    out_rgb = Image.composite(shifted_rgb, rgb, mask)
    return Image.merge("RGBA", (*out_rgb.split(), alpha))


def write_manifest(out_path: Path, entries: List[dict]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "entries": entries,
    }
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def rel(path: Path) -> str:
    """Repo-relative when inside the repo (05c: absolute paths carried the machine folder name)."""
    root = Path(__file__).resolve().parents[2]
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Derive recolored sprite source sheets from a base PNG.")
    parser.add_argument("--base", required=True, help="Base PNG path.")
    parser.add_argument("--out-dir", required=True, help="Output folder.")
    parser.add_argument("--spec", required=True, help="JSON file containing { output_name: { hue_degrees, ... } }.")
    parser.add_argument("--force", action="store_true", help="Overwrite outputs if they exist.")
    parser.add_argument(
        "--write-manifest",
        default="assets/sprites/source/derived-images.manifest.json",
        help="Where to write a derived-asset manifest JSON.",
    )
    args = parser.parse_args()

    base_path = Path(args.base).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    spec_path = Path(args.spec).expanduser().resolve()

    if not base_path.exists():
        raise FileNotFoundError(f"Base image not found: {base_path}")
    if not spec_path.exists():
        raise FileNotFoundError(f"Spec file not found: {spec_path}")

    out_dir.mkdir(parents=True, exist_ok=True)

    base_img = Image.open(base_path).convert("RGBA")
    spec_raw = json.loads(spec_path.read_text(encoding="utf-8"))
    if not isinstance(spec_raw, dict):
        raise ValueError("--spec JSON must be an object mapping output_name -> params.")

    derived_entries: List[dict] = []
    for output_name, params in spec_raw.items():
        if not isinstance(output_name, str) or not output_name.endswith(".png"):
            raise ValueError(f"Invalid output_name '{output_name}'. Must be a .png filename.")
        if not isinstance(params, dict):
            raise ValueError(f"Invalid params for '{output_name}'. Must be an object.")

        hue_degrees = int(params.get("hue_degrees", 0))
        sat_mask_threshold = int(params.get("sat_mask_threshold", 24))
        sat_multiplier = float(params.get("sat_multiplier", 1.0))
        val_multiplier = float(params.get("val_multiplier", 1.0))
        notes = str(params.get("notes", "") or "")

        out_path = out_dir / output_name
        if out_path.exists() and not args.force:
            continue

        out_img = hue_shift_rgba(
            base_img,
            hue_degrees,
            sat_mask_threshold=sat_mask_threshold,
            sat_multiplier=sat_multiplier,
            val_multiplier=val_multiplier,
        )
        out_img.save(out_path, format="PNG", optimize=True)

        derived_entries.append(
            {
                "base": rel(base_path),
                "output": rel(out_path),
                "hue_degrees": hue_degrees,
                "sat_mask_threshold": sat_mask_threshold,
                "sat_multiplier": sat_multiplier,
                "val_multiplier": val_multiplier,
                "notes": notes,
            }
        )

    write_manifest(Path(args.write_manifest), derived_entries)


if __name__ == "__main__":
    main()

