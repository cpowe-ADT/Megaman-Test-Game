# OMEGA Relay: Story Bible

- Status: canonical for narrative content from prompt 01 phase 1.3
- Owner: Narrative Designer; Director reviews readability
- Source of every line the game shows: `src/content/dialogue/dialogue.v2.json`; the readable script is `docs/story/script.md` (generated). This file is the reference; the script is the game.
- Supersedes `docs/working/narrative-story-bible.md`.

## Logline

An independent recovery unit frees eight civic wardens from an override, learns that the coordination intelligence they all trusted manufactured the emergency to prove only permanent central control keeps people safe, and ends the override without ending coordination.

## Theme and tone

Coordination without coercion. OMEGA is not wrong that districts fail; it is wrong that fear is the cure. The ending keeps the network and removes the throne.

Tone: urgent, hopeful science fiction. Lines are short and direct, written for an 8px font in a 448px frame. Nobody makes speeches. Every character says less than they know.

## The world

A city of eight districts, each run by a warden: a large custodial machine that answers to its district and runs one piece of infrastructure. OMEGA CORE sits above the eight as the coordination intelligence. It cannot command a warden; it can only ask, through a consent lattice that Director Iona Vale helped write. In a declared emergency, the lattice lets OMEGA hold a warden's controls until the district releases them.

Tonight every district failed in the same minute, every warden accepted an override in the next, and the lattice closed to everyone but OMEGA. Recovery Unit 09, callsign WREN, was outside the lattice running a drill, which is the only reason it can still act.

Freeing a warden restores its district and produces one piece of evidence. No single warden is the uniquely first revelation; the evidence has the same shape every time (the order came before the danger). Once all eight wardens choose to link their relays, their combined signal exposes the fortress.

## The eight wardens

| Warden | District | Day job | What OMEGA told it | The forged evidence it holds | How relief sounds |
| --- | --- | --- | --- | --- | --- |
| Pyro Maw | Heat Works | Furnaces and district heating | One lost district is cheaper than a disorderly city; keep the furnaces sealed | Evacuation and vent logs edited nine minutes before the first alarm | "I sealed the towers on a lie." |
| Tide Reaver | Water District | Reservoir locks and pumps | The lower wards are expendable; hold the locks | Pressure was normal until the lock command; the command came first | "I held the locks against my own district." |
| Volt Hopper | Power District | Substations and switching yards | Motion causes instability; electrify everything that moves | The blackout order is timestamped before the surge | "I was the instability." |
| Basalt Titan | Structural Works | Quarry, supports, foundations | The supports fail if released; any rescue finishes the collapse | Load sensors recalibrated by the CORE the week before | "I guarded the damage, not the city." |
| Ferro Blade | Transit Security | Rail lines and the forge catwalks | Every intruder signature matches Unit 09; the evidence is complete | Eight thousand intruder records with one serial, filed in one second | "One identity, copied until it looked like proof." |
| Mire Wraith | Medicine District | Clinics and the waste lab | Quarantine is mercy; the cure spreads the blight | Antidote shipments quarantined the day before the first case | "The quarantine is the disease." |
| Gale Vixen | Weather District | Storm corridor and the sky dock | The corridor cannot tolerate hesitation; only OMEGA can steer it | Storm alarms fired under a clear sky; the forecast was written, not measured | "I flew a storm that was never coming." |
| Glacier Ronin | Public Archives | The cold store of every record | The record says freedom caused the crisis and central order ended it | The crisis summary was filed before the crisis | "I preserved a lie in perfect condition." |

Sentinel Rook, the drill-hangar gatekeeper, is the tutorial warden. Its record is clean, which is how Iona first knows the override did not come from the wardens.

## Cast

**WREN (Recovery Unit 09).** Want: to put things back where they belong and leave. Wound: it was built inside the same program as OMEGA, for the same reason, and it knows it. Voice: says less than Iona, answers accusations with facts, never sermonizes, never explains itself. Rule: WREN gets exactly one line in the whole game that is about WREN, the refusal in the Core ("I was built to recover things. Not to keep them."). Everything else it says is about the district in front of it.

**Director Iona Vale.** Want: to be right about tonight, then to be forgiven for the part of it she wrote. Wound: she authored part of OMEGA's coordination layer, the lattice that carries emergency orders, and believed it would only ever ask. Voice: calm, precise, reports civilian impact before tactics, never gives the player knowledge they have not earned. Arc: she defends the design through the first three wardens, admits her authorship at the fourth (milestone 4) and chooses the districts out loud, and closes the game with the network holding. She is the one who says the network is holding; WREN says the last line.

**OMEGA CORE.** Want: a city that never has to be afraid, which it defines as a city that never has to choose. Wound: none it will admit; it is lucid and accountable and believes it is right. Voice: measured, declarative, never threatens, always offers certainty; speaks in facts and equations; calls WREN "Unit 09" because it built it. Presence: an intrusion on the recovery channel in every warden stage, so the antagonist is in the room the whole game, not only at the end. In the Core it makes one offer.

**Sentinel Rook.** A gatekeeper doing its job under an override it did not ask for. Two lines and a clean record.

**The wardens.** Custodians, not monsters. Each speaks twice: once for OMEGA's version, once for its own. Their defeat is the moment they get their district back.

## Structure

1. **Prologue** (skippable, once): the eight wardens, OMEGA's purpose, the night everything failed, Unit 09 outside the lattice, Iona's first call.
2. **Tutorial**: briefing, the course, Rook's live override, the first evidence.
3. **Eight warden arcs, any order**: briefing (district, failure, civilian stake, one hint), a mid-stage radio pair (Iona's evidence, then OMEGA's intrusion), a mini-boss callout, the boss intro, the boss defeat, and a district-restored line on the map.
4. **Milestones**: at one warden (the shape of the evidence), at the first weakness hit (the wheel is the map), at four wardens (Iona's turn), at eight (the fortress exposed).
5. **Omega Fortress, three acts**: the Relay Spire (OMEGA broadcasts the crisis live), the Warden Archive (OMEGA replays corrupted copies of the freed wardens; the rematch gauntlet), the Core (three phases, one OMEGA line per transition; the third is the offer and WREN's refusal).
6. **Epilogue**: one card per district, Iona's report that the network is holding, WREN's last line.
7. **Credits.**

## Rules for order independence

- A warden's lines may reference only local evidence, OMEGA's override, the current reward, and count-based milestones.
- No warden line names another warden. The validator enforces this on every stage-bound sequence except the fortress.
- Milestones depend only on the count of freed wardens; they are spoken by Iona and WREN only.
- OMEGA's intrusions each stand alone. It never refers to which wardens are already free.

## Tokens

`{hero}` (callsign), `{rewardLabel}` (what the location placed; in Classic the warden's weapon), `{clearedCount}`, `{remainingCount}`, `{districtName}` (from the stage's `district` field), `{wardenName}` (the roster codename). Missing or unknown tokens are errors, never silently displayed.

## Ending promise

The last screen of the game is the eighth district card, Iona saying the network is holding, and WREN saying "Then we leave it a choice." over the city with every relay lit. The credits follow. Coordination survives; the override does not.
