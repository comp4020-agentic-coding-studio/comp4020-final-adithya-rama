# Integration handoff: October gameplay and presentation revision

Updated 10 October 2026 (Australia/Sydney). Continue the existing game; do not
restart the foundation or substitute conventional capture-the-enemy-flag.

## Current direction

The user's feedback and revised contract are in
[REVISION_2026_10_10.md](REVISION_2026_10_10.md). The original plan remains
historical context. The revision adds three carried equipment slots, numpad
directional firing, incremental health recovery, flashbangs, forgiving bot
levels, illustrated arena terrain and armored pilots, clearer weapon feedback,
and redesigned home/profile/lobby screens. Standard rooms use frag, flashbang
and poison smoke; EMP and mines remain optional advanced equipment.

The complete arsenal and five modes remain. Each team carries its own flag;
dropped flags remain until recovered or out of bounds. Server authority,
persistent guest identity/results and the fixed hosting allowance remain.

## Running and checking

See [DEVELOPMENT.md](DEVELOPMENT.md). Use Node 24.21.0 through mise. Build before
starting. Isolate databases/ports for acceptance and restart tests:

```sh
mise exec -- pnpm build
PORT=8081 DB_PATH=/tmp/jet-acceptance.sqlite mise exec -- pnpm start
APP_URL=http://localhost:8081 mise exec -- pnpm check
APP_URL=http://localhost:8081 mise exec -- pnpm check:browser
APP_URL=http://localhost:8081 mise exec -- node scripts/browser-refresh.ts
mise exec -- pnpm check:evidence
```

The revision browser harness observes authoritative traffic while using real
keyboard and touch controls; it does not inject game state. The map preview
harness renders actual map data and renderer code, with explicitly staged art
fixtures for closeups. These are distinct forms of evidence. Arsenal,
preferences, modes, rendering, persistence and constrained load harnesses remain
under scripts/. Raw reports/screenshots are ignored under test-results/.

Current measured results belong in [VALIDATION.md](VALIDATION.md), with the
October record separate from the earlier release. Do not carry forward older
performance or live claims as though they verify changed code.

## Release and course boundary

The repository was verified public and the annotated crit-8 tag resolves to
e6b4df425c06d822c13578559610160be6bfe4f7. Adithya performed his own publication.
Preserve this tag: October revisions do not alter the cutoff snapshot.
The existing main-branch course workflow runs checks and deploys after success.
There is no ship automation.

The Fly app is https://comp4020-final-adithya-rama.fly.dev/. Credentials remain
in the configured ignored environment. Never print them. Retain one shared CPU,
256 MB, one /data volume and the default limit of one active room.

## Human evidence

Adithya's dissatisfaction with the prior maps/mechanics is real product feedback,
recorded in the revision. It does not stand in for the required returning-player
and newcomer playtests. [PLAYTEST.md](PLAYTEST.md) remains the template for those
observations. No claims of fun, balance or historical parity should be invented.

Adithya's preferred role is to think, brainstorm, define system behavior and
quality, and direct agents. Preserve his supplied Crit 8 reflection; later
technical work is not a new personal reflection.
