# Feature checklist

Every agreed feature from [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), with
its status. A menu option or icon does not count as a working feature.

| Status | Meaning |
|---|---|
| **pending** | not built |
| **implemented** | built end to end (simulation, networking, rendering, HUD, persistence where relevant) |
| **tested locally** | implemented, and covered by an automated test or a recorded local browser run |
| **verified live** | tested locally, and checked on the deployed `*.fly.dev` app |

Nothing is **verified live** yet: the app has not been deployed (see
[HANDOFF.md](HANDOFF.md)).

## Movement and combat

| Feature | Status | Evidence / note |
|---|---|---|
| Running, jumping | tested locally | `test/movement.test.ts`, browser check |
| Crouching (slower movement) | tested locally | `test/movement.test.ts` |
| Dropping through marked platforms | tested locally | `test/movement.test.ts` |
| Directional flight, fuel depletion and regeneration | tested locally | `test/movement.test.ts` |
| Weapon-dependent zoom, right-click zoom | implemented | AK-47 has 1.25× zoom; right click / touch Zoom widens 1.35× |
| Damage, death, respawning (3 s) | tested locally | `test/combat.test.ts` |
| Spawn protection (2 s, ended by firing/throwing/melee) | tested locally | flag capture ending protection is P3 |
| Environmental death (leaving the map) | tested locally | `test/movement.test.ts` |
| Two weapon slots, select 1/2, swap Q | tested locally | `test/combat.test.ts` |
| Dual wielding compatible one-handed weapons (F) | pending | P4; `F` is bound but does nothing yet |
| Heavy weapons excluded from dual wield | pending | P4 |
| Shield in one slot | pending | P4 |
| Manual pickup / swap (E) | tested locally | `test/combat.test.ts` |
| Dropping equipment (X) | tested locally | dropped weapons keep their ammo, expire after 20 s |
| Auto-reload on empty, manual reload (R) | tested locally | `test/combat.test.ts` |
| Melee (V) | implemented | fixed 40 damage, not the machete; no dedicated test |
| Health / ammunition / fuel pickups | implemented | auto-collected; no dedicated test |
| Remappable bindings | pending | bindings live in one table (`src/client/input.ts`); no UI to change them |
| Keyboard aiming / fire alternative | implemented | arrow keys aim in 8 directions, J / Enter fire |
| Touch controls covering the same actions | tested locally | twin sticks plus 8 buttons; phone browser check |
| Losing focus clears held inputs | implemented | `blur` and `visibilitychange`; a neutral frame is sent when hidden |

## Arsenal (21 firearms, 4 throwables, 2 equipment)

| Weapon | Status | Note |
|---|---|---|
| Mini Eagle | tested locally | semi-auto sidearm, default slot 1 |
| Uzi | tested locally | automatic SMG, default slot 2 |
| AK-47 | tested locally | map pickup |
| SPAS-12 | tested locally | 7-pellet shotgun, map pickup |
| Golden Eagle, Magnum | pending | P4 |
| Tec-9, MP5 | pending | P4 |
| M4, Tavor X95, XM8 | pending | P4 |
| M14, M93BA | pending | P4 |
| AA-20 | pending | P4 |
| Minigun, SMAW, RG6 grenade launcher, saw launcher | pending | P4 |
| Flamethrower, PHASR beam, EMP gun | pending | P4 |
| Machete, riot shield | pending | P4 |
| Fragmentation grenade | tested locally | blast falloff and wall occlusion tested; 2 at spawn |
| Gas, EMP, proximity mine | pending | P4 |
| Six-throwable carrying limit | implemented | enforced on ammo pickups; only frags exist yet |

Weapon values are authored and untuned. None are claimed to match Mini Militia.

## Modes and results

