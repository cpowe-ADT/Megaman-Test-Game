# MegaMan Consultant Audit
- Status: working
- Owner scope: repo, gameplay
- Last reviewed: 2026-03-06

## Scope
This audit focuses on Stage Select/front-screen quality, interaction flow, and the sprite pipeline strategy for a Phaser 3 + TypeScript project.

## UI Readability Findings
- **[P0] Slot text overload causes overlap and illegibility.**
  Acceptance criteria:
  - No text layers intersect in any of 9 slots at default canvas size.
  - Card content limited to codename + compact metadata line.
- **[P1] Header/footer hierarchy competes with mission grid.**
  Acceptance criteria:
  - Header message is one line and never intersects grid.
  - Footer is single-line control legend + page indicator.
- **[P1] Preview panel copy density reduces scanning speed.**
  Acceptance criteria:
  - Preview split into 3 blocks: callout, identity/stats, summary/reward.
  - No wrapping collisions at default viewport.

## Input Flow Findings
- **[P0] Click behavior was confirm-first, causing accidental stage starts.**
  Acceptance criteria:
  - First click selects.
  - Second click on selected card confirms.
  - Enter/NumpadEnter confirms current selection.
- **[P1] Hover behavior should be non-destructive.**
  Acceptance criteria:
  - Hover never triggers mission start.
  - Hover does not mutate selected boss unless explicitly clicked.

## Content Hierarchy Findings
- **[P1] Essential tactical info is not prioritized.**
  Acceptance criteria:
  - Element/weakness/resistance always visible in preview.
  - Mission card text is concise; details moved to preview.
- **[P2] Unlock/game-over telemetry should be informative but compact.**
  Acceptance criteria:
  - GO count and lock state shown in compact format per card.

## Game Feel Gap Findings
- **[P1] Front-screen visual rhythm is static and feels unfinished.**
  Acceptance criteria:
  - Distinct zones (header/grid/preview/footer) with clear contrast.
  - Cursor/selection affordance remains visible in all card colors.
- **[P2] Missing polish systems outside this pass.**
  Missing systems:
  - Hover animation / subtle transitions.
  - Sound feedback for move/select/confirm.
  - Contextual boss portrait thumbnails.

## Asset Pipeline Gap Findings
- **[P0] No manifest contract for sprite sheets.**
  Acceptance criteria:
  - Manifest schema exists and validates.
  - Runtime attempts atlas loading only from ready entries.
- **[P1] No importer for API/network sprite sources.**
  Acceptance criteria:
  - Import script supports dry-run and real download mode.
- **[P1] No generated prompt pack from existing boss metadata.**
  Acceptance criteria:
  - Prompt files generated for all 9 bosses from `spritePlan`.
  - Workflow degrades gracefully when `OPENAI_API_KEY` is absent.

## Front Screen Done Rubric
A front screen is considered done when all checks pass:
1. No text overlap at 100% scale on the default viewport.
2. Selection focus is always visible and unambiguous.
3. Mouse and keyboard have parity (`click select`, `enter confirm`).
4. Scene transition to Game is stable and test-validated.
5. Visual grouping (header/grid/preview/footer) is clearly readable in under 2 seconds.
