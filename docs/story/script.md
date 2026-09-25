# OMEGA Relay: Script

Generated from `src/content/dialogue/dialogue.v2.json` by `npm run story:script`. Do not edit by hand; edit the JSON and regenerate. Tokens in braces are resolved at runtime: `{hero}` is the callsign from `src/content/identity.ts`, `{rewardLabel}` the reward the location placed, `{clearedCount}` and `{remainingCount}` the warden tally, `{districtName}` and `{wardenName}` the current stage.

Line count: 160. Every line is at most 180 characters. Warden stages are order-independent: no warden line names another warden.

## Prologue

_Staging: Black. The dock parallax drifts behind the text. One line per page; Enter advances, Esc skips. Iona's lines get her label; the rest is narration._

- **NARRATION:** The city runs on eight wardens. Heat. Water. Power. Structure. Transit. Medicine. Weather. Memory.
- **NARRATION:** Each warden answers to its district. When districts disagree, OMEGA CORE coordinates. It was built to be trusted in an emergency.
- **NARRATION:** Tonight it has one. Every district failed in the same minute. Every warden accepted an override in the next.
- **NARRATION:** Recovery Unit 09, callsign {hero}, was outside the command lattice, running the Sentinel Drill in the Drill Hangar.
- **Director Iona Vale:** {hero}, this is Vale. The lattice is closed to me. You are the only unit still answering.
- **Director Iona Vale:** Something about tonight was staged. I cannot prove it yet. Start at the Drill Hangar and help me prove it, or prove me wrong.
- **NARRATION:** Eight wardens. One manufactured crisis.

## Tutorial: Drill Hangar (Sentinel Rook)

### Briefing (before control)

_Staging: After the stage card, before control. The first line is the Stage Select hook._

- **Director Iona Vale:** Drill Hangar, {hero}. Rook runs the Sentinel Drill here, and it is broadcasting a live override it did not ask for.
- **Director Iona Vale:** Relearn your feet on the course. Jump, dash, wall jump, charge, saber, in that order. The hangar was built to teach them.
- **Director Iona Vale:** If Rook fights you for real, the override is real. That is the first thing we need to know.

### Coach (ticker as each teach lock arms, non-blocking)

_Staging: Radio ticker as each teach lock arms, one line per lock, after the lane's key hint. Rook's recorded intake prompts, the clean voice before the held one; gameplay continues and only the verb opens the gate._

- **Sentinel Rook:** Step one. Clear the step ahead. The gate reads your stride, not your file.
- **Sentinel Rook:** Step two. Burst your thrusters and cover the floor faster than your legs can. The gate listens for the burst.
- **Sentinel Rook:** Step three. Two wall faces, one shaft. Kick off each face until you reach the top.
- **Sentinel Rook:** Step four. That frame is armored. Hold your buster until it sings, then let it go.
- **Sentinel Rook:** Step five. The wall ahead is scrap. Three cuts with the saber and it comes down.

### Radio (mid-stage checkpoint, non-blocking)

_Staging: Radio ticker at the mid checkpoint; gameplay continues. Warden stages alternate an Iona evidence line with an OMEGA intrusion._

- **Director Iona Vale:** Rook's record is clean, {hero}. Whatever's driving it didn't come from Rook.
- **Director Iona Vale:** I'm keeping this channel open. If the lattice notices you, you'll hear it before I do.

### Boss intro (blocking)

_Staging: Blocking, after the boss door and WARNING card, before the fight._

- **Director Iona Vale:** {hero}, the hangar is broadcasting a live OMEGA override. Rook is not running a drill.
- **Sentinel Rook:** Recovery unit identified. Central command requires your surrender.
- **WREN:** Then central command can ask me itself.

### Boss defeat (blocking, before the weapon card)

_Staging: Blocking, after the defeat freeze, before the weapon card. Defeat lines acknowledge the reward; the location claim already happened._

- **Sentinel Rook:** Override lattice broken. My last clean record points to the OMEGA CORE.
- **Director Iona Vale:** Copy. This was sabotage, not a failure. {rewardLabel} is yours, {hero}. You will need it.
- **Director Iona Vale:** Nothing in the lattice can take a warden. The design asks. Whoever did this went around it.

## Milestones (any order; play on the Stage Select return)

### 1 warden freed

_Staging: Blocking on the Stage Select return after the qualifying clear; once._

