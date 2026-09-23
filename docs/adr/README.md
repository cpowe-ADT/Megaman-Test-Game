# ADRs
- Status: canonical
- Owner scope: repo
- Last reviewed: 2026-03-06

Use an ADR when a decision changes long-lived architecture, tooling, content contracts, or repo workflow in a way future agents and developers will need to understand.

Create an ADR for:
- major runtime boundary decisions,
- new validation or testing policies,
- content-schema or asset-pipeline contract changes,
- significant shifts in scene/runtime ownership.

Do not use an ADR for:
- routine bug fixes,
- small refactors without lasting policy impact,
- temporary exploration notes.

Start from `docs/templates/adr-template.md` and link the ADR from `docs/README.md` once it becomes relevant to active development.

## Accepted ADRs
- `docs/adr/0001-runtime-modularization.md`
- `docs/adr/0002-bundle-size-strategy.md`
