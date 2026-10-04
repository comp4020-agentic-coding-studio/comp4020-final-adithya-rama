# Handoff: P2 complete, over to Codex for review and P3

From: Claude Opus (Claude Code) · Date: 2026-10-04 · Code commit: `6f60466`

## What was built

- **P0 foundation**: shared types and settings (`src/shared/`); a Node 24
  server that runs its TypeScript directly (`src/server/main.ts`); SQLite on a
  worker thread with migrations (`db-worker.ts`); opaque guest-session cookies;
  `/readme/` rendered from `README.md` on the server; and a two-stage
  Dockerfile.
- **P1 movement**: Outpost Yard, plus the Test Range developer map;
  deterministic movement with flight, fuel, crouch and one-way platforms
  (`physics.ts`); mouse, keyboard and twin-stick touch input; and a Pixi
  renderer whose camera follows the player and widens with zoom.
- **P2 first match**: authoritative rooms (`rooms.ts`) at 60 Hz with 20 Hz
  snapshots and 30 Hz batched input; one input frame consumed per tick; own
  movement predicted and reconciled, other players interpolated 100 ms behind;
  hitscan rewind of up to 150 ms; Mini Eagle, Uzi, AK-47 and SPAS-12; frag
  grenades, melee and pickups; FFA, TDM and training with practice bots;
  respawns, assists and MVP; match row before play, 5 s checkpoints and
  idempotent finalisation; history; and reconnection to a seat held for 30 s.

`docs/FEATURES.md` has the status of every agreed feature.

## Commands and results (run on 2026-10-04)

| Command | Result |
|---|---|
| `pnpm typecheck` | clean |
| `pnpm test:unit` | 30 passed |
| `pnpm check` against `pnpm start` | 2 starter invariants + 8 contract specs passed |
| `pnpm check` with `APP_URL` on the production image (`docker run --memory=256m`) | all passed |
| `pnpm check:browser` | practice round played through at 1920×1080 and 390×844 touch; screenshots in `test-results/` |
| `DURATION_S=90 node scripts/load-check.ts` against the container (1 scripted human + 7 hard bots, FFA) | RSS 121 → max 127 MB; step p95 ≈ 1.0 ms; cgroup memory 67 MiB of 256 |

That load probe is not the plan's 30-minute soak, and none of the
latency or jitter tests have been run.

## Deployment

**Not deployed.** The repo has no `mise.local.toml`, so there's no
`FLY_API_TOKEN`. The token is in the course's Ed message for this repo. Once it
is pasted in:

```sh
flyctl status -a comp4020-final-adithya-rama
flyctl deploy --remote-only --ha=false -a comp4020-final-adithya-rama
```

Then open `https://comp4020-final-adithya-rama.fly.dev/` and run
`APP_URL=https://comp4020-final-adithya-rama.fly.dev pnpm check`.

## Running it

```sh
mise install && pnpm install
pnpm build && pnpm start                 # http://localhost:8080, DB in .data/
pnpm check                               # with the server running
pnpm check:browser                       # with the server running
docker build -t jet-skirmish . && docker run --rm -p 8080:8080 --memory=256m --tmpfs /data jet-skirmish
```

## Known limitations for the reviewer

- Shooting isn't predicted, so local tracers lag by one round trip.
- When the server's input queue backs up, two frames are merged by OR-ing their
  buttons. A press can therefore extend one tick, but a step is never skipped.
- Host transfer happens only when the host leaves or their 30 s seat hold
  expires, not as soon as they disconnect.
- A match is abandoned only when no human is connected. The plan's rule that an
  absent team gets 30 seconds isn't built.
- No tests yet for duplicate finalisation, storage failure, or restart →
  interrupted. The code paths exist (`finalize` checks the match status; boot
  marks `live` matches as interrupted).
- Bots steer straight at targets and jet over walls; there's no pathfinding.
- Weapon numbers are authored guesses, not tuned.
- The README's "What good means" section and `reflections/crit-8.md` are
  Adithya's to write. `pnpm check:evidence` fails until the reflection exists.

## Next: Codex, P3

Audit P0–P2 independently (shared-simulation consistency, server authority,
prediction and reconciliation, collisions, memory, persistence, desktop and
touch use). Then implement Flag Delivery exactly as the plan's twelve rules
say, using `FlagState` in `src/shared/types.ts` and the goals and flag homes
already placed in Outpost Yard. Also build disconnect flag drops, the 30 s
absent-team rule, faster host transfer, and the edge-case tests listed under
"Required verification".
