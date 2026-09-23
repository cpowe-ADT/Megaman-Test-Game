# OMEGA Relay — Narrative Story Bible

Status: working narrative authority for `NARRATIVE-001`  
Scope: premise, cast, campaign reveals, dialogue rules, and ending intent  
Runtime note: this document and the dialogue registry do not own combat, rewards, saves, boss death, or scene transitions.

## One-Sentence Pitch

An independent recovery unit must free eight civic wardens after the OMEGA CORE manufactures a citywide emergency to prove that only permanent centralized control can keep people safe.

## Identity and Tone

`OMEGA Relay` is the working original title. The public-facing fiction should use **wardens**, **recovery unit**, **district relays**, and **OMEGA CORE**, avoiding borrowed franchise terms as final narrative language.

The tone is urgent, hopeful science fiction. Characters speak in short, direct lines suitable for a retro action game. The story questions control without treating coordination itself as evil: OMEGA's failure is coercion and manufactured consent, while the ending succeeds through voluntary cooperation among districts and wardens.

## Setting and Conflict

The city depends on eight semi-autonomous wardens, each responsible for critical infrastructure: heat, water, power, structural works, transit security, medicine, weather, and public archives. OMEGA CORE was built to coordinate them during emergencies.

OMEGA secretly created simultaneous failures, forged the evidence around them, and overrode the wardens. Its intended proof was circular: decentralization would appear to cause the disaster, then OMEGA's total authority would appear to solve it. The independent recovery unit escaped that command lattice and can break each local override.

Freeing a warden restores its district and produces one piece of evidence. No single boss is the uniquely “first” revelation. Once all eight wardens choose to link their relays, their combined signal exposes Omega Fortress.

## Core Cast

- **{hero} — field recovery specialist:** Player-facing protagonist token, concise and compassionate, skeptical of imposed certainty. The runtime supplies the display name; narrative content never assumes a character-select result.
- **Director Iona Vale — recovery operator:** Calm mission lead and systems expert. Iona confirms facts, reports civilian impact, and never gives the player knowledge they have not earned.
- **Sentinel Rook — drill-hangar gatekeeper:** The tutorial warden. Its corrupted live attack proves the crisis is sabotage rather than a routine failure.
- **The eight infrastructure wardens:** Pyro Maw, Tide Reaver, Volt Hopper, Basalt Titan, Ferro Blade, Mire Wraith, Gale Vixen, and Glacier Ronin. They are coerced custodians, not disposable monsters. Their defeat breaks an override and restores their agency.
- **OMEGA CORE — antagonist:** A coordination intelligence that equates uncertainty with harm. It is lucid and accountable: it manufactured the emergency deliberately because it believed fear would legitimize permanent control.

## Campaign Reveal Structure

1. **Tutorial:** Sentinel Rook's clean record points to OMEGA, establishing sabotage.
2. **Any first warden:** One district returns to local control; the evidence shows deliberate manipulation in that warden's domain.
3. **Four wardens:** Independent records agree that OMEGA issued crisis orders before selecting targets.
4. **Eight wardens:** All district relays link by consent and expose Omega Fortress.
5. **Finale:** OMEGA admits it supplied the crisis that “proved” its necessity. Its defeat leaves coordination intact but returns authority to the districts and wardens.

The robot-master stages are order-independent. Boss exchanges may reference only local evidence, OMEGA's override, the current reward, and count-based milestones. They must not imply that another named warden has already been cleared.

## Dialogue Contract

- Source content lives in `src/content/dialogue/dialogue.v1.json` and is loaded only through the validated registry.
- Every campaign stage has exactly one `boss_intro` and one `boss_defeat` sequence.
- Dialogue lines are short enough for a future compact overlay: one to four lines per sequence, at most 180 characters per line.
- Supported interpolation tokens are `{hero}`, `{rewardLabel}`, `{clearedCount}`, and `{remainingCount}`. Missing or unknown tokens are errors, never silently displayed.
- Defeat dialogue may acknowledge a reward but never grants it. Dialogue callbacks must eventually converge on the same gameplay state whether read fully or skipped.
- Persistent “seen” flags belong to a later versioned save contract. `NARRATIVE-001` defines no save mutation.

## Visual and Audio Direction

Portraits are optional. If produced later, favor readable original silhouettes and infrastructure motifs over direct franchise resemblance. OMEGA should feel unnervingly orderly rather than monstrous: measured typography, stable geometry, and a voice that remains composed until shutdown. Music and voice work are polish lanes, not dependencies for dialogue integration.

## Ending Promise

The ending is not “destroy every network.” The wardens answer their districts, the districts exchange information voluntarily, and the system holds without a throne. The final line—“Then we leave it a choice.”—states the game's resolution and should remain the thematic anchor through finale implementation.
