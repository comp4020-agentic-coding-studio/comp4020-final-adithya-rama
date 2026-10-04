# Integration handoff: complete scope implemented, release acceptance

Updated 5 October 2026 (Australia/Sydney). The user authorized implementing the
whole plan after the original Claude P2 handoff. Do not restart P0 or remove the
later work based on that older handoff.

## Current implementation

P0–P5 are implemented: shared authoritative simulation, all 21 firearms, both
equipment entries, four throwables, four planned arenas, five modes, desktop and
touch controls, room rules/presets, guest identity, preferences and saved history.
Flag Delivery uses each team's own flag and permanent dropped flags.

Core integration is in commit `225a493`; `de9a5f0` fixes the final zero-score MVP
tie rule. Subsequent client and acceptance work is recorded in Git history.
[FEATURES.md](FEATURES.md) is the complete feature ledger; [VALIDATION.md](VALIDATION.md)
separates automated, browser, container, live and outstanding human evidence.

## Running and checking

See [DEVELOPMENT.md](DEVELOPMENT.md). Use Node 24.21.0 through mise.
Build before starting the server. Use an isolated DB and port for destructive
restart tests; the normal local database is under ignored `.data/`.

```sh
mise exec -- pnpm build
PORT=8081 DB_PATH=/tmp/jet-acceptance.sqlite mise exec -- pnpm start
APP_URL=http://localhost:8081 mise exec -- pnpm check
APP_URL=http://localhost:8081 mise exec -- pnpm check:browser
mise exec -- pnpm check:evidence
```

The current unit suite has 101 checks; the running-app/server/storage suite has
32. The arsenal, independent browser modes, preferences, latency, persistence
and constrained load harnesses live in `scripts/`. Read each script's isolation
requirements before running it. Raw local reports belong in ignored
`test-results/`; durable summaries belong in the validation records.

## Release

The Fly token is available through the course's configured mise environment.
Never print it or commit `mise.local.toml`. Deploy only the existing application
with the fixed one-CPU, 256 MB and persistent-volume shape.

```sh
mise exec -- flyctl deploy --remote-only --ha=false -a comp4020-final-adithya-rama
```

The application URL is https://comp4020-final-adithya-rama.fly.dev/.
Deployment, all five live browser mode flows, and persistence across a Fly
restart/cold start/redeployment have passed. See [VALIDATION.md](VALIDATION.md)
for evidence and boundaries. Default admission remains one active room.

## Remaining evidence

Human playtests with one returning Mini Militia player and one newcomer remain
required. Do not invent observations, enjoyment, familiar feel or balance
validation. Use [PLAYTEST.md](PLAYTEST.md), observe the listed tasks, then record
and fix concrete problems.

Adithya supplied the Crit 8 reflection directly. His role is to think,
brainstorm, define system behavior and quality, and direct agents' implementation.
His group is Dàchī, Wednesday 10:30am; the cutoff is Wednesday 7 October 2026,
08:30 Australia/Sydney. Repository instructions retain private visibility until
that cutoff. Complete the course public ship/tag procedure then and retain public
visibility; do not claim it has happened before checking.
