# OMEGA Relay: Dialogue Style Guide

Thirty rules for anyone adding a line to `dialogue.v2.json`.

1. Write for an 8px font in a 448px frame: at most 180 characters, and shorter is better.
2. One idea per line. A second idea is a second line.
3. No speeches. The most anyone says at once is four lines, and that is a boss.
4. Iona reports the civilian cost before the tactic, and never tells the player what they have not seen.
5. Iona is precise: numbers, timestamps, work orders. She is never sarcastic.
6. WREN answers with a fact or an action. WREN never explains itself and never says how it feels.
7. WREN gets one line about WREN in the whole game. It is already written (Core, phase 3). Do not add another.
8. OMEGA is measured and declarative. It never threatens, never raises its voice, and always offers certainty.
9. OMEGA calls the hero "Unit 09". Everyone else uses the callsign token `{hero}`.
10. OMEGA speaks in equations, variables, margins, facts. It believes it is right; write it that way.
11. Wardens speak twice: OMEGA's version at the intro, their own at the defeat. Both are short.
12. A defeat line acknowledges the reward with `{rewardLabel}`. It never grants, unlocks or gives it; the game already did. The validator rejects those verbs.
13. Warden stages are order-independent: never name another warden in a warden's stage. The validator rejects it.
14. Milestones depend only on the count. Iona and WREN only. No warden names.
15. Banned words: any franchise term (Mega Man, Maverick, Reploid, robot master, Dr. anything), "hero" as a noun in dialogue, "AI".
16. Public terms: wardens, districts, relays, the lattice, the override, the CORE, Recovery Unit 09.
17. Use `{districtName}` on the district-restored line so the map reads the same everywhere.
18. Radio lines are one or two: Iona's evidence first, OMEGA's intrusion second. Gameplay keeps running; keep them readable at a glance.
19. Briefings are three lines: the district and its failure, the civilian stake, one tactical hint about the stage's mechanic.
20. Mini-boss callouts are one line: what it is, its tell, the counter.
21. The evidence in every warden stage has the same shape: the order came before the danger. Vary the domain, not the shape.
22. Do not foreshadow the fortress by name before milestone 8.
23. No jokes. Dry is allowed; funny is not.
24. Contractions are fine for Iona, rare for WREN, never for OMEGA.
25. No exclamation marks except in a warden's OMEGA-version line, and at most one per game.
26. Names of places are capitalized and stable: Heat Works, Water District, Power District, Structural Works, Transit Security, Medicine District, Weather District, Public Archives, Central Core.
27. Narration (no speaker) exists only in the prologue, the epilogue cards and the credits.
28. The epilogue cards are one sentence of aftermath each, present tense, concrete.
29. The last line of the game is fixed: "Then we leave it a choice." Do not move it, echo it earlier, or add a line after it.
30. Edit the JSON, run `npm run story:script`, and read your line out loud at 448x252 before you commit it.
