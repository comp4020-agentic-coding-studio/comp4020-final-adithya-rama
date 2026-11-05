# Agent rules for Jet Skirmish

The current definition of good is in `README.md`; the corresponding requirements
and check map are consolidated in `docs/QUALITY_CONTRACT.md` (5 November 2026).
Read both before changing the game. That contract includes later user corrections
that supersede older plans. The original `docs/IMPLEMENTATION_PLAN.md`, dated
revision plans and decision records remain the history of how the project grew.
Later direct user instructions take precedence. Do not silently restore an older
rule because it appears in the first implementation plan.

## Before working

- Read `README.md`, `docs/QUALITY_CONTRACT.md`, `docs/FEATURES.md` and the latest
  `docs/HANDOFF.md`, and look at `git status` and the recent log.
- One agent at a time integrates changes. Stop at the stage boundary named in
  the handoff unless the user has authorized continuing. The user authorized
  the complete plan on 4 October 2026; the integrator coordinates all stages.

## Game rules are fixed

- Never change an agreed rule to make implementation easier. Flag Delivery uses
  each team's **own** flag. A dropped flag stays where it lands until a teammate
  recovers it, and only leaving the map returns it home. There is no return
  timer, no enemy pickup, and no conventional capture-the-flag.
- Preserve the current supported maps. The original map-cut order is historical.
  Any new feature cut needs the scope revised with the user explicitly.

- Preserve movement-independent aim, physical crouching, directional shield
  geometry, headshot/body-shot distinctions and server-side concealment as
  specified in the current quality contract. Corrections must update the relevant
  regression and instructions when they change an ongoing requirement.

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
- Use `spec/README.md` to find the checks for the claim being changed. Unit
  checks in `test/` also run through `pnpm check`; browser/live scripts are
  separate gates and must not be implied by a green unit run.
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
- Commit as you go, with descriptive messages. The user already published the
  repository and created crit-8 at e6b4df4. Preserve visibility and that immutable
  cutoff tag; later work must not be represented as the Crit 8 state.
