# Feature checklist

This records the full agreed scope. **Implemented** means the feature crosses its
required simulation/server/client boundaries. **Tested locally** means a named
check exercised it, with the limits below. **Verified live** is reserved for
checks actually performed on Fly. Human playtesting is a separate requirement.

## Current release boundary

P0–P5 implementation is present. P6 acceptance is in progress. The integrated
local check passes 96 simulation tests, five touch-input tests and 32 server/storage/API/course tests.
Browser arsenal acceptance passes all weapons and throwables. Live browser verification covers every mode, desktop/touch practice and saved
history across Fly restart, cold start and redeployment. Two thirty-minute
constrained server soaks passed. Detailed status and limits are recorded in [VALIDATION.md](VALIDATION.md), not inferred
from these local checks. All four planned arenas are retained.

## Movement and inventory

| Feature | Status | Evidence |
|---|---|---|
| Run, jump, crouch, drop through platforms | tested locally | movement tests; desktop/phone practice |
| Directional flight, fuel use/recharge | tested locally | movement tests; browser practice |
| Weapon-dependent zoom | tested locally | weapon range/HUD; rendering uses weapon data |
| Health, damage, deaths, respawns | tested locally | combat/full-game tests; browser rounds |
| Two-second spawn protection and early action/flag termination | tested locally | combat/full-game tests |
| Two slots, direct selection, switching | tested locally | combat/full-game tests; arsenal browser |
| Independent compatible dual wielding | tested locally | dual ammunition/reload tests |
| Heavy exclusion, shield paired with one-handed equipment | tested locally | full-game tests; shield browser |
| Manual pickups, swapping, dropping | tested locally | combat tests; browser range traversal |
| Automatic and manual reload | tested locally | combat/full-game tests; browser ammunition |
| Health, ammo, fuel pickups | tested locally | full-game tests |
| Six-item throwable cap, two default frags | tested locally | full-game tests |
| Remappable keys, keyboard aiming/fire | tested locally | eight-flow preferences browser check; persisted remapping and keyboard input |
| All touch actions | implemented | two sticks, twelve action buttons, scoreboard/menu; practice movement/fire tested |
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
| M4 | tested locally | faster rifle |
| Tavor X95 | tested locally | tighter precision-oriented rifle |
| XM8 | tested locally | faster rifle with larger magazine |
| M14 | tested locally | semi-automatic precision rifle |
| M93BA | tested locally | long-range heavy precision rifle |
| SPAS-12 | tested locally | seven-pellet pump shotgun |
| AA-20 | tested locally | automatic six-pellet shotgun |
| Minigun | tested locally | sustained high-rate fire |
| SMAW | tested locally | swept rocket with blast falloff |
| RG6 | tested locally | bouncing timed explosive projectile |
| Saw launcher | tested locally | swept ricocheting disc |
| Flamethrower | tested locally | short cone, one damage application per target per burst |
| PHASR beam | tested locally | penetrates players, stops at walls |
| EMP gun | tested locally | damage plus temporary flight disable |
| Machete | tested locally | stronger, longer melee strike |
| Riot shield | tested locally | directional direct-fire damage reduction |
| Fragmentation | tested locally | blast falloff and wall occlusion |
| Gas | tested locally | visible lingering damage area |
| EMP grenade | tested locally | area flight disable |
| Proximity mine | tested locally | terrain attachment, arming delay, enemy trigger |

Each entry has a pickup, original visual, HUD representation, replicated behavior
and inventory handling. Equipment correctly avoids firearm ammunition/reload rules.

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
| Training: one human and zero–three bots | tested locally | all arsenal browser sessions; practice round |
| Survival: one–four humans, waves, max eight active enemies | tested locally | full-game tests; two-browser survival |
| Kills/deaths/assists/deliveries, team scores, MVP | tested locally | full-game tests; results browser |
| Assist threshold/window, mode-specific contribution, shared MVP ties | tested locally | combat/full-game tests |
| Results explain ranking and distinguish saving/failure/saved | tested locally | browser results; failure-injection room test |
| Training/survival separate from human PvP aggregates | tested locally | storage tests |

## Maps and rooms

| Feature | Status | Evidence |
|---|---|---|
| Cryptworks, Outpost Yard, Crosscurrent, Skyshaft | tested locally | authored geometry; map tests; browser modes |
| Ground route to flags/goals with no flight, double gravity, half speed | tested locally | all four arenas in map tests |
| Spawn collision checks and navigation nodes | tested locally | map tests; server bot routing |
| Full-catalogue Test Range | tested locally | all arsenal browser sessions; restricted from Flag Delivery |
| Public listings and quick join | tested locally | APIs and room admission |
| Private codes/invites, optional passwords | tested locally | room/API checks |
| Ready-up, team selection, host controls/transfer | tested locally | room/network checks |
| Spectators, late join, rematches | tested locally | room checks; browser mode flows |
| Live settings frozen; changes staged for next round | tested locally | room tests; two consecutive staged settings browser checks |
| Named saved presets | tested locally | owner-scoped storage/API checks; preset save/apply browser check |
| Map/mode/capacity/duration/score limit | implemented | validated settings + host UI |
| Flight/thrust/fuel capacity/recharge/unlimited fuel | tested locally | shared settings/physics + UI |
| Gravity/speed/health/damage/respawn delay | tested locally | shared settings/physics/combat + UI |
| Weapon/throwable allowlists and two-slot loadouts | tested locally | validation/full-game tests + UI |
| Map pickups/unlimited ammo/friendly fire | tested locally | simulation tests + UI |
| Bot count and difficulty | tested locally | server bots; training/survival |
| Default one active room, four waiting, 24 clients | tested locally | room admission and bounded queues; two-room override is acceptance-only |

## Supporting systems

| Feature | Status | Evidence |
|---|---|---|
| Persistent guest identity, profile and preferences | tested locally | cookie/API and container recreation |
| Colour, helmet, face and emblem customisation | implemented | original renderer + profile API; persistence checks |
| History pagination, match details, weapon statistics | tested locally | storage/API/browser history |
| Procedural audio, mute, volume, reduced shake | implemented | client controls; audible human assessment pending |
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
- Repository visibility at the agreed cutoff, and final course ship/tag procedure.

These are not represented as completed by automated tests.