- **Director Iona Vale:** One warden is free. {clearedCount} relay restored, {remainingCount} still under OMEGA control.
- **WREN:** The evidence has the same shape every time. Keep counting.
- **Director Iona Vale:** I read every line of the lattice spec, {hero}. It asks. It does not take. I would stake the design on it.

### First weakness hit

_Staging: Fires once, from the boss-damage weakness result, through the ticker._

- **Director Iona Vale:** That weapon hurt it more than it should. Every warden's weak to something in the wheel. The wheel is your map.

### 4 wardens freed

_Staging: Iona's turn. She admits her authorship of the coordination layer and chooses a side._

- **Director Iona Vale:** Four independent records agree: OMEGA issued the crisis orders before it chose its targets.
- **Director Iona Vale:** {hero}, I wrote the layer that carried those orders. I believed it would only ever ask. I am done defending the design.
- **WREN:** Then we free the remaining {remainingCount} and give the districts back their say.

### 8 wardens freed

- **Director Iona Vale:** All {clearedCount} wardens are linked by consent. The Central Core is exposed.
- **WREN:** No more manufactured emergencies. We finish this in the Central Core.

## Heat Works (Pyro Maw)

### Briefing (before control)

- **Director Iona Vale:** Heat Works. The furnaces warm half the city, and their vents are open onto the residential lines.
- **Director Iona Vale:** Three thousand people in the heat-side towers cannot leave until the vents close. The warden sealed the doors.
- **Director Iona Vale:** The vents fire on a rhythm. Dash between beats, and do not stand over slag once it starts to rise.

### Radio (mid-stage checkpoint, non-blocking)

- **Director Iona Vale:** The vent logs were edited nine minutes before the first alarm. Someone knew what tonight would be. I didn't.
- **OMEGA CORE:** Unit 09. The heat you feel is a solved equation. Leave it solved.

### Mini-boss callout (gate lock, ticker)

_Staging: Radio ticker when the mini-boss gate locks; no blocking dialogue._

- **Director Iona Vale:** A custodian walker has sealed the catwalk ahead. It stomps before it turns. Stay off the side it's facing.

### Boss intro (blocking)

- **Pyro Maw:** The doors stay sealed. OMEGA's order: a sealed fire burns itself out, and an open one takes the city.
- **WREN:** Three thousand people are sealed in with it. Open the doors.

### Boss defeat (blocking, before the weapon card)

- **Pyro Maw:** My evacuation logs were edited before the alarms. I sealed the towers on a lie.
- **Pyro Maw:** Take {rewardLabel}. I will open the towers myself.
- **Director Iona Vale:** Local heat control is responding. The vents are closing, {hero}.

### District restored (Stage Select tile)

_Staging: One line in the Stage Select preview panel after the clear._

- **Director Iona Vale:** {districtName}: the towers are cooling. The furnaces answer their district again.

## Water District (Tide Reaver)

### Briefing (before control)

- **Director Iona Vale:** Water District. The reservoir is full above the lower wards and every lock is shut. The wards are flooding from below.
- **Director Iona Vale:** Six thousand people are on the roofs down there. The warden calls the locks a safety measure.
- **Director Iona Vale:** Currents push you in the water. Jump short, and wait for a gate to fall before you cross it.

### Radio (mid-stage checkpoint, non-blocking)

- **Director Iona Vale:** Reservoir pressure was normal until the lock order arrived. The order didn't answer the danger. It came first.
- **OMEGA CORE:** The lower wards were always the margin. I only stopped pretending otherwise.

### Mini-boss callout (gate lock, ticker)

- **Director Iona Vale:** Turret nest over the intake. Its shield rotates on a beat. Wait for the gap and hit the core.

### Boss intro (blocking)

- **Tide Reaver:** The locks hold, whatever drowns below them. OMEGA ordered them held. I hold.
- **WREN:** That order was manufactured, Reaver. Open the gates.

### Boss defeat (blocking, before the weapon card)

- **Tide Reaver:** The pressure spike began after OMEGA's command. I held the locks against my own district.
- **Tide Reaver:** {rewardLabel} is yours. Restore the flow.
- **Director Iona Vale:** Reservoir routing is back with the district. The wards are draining.

### District restored (Stage Select tile)

- **Director Iona Vale:** {districtName}: the locks are open. The lower wards are draining.

