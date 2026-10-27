# Current handoff: 28 October combat and visual creator

Read [the current revision](COMBAT_WORKSHOP_2026_10_28.md) and
[reference audit](COMBAT_REFERENCE_2026_10_28.md). Shield coverage now rotates
with aim. M93BA is 60 body / 120 exposed standing head; rocket direct impact
and per-person shield/terrain splash are separate. Saw collision and artwork
share a 10-unit radius and swept rebounds. The pilot creator now uses visual
choices, large animated preview and persisted eyebrows. Protocol 5 requires
stale clients to reload. Validation and deployment status are in the revision.

The following October 21 handoff is historical; its one-shot-body sniper and
old creator descriptions are superseded. Preserve personal reflections and tags.
# Integration handoff: October 21 Crit 10 revision

Latest release pass: [pilot identity and aiming](PILOT_RELEASE_2026_10_21.md).
Full saved character choices now render in the home preview, lobby and match.
Gentle aim assist is default-on and optional, with a separate sight guide.
Boot retry, real match-loading stages, sound previews and preference failure
feedback complete this pass. Run `scripts/browser-pilots.ts` against the target
environment; local and live evidence remain separate. Preserve all course tags.
Release `e78a1fb` passed deployment workflow 39468510671 and the two-browser live
pilot acceptance on 21 October at 04:46 AEDT. The existing acceptance guest and
match-detail digest survived the deploy. The live-persistence harness accounts
for additive avatar defaults without rewriting its original private baseline.

Latest combat amendment: M93BA body damage is 100, with existing shield,
protection and room multipliers retained. Poison damages all teams including
its owner, and spawn safety accounts for allied poison. Its animated danger
cloud remains cosmetic. See [combat follow-up](COMBAT_FOLLOWUP_VALIDATION.md).

Latest UAT follow-up: readable, viewer-relative nameplates. Teammates are green
`ALLY`, opponents red `ENEMY`, with fixed screen-size names and health bars.
Screen-space placement separates nearby names without revealing hidden enemies.
See [nameplate verification](NAMEPLATE_VALIDATION.md) for local checks and the
separate live acceptance command. This is a renderer-only gameplay change.

Follow-up control amendment: movement and flight no longer select gun aim.
Mouse follows the cursor; released numpad/arrow/touch aim retains its direction
until deliberate aiming changes it. Existing movement/jetpack bindings remain.
Local production verification passed 391 unit tests, 40 server/spec tests,
desktop/phone browser rounds and `scripts/browser-independent-aim.ts` using
real keyboard inputs and authoritative snapshots. Live verification is a
separate post-deployment step; the script accepts `APP_URL`.

Latest scope: [Crit 10 validation](CRIT_10_VALIDATION.md),
[access decision](decisions/0005-who-may-see-and-change-what.md) and
[log-only rehearsal](CRIT_10_REHEARSAL.md). The reflection is an assisted edit of
Adithya's supplied account about user acceptance testing and directing agents.
Preserve previous reflections and tags. This work does not run `/ship`.

Current changes add named/identified gameplay logs and connection-bound profile
updates, player-centred camera tracking beyond terrain, a finite exterior flight
area with progressive unpowered fall damage, smaller translucent equipment
cards, and the default-on Random spawns room setting. Old saved aim look-ahead
preferences no longer move the camera. Lunarcy retains zero gravity; flag return
boundaries remain the original map rectangle. See the latest validation record
for measured local and live status; October 14 results below are historical.

Read [the revision plan](REVISION_2026_10_14_PLAN.md), [research ledger](RESEARCH_MINI_MILITIA_2026_10_14.md), [chosen rules](decisions/0004-classic-pc-gameplay.md), [feature checklist](FEATURES.md) and [current evidence](REVISION_2026_10_14_VALIDATION.md). Earlier evidence applies only to its recorded build.

## Current implementation

