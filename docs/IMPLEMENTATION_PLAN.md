# Implementation plan: classic Mini Militia-style PC game

> Agreed plan, saved verbatim as the reference for every stage. The live status
> of each feature is tracked in [FEATURES.md](FEATURES.md); the latest stage
> handoff is in [HANDOFF.md](HANDOFF.md).

## 1. Product and scope

Build a **2D online arena shooter**, using old Mini Militia v4 as the gameplay reference, with keyboard/mouse controls, eight-player rooms, a substantial arsenal, configurable rules, and persistent results.

**Working title:** Jet Skirmish.

The defining modes are **team deathmatch** and **your own-flag delivery mode**. Free-for-all, training, and survival complete the game.

The existing repository is an unchanged starter. Its fixed hosting allowance is one shared CPU, 256 MB RAM, and a persistent volume. The implementation must work within that allowance.

**Confirmed decisions**

- Online browser play; no offline LAN.
- Maximum eight players per PvP room.
- Classic 2D presentation and flight.
- Four maps targeted; map count may fall to two.
- Required weapon, grenade, movement, room, and scoring systems remain in scope.
- Each team carries its own flag into the opposing goal.
- Dropped flags stay where they land. Only leaving the playable map returns a flag home.
- Claude Opus builds the initial foundation; Codex reviews and takes over the critical multiplayer and flag work.

Use v4 as the reference for feel, with later weapons deliberately included as extras. The developers' own Classic v4 configuration approximates v4.0.42; this project should distinguish researched behavior from its own tuning. [Developer reference](https://groups.google.com/g/mini-militia-classic-alpha-force/c/q04io0qi72c)

Use original character art, terrain, effects, audio, and branding. The Catacombs map will be a recognizable homage in its underground structure and combat opportunities, with authored geometry.

**Desktop remains the primary experience.** Include functional touch controls and responsive menus because the course assesses complete functionality at both 1920×1080 and 390×844. A "desktop only" message would leave that requirement unmet. [Marking environment](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/)

## 2. Complete gameplay specification

### Movement and combat

Implement running, jumping, crouching, dropping through marked platforms, directional flight, fuel depletion and regeneration, weapon-dependent zoom, damage, death, and respawning.

Players carry **two weapon/equipment slots**. Compatible one-handed weapons can be used together, consuming both slots. Each retains its own ammunition and reload state. Heavy weapons cannot be dual wielded. A shield occupies one slot and can accompany a compatible one-handed weapon.

Include manual pickups, swaps, dropping equipment, automatic reload on an empty magazine, manual reload, melee, and health/ammunition/fuel pickups.

**Default desktop controls**

| Action | Binding |
|---|---|
| Move | A / D |
| Jump | W |
| Jetpack | Space |
| Crouch / descend through platform | S |
| Aim / fire | Mouse / left click |
| Zoom | Right click |
| Select / switch weapon | 1, 2 / Q |
| Toggle compatible dual wielding | F |
| Reload / pick up / drop | R / E / X |
| Throw / select grenade | G / T |
| Melee | V |
| Scoreboard / menu | Tab / Escape |

Bindings are remappable. Provide keyboard aiming/fire alternatives and touch controls covering the same actions. Losing focus clears held inputs.

### Arsenal

The agreed catalogue contains **21 firearms**, four throwable types, and melee/shield equipment. Some entries are deliberate additions beyond the older reference.

| Category | Included weapons |
|---|---|
| Sidearms | Mini Eagle, Golden Eagle, Magnum |
| SMGs | Uzi, Tec-9, MP5 |
| Assault rifles | AK-47, M4, Tavor X95, XM8 |
| Precision rifles | M14, M93BA |
| Shotguns | SPAS-12, AA-20 |
| Heavy/projectile | Minigun, SMAW, RG6 grenade launcher, saw launcher |
| Special | Flamethrower, PHASR beam, EMP gun |
| Equipment | Machete, riot shield |
| Throwables | Fragmentation, gas, EMP, proximity mine |

Each entry requires working visuals, pickups, ammunition, firing/effect behavior, appropriate reload behavior, dropping, HUD representation, and multiplayer replication.

