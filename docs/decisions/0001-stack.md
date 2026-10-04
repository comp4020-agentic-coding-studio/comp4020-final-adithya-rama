# 1. Stack: TypeScript, PixiJS, shared simulation, Node + ws, SQLite

Date: 2026-10-04 · Status: accepted

## Context

Jet Skirmish is a real-time 2D shooter for up to eight players in a browser.
It must run on the course's fixed Fly.io allowance: one shared CPU, 256 MB of
memory, one volume at `/data`, and no separate database server. The plan
([IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)) needs an authoritative
server, client-side prediction using the same rules, and saved results that
survive restarts.

## Decision

- **One TypeScript simulation in `src/shared/`**, with no browser or Node
  dependencies. The server runs it authoritatively at 60 Hz, and the client
  runs the movement part for prediction. One copy of the rules means the two
  can't drift apart.
- **PixiJS 8 renders the game; native HTML/CSS does the menus and HUD.** Pixi
  only draws, so the rules never depend on frame rate. HTML menus work with
  screen readers and phone layouts without extra effort.
- **Node 24 with `ws`, running the TypeScript directly** through Node's type
  stripping. That means only erasable syntax (enforced by
  `erasableSyntaxOnly`), and the server needs no build step. Vite builds only
  the client.
- **SQLite through `node:sqlite`, on a worker thread.** `DatabaseSync` blocks,
  so it never runs on the game loop's thread. The file lives on `/data` in WAL
  mode.

## Consequences

- `node:sqlite` is release-candidate (stability 1.2) in Node 24. Node is pinned
  to 24.21.0 in `mise.toml` and the Dockerfile so the API can't shift under us.
- Two JavaScript threads and type stripping cost memory. The measured idle RSS
  is about 117 MB inside the production container (the container's own memory
  count is about 64 MiB). A 90-second probe with eight fighters peaked at
  127 MB RSS, with a 95th-percentile step time of about 1 ms. If the 30-minute
  soak shows growth, precompiling the server to JavaScript is the first lever.
- Messages are compact versioned JSON. A binary protocol is deferred until
  measurement says JSON is too heavy.
- There is no account system: identity is an opaque guest cookie, so clearing
  browser data makes a new pilot. That is the plan's stated behaviour.