- Physical 28-unit crouch/crawl with standing clearance. S does not descend; Shift+S or Descend crosses only marked one-way platforms. Bounded step-up handles small ledges without climbing walls or passing through ceilings.
- Six new authored layouts: Outpost, High Tower, Ice Box, Pyramid, Lunarcy, Catacombs. Six previous arenas and Test Range remain. Stable map IDs/result versions keep old history meaningful. Reference similarity is not recovered exact geometry.
- Lunarcy enforces zero gravity/unlimited fuel. Directional thrust, coast, counter-thrust, EMP and dropped/projectile/flag motion agree across prediction and authority. Flag return bounds remain the actual map rectangle.
- Classic PC flat bullet damage through finite range; M4 burst, minigun/saw wind-up, M14/EMP travel, saw piercing/terminal blast and PHASR/flame refill. Conventional reload continues while holstered; dropping grants no ammunition. Directional shield/knife and compatible dual guns remain.
- Saved per-weapon Near/Field/Far/Range views with centred tracking. Phone framing reserves the actual HUD/control band. A far view never extends legal weapon reach.
- Fully covered grounded crouching conceals a pilot in foliage. Revealing actions and flags expose them. Server snapshots omit hidden enemies, public scores omit positions, bots obey visibility, and killer-follow cannot switch to an unrelated actor. Spectators intentionally receive full observer vision.
- Navigation prewarms in yielded chunks before match announcement. Easy bots allow charge completion before their firing burst. Spawn selection considers cover, gas, mines and incoming projectiles.
- Original weapon/avatar art, charge/reload feedback, foreground foliage and bounded effects. Sixteen credited CC0 gun/voice clips remain the approved sound alternative. Low-flash and blood visibility are separate from shake/volume.
- Pickup previews, grenade bag/type display, playable Training tasks, Survival preparation/revival cues and weapon-role labels. Room cards show map geometry, human/bot counts and rule badges. Lunarcy controls, readiness reset and staged rules are explicit.
- Eighteen touch controls support saved placement, size/opacity, overlap checks, reset and rotation. Protocol 4 visibly rejects stale browser clients whose old movement prediction would disagree.

Own-flag rules remain unchanged: carry your team's flag into the enemy goal; one flag exists per team; dropped flags remain indefinitely in bounds; only teammates recover them; damage resolves before both teams' deliveries. Training teaches the same rules on arenas; Test Range has no objectives.

## Running and verification

Node 24.21.0 and pnpm 11.9.0 are pinned through mise. Use isolated databases/ports for acceptance. Never point destructive restart tests at real player data.

```sh
mise exec -- pnpm build
PORT=8081 DB_PATH=/tmp/jet-acceptance.sqlite mise exec -- pnpm start
APP_URL=http://localhost:8081 mise exec -- pnpm check
APP_URL=http://localhost:8081 mise exec -- pnpm check:browser
mise exec -- node scripts/browser-arsenal.ts
mise exec -- node scripts/check-reference-modes.ts
mise exec -- pnpm check:evidence
docker build -t jet-skirmish:acceptance .
mise exec -- pnpm check:persistence
```

Actual-app revision, touch editor, phone framing, room-card and native long-render scripts live under scripts/browser-*.ts. Reports/screenshots remain ignored under test-results/. Arsenal and map/mode checks manage their own isolated servers. Read each script's environment options before running. Load checks must report disconnect failures instead of sampling an empty server as success.

## Release boundaries

One shared CPU, 256 MB, one /data volume, one active room. Separate one-room soak containers do not establish two-room capacity on one machine. Current acceptance/deployment status is in the validation record; a build or short probe is not the entire release gate.

Preserve the public repository, immutable crit-8 at e6b4df425c06d822c13578559610160be6bfe4f7, and Crit 9 commits d1703b0/eb9488a. Do not run /ship, retag or edit personal reflections. The normal main workflow deploys to https://comp4020-final-adithya-rama.fly.dev/. Credentials remain in the configured ignored environment and are never printed.

Adithya directs product and quality criteria. No returning-player/newcomer playtest, physical-phone performance or subjective audio resemblance is claimed. Record real human findings when supplied, with fixes and remaining limitations.
