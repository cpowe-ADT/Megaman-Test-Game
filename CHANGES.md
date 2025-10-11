# Stage Select + gameplay input alignment

## Summary
- Unified keyboard handling behind a shared `InputActions` map so Enter/Numpad Enter confirm menus, Space drives gameplay jumps, and Escape is reserved for pause.
- Updated Stage Select and Game scenes to consume the shared input, keep transitions atomic, surface a toggleable debug HUD, and drive jumping through a reusable controller.
- Hardened headless scene tests with an atomic `SceneManager`, Stage Select stubs, and a jump controller unit test to prove Enter transitions and Space jumps.

## Testing
- `npm run test`