Fragmentation uses blast damage and falloff; gas creates a visible damaging area; EMP temporarily disables flight; proximity mines attach to terrain and have an arming delay. Default grenade inventory is two fragmentation grenades, with six total throwable items as the carrying limit.

Weapon statistics live in shared data. Initial values are authored and then tuned through playtesting; they are not presented as recovered original balance values.

### Modes and results

**Team deathmatch**

- Two teams; default five-minute round.
- Most enemy kills wins.
- Optional kill limit.
- Friendly fire off by default.
- Suicides, environmental deaths, and friendly kills do not increase team score.
- Equal scores at the end produce a draw.

**Flag Delivery — the signature mode**

1. Each team owns exactly one flag.
2. A player collects their own team's flag from its home pedestal.
3. They carry it into the opposing team's goal to score one delivery.
4. After scoring, the next flag becomes available at their home pedestal on the following simulation tick.
5. While a flag is carried or dropped, another cannot spawn.
6. Death or disconnection drops the flag at the carrier's position. It falls onto terrain and remains there indefinitely.
7. Only teammates can recover it. Opponents stop deliveries through combat.
8. A flag that leaves the playable world returns home as the same flag.
9. Carriers retain normal weapons, flight, and grenade use.
10. Both teams can attack and deliver simultaneously. Delivery does not depend on the other flag being home.
11. No automatic return timer, voluntary flag throwing, or opponent-triggered return.
12. Most deliveries after five minutes wins; an optional delivery limit is available.

Resolve damage before delivery checks, so a player killed during that tick cannot also deliver. Process both teams' valid scoring events before deciding a simultaneous finish.

**Other modes**

- **Free-for-all:** individual kill scoring.
- **Training:** one human and up to three bots, with movement and weapon practice.
- **Survival:** one to four humans against escalating waves, with at most eight active enemies.
- Published training and survival use the authoritative server. Their results remain separate from human PvP statistics.

**Scoreboards and MVP**

Show kills, deaths, assists, deliveries, team scores, and MVP.

- Deathmatch contribution score: `2 × kills + assists`.
- Flag contribution score: `10 × deliveries + 2 × kills + assists`.
- An assist requires at least 20% of the victim's maximum health in damage within the preceding eight seconds.
- MVP is selected across both teams; ties use fewer deaths, then share the award.
- Display the scoring explanation in the results screen.

Defaults: three-second respawn and two-second spawn protection. Firing, throwing, melee, or collecting a flag ends protection immediately.

### Maps, rooms, and supporting features

| Map | Purpose |
|---|---|
| **Cryptworks** | Catacombs-inspired tunnels, chambers, vertical shafts, close combat |
| **Outpost Yard** | Clear outdoor arena, introductory routes, training and survival |
| **Crosscurrent** | Three-route arena emphasizing flag escort and interception |
| **Skyshaft** | Taller industrial arena emphasizing flight and long sightlines |

All four support the three PvP modes. Cut Skyshaft first and Crosscurrent second if necessary. Retain Cryptworks and Outpost Yard.

Author maps with collision geometry, platforms, spawn points, pickups, goals, flag pedestals, bounds, and bot-navigation information. Ensure objectives and legal flag-drop locations remain recoverable under supported room settings.

Rooms include public listings, quick join, private invitation links/codes, optional passwords, readiness, team selection, host controls, spectators, late joining, and rematches.

**Room settings**

- Map, mode, capacity, duration, score limit.
- Flight enabled, thrust, fuel capacity, recharge, unlimited fuel.
- Gravity, movement speed, health, damage, respawn delay.
- Weapon/throwable allowlists, starting loadouts, map pickups.
- Unlimited ammunition, friendly fire, bot count and difficulty.
- Named saved presets.

Use bounded presets: numeric multipliers of 0.5×, 1×, 1.5×, or 2× where appropriate; default 1×. Round duration choices are 2, 5, 10, and 15 minutes. Default capacity is eight.

Freeze gameplay settings during a round. Host changes apply to the next round. Host departure transfers management to the longest-connected remaining player; the server continues the match.

Also include character customization, persistent preferences, match history, weapon statistics, sound controls, readable team identifiers, reduced screen shake, and room chat with mute controls. All gameplay equipment is available without paid unlocks.

## 3. Architecture, interfaces, and persistence

### Stack

