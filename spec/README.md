# The spec

The [final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
and its spec are on the course website, along with the specs for crits 8, 9 and
10, which run in this repo. The brief poses the problem; the spec is the fixed
contract.

## What ships

`invariants.test.ts` checks the two things the course relies on:

- `/` answers with a 200, which is what the deploy and the crit capture read
- `/readme/` publishes `README.md`. Markdown renderers all differ slightly, so
  it checks the README's headings rather than every word: each one has to
  appear, in order, in the HTML the server sends, since no script runs. Render
  it however you like, as long as it's there in full; the marker reads it there.

Both run against the **running** app over HTTP, so they hold whatever it's built
with. In CI that app is the image your `Dockerfile` builds, started with a
throwaway `/data`, and a red run blocks the deploy. Locally, start the app
however you run it and `pnpm check` finds it at `APP_URL` (default
`http://localhost:8080`). Keep them; don't delete them.

## Your checks

Everything else in `spec/` is yours to write. Any `spec/*.test.ts` runs with
`pnpm check`, against the same running app. Some lines of a spec only a person
can judge; those are left to the crit and the marker.

At a crit, a green `check` job is half the shipped mark, but it's never the
judgement of the work: your tutor checks what you deployed against the published
spec.

## Jet Skirmish quality-to-check map

Consolidated on 5 November 2026 alongside
[the current quality contract](../docs/QUALITY_CONTRACT.md). This index makes the
existing harness easier to inspect; it does not claim the consolidation was
present at earlier crit cutoffs. `CLAUDE.md` directs agents to the same contract.

`pnpm check` runs TypeScript checking, unit checks in `test/`, then these `spec/`
checks. Some `spec/` files exercise an isolated room or database directly; others
use HTTP/WebSocket against the running production build. Browser and deployed
acceptance scripts below are separate runs, not automatically implied by CI.

| Quality claim | Existing automatic evidence | Important boundary |
| --- | --- | --- |
| A stranger can enter and return as the same pilot | `alive.test.ts`, `server-api.test.ts` | Cookie-store identity; no cross-device recovery after clearing cookies. |
| Separate players share authoritative outcomes | `alive.test.ts`, `server-rooms.test.ts`, `../test/rate-limit.test.ts` | Tests cover refused fabricated score/damage and host actions; they cannot establish subjective fairness. |
| Exactly one own flag per team; drops stay; deaths precede delivery | `../test/full-game.test.ts`, `server-rooms.test.ts` | Simultaneous scoring, generation, enemy rejection, disconnect and out-of-bounds cases are explicit. |
| Saved success corresponds to committed, owned records | `server-storage.test.ts`, `server-api.test.ts`, `../test/client-integration-regressions.test.ts` | Includes idempotent completion, failed writes, ownership, checkpoint restart and rollback. A live redeploy is a separate check. |
| Logs explain who acted and why an action was refused | `server-logs.test.ts` | Distinguishes duplicate names by IDs; checks final flag drops and excludes credentials/chat. Not a complete input replay. |
| Movement does not turn the gun; controls survive focus changes | `../test/input.test.ts`, `../test/touch.test.ts` | Real browser input has its own script; a unit event is not a physical-device test. |
| Shield art, collision, sniper and blast rules agree | `../test/combat-directional.test.ts`, `../test/explosive-deaths.test.ts`, `../test/impact-feedback.test.ts` | Covers standard-health direct/head/body cases, cover, distance, preference and cause distinctions. Authored tuning, not proven historic parity. |
| Hidden opponents are omitted before serialization | `../test/server-visibility.test.ts`, `../test/reference-maps.test.ts` | Foliage concealment and killer-follow rules; spectators deliberately have full observer vision. |
| Saved customization and effects remain usable | `server-api.test.ts`, `../test/pilot-creator.test.ts`, `../test/pilot-customization.test.ts`, `../test/nameplates.test.ts` | Automated controls and geometry checks do not prove attractive art, fun or complete accessibility. |
| The public entry and README are available without scripts | `invariants.test.ts`, `readme-content.test.ts` | Preserves the shipped heading/order invariant, compares all rendered text and source links, and fetches local documentation links without running scripts. |

### Browser, restart and deployment evidence

- `pnpm check:browser` plays actual practice rounds at 1920×1080 and 390×844.
- `scripts/browser-independent-aim.ts` uses real inputs and authoritative shot
  events; `scripts/browser-directional-combat.ts` checks shield/head/body cases
  with an independent guest.
- `scripts/browser-creator.ts` exercises every tile, save/reload, recoverable save
  failure and reduced motion. `scripts/browser-pilots.ts` checks two separate
  profiles, loading, aiming preferences and saved results.
- `scripts/browser-combat-effects.ts` checks real desktop/touch throws and an
  independent peer's outcomes, including normal/reduced-blood frag and EMP.
- `scripts/browser-crit10.ts` and `scripts/browser-crit10-gameplay.ts` rehearse
  URL-only entry, permissions and narratable actions; the human crit exercise
  remains a different event.
- `scripts/persistence-acceptance.ts` uses isolated restart/redeploy fixtures.
  `scripts/live-persistence.ts verify <label>` reads the original acceptance
  guest on the deployed site without replacing its private baseline.
- `scripts/acceptance-load.ts` and the recorded constrained-container runs test
  delay, churn and capacity under named conditions. Do not generalize a short
  run to every network or a full soak. Read the dated validation record.

A meaningful correction should keep the failing case in the appropriate test or
browser script, or explain why human observation is the right check. Record the
observed result and current limitation. Do not write a passing test that merely
repeats the implementation, and do not turn a subjective claim into an invented
measurement. See [human playtesting](../docs/PLAYTEST.md) and the
[latest recorded live release](../docs/CHARACTER_EFFECTS_2026_10_28.md).
