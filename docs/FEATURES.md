# Feature checklist

## 28 October: directional combat and visual creator

Implemented and locally tested, with live browser acceptance recorded: 360-degree physical shield coverage, headshot-only lethal sniper, explicit rocket impact and stronger distance/cover blast damage, radius-correct saw ricochets, bounded combat effects, and a visual creator with large animated preview and saved eyebrows. [Current evidence and deployment status](COMBAT_WORKSHOP_2026_10_28.md). Earlier dated records remain historical.


## October 21: Crit 10 and player feedback

Current evidence is in [CRIT_10_VALIDATION.md](CRIT_10_VALIDATION.md).
Implementation and release verification are recorded separately there.

- [x] Names plus stable actor/profile IDs in meaningful server gameplay logs;
      actual changed settings and denied host actions are traceable.
- [x] Updated browser-identity, access and visibility decision; URL-only
      two-profile rehearsal instructions.
- [x] Crit 10 reflection based on Adithya's supplied UAT and agent-direction account.
- [x] Direction-independent camera tracking, including beyond all terrain edges.
- [x] Finite exterior flight with progressive unpowered fall damage; zero-gravity
      Lunarcy and original own-flag return bounds preserved.
- [x] Compact translucent three-slot inventory.
- [x] Server-validated Random spawns setting, default on, with safety and variety.
- [x] M93BA two-body-hit / one exposed standing-head hit at standard settings (28 October amendment); poison harms its owner,
      allies and opponents regardless of friendly fire. Animated poison bloom,
      swirling smoke, rising bubbles and skull cue.
      See [combat follow-up validation](COMBAT_FOLLOWUP_VALIDATION.md) for evidence.
- [x] Viewer-relative green ally/red enemy nameplates, explicit text markers,
      fixed screen-size text, dark backing, matching health bars and collision
      placement for crowded views. Concealed opponents remain hidden.
      Local/live verification for this follow-up is recorded in
      [nameplate validation](NAMEPLATE_VALIDATION.md).

This records the full agreed scope. **Implemented** means the feature crosses its
required simulation/server/client boundaries. **Tested locally** means a named
check exercised it, with the limits below. **Verified live** is reserved for
checks actually performed on Fly. Human playtesting is a separate requirement.

## Current release boundary

The **21 October Crit 10 revision is deployed**, with
[local and live evidence recorded separately](CRIT_10_VALIDATION.md).
The earlier six-layout verification below applies to the October 14 release.
All six new layouts passed live desktop and
phone rounds; all five modes produced identical saved results in independent
sessions. Saved pre-existing profile/history survived deployment. The first
phone pass was held behind Adithya's active match; its failed attempt and the
successful retry remain explicit in the validation record.
It adds six authored reference layouts, physical crouch/explicit descent,
space inertia, a Classic PC damage/handling profile, saved scope levels,
server-filtered foliage concealment, navigation-aware bots, training tasks and
editable touch controls. [ADR 0004](decisions/0004-classic-pc-gameplay.md) records
the chosen rules; [the revision plan](REVISION_2026_10_14_PLAN.md) retains the
full requirements. Current evidence and remaining gates are recorded in
[14 October validation](REVISION_2026_10_14_VALIDATION.md).

### Previous deployed boundary

The [13 October revision](REVISION_2026_10_13.md) adds distinct weapon
silhouettes, role-based range tuning, recorded audio, physical shield/knife
handling, automatic grenade collection, an attacker-follow death camera,
rocket-death debris and six distinct arenas.

**Local evidence:** 201 unit tests and 33 running-app/server/storage
checks pass (234 total). Browser acceptance covers all 23 weapon/equipment
entries and five throwables across 29 rounds, all six arena choices and 23
armory cards at desktop and phone sizes. See
[13 October validation](REVISION_2026_10_13_VALIDATION.md) for the exact scope
and limitations. **Verified live:** all six map selections, 23 armory cards,
profile layouts, 16 audio responses/hashes/decodes, successful flows for all five
modes, and unchanged pre-existing saved profile/history after deployment. The
first survival attempt lost both browser heartbeats; its failed report and
successful fresh retry are retained. Detailed combat geometry and every arsenal
entry remain supported by the local tests rather than an exhaustive live playtest.

