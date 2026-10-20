# Crit 10 validation — 21 October 2026

This record distinguishes implemented behavior, local checks, deployment and
live observations. Automated browser rehearsal does not stand in for the pod's
human log-only exercise.

## Scope and corrections

Starting point: `24753d1` already added names to many lifecycle logs and a
proposed access decision. The follow-up found ambiguous duplicate names in
combat logs, incomplete settings detail, flag drops that could miss logging
when the last member left, and a renamed connected guest joining with an old
cached name. The server changes address those cases.

Adithya's gameplay feedback requested a stable view when turning, camera follow
outside terrain, recoverable flight beyond the map, a smaller translucent
inventory, and optional varied spawns. Shared movement now uses a finite
1,000-unit exterior envelope; normal-gravity unpowered descent below terrain
accumulates one second of grace followed by 5 damage every 15 simulation ticks.
Actual thrust pauses exposure without resetting it. Re-entry resets it.
Environmental deaths grant no kills or assists. Space retains zero gravity.

Random spawns chooses among similarly safe, legal authored positions and avoids
the last position where a comparable alternative exists. It does not select a
dangerous location merely for variety. The setting is validated on the server,
saved in presets and staged for the next round during play.

## Local checks

- Type checking, the production client build and `pnpm check:evidence` passed.
- The integrated `pnpm check` passed **389 unit tests and 40 server/storage
  tests** against the final protocol-4 build on port 8109. The new cases include
  exterior flight/fuel/EMP/fall death, safe varied spawns across all 13 maps,
  exterior projectile hits and expiry, preserved flag return boundaries,
  camera framing, named events and personal-data ownership.
- The first real-browser rehearsal used independent desktop 1920×1080 and
  mobile 390×844 contexts at `http://localhost:8108`, from the home URL only.
  Both renamed their profiles, created/joined through the UI, and saw readiness.
- Four forged commands sent over the guest's own actual connection were
  refused by the server: settings, start, end and rematch.
- Real keyboard movement and melee produced a 1–0 TDM result. A second round
  collected the host's own flag and delivered it for 1–0 before the host ended
  the round. Both browsers received identical committed results and personal
  history. Host transfer and returning browser identity also passed.
- Server stdout contained the real named kill, own-flag pickup/delivery, refused
  actions, changed settings and host-transfer events. Browser storage/session
  credentials were not included in evidence.

Harness: `scripts/browser-crit10.ts`. Initial ignored report:
`test-results/crit10-local.json`; initial server log:
`test-results/crit10-local-server.log`. Final integrated output:
`test-results/crit10-final-check.log`.
The final protocol-4 two-profile repeat passed in
`test-results/crit10-local-final-held-input.json` (room `RBU8F`).

The first complete camera/HUD acceptance pass used actual inputs at both
marking viewports. On Lunarcy it flew to all four exterior boundaries, stayed
alive and kept the camera within 0.06 world units of the settled pilot centre.
Turning in place moved the view by less than one world unit, including with an
old saved look-ahead preference set true. The inventory measured **320×180 CSS
pixels on desktop**, **376×131 on phone**, with a 0.52-alpha panel and fully
opaque labels. Three slots and all five configured grenade counts remained
visible. Default/toggle/preset/staged Random spawns behavior passed.

Ignored report: `test-results/oct21-crit10-gameplay-final/report.json`.
Screenshots were visually inspected. The required practice/touch/history
`pnpm check:browser` also passed on the protocol-4 build. Phone evidence is
Chromium touch emulation, not physical-phone performance.

Final protocol-4 gameplay acceptance passed in
`test-results/oct21-crit10-gameplay-accepted/report.json`: both viewport
perimeter/settings passes plus two Outpost recovery rounds. Each recovery
showed gradual loss from 100 HP, then stable 90 HP once powered flight was
acknowledged, a cleared fall warning, successful ascent and committed results.
The camera retains 160 ms movement smoothing: at 2× thrust the pilot can lead
the screen centre during ascent. Exact settled centering does not imply zero
tracking lag during motion.

## Failed attempts and limitations of the local environment

- An intermediate broader server run used a still-running protocol-3 process
  after the protocol-4 bump. Five connection tests refused the incompatible
  client as designed. Restarting on current source preceded the clean integrated
  40-test run; the old attempt is not counted as passing evidence.
- The first compact-HUD assertion found a 201-pixel-tall desktop panel with
  five grenade types. Styling was tightened; the size assertion was retained.
- An added terrestrial recovery browser route initially chose Test Range,
  whose authored solid ceiling/walls prevent flying outside. This was a route
  assumption, not evidence of a camera clamp; the follow-up uses open Outpost.
- One protocol-4 narration repeat missed its instantaneous melee key tap.
  The harness now holds the key for 100 ms so it spans the game's sampled
  input interval; the repeat produced the actual kill and passed. The first
  failed report is retained as `test-results/crit10-local-final.json`.
- The first recovery assertion compared health before a screenshot with health
  after the thrust request reached the server. The corrected check starts at
  the authoritative `JETTING` acknowledgement; unpowered damage in transit is
  valid and is retained in the report.
- A local container build could not start because Docker Desktop's daemon/WSL
  integration was unavailable. The normal release workflow builds and tests
  the production Docker image separately. Local Node checks are not represented
  as constrained-container evidence.

## Release verification

Publication and live observations are recorded here after the workflow completes.
Before deployment, the prior-release acceptance profile, preferences, aggregates,
history and exact match details still matched their saved baseline using only
authenticated GET requests. Match detail digest:
`43c2db246e749f66f281c76f3cc2a094ee17733b3378de2bd47940d070bdfa5e`.

## Human evidence and limits

Adithya reports observing other people play, noting their difficulties and
using those observations to request changes. His supplied reflection also
describes how image references and explicit physics/behavior documentation
improved agent output. This is reported human feedback, not an invented
returning-player/newcomer study or a claim that the Crit 10 pod rehearsal has
already taken place.

No new 30-minute load or native-GPU rendering benchmark is claimed for this
revision. Earlier measurements remain attached to their October 14 build.
Logs remain part of normal server operation after the crit; provider log
retention is not an indefinite archive of every event.
