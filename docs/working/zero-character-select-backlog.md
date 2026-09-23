# Zero Character Select Backlog

This is the follow-on backlog for a future playable-character split. The private Mega Man visual override pass does not change save data or runtime character selection yet.

## Future Contract

```ts
type PlayerCharacterId = 'x' | 'zero'

type SaveData = {
  selectedCharacterId?: PlayerCharacterId
}

type ActiveRunSaveData = {
  playerCharacterId?: PlayerCharacterId
}
```

## Implementation TODO

- Add a character-select step between `Title` and `StageSelect`, or as a compact modal launched from `StageSelect`.
- Load per-character atlas bindings so `atlas_player_main` becomes a runtime alias instead of a hard-coded X-only contract.
- Split X and Zero move identity:
  X keeps charge-shot centric combat.
  Zero gets saber-forward movement, tighter melee cancel windows, and distinct damage/hurt timings.
- Persist `SaveData.selectedCharacterId` so the menu remembers the default character between sessions.
- Persist `ActiveRunSaveData.playerCharacterId` so resume/load returns the correct player atlas and move set.
- Extend smoke coverage for the character-select flow, per-character spawn validation, and save/load round-trips.
- Extend visual-sweep coverage so both X and Zero locomotion, jump, dash, hurt, and intro poses are captured.
- Add boss-intro and win-scene portrait routing so the selected character is reflected in transitional UI.