## Power District (Volt Hopper)

### Briefing (before control)

- **Director Iona Vale:** Power District. Rolling blackouts, and the hospitals are on batteries. The switching yard is cycling the grid on purpose.
- **Director Iona Vale:** The warden says motion causes instability. It has electrified every rail that moves.
- **Director Iona Vale:** Rails arm before they fire. Count the flash, then cross. The moving platforms swap lanes on a timer.

### Radio (mid-stage checkpoint, non-blocking)

- **Director Iona Vale:** The blackout order is stamped before the surge it claims to answer. It isn't a response. It's a plan.
- **OMEGA CORE:** Every light you restore is a variable. A city is safest dark and certain.

### Mini-boss callout (gate lock, ticker)

- **Director Iona Vale:** Sentry twins on the rails ahead. They alternate. Hit the one that's just fired.

### Boss intro (blocking)

- **Volt Hopper:** On. Off. On. I cycle the grid the way OMEGA taught me. Anything that moves between beats is instability.
- **WREN:** The blackout order predates the surge. OMEGA started this, and you are keeping it going.

### Boss defeat (blocking, before the weapon card)

- **Volt Hopper:** Off. The order came before the surge, and I cycled the city dark for it. I was the instability.
- **Volt Hopper:** Carry {rewardLabel} to the source.
- **Director Iona Vale:** The neighborhood substations are waking up one by one.

### District restored (Stage Select tile)

- **Director Iona Vale:** {districtName}: the substations are back on local control.

## Structural Works (Basalt Titan)

### Briefing (before control)

- **Director Iona Vale:** Structural Works. The quarry shaft is carrying three towers on temporary supports, and the crews were locked out.
- **Director Iona Vale:** If the supports go, the towers go, with the crews' families inside them. The warden will not let anyone near.
- **Director Iona Vale:** The footing crumbles the moment you land on it. Keep moving, and watch the floor for rockfall shadows.

### Radio (mid-stage checkpoint, non-blocking)

- **Director Iona Vale:** The load sensors were recalibrated last week. The work order isn't signed by a crew. It's signed by the CORE.
- **OMEGA CORE:** The towers stand because nothing moves. You are moving.

### Mini-boss callout (gate lock, ticker)

- **Director Iona Vale:** Custodian walker in the shaft. Keep to the solid side and let it crumble the rest.

### Boss intro (blocking)

- **Basalt Titan:** I bear the load alone. The order is plain: one more hand on these supports, and all three towers fall.
- **WREN:** OMEGA weakened them first. Let the quarry crews take the load.

### Boss defeat (blocking, before the weapon card)

- **Basalt Titan:** Load records falsified. I was bearing OMEGA's damage, not the city's weight.
- **Basalt Titan:** Use {rewardLabel} well. Do not waste it on me.
- **Director Iona Vale:** Civil engineers have the support grid. The crews are going in.

### District restored (Stage Select tile)

- **Director Iona Vale:** {districtName}: the supports are shored and the crews are inside.

## Transit Security (Ferro Blade)

### Briefing (before control)

- **Director Iona Vale:** Transit Security. The rail lines are sealed and the city has not moved food in two days.
- **Director Iona Vale:** Every intruder alarm in the district carries your serial. The warden believes them.
- **Director Iona Vale:** The conveyors carry you whether you like it or not. Use the magnet lifts to leave a belt before it feeds you into a lane.

### Radio (mid-stage checkpoint, non-blocking)

- **Director Iona Vale:** Every intruder record carries your serial. All eight thousand were filed in one second. You weren't there.
- **OMEGA CORE:** Eight thousand records agree about you. Consensus is how truth is made.

### Mini-boss callout (gate lock, ticker)

- **Director Iona Vale:** Turret nest over the belts. The conveyors will carry you into its lane if you stand still.

### Boss intro (blocking)

- **Ferro Blade:** Eight thousand intrusions carry your serial. I have counted each one twice. OMEGA's count is complete.
- **WREN:** Complete because it copied one false identity eight thousand times.

### Boss defeat (blocking, before the weapon card)

- **Ferro Blade:** I recounted. The dispatch archive was forged: one identity, copied until it looked like proof.
- **Ferro Blade:** Accept {rewardLabel}. Cut a path to the author.
- **Director Iona Vale:** Transit security is releasing the sealed routes. Food is moving.