Earlier deployment and soak evidence in [OCTOBER_VALIDATION.md](OCTOBER_VALIDATION.md)
and [VALIDATION.md](VALIDATION.md) applies to those recorded builds. It does not
prove the changed build. Human balance, familiarity and sound assessment remain
pending. All four existing arenas are retained, with Sirocco Dunes and Sunspire
Palace added.

## Movement and inventory

| Feature | Status | Evidence |
|---|---|---|
| Run, jump, physical crouch/crawl, explicit platform descent | tested locally | movement/researched-gameplay tests; S never descends; Shift+S/Descend is deliberate |
| Directional flight, fuel use/recharge | tested locally | movement tests; browser practice |
| Saved weapon-dependent Near/Field/Far/Range views | verified live | camera reach/legibility tests locally; live scope selection/persistence in both browser viewports |
| Zero-gravity inertia and unlimited Lunarcy boost | tested locally | actor/projectile/equipment/flag regressions; forced room rules; actual arena browser rounds |
| Bush concealment and server-filtered enemy positions | tested locally | visibility serialization and bot perception tests; public scores omit coordinates |
| Health, damage, deaths, respawns | tested locally | combat/full-game tests; browser rounds |
| Gradual health recovery after combat delay | tested locally | gameplay-refresh tests; observed browser damage and one-point recovery |
| Distinct Easy / Normal / Hard bot reactions and bursts | tested locally | bot tuning and navigation tests; human balance remains pending |
| Two-second spawn protection and early action/flag termination | tested locally | combat/full-game tests |
| Three slots, direct selection, Tab cycling | tested locally | combat/full-game tests; arsenal browser |
| Independent compatible dual wielding | tested locally | dual ammunition/reload tests |
| Heavy exclusion; shield pairs only with a carried machete | tested locally | combat revision tests; shield browser; selecting a firearm drops the shield as a pickup |
| Manual pickups, swapping, dropping | tested locally | combat tests; browser range traversal |
| Automatic/manual reload; holstered reload continues | tested locally | per-slot reload and drop cancellation tests; PHASR/flame automatically refill |
| Health, ammo, fuel pickups | tested locally | full-game tests |
| Six-item throwable cap; start with two frag, one flash, one poison | tested locally | combat revision tests; four of six spaces occupied at spawn |
| Automatic allowed grenade pickup; T cycles stock, G throws | tested locally | wall/full-capacity/allowlist simulation cases; browser throwable rounds; last-item auto-selection |
| Remappable keys, numpad aim/fire, movement facing, aim-only arrows | tested locally | input regressions; eight-flow preferences and revision browsers |
| All touch actions and saved layout editor | verified live, bounded | all 18 controls and overlap/reset/rotation checked locally; live drag/save and profile restoration after reload |
| Focus loss clears held inputs | tested locally | input handlers; server stale-input test |

## Complete arsenal

All values are authored tuning, not recovered Mini Militia balance values.
[Browser arsenal evidence](browser-arsenal-note.md) covers visible equipment,
input, ammunition and authoritative events. Damage, penetration and immunity
assertions belong to simulation tests; an observed shot alone is not that proof.

| Entry | Status | Behavior |
|---|---|---|
| Mini Eagle | tested locally | semi-automatic sidearm |
| Golden Eagle | tested locally | slower, stronger sidearm |
| Magnum | tested locally | high-damage six-round sidearm |
| Uzi | tested locally | fast, wide-spread one-handed SMG |
| Tec-9 | tested locally | one-handed SMG with different cadence/range |
| MP5 | tested locally | two-handed, tighter SMG |
| AK-47 | tested locally | rifle, stronger individual shots |
| M4 | tested locally | one press commits three rounds; held directional input repeats after cooldown |
| Tavor X95 | tested locally | tighter precision-oriented rifle |
| XM8 | tested locally | faster rifle with larger magazine |
| M14 | tested locally | semi-automatic finite-travel precision projectile |
| M93BA | tested locally | long-range heavy precision rifle; 1.5× exposed-head hit damage |
| SPAS-12 | tested locally | seven-pellet pump shotgun |
| AA-20 | tested locally | automatic six-pellet shotgun |
| Minigun | tested locally | 650ms spin-up before sustained high-rate fire |
| SMAW | tested locally | swept rocket with blast falloff |
| RG6 | tested locally | bouncing timed explosive projectile |
| Saw launcher | tested locally | wind-up, swept ricochet, bounded piercing and terminal explosion |
| Flamethrower | tested locally | short cone, one damage application per target per burst; automatic refill |
| PHASR beam | tested locally | penetrates players, stops at walls; automatic refill |
| EMP gun | tested locally | travelling pulse, flight disable and mine disarming |
| Machete | tested locally | one valid strike kills; range, walls, protection and friendly-fire checks still apply |
| Riot shield | tested locally | aim-oriented plate blocks intersecting bullets and attenuates covered splash; exposed angles, direct rockets, flame and gas remain counters |
| Fragmentation | tested locally | blast falloff and wall occlusion |
| Flashbang | tested locally | distance/cover attenuation, temporary sight impairment, bot disruption |
| Poison smoke | tested locally | visible lingering damage area |
| EMP grenade | tested locally | area flight disable |
| Proximity mine | tested locally | terrain attachment, arming delay, enemy trigger |