| Feature | Status | Note |
|---|---|---|
| Team deathmatch (enemy kills score; suicides, environmental and friendly kills don't) | tested locally | `test/combat.test.ts`, `spec/alive.test.ts` |
| Friendly fire off by default, room toggle | tested locally | |
| Kill / score limit | tested locally | |
| Draw on equal scores | tested locally | |
| Free-for-all | tested locally | load probe, unit tests |
| Training (one human, up to 3 bots) | tested locally | the "Practice against bots" button; results kept out of PvP profile stats |
| Flag Delivery (all 12 rules) | pending | P3 (Codex) |
| Survival | pending | P5 |
| Scoreboard (Tab) with K/D/A | implemented | deliveries column waits for P3 |
| Assists (20% max health in 8 s) | tested locally | |
| Contribution score and MVP (fewer deaths, then shared) | tested locally | |
| Scoring explanation on the results screen | tested locally | browser check |

## Maps

| Map | Status | Note |
|---|---|---|
| Outpost Yard | tested locally | spawns stand on ground (unit test); goals and flag pedestals are placed for P3 but unused |
| Test Range (developer map) | implemented | available in any mode's map list |
| Cryptworks | pending | P5 |
| Crosscurrent | pending | P5 (second to cut) |
| Skyshaft | pending | P5 (first to cut) |
| Bot navigation data | implemented (minimal) | a few nav nodes per map; bots steer directly, no pathfinding |

## Rooms

| Feature | Status | Note |
|---|---|---|
| Public listing | tested locally | home screen polls every 4 s |
| Quick join | implemented | joins the fullest open public room, or makes one |
| Private invitation links / codes | tested locally | `/r/CODE` links, 5-character codes |
| Optional passwords | pending | |
| Readiness | implemented | shown in the lobby; the host may start regardless |
| Team selection | tested locally | auto-balanced on join, switchable in the lobby |
| Host controls (settings, start, end round, rematch) | tested locally | non-host attempts are rejected (spec) |
| Host transfer to longest-connected | implemented (basic) | on leave or after the 30 s seat hold; P3 strengthens it |
| Spectators | pending | P5; a full room refuses joins |
| Late joining | implemented | joins a running match on the smaller team |
| Rematches | implemented | back to the lobby with the same settings |
| Settings frozen during a round | tested locally | |
| Map, mode, capacity, duration, score limit | implemented | capacity is set from the API only, not the lobby UI |
| Flight, thrust, fuel capacity, recharge, unlimited fuel | implemented | |
| Gravity, movement speed, health, damage, respawn delay | implemented | |
| Weapon / throwable allowlists, starting loadouts | implemented server-side | no lobby UI yet (P4) |
| Map pickups toggle | implemented | |
| Unlimited ammunition | implemented | |
| Bot count and difficulty | implemented | |
| Named saved presets | pending | table exists; no API or UI (P4) |
| One active room, four waiting rooms, 24 clients | implemented | constants in `src/shared/constants.ts` |

## Supporting features

| Feature | Status | Note |
|---|---|---|
| Guest identity via opaque cookie | tested locally | `spec/alive.test.ts` |
| Display name and colour customisation | tested locally | |
| Character customisation beyond colour | pending | P5 |
| Persistent preferences | implemented | reduced screen shake is stored on the profile |
| Match history (paginated) and match details | tested locally | |
| Weapon statistics | pending | P5 |
| Sound and sound controls | pending | P5; the game is silent |
| Readable team identifiers | implemented | Ember / Tide names plus colours |
| Reduced screen shake | implemented | |
| Room chat with mute | pending | P5 |
| Server-rendered `/readme/` | tested locally | starter invariant |

## Multiplayer and persistence

| Feature | Status | Note |
|---|---|---|
| 60 Hz authoritative simulation, 20 Hz snapshots, 30 Hz input batches | tested locally | |
| Client prediction and reconciliation (own movement) | implemented | shooting isn't predicted, so tracers arrive after one round trip |
| 100 ms interpolation of other players | implemented | |
| Hitscan lag compensation (≤150 ms) | implemented | no dedicated test |
| One input frame per tick (no speed from extra messages) | tested locally | |
| Compression off, bounded messages and queues, origin/session checks, stalled-socket cleanup | tested locally (origin, session) | |
| Match row before play; 5 s checkpoints; idempotent finalisation | implemented | finalisation is idempotent by status check; no duplicate-finalise test yet |
| "Saving" until committed; failure shown honestly | implemented | no failure-injection test yet |
| Interrupted matches after restart | implemented | marked at boot; not yet tested across a container restart |
| Disconnect: controls neutral, body vulnerable 10 s, seat held 30 s, rejoin same player | tested locally (rejoin) | flag drop on disconnect is P3 |
| Absent team gets 30 s before abandonment | pending | the room only ends as abandoned when nobody is connected (P3) |
| Logging (lifecycle, rejections, storage, timing, memory) | implemented | JSON lines; no credentials logged |
