# Stage Select + gameplay input alignment

## Summary
- Unified keyboard handling behind a shared `InputActions` map so Enter/Numpad Enter confirm menus, Space drives gameplay jumps, and Escape is reserved for pause.
- Updated Stage Select and Game scenes to consume the shared input, keep transitions atomic, surface a toggleable debug HUD, and drive jumping through a reusable controller.
- Hardened headless scene tests with an atomic `SceneManager`, Stage Select stubs, and a jump controller unit test to prove Enter transitions and Space jumps.
- Reorganized repository documentation into canonical top-level docs plus `docs/architecture`, `docs/content`, `docs/testing`, `docs/runbooks`, `docs/adr`, `docs/templates`, `docs/working`, and `docs/archive`.
- Added repo-specific `AGENTS.md`, `CONTRIBUTING.md`, `TESTING.md`, `ARCHITECTURE.md`, a docs authority map, and accepted ADRs for runtime modularization and bundle-size strategy.

## Testing
- `npm run test`
- `npm run verify`