Each entry has a pickup, original visual, HUD representation, replicated behavior
and inventory handling. All 23 weapon/equipment entries use distinct authored
outlines shared by held art and HUD icons; identification does not depend only
on colour. Equipment correctly avoids firearm ammunition/reload rules. Authored
range classes and flat bullet damage through maximum reach are tested locally;
explosions retain distance falloff. These are not recovered historical v4 statistics.

## Modes and results

| Feature | Status | Evidence |
|---|---|---|
| FFA, enemy-kill TDM, optional limits, draws | tested locally | combat tests; two independent browsers |
| Friendly-fire scoring excludes friendly kills/suicides/environment | tested locally | combat/full-game tests |
| Own-flag collection and opposing-goal delivery | tested locally | simulation tests; actual browser delivery |
| Exactly one flag per team; next-tick replacement | tested locally | full-game tests |
| Dropped flag remains beyond 15 seconds | tested locally | 20-second test with no timer |
| Enemy contact cannot collect/return | tested locally | full-game tests |
| Death/disconnect drop, teammate recovery, same-flag OOB return | tested locally | simulation and room tests |
| Normal weapons/flight while carrying; no voluntary flag toss | tested locally | core flag tests and unchanged action path |
| Damage before delivery; simultaneous final-tick/limit scoring | tested locally | full-game tests |
| Attacker-follow camera until respawn, with self/environment and missing-attacker handling | tested locally | death attribution regressions; real-network browser camera checks |
| Bounded rocket-death fragments and separate ordinary death effects | tested locally | death-effects tests; browser screenshots; effects do not alter combat |
| Training: one human and zero–three bots, equipment/movement/own-flag lessons | tested locally | authoritative arena flags; checklist reacts to input and delivery events; Test Range remains flag-free |
| Survival: one–four humans, waves, max eight active enemies | tested locally | full-game tests; two-browser survival |
| Kills/deaths/assists/deliveries, team scores, MVP | tested locally | full-game tests; results browser |
| Assist threshold/window, mode-specific contribution, shared MVP ties | tested locally | combat/full-game tests |
| Results explain ranking and distinguish saving/failure/saved | tested locally | browser results; failure-injection room test |
| Training/survival separate from human PvP aggregates | tested locally | storage tests |

## Maps and rooms

