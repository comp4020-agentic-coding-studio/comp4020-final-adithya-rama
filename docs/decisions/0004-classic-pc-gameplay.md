# 0004 — A researched Classic PC ruleset with physical crouching

Date: 14 October 2026. Status: accepted for the current implementation; release verification is tracked separately.

## Context

Adithya asked for a whole-game review against Mini Militia Classic, specific map layouts, useful long-range views, crouching that does not fall through floors, and bushes that can hide players. The [research ledger](../RESEARCH_MINI_MILITIA_2026_10_14.md) distinguishes original v4, current Classic documentation, and authored tuning. The [revision plan](../REVISION_2026_10_14_PLAN.md) records the full remaining work.

The README judges the game by readable combat, fair shared outcomes and movement that communicates its actual collision. A nostalgic description alone does not settle every rule. In particular, the historical crouching guide describes head-region interception, whereas the requested physical crouch should expose a smaller body without invisible immunity.

## Decision

- The default profile is **Classic PC**: flat bullet damage up to a finite authored range; projectile travel, spread, burst and charge behavior distinguish weapons. Weapon values remain authored, not recovered v4 statistics.
- A valid M4 press commits one three-round burst over about 167ms. Ordinary release, including menu/blur release, prevents repeats but lets those already committed rounds finish. Switching, reloading, death, disconnect and missing/stale input cancel pending rounds. Conventional reloads continue while holstered; dropping cancels without granting ammunition. PHASR/flamethrower refill automatically.
- Crouch lowers the physical body to 28 units. It grants no invisible head shield or crouched headshot bonus. S only crouches on a surface; Shift plus the crouch binding, a remapped Descend action, or the touch Descend button intentionally drops through marked platforms. A full-body clearance check prevents standing inside a ceiling.
- Lunarcy uses zero gravity and unlimited fuel for actors, projectiles, flags and dropped equipment. These are Adithya's requested rules, not independently verified historical values. W/Space thrust upward, A/D laterally and unsupported S downward. Releasing controls coasts; opposing thrust brakes. EMP disables all powered thrust, not just Space.
- Preserve three weapon slots, compatible dual guns, the knife-only shield pairing, automatic grenade collection, the six-item grenade limit, flashbang/poison variants and exact own-flag delivery. Selecting a firearm drops an equipped shield. Flags remain recoverable in bounds indefinitely.
- Saved scope levels control visible world span independently of firing range. Aim look-ahead is optional. Default phone framing preserves actor size; explicit distant views trade size for reach. Following a killer uses that actor's weapon view.
- A fully covered, grounded crouch can hide in a bush. Partial exposure remains visible. Firing and other revealing actions expose the actor temporarily. Teammates retain identification; FFA players do not become teammates because they share team value -1. Hidden enemy coordinates are removed before snapshot serialization, including after reconnect. Scores remain public without coordinates.
- Carrying a flag reveals its carrier. A dead player may follow only the actual killer, until that killer dies/disconnects or the victim respawns. Authorization never resumes when the killer respawns/reconnects. This exception does not grant the killer's team vision. Spectators explicitly receive an observer view of all players; this is a friendly-room game, not an anti-collusion ranked service.
- Existing lobby rule changes clear readiness for everyone; in-round changes remain staged for the next round. The UI explains this policy and Lunarcy's forced rules before starting.
- New map IDs preserve existing saved match meaning. Results record map and rules versions. Protocol 3 rejects incompatible browser builds with a reload message.

## Alternatives and costs

Reproducing historical crouch interception would favor nostalgia but contradict physical silhouette expectations; it is not a second hidden ruleset. We chose physical crouching. Keeping modern damage falloff would retain prior tuning but weaken the requested Classic behavior; flat damage now makes maximum range and obstruction especially important.

Rendering bushes only in the client would be cheaper, but bots and modified clients could retain hidden positions. Filtering on the server adds per-viewer serialization and explicit public-score/death-camera handling. That cost must pass the existing one-CPU, 256-MB acceptance gate. A spectator can relay information, so the observer policy is visible rather than presented as competitive secrecy.

Long-range camera views can make phone actors too small. Default and explicit far views deliberately make different trade-offs. No scope increases the underlying damage, accuracy or legal range. Six reconstructed layouts retain recognizable route structures while using authored geometry and original artwork; exact historical collision parity is not claimed.

The current implementation must still pass browser, performance, persistence and human-playtest gates. Passing a simulation test does not establish visual fidelity, sound resemblance or enjoyment.
