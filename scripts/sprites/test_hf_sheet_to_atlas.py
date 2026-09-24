import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import hf_sheet_to_atlas as cutter  # noqa: E402
from hf_sheet_to_atlas import (
    anim_names_by_index,
    atlas_grid_position,
    atlas_grid_size,
    baseline_position,
    cell_rect,
    connected_component_areas,
    fit_scale_to_cell,
    parse_anims,
    parse_grid,
    parse_ref_cells,
    scale_from_reference_heights,
)


class ParseGridTests(unittest.TestCase):
    def test_parses_cols_and_rows(self):
        self.assertEqual(parse_grid("6x4"), (6, 4))

    def test_is_case_insensitive(self):
        self.assertEqual(parse_grid("4X6"), (4, 6))


class CellRectTests(unittest.TestCase):
    def test_first_cell_is_top_left(self):
        self.assertEqual(cell_rect(0, cols=6, cell_w=48, cell_h=48), (0, 0, 48, 48))

    def test_wraps_to_next_row(self):
        # index 6 in a 6-wide grid is column 0, row 1.
        self.assertEqual(cell_rect(6, cols=6, cell_w=48, cell_h=48), (0, 48, 48, 96))

    def test_non_square_cells(self):
        self.assertEqual(cell_rect(2, cols=4, cell_w=256, cell_h=171), (512, 0, 768, 171))


class ParseAnimsTests(unittest.TestCase):
    def test_splits_multiple_spans(self):
        self.assertEqual(
            parse_anims("idle=0-3,turn=4-4,land=5-5"),
            [("idle", 0, 3), ("turn", 4, 4), ("land", 5, 5)],
        )

    def test_single_frame_span(self):
        self.assertEqual(parse_anims("wall_jump=12-12"), [("wall_jump", 12, 12)])


class AnimNamesByIndexTests(unittest.TestCase):
    def test_expands_spans_to_local_indices(self):
        anims = parse_anims("idle=0-3,turn=4-4")
        mapping = anim_names_by_index(anims, "player_main")
        self.assertEqual(mapping[0], "player_main/idle/000")
        self.assertEqual(mapping[3], "player_main/idle/003")
        self.assertEqual(mapping[4], "player_main/turn/000")

    def test_unmapped_index_is_absent(self):
        mapping = anim_names_by_index(parse_anims("idle=0-1"), "player_main")
        self.assertNotIn(5, mapping)


class ParseRefCellsTests(unittest.TestCase):
    def test_parses_comma_separated_indices(self):
        self.assertEqual(parse_ref_cells("2,7,10"), [2, 7, 10])

    def test_single_index(self):
        self.assertEqual(parse_ref_cells("4"), [4])


class ScaleFromReferenceHeightsTests(unittest.TestCase):
    def test_scale_matches_body_height_to_median(self):
        # median of [200, 220, 240] is 220; body height 44 -> scale 0.2
        self.assertAlmostEqual(scale_from_reference_heights([200, 220, 240], 44), 0.2)

    def test_single_reference_height(self):
        self.assertAlmostEqual(scale_from_reference_heights([100], 40), 0.4)

    def test_rejects_empty_list(self):
        with self.assertRaises(ValueError):
            scale_from_reference_heights([], 40)

    def test_rejects_zero_median(self):
        with self.assertRaises(ValueError):
            scale_from_reference_heights([0, 0], 40)


class FitScaleToCellTests(unittest.TestCase):
    def test_content_already_fits(self):
        self.assertEqual(fit_scale_to_cell(30, 40, 48), 1.0)

    def test_shrinks_wider_content(self):
        # content 96 wide, 48 tall, cell 48 -> limited by width: 48/96 = 0.5
        self.assertAlmostEqual(fit_scale_to_cell(96, 48, 48), 0.5)

    def test_shrinks_taller_content(self):
        self.assertAlmostEqual(fit_scale_to_cell(40, 80, 48), 0.6)


class BaselinePositionTests(unittest.TestCase):
    def test_centres_horizontally_and_sits_on_baseline(self):
        # content 20x30 in a 48px cell, baseline 44 -> feet at row 44, so y = 44 - 30 = 14
        self.assertEqual(baseline_position(20, 30, cell=48, baseline=44), (14, 14))

    def test_clamps_to_top_when_content_taller_than_baseline_allows(self):
        # content taller than the baseline can host stays inside the cell (y >= 0)
        self.assertEqual(baseline_position(10, 48, cell=48, baseline=44), (19, 0))


class AtlasGridTests(unittest.TestCase):
    def test_position_wraps_at_atlas_columns(self):
        self.assertEqual(atlas_grid_position(0, atlas_columns=16, cell=48), (0, 0))
        self.assertEqual(atlas_grid_position(16, atlas_columns=16, cell=48), (0, 48))
        self.assertEqual(atlas_grid_position(17, atlas_columns=16, cell=48), (48, 48))

    def test_size_for_exact_rows(self):
        self.assertEqual(atlas_grid_size(32, atlas_columns=16, cell=48), (768, 96))

    def test_size_ceils_partial_row(self):
        self.assertEqual(atlas_grid_size(17, atlas_columns=16, cell=48), (768, 96))

    def test_size_for_fewer_frames_than_columns(self):
        self.assertEqual(atlas_grid_size(5, atlas_columns=16, cell=48), (240, 48))

    def test_empty_atlas(self):
        self.assertEqual(atlas_grid_size(0, atlas_columns=16, cell=48), (0, 0))


