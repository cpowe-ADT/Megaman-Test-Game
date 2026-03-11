# Documentation Maintenance
- Status: canonical
- Owner scope: repo
- Last reviewed: 2026-03-06

## Update Docs When
- architecture boundaries change,
- commands or validation requirements change,
- asset/content contracts change,
- automation hooks or smoke expectations change,
- a planning doc becomes canonical or obsolete.

## Classification Rules
- `canonical`: current source of truth
- `working`: useful active planning or audit context
- `historical`: preserved context only
- `superseded`: intentionally replaced

## Required Maintenance Steps
1. Update the owning canonical doc.
2. Update `docs/README.md` if a doc moved, changed status, or was added.
3. Update `progress.md` if the change affects future handoff context.
4. Archive time-bound or replaced docs instead of deleting them silently.

## Drift Prevention
- Prefer one canonical doc per concern.
- Link out instead of copying the same rules into multiple files.
- If a doc stops matching runtime reality, downgrade it to `working` or `historical` until refreshed.
