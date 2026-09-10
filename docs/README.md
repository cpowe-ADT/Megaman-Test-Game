# Documentation Index

This repository uses an authority-based documentation structure. Start here when you need to know which docs are current, which are in-progress planning artifacts, and which are historical context only.

## Status Model
- `canonical`: current source of truth for active development
- `working`: useful planning or audit context that may lag behind runtime reality
- `historical`: preserved context with date-bound or superseded guidance
- `superseded`: intentionally replaced by another canonical doc

## If You Need X, Read Y
| Need | Read |
| --- | --- |
| Run the game and see current state | `README.md` |
| Understand repo workflow for agents | `AGENTS.md` |
| Understand contribution rules | `CONTRIBUTING.md` |
| Know which test command to run | `TESTING.md` |
| Understand the current runtime shape | `ARCHITECTURE.md`, `docs/architecture/current-state.md` |
| Understand the target modular architecture | `docs/architecture/target-architecture.md` |
| Understand boss-framework internals | `docs/architecture/boss-framework.md` |
| Understand asset and sprite workflows | `docs/content/assets.md`, `docs/content/sprites.md`, `docs/content/sprite-imagegen.md` |
| Understand content/schema contracts | `docs/content/content-schemas.md` |
| Know merge gates and release checks | `docs/testing/quality-gates.md` |
| Read or update handoff notes | `progress.md`, `docs/runbooks/agent-handoff.md` |
| Understand working refactor plans and audits | `docs/working/` |
| Read historical planning artifacts | `docs/archive/` |

## Repo Map
- `src/main.ts`: Phaser bootstrap, renderer config, automation hooks
- `src/scenes/`: scene flow and gameplay integration
- `src/player/`: player runtime modules
- `src/enemy/`: enemy framework and debug/runtime helpers
- `src/boss/`, `src/bosses/`: boss framework, config, controller integration
- `src/content/`: registries, campaign data, enemy content
- `src/content/dialogue/`, `src/narrative/`: validated story content and pure dialogue playback
- `src/ui/DialogueOverlayController.ts`: blocking in-game dialogue presentation adapter
- `src/assets/`: sprite-manifest types, validation, loading helpers
- `tests/`, `src/boss/__tests__/`: automated regression tests
- `scripts/`: smoke, visual sweep, sprite tooling, import/validation helpers
- `progress.md`: canonical rolling handoff log

## Canonical Docs
| Path | Status | Scope | Purpose |
| --- | --- | --- | --- |
| `README.md` | canonical | repo | Quickstart, current state, controls, core commands |
| `AGENTS.md` | canonical | repo | Agent operating contract and handoff rules |
| `CONTRIBUTING.md` | canonical | repo | Coding methodology and merge expectations |
| `TESTING.md` | canonical | repo | Test strategy and command selection |
| `ARCHITECTURE.md` | canonical | repo | Current architectural summary and boundaries |
| `docs/architecture/current-state.md` | canonical | gameplay | Detailed current runtime shape |
| `docs/architecture/README.md` | canonical | repo | Local index for architecture docs |
| `docs/architecture/target-architecture.md` | canonical | gameplay | Target architecture and migration destination |
| `docs/architecture/boss-framework.md` | canonical | gameplay | Boss framework structure and concepts |
| `docs/architecture/repo-map.md` | canonical | repo | High-value code map for humans and agents |
| `docs/content/README.md` | canonical | content | Local index for content and asset docs |
| `docs/testing/quality-gates.md` | canonical | tools | Merge/release gates and validation expectations |
| `docs/testing/README.md` | canonical | tools | Local index for testing docs |
| `docs/content/assets.md` | canonical | content | Asset packaging and licensing guidance |
| `docs/content/content-schemas.md` | canonical | content | Current content-schema reference |
| `docs/content/sprites.md` | canonical | content | Sprite intake, slicing, naming, and manifest workflow |
| `docs/content/sprite-imagegen.md` | canonical | tools | Optional image-generation workflow and import path |
| `docs/content/derived-sprite-sources.md` | canonical | content | Temporary derived sprite-source rules |
| `docs/content/boss-sprite-guide.md` | canonical | content | Boss art production requirements |
| `docs/runbooks/agent-handoff.md` | canonical | repo | How to maintain `progress.md` handoff quality |
| `docs/runbooks/doc-maintenance.md` | canonical | repo | How to keep docs current and classify new docs |
| `docs/runbooks/README.md` | canonical | repo | Local index for operational runbooks |
| `docs/adr/README.md` | canonical | repo | ADR usage rules |
| `docs/adr/0001-runtime-modularization.md` | canonical | repo | Records the decision to modularize gameplay while keeping the game playable during migration |
| `docs/adr/0002-bundle-size-strategy.md` | canonical | repo | Records the current strategy for managing the large production bundle without destabilizing the runtime |

## Working Docs
| Path | Status | Purpose |
| --- | --- | --- |
| `docs/working/full-game-audit.md` | working | Phase 1 progression/save/stage-select contract audit |
| `docs/working/full-game-sprint-plan.md` | working | Active sprint targets, feel specs, trace contracts, and follow-up risks |
| `docs/working/refactor-plan.md` | working | Large phased refactor plan and rollback thinking |
| `docs/working/implementation-spec.md` | working | Feature-specific implementation checklist and prompt context |
| `docs/working/consultant-audit.md` | working | UX and pipeline audit findings |
| `docs/working/orchestrated-completion-audit.md` | working | Five-persona completion audit, ticket backlog, and three-shot execution plan |
| `docs/working/supervised-game-completion-plan.md` | working | Current supervised, staged plan for save, combat, content, story, visual, and release completion |
| `docs/working/enemy-ecology-and-variant-plan.md` | working | Proposed enemy families, district routines, readable variants and bounded pilot; planning only, existing STOPs remain pending |
| `docs/working/boss-animation-and-fight-rebuild-plan.md` | working | Code-based plan for grounded/intentional-aerial boss motion, action-specific animation, original sprite production, fight strategy, and arena dynamics |
| `docs/working/README.md` | canonical | repo | Local index and usage rules for working docs |
| `docs/prompts/README.md` | working | Completion prompt package: orchestrator charter, four build prompts, eval ledger, handoffs. Start here to finish the game. |

## Historical Docs
| Path | Status | Replacement / Context |
| --- | --- | --- |
| `docs/archive/implementation-prompt-v2.md` | historical | Older prompt-driven implementation brief; retained for context only |
| `docs/archive/next-7-days.md` | historical | Date-bound execution plan from February 2026 |
| `docs/archive/README.md` | canonical | repo | Local index and usage rules for archived docs |

## Known Risks / Debt To Watch
- `src/scenes/Game.ts` is still the largest runtime hotspot and remains under `@ts-nocheck`.
- The production build currently emits a large-bundle warning.
- Runtime ownership is split across legacy scene code and newer subsystem modules.
- Long-lived planning docs can drift; check status labels before following a document.

## Rules For Adding New Docs
- Add canonical docs only when they become a true source of truth.
- Put time-bound plans, audits, and implementation notes under `docs/working/` unless they are already obsolete, in which case archive them.
- Update this index whenever a doc is added, moved, archived, or promoted.

## Compatibility Notes
- Legacy flat `docs/*.md` paths for moved files now contain lightweight redirect stubs so older references still resolve to the new canonical or archived locations.