class ConnectedComponentAreasTests(unittest.TestCase):
    def test_finds_two_separate_components(self):
        mask = [
            [True, True, False, False],
            [False, False, False, True],
        ]
        components = connected_component_areas(mask)
        sizes = sorted(len(c) for c in components)
        self.assertEqual(sizes, [1, 2])

    def test_diagonal_pixels_are_not_connected(self):
        mask = [
            [True, False],
            [False, True],
        ]
        components = connected_component_areas(mask)
        self.assertEqual(len(components), 2)

    def test_empty_mask_has_no_components(self):
        self.assertEqual(connected_component_areas([[False, False]]), [])


if __name__ == "__main__":
    unittest.main()


class PixelArtDownscaleTests(unittest.TestCase):
    """05c: the player cut keeps flat colours, drops magenta fringe and adds a dark outline."""

    def test_mode_block_color_picks_the_majority_and_respects_coverage(self):
        red, blue = (200, 0, 0, 255), (0, 0, 200, 255)
        clear = (0, 0, 0, 0)
        self.assertEqual(cutter.mode_block_color([red, red, blue, clear]), red)
        self.assertEqual(cutter.mode_block_color([red, clear, clear, clear]), clear)

    def test_mode_downscale_keeps_a_two_colour_split_crisp(self):
        from PIL import Image
        img = Image.new("RGBA", (8, 4), (0, 0, 0, 0))
        for x in range(8):
            for y in range(4):
                img.putpixel((x, y), (250, 0, 0, 255) if x < 4 else (0, 0, 250, 255))
        small = cutter.mode_downscale(img, 0.5)
        self.assertEqual(small.size, (4, 2))
        left, right = small.getpixel((0, 0)), small.getpixel((3, 1))
        self.assertGreater(left[0], 200)
        self.assertGreater(right[2], 200)

    def test_magenta_fringe_is_detected_but_amber_and_blue_are_not(self):
        self.assertTrue(cutter.is_magenta_fringe(160, 40, 150))
        self.assertFalse(cutter.is_magenta_fringe(242, 169, 59))
        self.assertFalse(cutter.is_magenta_fringe(63, 111, 166))

    def test_outline_surrounds_the_silhouette(self):
        from PIL import Image
        img = Image.new("RGBA", (1, 1), (63, 111, 166, 255))
        out = cutter.add_outline(img)
        self.assertEqual(out.size, (3, 3))
        self.assertEqual(out.getpixel((1, 0))[:3], cutter.OUTLINE_RGB)
        self.assertEqual(out.getpixel((0, 0))[3], 0)
        self.assertEqual(out.getpixel((1, 1))[:3], (63, 111, 166))

    def test_flash_colour_is_pale_yellow_not_body_amber(self):
        self.assertTrue(cutter.is_flash(240, 240, 160))
        self.assertTrue(cutter.is_flash(255, 255, 255))
        self.assertFalse(cutter.is_flash(240, 192, 16))
        self.assertFalse(cutter.is_flash(127, 176, 222))

    def test_shadow_under_the_feet_is_dropped_and_the_body_anchors_the_frame(self):
        from PIL import Image
        img = Image.new("RGBA", (20, 30), (0, 0, 0, 0))
        for x in range(8, 12):
            for y in range(0, 24):
                img.putpixel((x, y), (63, 111, 166, 255))  # body
        for x in range(0, 6):
            for y in range(4, 8):
                img.putpixel((x, y), (63, 111, 166, 255))  # cannon held forward, detached
        img.putpixel((9, 28), (20, 26, 38, 255))  # a drawn shadow speck under the feet
        cleaned = cutter.drop_shadows(img)
        self.assertEqual(cleaned.getpixel((9, 28))[3], 0)
        self.assertEqual(cleaned.getpixel((2, 5))[3], 255, "a shape beside the body is not a shadow")
        self.assertEqual(cutter.body_anchor_x(cleaned.crop(cleaned.getchannel("A").getbbox())), 10.0)

    def test_magenta_cast_greys_become_undersuit_grey_but_armour_and_amber_stay(self):
        for purple in [(106, 88, 111), (48, 31, 70), (20, 0, 30), (34, 0, 72)]:
            self.assertTrue(cutter.has_magenta_cast(*purple), purple)
        for keep in [(84, 147, 200), (14, 11, 47), (63, 111, 166), (242, 169, 59), (232, 210, 142), (20, 26, 38)]:
            self.assertFalse(cutter.has_magenta_cast(*keep), keep)
        self.assertEqual(cutter.decast(106, 88, 111), cutter.UNDERSUIT_GREYS[1])
        self.assertEqual(cutter.decast(20, 0, 30), cutter.OUTLINE_RGB)

    def test_fixed_palette_keeps_a_small_amber_patch_amber(self):
        from PIL import Image
        img = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
        for x in range(40):
            for y in range(40):
                shade = 60 + (x * 4) % 120
                img.putpixel((x, y), (shade // 3, shade // 2 + 20, shade + 40, 255))
        for x in range(2):
            for y in range(2):
                img.putpixel((x + 10, y + 10), (240, 170, 60, 255))
        out = cutter.quantize_with_fixed(img, 8, cutter.HERO_FIXED_PALETTE)
        r, g, b, _a = out.getpixel((10, 10))
        self.assertGreater(r, 200)
        self.assertLess(b, 100)