| Feature | Status | Evidence |
|---|---|---|
| Outpost, High Tower, Ice Box, Pyramid, Lunarcy, Catacombs | verified live, bounded | six live Training rounds in each browser viewport; thirty local map/mode cases; both-team ground/flight routes and highest-pickup reach tested locally |
| Hazard-aware spawning and bounded bot navigation prewarm | tested locally | spawn danger tests; yielded cache preparation before the match clock starts |
| Cryptworks, Outpost Yard, Crosscurrent, Skyshaft, Sirocco Dunes, Sunspire Palace | tested locally | six arena choices in both browser viewports; authored map previews |
| Connected catacombs, jungle canyon, snowy forts, coastal spans, desert mesas and palace galleries | tested locally | collision-matched terrain; independent visual inspection; palace stair traversal |
| Ground route to flags/goals with no flight, double gravity, half speed | tested locally | all six arenas in map tests |
| Spawn collision checks and navigation nodes | tested locally | map tests; six-arena bot routes for both teams with flight on/off |
| Full-catalogue Test Range | tested locally | all arsenal browser sessions; restricted from Flag Delivery |
| Public listings and quick join | implemented | map thumbnails, human/bot counts, state/password/custom-rule labels; admission checks |
| Private codes/invites, optional passwords | tested locally | room/API checks |
| Ready-up, team selection, host controls/transfer | tested locally | room/network checks |
| Spectators, late join, rematches | tested locally | room checks; browser mode flows |
| Live settings frozen; changes staged for next round | tested locally | room tests; two consecutive staged settings browser checks |
| Named saved presets | tested locally | owner-scoped storage/API checks; preset save/apply browser check |
| Map/mode/capacity/duration/score limit | implemented | validated settings + host UI |
| Flight/thrust/fuel capacity/recharge/unlimited fuel | tested locally | shared settings/physics + UI |
| Gravity/speed/health/damage/respawn delay | tested locally | shared settings/physics/combat + UI |
| Weapon/throwable allowlists and three-slot loadouts | tested locally | validation/full-game tests + UI |
| Map pickups/unlimited ammo/friendly fire | tested locally | simulation tests + UI |
| Bot count and difficulty | tested locally | server bots; training/survival |
| Default one active room, four waiting, 24 clients | tested locally | room admission and bounded queues; two-room override is acceptance-only |

## Supporting systems

| Feature | Status | Evidence |
|---|---|---|
| Persistent guest identity, profile and preferences | tested locally | cookie/API and container recreation |
| Full pilot creator: callsign, colour, body, outfit, hair/colour, facial hair, eyewear, headgear, skin and emblem; four original presets | verified live | original SVG/Pixi art, server validation, lobby/match rosters and two-browser persistence checks; [release evidence](PILOT_RELEASE_2026_10_21.md) |
| Default-on optional gentle aim assist and separate dotted sight guide | tested locally; controls verified live | bounded visible-enemy correction, authoritative near-miss regression and saved desktop/phone controls; human balance acceptance pending |
| Hangar startup/retry, real arena/snapshot loading and touch-specific tips | verified live | failure/delay injection, unit cleanup checks and desktop/phone screenshots |
| Armoury gun sound previews | verified live | all sixteen credited recordings fetched in both browsers; same playback path as gameplay; listening quality remains a human judgement |
| History pagination, match details, weapon statistics | tested locally | storage/API/browser history |
| CC0 recorded firearm shots and human hurt/death voices; authored special effects | tested locally | [audio credits](../src/client/public/audio/CREDITS.md), source/hash mapping and browser decode/playback scheduling; subjective quality remains unverified |
| Mute, volume, shake, independent blood and low-flash choices | tested locally | persisted profile settings; equivalent dark flash exposure in both browser viewports; physical-device/listening assessment pending |
| Team names/markers and readable identifiers | implemented | renderer/HUD/results |
| Room chat and mute | tested locally | room test; escaped UI; mute/unmute browser check |
| Complete server-rendered README | tested locally | preserved course invariant |
| 60 Hz authority, 20 Hz snapshots, 30 Hz input batches | tested locally | shared loop/server/clients; load harness |
| Movement prediction/reconciliation; 100 ms interpolation | implemented | shared movement/client; browser verification |
| Server-validated hitscan history up to 150 ms | tested locally | rewind tests; room input validation |
| Rate/size/queue bounds; compression off; origin/session checks | tested locally | authority/API tests |
| Five-second checkpoints and idempotent finalization | tested locally | storage tests and restart acceptance |
| Interrupted rounds preserve checkpoint without completed awards | tested locally | container restart/recreation acceptance |
| Ten-second vulnerable body, thirty-second reserved seat | tested locally | room tests; actual 10.5-second reconnection |
| Absent-team grace and abandonment | tested locally | room tests |
| Lifecycle/timing/memory/storage logging | implemented | health endpoint and acceptance reports |

## Still requires external evidence

- Returning-player and newcomer playtests, observed problems and resulting tuning.
- Physical phone performance and subjective sound/feel assessment. Native desktop
  GPU measurements are recorded separately in RENDERING_EVIDENCE.md.
- Exact historical publication timing at the cutoff is not established by the
  current public-state check. The repository is already public and crit-8 is
  preserved; later course ship/tag actions remain Adithya's responsibility.

These are not represented as completed by automated tests.