| Layer | Decision |
|---|---|
| Browser | TypeScript, Vite, PixiJS 8 |
| Menus and forms | Native HTML/CSS |
| Simulation | Shared, browser-independent TypeScript |
| Server | Existing Node 24 runtime, HTTP, `ws` |
| Storage | SQLite through `node:sqlite`, in one database worker |
| Tests | Existing Vitest plus Playwright and scripted WebSocket clients |
| Hosting | Existing Fly application, machine size, region, and volume |

Pixi renders the game; it does not own game rules. The same simulation code supplies authoritative server behavior and local movement prediction. This keeps rendering separate from gameplay timing. [Pixi render-loop documentation](https://pixijs.com/8.x/guides/concepts/render-loop)

Keep SQLite work off the game loop because `DatabaseSync` is synchronous. Pin the existing Node version and document the built-in SQLite API's release-candidate status. [Node 24 SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

### Multiplayer contract

- Fixed simulation: **60 steps/second**.
- Server snapshots: **20/second**.
- Client input: **30 transmissions/second**, batching up to two simulation frames.
- Local player movement is predicted immediately and reconciled against server acknowledgements.
- Other players initially use a 100 ms interpolation buffer.
- Hitscan compensation uses at most 150 ms of server-validated history.
- Projectiles, explosions, pickups, and flags use current authoritative simulation state.
- Clients submit input and requested actions. The server owns positions, damage, ammunition, fuel, kills, and deliveries.
- Server time limits input processing; extra messages cannot increase movement speed.

Use compact, versioned JSON messages initially. Send static maps and weapon definitions separately from recurring snapshots.

Disable WebSocket compression, bound incoming messages and queues, validate origin/session/room membership, and disconnect persistently stalled connections. Compression has a documented memory and performance cost. [Official `ws` documentation](https://github.com/websockets/ws#websocket-compression)

### Public interfaces and shared types

HTTP interfaces:

- Guest-session creation and current profile.
- Profile/customization/preferences updates.
- Public room listing and room creation.
- Owned room-preset storage.
- Paginated personal match history and match details.
- Static content manifest, health check, and full server-rendered `/readme/`.

WebSocket commands cover joining, readiness, team selection, host settings, starting/rematching, input batches, chat, spectating, and leaving.

Server messages cover room state, acknowledged simulation snapshots, combat/objective events, results, saving status, and errors.

Define shared types for `RoomSettings`, `InputFrame`, `WorldSnapshot`, `WeaponDefinition`, `ThrowableDefinition`, `MapDefinition`, `FlagState`, and `MatchResult`. The flag type explicitly records owner, state, carrier or position, and delivery generation to reject duplicate scoring.

### Identity and persistence

Use an opaque persistent guest-session cookie. Display names identify players visually; they do not authenticate them.

Store profiles, sessions, preferences, room presets, matches, and match participants. Returning in the same browser restores identity and history. Clearing that browser's data creates a new guest identity.

Store SQLite and its journal files on the persistent volume. Run migrations at startup. Save:

- Match creation before play begins.
- Coalesced participant checkpoints every five seconds.
- Final results and profile aggregates in one idempotent transaction.

Results remain visibly "saving" until committed. Failed writes must not produce a false saved-success message.

After a restart, unfinished matches become **interrupted**, showing their latest partial checkpoint. They award no completed-match win or MVP; up to the last five seconds of progress may be absent. Completed results survive restarts and redeploys. Live rounds do not resume across a server deployment.

On disconnect, drop the flag immediately, neutralize controls, leave the body vulnerable for ten seconds, and reserve the seat for thirty seconds. Reconnection restores the existing participant without duplicating inventory, scores, or flags. An absent team gets thirty seconds for reconnection or replacement before the match ends as abandoned.

### Capacity and observability

Begin with one active room and up to four waiting rooms. Enable two simultaneous active rooms only after the defined load test passes. Maximum total connected clients: 24, including spectators and lobbies.

Log room lifecycle, disconnections, rejected actions, match finalization, storage failures, simulation timing, memory, and queue depth. Never log session credentials.

## 4. Implementation stages and acceptance

### Build order and ownership

| Stage | Deliverable | Primary owner |
|---|---|---|
| **P0 — Foundation** | Save this plan and feature checklist; establish shared types, build, server, storage, README route, Docker image, and first deployment path | Claude Opus |
| **P1 — Movement** | Outpost map, collision, flight, fuel, aiming, camera, desktop/touch input, developer test range | Claude Opus |
| **P2 — First complete match** | Authoritative multiplayer, room joining, four working guns, fragmentation grenades, FFA/TDM, simple practice bot, respawns, saved results, basic reconnection | Claude Opus |
| **P3 — Signature mode and review** | Audit P2; implement exact Flag Delivery rules, assists/MVP, host transfer, disconnect cases, stronger networking tests | Codex |
| **P4 — Full arsenal and rules** | Every listed weapon/throwable, dual wielding, shield/melee, pickups, all room settings and presets | Claude Opus, with Codex integration review |
| **P5 — Content and presentation** | Remaining maps, navigation and bots, survival, customization, audio, chat, spectating, complete responsive UI | Claude Opus |
| **P6 — Release acceptance** | Full load/latency/persistence tests, live browser testing, balance corrections, documentation and final deployment verification | Codex |

P2 is the first C8 proof-of-life target. It is an intermediate release; the complete scope ends at P6.

Keep the deployed build usable after every stage. Map reductions follow the stated order; other feature cuts require revising the agreed scope explicitly.

### Required verification

**Simulation and modes**

- Fuel, gravity, collisions, ammunition, cooldowns, reloads, switching, dual wielding, and all throwable effects.
- Fast projectiles cannot pass through walls.
- Every weapon has a distinct tested behavior.
- Each team always has exactly one flag.
- A dropped flag remains dropped beyond fifteen seconds and until recovered.
- Enemy contact cannot collect or return it.
- Death, disconnect, recovery, out-of-bounds return, and rematches preserve flag ownership.
- Repeated overlap cannot duplicate delivery points.
- Simultaneous deliveries and final-tick scoring produce consistent results.
- Kill, assist, MVP, tie, and friendly-fire rules agree with the displayed results.

**Multiplayer and persistence**

- Two independent browser sessions finish each mode and see the same outcome.
- Rejoining does not duplicate a player or grant fresh ammunition/health.
- Unauthorized room changes and fabricated damage/score messages are rejected.
- Duplicate finalization does not duplicate statistics.
- Completed results survive a container restart and redeployment.
- Storage failure, interrupted matches, cold starts, and host departure have visible, accurate outcomes.

**Performance targets**

- Thirty-minute soak in the production container with a 256 MB memory limit.
- Total process memory below 200 MB with no sustained growth.
- Simulation work below 8 ms at the 95th percentile, with no sustained tick backlog.
- Test maximum legal weapon/grenade activity and room churn.
- Test 50, 100, and 150 ms round-trip latency, jitter, and temporary disconnection.
- Before enabling two active rooms, test both two eight-player PvP rooms and two survival rooms containing four humans plus eight enemies each.
- Target 60 FPS on the measured desktop test machine; record its hardware and browser.

These are acceptance targets, not claims of measured performance.

**Human playtesting**

Use at least one returning Mini Militia player and one newcomer. Observe joining, understanding flight, switching weapons, completing a delivery, recovering a dropped flag, and starting a rematch. Record problems and corresponding fixes. Familiarity, fairness, and fun require this evidence.

### Course evidence and release

Preserve the existing course checks and extend them. Run `pnpm check` against the running production build and `pnpm check:evidence` against real repository history.

Maintain the README's definition of good, the agent rules, process overview, decision records, and crit reflections. The user supplies personal judgements and reflection; agents can structure and edit them without inventing experience.

Publish the complete README at `/readme/`. Record real commits, test evidence, sources, limitations, and changes prompted by playtesting. Make the repository public by the applicable C8 cutoff and retain its public status. [Final project requirements](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)

## 5. Agent handoff

Claude Opus works in Claude Code with this repository open, and one agent at a
time is responsible for integrating changes. The handover to Codex is **after
P2**: Claude establishes a playable, persistent foundation; Codex checks its
implementation independently before adding the flag system, then hands a precise
P4 task back to Claude. Every stage ends with a written handoff
([HANDOFF.md](HANDOFF.md)) giving the commit, changes, commands and results,
current limitations, and remaining checklist items.