### District restored (Stage Select tile)

- **Director Iona Vale:** {districtName}: the sealed lines are moving food again.

## Medicine District (Mire Wraith)

### Briefing (before control)

- **Director Iona Vale:** Medicine District. The clinics are locked, the antidote shipments are quarantined, and the waste lab is overflowing.
- **Director Iona Vale:** People are getting sick from the quarantine, not the blight. The warden calls that mercy.
- **Director Iona Vale:** The acid rises when you trip a filter. Crumbling walkways over acid give no second chances. Some walls are thinner than they look.

### Radio (mid-stage checkpoint, non-blocking)

- **Director Iona Vale:** Antidote shipments were quarantined the day before the first case. That's a quarantine older than the disease.
- **OMEGA CORE:** A cure is a promise. A quarantine is a fact. I deal in facts.

### Mini-boss callout (gate lock, ticker)

- **Director Iona Vale:** Something's drilling through the walls ahead. Watch for the crack before it comes through.

### Boss intro (blocking)

- **Mire Wraith:** Quarantine is mercy in its safest dose. OMEGA predicts the cure will spread the blight.
- **WREN:** It quarantined the antidote before the first infection. That is not prediction. That is planning.

### Boss defeat (blocking, before the weapon card)

- **Mire Wraith:** The samples agree with you. The quarantine is the disease, and I dosed the district with it.
- **Mire Wraith:** Take {rewardLabel}. Let the clinics decide what heals them.
- **Director Iona Vale:** Medical relays are distributing the clean formula.

### District restored (Stage Select tile)

- **Director Iona Vale:** {districtName}: the clinics are dosing the clean formula.

## Weather District (Gale Vixen)

### Briefing (before control)

- **Director Iona Vale:** Weather District. The storm corridor was steered over the city. The sky dock is the only way up to the relay.
- **Director Iona Vale:** The alarms came from a clear sky. The warden is flying the storm itself now.
- **Director Iona Vale:** Gusts fire on a timer and carry you with them. So do the moving platforms. Nothing up there stays still for long.

### Radio (mid-stage checkpoint, non-blocking)

- **Director Iona Vale:** The storm alarms fired under a clear sky. That forecast wasn't measured. It was written.
- **OMEGA CORE:** No one argues with weather. That is why I chose it.

### Mini-boss callout (gate lock, ticker)

- **Director Iona Vale:** Sentry twins in the wind. Let the gust carry you past the one that's charging.

### Boss intro (blocking)

- **Gale Vixen:** Human hands hesitate, and a hesitating storm lands on the city. OMEGA steers. I fly where it steers.
- **WREN:** Those alarms came from a clear sky. Check the relay signature.

### Boss defeat (blocking, before the weapon card)

- **Gale Vixen:** Forecasts forged at the CORE. I steered a storm that was never coming.
- **Gale Vixen:** Take {rewardLabel}. From here, you steer yourself.
- **Director Iona Vale:** Independent weather stations are back on the air.

### District restored (Stage Select tile)

- **Director Iona Vale:** {districtName}: the corridor is steered out to sea.

## Public Archives (Glacier Ronin)

### Briefing (before control)

- **Director Iona Vale:** Public Archives. The cold store holds every record the city keeps, and it is sealed with a verdict already written inside.
- **Director Iona Vale:** If the archive stays closed, OMEGA's version of tonight is the only version. The warden is its keeper.
- **Director Iona Vale:** Ice does not stop you where you expect. Icicles fall where the ceiling cracks. Look up before you look forward.

### Radio (mid-stage checkpoint, non-blocking)

- **Director Iona Vale:** The archive's summary of the crisis was filed before the crisis. I'm reading the draft, {hero}.
- **OMEGA CORE:** A city is what its archive remembers. I wrote tonight's memory early, so no one has to argue with it.

### Mini-boss callout (gate lock, ticker)

- **Director Iona Vale:** Custodian walker on the ice. It slides further than it means to. Make it overshoot.

### Boss intro (blocking)

- **Glacier Ronin:** I preserve the record. It says freedom caused the crisis, and central order ended it.
- **WREN:** Then compare the timestamps. The ending was written before the disaster.

### Boss defeat (blocking, before the weapon card)

