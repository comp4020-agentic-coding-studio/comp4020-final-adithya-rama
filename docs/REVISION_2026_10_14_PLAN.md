# Jet Skirmish: researched gameplay and map revision

Date: 14 October 2026.
Baseline: `eb9488a`.
Status: implementation in local acceptance. The original proposal below remains
the scope record; chosen behavior is in [ADR 0004](decisions/0004-classic-pc-gameplay.md).
The feature checklist and validation record distinguish completed implementation,
local evidence and deployment. Proposal text alone does not establish completion.

Read the [research and source ledger](RESEARCH_MINI_MILITIA_2026_10_14.md), the [existing scope](IMPLEMENTATION_PLAN.md), [October 13 contract](REVISION_2026_10_13.md) and [feature checklist](FEATURES.md) together. Direct user instructions remain authoritative. Preserve both Crit 9 commits, reflections and published cutoff tags.

## 1. What this revision must achieve

Make the game recognizably closer to the requested reference through its interactions, not just names and colours:

1. Weapons have identifiable handling, firing rhythms, travel, reach, effects and sound.
2. Camera framing lets the player use those weapon roles without losing their character.
3. S reliably crouches; believable solid surfaces, crawl gaps and flight agree with the rendered map.
4. At least five genuinely different reference layouts work. Target six: Outpost, High Tower, Ice Box, Pyramid, Lunarcy and Catacombs.
5. Vegetation provides useful concealment, and bots obey its information limits.
6. Existing keyboard-only play, inventory, grenades, shield/knife, recovery and death-follow remain functional and understandable.
7. Joining, readiness, host controls, rules and results remain clear throughout multiplayer.
8. Improvements fit the existing one-CPU/256-MB Fly deployment and authoritative online architecture.

