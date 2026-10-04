# Process overview

> Factual record of the agentic workflow so far, written by the implementing
> agent. Adithya's own account of the decisions and what they learned belongs
> here too, and in `reflections/`.

## From brief to plan

The final project brief asks for an app that is alive for a stranger and good
by a definition the student argues for. The chosen app is Jet Skirmish, a
browser take on Mini Militia v4's jetpack arena combat. Before any code, the
whole scope was agreed as one written plan,
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). The plan covers
the game rules, including the own-flag Flag Delivery mode, the architecture
and network contract, persistence, acceptance tests, and a staged build split
between two agents. It went in first, with the agent rules drawn from it in
[CLAUDE.md](CLAUDE.md), as
[`c9a6d0b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/c9a6d0b).

## Agentic workflow

- **Two agents, one integrator at a time.** Claude Opus (in Claude Code) builds
  stages P0–P2, then stops. Codex audits that foundation independently and
  builds P3 (Flag Delivery and the hardest multiplayer cases), then hands P4
  back. Every handoff is written down in [docs/HANDOFF.md](docs/HANDOFF.md).
- **Grounding.** The agent works from the saved plan and a feature checklist
  ([docs/FEATURES.md](docs/FEATURES.md)). The checklist separates
  *implemented*, *tested locally*, *verified live* and *pending*, so nothing
  claims more than the evidence shows.
- **Backpressure.** `pnpm check` runs the typecheck, 30 unit tests of the
  shared simulation (`test/`), and contract specs that drive the running app
  over HTTP and WebSocket (`spec/`). One spec plays the crit-8 line directly: a
  stranger plays a round and finds it in their history when they come back.
  `pnpm check:browser` plays a round in Chromium at 1920×1080 and on a 390×844
  touch phone and saves screenshots. `scripts/load-check.ts` probes memory and
  tick time with eight fighters.
- **Corrections the checks forced.** The first server boot failed because a
  SQL statement was prepared before the migrations ran. A memory measurement
  showed what type stripping and the database worker cost, which went into the
  stack decision. The phone screenshots showed HUD panels overlapping, which
  was fixed before the commit.

P0–P2 landed as
[`6f60466`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/6f60466).
The plan wanted one commit per stage, but the three stages were built in one
pass, because the first runnable match needs all of them. So they landed as one
commit, and its message says what belongs to each stage.

## Stack

TypeScript with one shared simulation, PixiJS for drawing, HTML for menus,
Node 24 with `ws`, and SQLite on the Fly volume. The trade-offs are in the
decision record, [docs/decisions/0001-stack.md](docs/decisions/0001-stack.md).
