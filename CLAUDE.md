# Agent rules for Jet Skirmish

These rules come from the agreed plan in `docs/IMPLEMENTATION_PLAN.md`. If a
rule here and the plan disagree, the plan wins; ask before changing either.

## Before working

- Read `docs/IMPLEMENTATION_PLAN.md`, `docs/FEATURES.md` and the latest
  `docs/HANDOFF.md`, and look at `git status` and the recent log.
- One agent at a time integrates changes. Stop at the stage boundary named in
  the handoff unless the user has authorized continuing. The user authorized
  the complete plan on 4 October 2026; the integrator coordinates all stages.

## Game rules are fixed

- Never change an agreed rule to make implementation easier. Flag Delivery uses
  each team's **own** flag. A dropped flag stays where it lands until a teammate
  recovers it, and only leaving the map returns it home. There is no return
  timer, no enemy pickup, and no conventional capture-the-flag.
- Cuts follow the plan: Skyshaft goes first, then Crosscurrent. Any other cut
  needs the scope revised with the user explicitly.

## Architecture

- Game rules live only in `src/shared/` (pure TypeScript, deterministic, no
  DOM or Node APIs). The server is authoritative, and the client predicts only
  its own movement with the same `stepMovement`.
- Server code runs through Node's type stripping, so use only erasable
  TypeScript: no enums, namespaces or constructor parameter properties.
- SQLite calls go through the worker in `src/server/db-worker.ts`, never on
  the game loop's thread.
- Respect the hosting limits: one machine, 256 MB, one volume at `/data`.
  Don't edit `fly.toml`'s machine shape.

## Definition of done

- A feature counts only when it works through simulation, networking,
  rendering, HUD and (where relevant) persistence. A menu entry or icon is not
  a feature.
- Run `pnpm check` against a running build (`pnpm build && pnpm start`, or the
  Docker image). For UI changes, also run `pnpm check:browser`, which plays
  both marking viewports (1920×1080 and a 390×844 touch phone).
- Keep the starter's `spec/invariants.test.ts` and add to `spec/`; never delete
  a past check.
- Update `docs/FEATURES.md` statuses honestly: implemented, tested locally,
  verified live, or pending.

## Honesty

- Never invent playtest results, personal reflections, historical Mini Militia
  parity, measurements, or deployment evidence. The user writes their own
  judgements (the README's "what good means", `reflections/`). Agents may
  structure and edit them.
- Report deployment status separately from local success.

## Secrets and git

- The Fly token lives in `mise.local.toml` (gitignored). Never print it,
  commit it, or put it in a command line that gets logged.
- Commit as you go, with descriptive messages. The repo stays private until the
  crit cutoff.
