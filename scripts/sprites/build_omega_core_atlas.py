#!/usr/bin/env python3
"""Build the 12-frame Omega Core runtime atlas strip from its transparent concept source."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


FRAME_SIZE = 64
FRAME_COUNT = 12


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def fit_subject(source: Image.Image) -> Image.Image:
    alpha = source.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("Omega source has no opaque pixels")
    subject = source.crop(bounds)
    subject.thumbnail((58, 58), Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    frame.alpha_composite(subject, ((FRAME_SIZE - subject.width) // 2, (FRAME_SIZE - subject.height) // 2))
    return frame


def shifted(frame: Image.Image, x: int = 0, y: int = 0) -> Image.Image:
    result = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    result.alpha_composite(frame, (x, y))
    return result


def build_frames(base: Image.Image) -> list[Image.Image]:
    frames = [shifted(base, 0, y) for y in (1, 0, -1, 0)]
    frames.extend(shifted(base, x, y) for x, y in ((0, 0), (-1, -1), (-2, 0), (-1, 1)))
    for index, (x, y) in enumerate(((0, 0), (-1, 0), (-2, 0), (-1, 0))):
        shot = shifted(base, x, y)
        draw = ImageDraw.Draw(shot)
        if index >= 1:
            flare_x = 2 if index == 1 else 0
            draw.rectangle((flare_x, 28, flare_x + 4 + index, 31), fill=(66, 231, 255, 255))
            draw.point((flare_x + 2, 27), fill=(255, 255, 255, 255))
            draw.point((flare_x + 2, 32), fill=(255, 138, 50, 255))
        frames.append(shot)
    return frames


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    frames = build_frames(fit_subject(source))
    if len(frames) != FRAME_COUNT:
        raise RuntimeError(f"Expected {FRAME_COUNT} frames, got {len(frames)}")
    strip = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    strip.save(output, optimize=True)


if __name__ == "__main__":
    main()