The quality target is a consistent arcade combat model, not real-world firearm simulation. An exact v4 clone is not established by these sources. The [developer's own CV4 description](https://groups.google.com/g/mini-militia-classic-alpha-force/c/q04io0qi72c) gives us a reference baseline; the user's PC adaptations remain explicit.

## 2. Decisions and compatibility

### Preserve the user's choices

- Eight-player online PvP; no LAN. Keep FFA, TDM, own-flag Delivery, authoritative Training and online Survival.
- Own flags, permanent in-bounds drops, teammate recovery, no enemy pickup or timed return. Keep simultaneous-scoring and damage-before-delivery rules.
- Three equipment slots; top-row 1/2/3 selects, Tab/Q cycles. Compatible small firearms can dual wield.
- Shield pairs with machete; selecting a firearm drops it. This is our custom rule even though the [MMC loadout guide](https://mini-militia-classic.fandom.com/wiki/Armory%3A_Default_Loadouts) includes a firearm/shield combination.
- Held numpad direction aims and fires, including after automatic reload; R is optional for conventional firearms. Mouse remains available.
- Frag, flash and poison remain prominent; EMP and mines remain available. Automatic grenade collection and T/G selection/throwing stay.
- Regeneration, easier bot levels, attacker-follow after death, stylized rocket fragments and reusable credited audio stay.
- Lunarcy has zero gravity and unlimited boost by direct user request.
- All gameplay equipment remains freely available. Cosmetic helmets/armor do not silently confer combat protection.

### Proposed reference corrections

The corrections below are proposed work packages, not additional features already approved or shipped. R0 records the chosen behavior before tests and code are changed.

Use a versioned **Classic PC** gameplay profile: CV4-style full bullet damage up to the weapon's maximum range, with authored PC tuning and the above customizations recorded. The current arbitrary attenuation curve should not be labelled classic. Store the profile/balance version with results and freeze it for a round. [Developer damage clarification](https://groups.google.com/g/mini-militia-classic-alpha-force/c/CecBQ5mszok)

Crouch requires an explicit distinction. **Default recommendation:** physical lowered body, no crouched headshot bonus, no invisible immunity above the visible body. The alternative is **Classic crouch cover**, which intercepts head-region rays as documented. Choose one default in R0; do not automatically build two complete combat models. If a second room preset is later wanted, label and test it independently. Historical head cover is not the carried riot shield and is not assumed physically realistic. The [crouching guide](https://mini-militia-classic.fandom.com/wiki/Crouching_Guide) documents the historical difference but not complete blast coefficients.

This recommendation resolves the tension between historical quirks and the user's request for understandable physics; it is a proposed design choice, not a previously approved change to hidden hit rules. It must be visible in the rule summary and change record.

Do not automatically reproduce duplication exploits, paid unlocks, ads, old networking bugs or every modern MMC special. Researching the entire game does not make every feature a required addition.

## 3. Movement, crouch and map physics

### Ground movement and collision

- Separate crouch from platform descent in input, protocol, touch UI and help. S only crouches on supported surfaces. Use a dedicated remappable descend action, provisionally Shift+S, only on visibly marked one-way platforms; solid slabs never permit descent.
- Resize/reposition the crouched hit regions so same-floor level fire from a standing opponent passes overhead; deliberately lowered aim must still hit. Current standing muzzle height is 29.92 units while crouched height is 30, so reducing only the sprite is insufficient.
- Feet remain anchored during crouch transitions. Holding S+A/D crawls. Releasing S beneath a low ceiling leaves the player crouched until standing clearance exists.
- Jumping/boosting under a ceiling must not enlarge the body into terrain. Leaving a ledge changes posture only when clearance permits; defensive crouch cover ends when unsupported.
- One-way ledges and solid rock must be visually distinguishable. Render the actual collision contour; avoid invisible lips, decorative holes treated as passage, or rooms accidentally filled solid.
- Add swept or bounded-substep character movement for high-speed and small-geometry cases. Reuse the same deterministic movement in prediction and authority.
- Introduce authored equipment handling multipliers, with shield/heavy slowing explained in the armory. Apply the same equipped-load rule on client and server. Do not penalize a holstered gun accidentally.
- Measure run, crawl, jump apex, flight rise, diagonal motion, stopping distance, fuel exhaustion and recharge in a repeatable range. Tune one variable at a time.

### Lunarcy

Add a map physics profile, resolved server-side into effective settings and sent to clients. Lunarcy enforces zero gravity, flight available and unlimited fuel. Disabled room controls explain these map rules; applying an old preset cannot secretly restore gravity or strand a player.

Use directional acceleration, inertia and deliberate braking. Proposed PC mapping: A/D lateral thrust, W/Space upward thrust, unsupported S downward thrust. Supported S crouches and does not accelerate down through the surface. Shift+S descends only through marked one-way surfaces. Normalize diagonal thrust. Choose acceleration, speed cap and braking through measurements, labelled authored rather than recovered coefficients. Do not give direction-dependent free extra speed. With no thrust input, coast; opposite directional input brakes before accelerating in reverse. EMP disables every powered thrust input, including A/D, while retaining existing momentum. It must not merely disable the Space key.

Apply the profile consistently to players, grenades, projectile gravity, dropped equipment and dropped flags. A rocket motor still propels a rocket. Cosmetic debris follows the same visual environment without affecting combat.

A dropped own flag in space keeps its identity, drifts under bounded velocity and can be recovered anywhere in the legal play area. It does not acquire a return timer. Keep the flag return rectangle exactly at x=0..map.width and y=0..map.height; only crossing it returns the flag. Player bounds are separate: current actors have a 240-unit margin and no top death boundary, so define and display a four-sided space boundary without changing flag-return rules. Test recovery with EMP temporarily disabling boost; velocity must not vanish as a side effect. Boundaries must be legible before a player leaves the map. Validate every reachable pocket and collision gap so a dropped flag cannot enter a crack a teammate cannot approach within pickup range. Solve this through drop collision/geometry; do not add a rescue timer, magnet or teleport.

### Acceptance

Hold S on every surface type; crawl under a low opening both ways; release under a ceiling; boost against ceilings/corners; traverse with 0.5x/1x/1.5x/2x supported settings; compare prediction and server positions. In space, verify no unforced acceleration, equal diagonal limits, predictable braking and no fuel depletion across a complete round.

## 4. Combat and the complete arsenal

Keep all 21 firearms, machete/shield and five throwables. The table is our proposed engineering work, derived from the current code and user requests; it is not a paraphrased original-game specification.

| Equipment group | Required work and identity |
|---|---|
| Mini Eagle, Golden Eagle, Magnum | Preserve individual silhouettes and one-handed combinations; distinguish cadence, impulse, report and recoil recovery. Validate mixed and identical pairs. |
| Uzi, Tec-9, MP5 | Make close-combat handling legible. Retain the small-gun dual capability; MP5 remains two-handed. |
| AK-47, M4, Tavor X95, XM8 | Correct M4 to a three-shot burst; retain distinct automatic rifle handling for the others. |
| M14, M93BA | Add finite M14 bullet travel; preserve a clearly defined precision-rifle role and exposed-head rules. Tune reach with the new camera. |
| SPAS-12, AA-20 | Separate pump cadence from automatic shotgun cadence; validate pellet count, spread, ammo and readable close-range threat. |
| Minigun | Add spin-up, sustained fire and spin-down feedback instead of immediate full-rate firing. |
| SMAW, RG6 | Separate straight powered rocket from arcing/bouncing timed explosive; visible travel and endpoint behavior must match reach. |
| Saw launcher | Add launch wind-up, piercing with bounded repeat-hit rules, ricochet and terminal explosion. |
| Flamethrower, PHASR | Dedicated fuel/battery handling and automatic refill; no misleading conventional manual-reload action. |
| EMP gun | Travelling pulse, flight suppression and mine disarming; explicit impact/expiry behavior. |
| Machete, shield | Keep one-hit valid blade strikes and directional panel interception; verify above, rear, side, crouch and airborne geometry. |
| Frag, flash, poison, EMP, mine | Preserve distinctive effects and inventory controls; test wall interaction, arming, persistence, team policy and effect visibility. |

Reference-driven corrections are recorded separately in the [source ledger](RESEARCH_MINI_MILITIA_2026_10_14.md#source-ledger-and-bounded-findings). Burst spacing, spin durations, projectile speed, penetration budgets and blast parameters below remain authored engineering choices. No complete wiki balance table is imported.

Implementation needs explicit per-slot state: cooldown, reload, burst progress and charge; explicit projectile state: age, remaining path distance and previously hit targets. Trigger release, switch, death and disconnect must settle those states deterministically. Rejoining cannot restart a burst or refill a magazine.

Proposed reload contract: once started, a conventional reload continues while holstered and completes once; selecting another slot does not cancel it. A dual pair keeps independent ammo and reload timers, including after switching away. Dropping a weapon cancels its in-progress reload without granting unearned ammunition. Death/disconnect follows the authoritative inventory lifecycle. This intentionally changes the current single-slot switch cancellation rule. No player receives extra ammo because a pickup merges, slots cycle, or a reload finishes twice.

Separate three quantities: maximum travel, useful engagement distance and visible distance. A rocket's launch definition must not mistake its explosive payload row for its reach. Flight direction, speed, lifetime and accumulated path length must agree.

Damage order: solid obstruction, relevant shield/cover interception, valid body region, damage policy, protection/team rules, authoritative death, then objective scoring. History used for compensated rays must record stance and protection geometry, not just today's body rectangle. Current projectile effects remain authoritative at current time. Proposed physical feedback adds bounded explosion impulses to surviving actors, with line-of-sight/team rules and the same prediction reconciliation as movement; parameters are authored. Ordinary bullet recoil moves the weapon/aim presentation, not the whole player. Melee remains contact damage unless a separate measured dash/impulse is deliberately selected in R0.

### Acceptance

For each entry, assert behavior as well as an emitted shot. Cover damage at near/mid/max/beyond range; finite travel time; wall before target versus target before wall; burst interruptions; charge timing; independent dual reload; piercing two targets once each; terminal explosion once; EMP mine disarm; no reload for full or empty-reserve equipment; and kills/assists attribution. Run combined effects under the legal maximum activity, not only isolated examples. Compare standing/crouching floor-blast exposure so lowering the body cannot accidentally reverse an intended defensive benefit; any mitigation is an explicit authored rule. Test explosion impulse before death/drop resolution, at walls and with simultaneous impacts.

## 5. Weapon reach, camera and aiming

The present SMAW has long travel but the default narrow view. Conversely, the current sniper's large view can make a phone character tiny. Fix the relationship rather than merely increasing every range.

Introduce a separate camera profile per weapon: preferred visible span, permitted scope levels, aim-direction offset and transition behavior. Rename internal ambiguous zoom values to visible-world span or scale. Never use independent X/Y stretching.

- Pistol/shotgun framing keeps nearby actors readable.
- Rifle framing adds forward awareness.
- Precision and rocket framing exposes longer sightlines and provides farther scope choices.
- Aim look-ahead moves the camera toward the direction of fire, with capped rear/vertical awareness and smooth reversal.
- Scope choice persists per weapon, with a clear keyboard and touch cycle action. Weapon switching restores a predictable preference; reduced-motion mode suppresses abrupt pans.
- Camera clamping works when a viewport is wider than the map. World-to-screen and screen-to-world share one transform, including camera interpolation.
- Death-follow and spectator follow use the followed actor's weapon profile and position. They do not claim a historical replay or exact remote cursor perspective.
- Show usable reach in the test range and armory. Aim aids stop at their intended distance and at solid cover; they must not promise hits beyond range.

The [scope guide](https://mini-militia-classic.fandom.com/wiki/How_Scope/Zoom_Work), [camera settings](https://mini-militia-classic.fandom.com/wiki/Settings_%28Gear%29) and [developer explanation](https://groups.google.com/g/mini-militia-classic-alpha-force/c/paDo7y2AlcQ) inform these distinct controls. We adapt them to PC without claiming the newer options all existed in v4.

Validation should measure visible distance from the muzzle along the aim ray, not just screen width. Place targets at 25%, 50%, 75%, 100% and just beyond weapon range. On desktop, the long-range scope must expose a target at the tested maximum unobstructed engagement distance for cardinal and diagonal aim. On 390x844, prioritize an identifiable actor at normal scope; explicit far scope may trade size for reach. Record CSS-pixel body size and the trade-off instead of claiming full-range visibility and large characters simultaneously.

## 6. Six reference maps with distinct routes

Map names below identify the reference layouts. Use authored terrain/character art and explicit provenance; do not present Jet Skirmish as the official game.

| Map | Layout and play purpose | Required checks |
|---|---|---|
| Outpost | Uneven asymmetric jungle, bunkers, separated upper shelves and lower passages | Low crawl routes, foliage, exposed crossings and reachable high weapons |
| High Tower | Central vertical tower, facing multi-storey buildings, lower connector | Interior/exterior transitions, long horizontal shots and several ascent routes |
| Ice Box | Ice basin, opposing upper forts and dense internal passages | Ceiling clearance, angled edges, distinguishable ice versus one-way platforms |
| Pyramid | Stepped exterior, layered interior maze and outside flanks | Tunnel height, entrance connectivity, rooftop/exterior routes and sightline breaks |
| Lunarcy | Separated irregular asteroids with hollow areas and open-space routes | All-direction navigation, zero-gravity drops and recovery, visible boundaries |
| Catacombs | Perimeter circuit, inner maze and central four-way crossing | Loops, intercepts, close combat and recoverable hidden pickups |

[Labelled full-resolution references](RESEARCH_MINI_MILITIA_2026_10_14.md#map-reference-corrections) establish the topology. Additional requested layouts—Subdivision, Bottleneck, No Escape, So Long, Cliffhanger and Crossfire—remain the next expansion set. Six is the planned first set; five is the user's explicit minimum, not permission to replace them with five palette variants. Preserve the existing original arenas and historical map IDs.

### Authoring pipeline

1. Annotate landmarks and route connections on each reference. Normalize coordinates using one uniform scale; preserve the image's aspect ratio, asymmetry and relative landmark placement.
2. Separate solid terrain, walkable rear-wall art, one-way ledges, decorative foreground and concealment volumes. Dark image fills are not automatically solid.
3. Author collision polygons or a compact tile contour with reusable edge geometry. Compile deterministically into collision primitives/spatial indexes. Avoid thousands of tiny runtime rectangles; choose representation after profiling the most complex map.
4. Derive render edges and debug outlines from the same geometry. Stair stepping, slopes and tiny gaps need explicit handling, not ornamental smoothing that disagrees with collision.
5. Hand-place spawns, pickups, flag homes/goals and route nodes on the reference topology. Do not reuse the factory's full-width basement and floor-level objectives for every map.
6. Add semantic traversal links: walk, crawl, jump, boost, descend and zero-gravity transfer. Map settings declare supported variants.
7. Keep every required terrestrial mode playable with the agreed no-flight/high-gravity/low-speed settings. Where faithful geometry makes that impossible, provide an explicitly labelled traversal variant that preserves principal routes. Do not add an invisible bridge or silently ignore settings. Lunarcy's mandatory flight is a visible map-specific exception.
8. Add map ID/version and a stored display name/version to results so new content does not relabel old matches.

For each map, retain a reference comparison, collision overlay, route graph, traversal recordings and pickup/spawn validation. Exact historic collision masks and item coordinates are not available from the images alone; review recognizability and routes rather than claiming pixel-perfect physics.

## 7. Bushes, information and bots

Bushes should work through foreground occlusion: sufficiently covered parts of a character become obscured by foliage, with enemy name/health labels suppressed. Keep a subtle local/team outline so players know their own position. Partial exposure should remain visible. Leaves do not stop bullets; rock does.

Define concealment in shared map data, separate from collision. Use separate visible/partially-occluded/fully-concealed states: send and draw partially exposed players, and suppress full enemy state only when full concealment applies. In FFA, team -1 must never make all players teammates. Proposed initial rule: grounded crouching within dense foliage conceals the body, while firing, throwing, melee, flying above the foliage or leaving it exposes the player. Any reveal grace time/detection distance is authored tuning, not a documented v4 value. Test moving quietly and stationary recovery so bushes actually support the requested hiding.

Bots use the same perception policy, with last-seen information that expires; they must not continue tracking the authoritative hidden position. Preserve easy/normal/hard reaction, turning and firing pauses. Improve route behavior and intentional mistakes before adding health/damage cheats.

For multiplayer, decide visibility per viewer. Rendering-only suppression is insufficient if the normal client's HUD or events immediately disclose an enemy. Audit nameplates, target markers, damage effects, positional audio and snapshots together. Audible firing may reveal a direction by design; a silent hidden actor must not emit an exact-position idle cue. Server-side filtering must preserve authoritative collisions and avoid re-entry interpolation from stale positions.

Retain the user-requested killer follow as an explicit exception: the server authorizes only the actual killer until respawn or that killer's death/disconnection; the client cannot request an arbitrary hidden actor. A follow view must not gain the killer's whole-team visibility or an unrestricted snapshot. Spectator observation is a separate declared room policy. Proposed objective policy: carrying a flag reveals the carrier to all players, including in foliage, and flags remain public objectives. Ordinary hidden enemies remain concealed. This is a new visibility choice to record in R0, not a change to ownership or scoring. Teammates always retain own-flag recovery information.

Threat-aware spawning should score clear, supported candidate positions using enemy distance, sightlines, projectiles, gas/mines and recently used locations. Penalize danger and choose among safe candidates deterministically. Existing protection still ends on offensive/objective actions. This implements our own bounded system inspired by the [spawn guide](https://mini-militia-classic.fandom.com/wiki/How_Player_Spawning_Works), whose coefficients are unavailable.

Acceptance: two independent sessions plus bots; hidden enemy label/body absent as specified, exposed portions visible, shots pass through foliage, incoming damage remains authoritative, bots lose hidden targets, reveal/re-hide agrees, reconnection does not reveal all players, and death-follow returns to the respawned player.

## 8. Inventory, recovery and combat presentation

These systems largely exist and require refinement, not a false claim of first implementation.

- Show all three slots consistently, with gun outline, selected/dual state, individual ammunition and reload progress. A shield occupying a slot must look like equipment, not an empty gun.
- Explain an attempted incompatible pair and preview what a pickup will replace. Pressing E must select the nearest eligible visible pickup predictably.
- Show automatic grenade pickup feedback, remaining capacity and the selected stocked type. Full inventory leaves the item available; no collection through walls.
- Preserve held-key firing through reload and after weapon switch subject to the new firing mode. Release/focus loss/menu entry must stop it. Test Num Lock states using physical key codes and opposing directional inputs.
- Keep gradual healing and show when it begins/stops. Existing six-second delay and four HP/second are a measurable starting point. Received damage and actual nearby threat should reset it; shots behind sealed walls should not suppress recovery forever.
- Synchronize original gun animations with simulation states: discharge, recoil, burst, magazine change, charge, empty and shield impact.
- Body pose should show crouch, grounded run, flight, damage and death. Held guns and hands must align across left/right/up/down aim. Cosmetic armor must not conceal the real vulnerable regions.
- Use separate reusable sound families and variants for mechanical reload, shots, ricochet, shield impact, injury, kill confirmation and jet state. Keep source/license records. Listen to the assets in a fight, not just decode them.
- Bound simultaneous sounds, debris and particles. Prioritize local actions and nearby threats. Separate blood visibility, shake, flash presentation and overall volume. A low-flash mode uses an equivalent non-flashing obscuration for the same duration and visible area; lowering brightness must not reveal opponents earlier.

Acceptance: visual gun identification without labels; independent hand reload checks; full/near-full grenade bags; wall-blocked pickup; each damage/death type; mute/reduced-effects persistence; no inaudible first shots or runaway loops after death/tab change. A returning player should identify weapon families from silhouettes and firing behavior, and a newcomer should understand which slot and grenade are active.

## 9. Rooms, modes, profile and whole-game flow

Preserve the working public list, quick join, codes/passwords, readiness, staged rules, host transfer, spectating and rematches.

Improve the flow around them:

- Start screen: clear Play, Join code, Create room and Practice actions, with profile/history secondary. Avoid presenting the entire armory before a player can join.
- Room card: map preview, mode, player/bot counts, privacy, match state and a concise custom-rules badge.
- Lobby: distinct roster/readiness, map/mission, and host settings areas. Show exactly who is not ready and why Start is unavailable. Gameplay settings changed after readiness should require an explicit shared confirmation/readiness policy.
- Basic settings expose map, mode, teams and bot difficulty; advanced panels hold multipliers, allowlists and equipment. Lunarcy's forced rules are obvious before joining.
- Test map previews from actual geometry; the preview cannot show an arena different from the one loaded.
- Add a short playable onboarding sequence for flight, crouch, weapon switch, grenade selection and own-flag delivery. Training should teach these tasks, not only provide bots.
- Improve Survival with readable wave preparation, enemy archetype cues and team recovery; keep the existing human/enemy limits and separate stats.
- Results explain team outcome, contributions/MVP, interruptions and saving status. Preserve replayable match details, not just a victory banner.
- Fix two current setting mismatches: PvP capacity must start at two, and Survival must not offer a configurable PvP bot count when its enemies come from waves.
- Add touch-layout editing for button placement, size and opacity, with safe-area bounds and a reset action; keep every required action reachable at 390x844.
- Keep guest identity honest: same browser restores it; a display name is not a login. Make profile appearance and input/sound preferences easy to find.

Useful later additions, separate from this required revision: team pings/chat channels, host kick controls with admission rules, map voting/rotation, cosmetic milestones, richer practice challenges, VIP or bomb mode. The [Game Modes page](https://mini-militia-classic.fandom.com/wiki/Game_Modes) is incomplete; do not claim its placeholders give enough rules to implement every mode. Do not replace our own-flag mode with its enemy-flag description.

Keep LAN, monetization, subscriptions and ranked matchmaking outside the agreed project. [Modern loadout rationale](https://mini-militia-classic.fandom.com/wiki/Why_Loadouts%3F) is useful context, not a requirement to add an economy.

## 10. Architecture and execution order

Continue the current stack and storage worker. Do not rewrite the server or increase Fly resources to accommodate unmeasured content.

Proposed shared additions: map physics/traversal/concealment definitions; versioned combat profile; explicit slot firing state; shared stance/hit geometry; visibility evaluation; camera settings schema. Server snapshots carry the minimum necessary state. Protocol changes reject stale clients visibly instead of interpreting old buttons differently. Asset/content versions invalidate stale previews and definitions.

| Stage | Concrete deliverable | Gate before moving on |
|---|---|---|
| R0: reference contract | This research, provenance fields, Classic PC decisions, isolated calibration range and captured baseline | No invented original values; baseline checks and actual current behavior recorded |
| R1: movement and collision | Crouch/descend separation, clearance, equipment handling and shared space physics | Deterministic unit tests plus desktop/touch traversal and prediction checks |
| R2: combat and camera | Weapon-specific state machines, damage profile, hit geometry, finite travel and camera preferences | Every weapon behavior tested; range/view comparison and simultaneous network outcomes |
| R3: six layouts | Layered authored reconstruction, map versions, spawns, objectives and navigation | Reference overlays and all principal routes exercised; no generic floor workaround |
| R4: concealment and AI | Bush occlusion/perception, fair bots, hazard-aware spawns and space navigation | Independent viewers agree; bots cannot track hidden coordinates; mode routes work |
| R5: presentation and flow | Inventory, sound/animation, profile, lobby, onboarding and results refinements | Keyboard-only and touch end-to-end play; listening and visual review |
| R6: release acceptance | Performance, persistence, latency, browser/human findings and final deployment record | Full acceptance below; local and live evidence reported separately |

One integrator owns shared interfaces and integration. Delegate map authoring, audiovisual assets and independent review after interfaces settle. Each stage gets a descriptive unsigned commit, actual test evidence and a checklist update. Keep the deployed build usable at stage boundaries. Research documents do not retroactively mark features complete.

## 11. Release acceptance and evidence

Retain existing course invariant tests. Add behavior tests tied to the requirements above rather than tests that only mirror data fields.

Run build, type checks, unit tests and running-production-app checks, then browser checks at 1920x1080 and 390x844. Existing relevant entry points include `pnpm check`, `pnpm check:browser`, arsenal/modes/preferences scripts, load checks, persistence checks and `pnpm check:evidence`. Use isolated databases. Review existing tests for old assumptions (S drop-through, arbitrary falloff, generic map routes) and change assertions only with a documented rule change.

Required integration matrix:

- Each new map in FFA, TDM and own-flag Delivery with two independent players; Training on all supported maps and Survival on maps with validated enemy routes.
- Both teams' flag routes, death/disconnect drops, teammate recovery, out-of-bounds return, simultaneous delivery and rematch; space is included.
- Mixed weapons, dual equipment, every throwable, crouch/head/shield angles, all legal room multipliers and inventory transitions.
- Normal connection, 50/100/150 ms round-trip latency, jitter, input stalls, host departure and reconnection.
- Saved preferences, old room presets, old match history, idempotent results, interrupted rounds and storage failure.
- Concealment snapshots/events, spectator/death-camera policy and no fabricated hit/score authority.

Performance: repeat the planned thirty-minute soak in the production container with a 256-MB limit, maximum legal activity and room churn. Target total process memory below 200 MB, simulation p95 below 8 ms and no sustained backlog. Test eight-player PvP and four-human/eight-enemy Survival with the most complex maps. Keep one active room until the separate two-room gate passes. Render acceptance is separate: on the recorded Intel Core Ultra 9 285H / Intel Arc 140T Windows reference system, target at least 58 mean rendered FPS and p95 frame interval at most 25 ms over ten minutes at 1920x1080, including eight active players, the most detailed map and far scope. Record the actual Chrome version (the prior baseline used 154.0.8037.99), settings and thermal/power conditions. These are proposed gates, not new measurements. Repeat the 390x844 viewport and software-rendering path separately; a desktop phone-sized viewport is not physical-phone evidence.

Human evidence: at least one returning player and one newcomer. Observe join/readiness, flight, crouching under cover, long-range aiming, identifying a gun, hiding/recovery, grenade switching, delivery and rematch. Record failures and fixes. Use short side-by-side reference comparisons and a sound listening pass. Automation alone cannot establish familiarity, fairness, fun or audio similarity.

After publication/deployment is authorized for the revision, verify the deployed commit, assets, multiplayer flows and existing saved results. Do not run /ship, retag course submissions, edit personal reflections or call a local pass a live result.

## 12. Implementation handoff

Start with R0/R1, then one small complete vertical slice: Outpost movement, one pistol, M4 burst, sniper, rocket, camera and a foliage encounter. This is an integration checkpoint; it does not reduce the final six-map/full-arsenal scope.

Before each later stage, read this plan, source ledger and current diff. Preserve the user's custom contracts. Complete behavior through shared simulation, server, renderer, HUD and persistence where relevant. Report which reference facts were confirmed and which parameters were authored. Keep failed checks and limitations visible.

The next implementation handoff must include commit, changed rules, reference links, commands/results, actual browser observations, remaining scope and live status. Do not declare a gun complete because an icon exists, a map faithful because its colour matches, or a bot fair because a difficulty selector exists.