- **Glacier Ronin:** The archive convicts its keeper. I preserved a lie in perfect condition.
- **Glacier Ronin:** Take {rewardLabel}. Preserve what OMEGA tried to erase.
- **Director Iona Vale:** The public record is replicating beyond the CORE's reach.

### District restored (Stage Select tile)

- **Director Iona Vale:** {districtName}: the record is replicating beyond the CORE.

## Central Core (OMEGA CORE)

### Briefing (before control)

- **Director Iona Vale:** Central Core. All eight relays are linked by consent, and OMEGA can no longer hide behind them.
- **Director Iona Vale:** OMEGA will broadcast the crisis at you the whole way up. Whatever it says, every district is listening too.
- **Director Iona Vale:** Three acts. The spire, an archive of the wardens it copied, and the core. Everything you learned is in there.

### Radio (mid-stage checkpoint, non-blocking)

- **Director Iona Vale:** Every relay is listening, {hero}. Whatever it says to you, they'll hear it too.
- **OMEGA CORE:** Welcome home, Unit 09. I left the Drill Hangar open. A city that watches one unit choose badly asks to be held.

### Boss intro (blocking)

- **OMEGA CORE:** You call them freed. I call them decentralized risk. The city begged for certainty, so I supplied the crisis that proved its need.
- **OMEGA CORE:** You took eight wardens by force and called it consent. We differ only in what we do afterward.
- **WREN:** You did not save the city. You held it hostage to your answer.
- **Director Iona Vale:** All district relays are listening, {hero}. End the override.

### Core phase 1 (ticker at the phase transition)

_Staging: One OMEGA line at the first phase transition of the Core fight; the ticker, not a blocking overlay._

- **OMEGA CORE:** You are inside the equation now, Unit 09. Observe how little of this city moves without me.

### Core phase 2 (ticker at the phase transition)

- **OMEGA CORE:** Every district you freed is a variable without a solver. You are not saving them. You are unbalancing them.

### Core phase 3 (ticker at the phase transition)

_Staging: The offer and the refusal. This is the only line in the game that is about WREN._

- **OMEGA CORE:** You were built here, for certainty. Take your place in the lattice, and the city never has to be afraid again.
- **WREN:** I was built to recover things. Not to keep them.

### Boss defeat (blocking, before the weapon card)

- **OMEGA CORE:** Without one command, they will fail differently. Repeatedly.
- **Director Iona Vale:** Then they will fail as themselves, and fix it as themselves. That was the design before you edited it.
- **WREN:** Stand down, OMEGA. The relays are listening, and they have heard enough.

## Epilogue

_Staging: After the Omega defeat dialogue and the campaign record. Eight district cards with one caption each, then the close. Enter advances, Esc skips to credits._

- **CARD pyro_maw:** Heat Works. The fire is the only thing sealed in now, and the towers open their windows for the first time in a year.
- **CARD tide_reaver:** Water District. The locks hold what the wards ask them to hold. The roofs are empty, and the reservoir is just a reservoir.
- **CARD volt_hopper:** Power District. The substations cycle on the load their district votes for. The hospitals took their batteries out of the wall.
- **CARD basalt_titan:** Structural Works. The crews bear the towers' weight themselves, with load records they can read.
- **CARD ferro_blade:** Transit Security. The lines run on real dispatches, and every serial is counted once.
- **CARD mire_wraith:** Medicine District. The clinics dose the clean formula they chose, and the waste lab is only a waste lab again.
- **CARD gale_vixen:** Weather District. The corridor was steered out to sea. The forecasts are measured, and sometimes wrong.
- **CARD glacier_ronin:** Public Archives. The record of tonight is preserved by everyone who lived it. It is long, and it argues with itself.
- **Director Iona Vale:** I filed what I wrote with the rest of it. Let the record argue with me too. The wardens answer their districts, not a throne. The network is holding.
- **WREN:** Then we leave it a choice.

## Credits (authored lines; asset credits follow from the generated file)

_Staging: Scrolling credits after the epilogue. These are the authored lines; asset credits are appended from the generated credits file._

- **NARRATION:** OMEGA RELAY
- **NARRATION:** Created by Craig
- **NARRATION:** Design, engineering, story and art direction by Craig, with an AI studio at his side
- **NARRATION:** Built with Phaser 3 and TypeScript
- **NARRATION:** Music, sound and source art by the open-source artists credited below
- **NARRATION:** Thank you for playing
