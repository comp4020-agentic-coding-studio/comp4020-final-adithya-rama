# 14 October: researched gameplay acceptance

Status: implemented and deployed; automated local acceptance and the live checks
below completed within their recorded boundaries.
Implementation: `e05240a077bf0ca20720a84c7b978c16ea86b704`.
Baseline research commit: `015b103`; Crit 9 reflection/decision and existing tags
are preserved. Read [the rules decision](decisions/0004-classic-pc-gameplay.md)
and [research ledger](RESEARCH_MINI_MILITIA_2026_10_14.md) alongside this evidence.

## Implementation and provenance

Six authored layouts use new stable IDs: Outpost, High Tower, Ice Box, Pyramid,
Lunarcy and Catacombs. The six previous arenas and Test Range remain available.
Terrain, spawns, pickup positions, bushes and objective routes share the same
geometry on client and server. These are original reconstructions, not extracted
Mini Militia assets or exact collision copies. Historical source uncertainty and
authored values remain explicit in the research ledger.

The Classic PC profile adds physical crouching, deliberate descent, finite
weapon travel, flat bullet damage, per-slot bursts/charge/refill, holstered
reloads, saved scopes and space physics. Concealed enemies are removed before
per-viewer snapshot serialization. Public scores remain visible without
positions; actual-killer follow ends permanently when that killer becomes
unavailable. Observer spectators intentionally see the whole match.

## Completed checks so far

- Baseline before changes: typecheck and 201 unit tests passed.
- At the first integrated acceptance checkpoint, `pnpm check` passed typecheck,
  314 unit tests and 35 running-app/server/storage checks. Later M4, navigation
  prewarm, bot charge and camera corrections were followed by a final **334 unit
  tests passed** checkpoint, typecheck and the 35 server/storage checks.
- The new-map network matrix passed all 30 cases: six maps × five modes. Each
  used independent sessions, normal movement/fire/slot input, common ticks and
  scores, identical results, committed history and map/rules versions. Training
  used one fighter plus spectator. These host-ended rounds verify integration,
  not every objective route or wave completion; route/delivery tests remain
  separate. Report: `test-results/oct14-reference-modes.json`.
- Two independent browser identities at 1920×1080 and 390×844 completed all five
  modes, agreed on results and saw committed history. The flag case ended by a
  real delivery limit. This regression used the previous arena IDs and therefore
  does not establish every new map/mode combination.
- Actual-app revision browser: twelve saved Training rounds across six new maps
  and both viewports, independent spectator snapshots, saved SMAW/M93BA scope
  choices, held-Z single cycling, dark flashbang exposure, independent blood/
  low-flash preferences, saved touch placement after reload, Lunarcy forced
  rules, PvP minimum capacity two and disabled Survival bot-count selection.
  No page/console errors. Final reviewed bundle `index-MbKx8yv3.js` repeated the
  full pass and staged TDM/Lunarcy/Survival/Training/Outpost transitions without
  changing the active round. Raw report: `test-results/oct14-final-classic-revision/report.json`.
- Final `pnpm check` against the production Docker container passed typecheck,
  all 334 unit tests and all 35 server/storage checks. Required desktop/phone
  practice-to-results/history browser checks passed too.
- The final full arsenal attempt passed 28 of 29 cases; the remaining shield
  assertion read an old snapshot immediately after slot selection. It now waits
  for server acknowledgement. A focused shield round then passed automatic
  knife pairing, observed frontal blocks, dropping on firearm selection and
  saved results. Together these runs cover all 21 guns, two equipment items,
  three-slot inventory and five throwables. Reports:
  `test-results/browser-arsenal/report.json` and
  `test-results/oct14-shield-final/report.json`. Failed attempts are preserved;
  this is not presented as a single uninterrupted full-suite pass.
- Touch component checks exercised all eighteen controls, drag/save/reset,
  overlapping-control rejection, safe bounds, landscape adaptation and Escape.
  Report: `test-results/oct14-touch-layout/report.json`.
- Art fixtures include six full-map previews and twelve desktop/phone close-ups.
  They establish rendering, not multiplayer outcomes. Report:
  `test-results/oct14-reference-art/report.json`.

## Failures that changed the work

- Route tests caught bots stuck in several passages. Authored navigation,
  supported crawl entries and bounded 24-unit step-up were corrected. Tests cover
  both teams with/without flight, double gravity and half speed, plus the highest
  pickup using normal finite fuel on every new map.
- A quick M4 click originally cancelled its remaining rounds. It now commits
  three rounds over about 167 ms. Ordinary release stops repeats; switching,
  reloading, death, disconnect or stale input cancels pending rounds. Menu/blur
  release may finish an already committed burst; it cannot start another.
- Easy bots' short firing window ended before minigun/saw charge completed.
  Their charge time now precedes the normal burst; real simulation regressions
  verify shots, rather than merely checking an input bit.
- Initial bot graphs cost up to 168.5 ms cold (Catacombs). Navigation is prepared
  in yielded chunks before match announcement; the active clock starts afterward.
  Caches retain at most five variants per map. Warm-route measurements alone
  would have hidden this issue.
- The first arsenal browser assumed every gun fired within 600 ms, less than the
  minigun's 650 ms spin-up. Its updated observation includes wind-up and still
  requires authoritative events/ammunition use. A dual-state assertion also
  raced the network; it now waits for the acknowledged state. The original
  failed report is retained in `test-results/oct14-arsenal-first-attempt/`.
- Real phone flight exposed a pilot behind the equipment HUD. The camera's
  usable vertical band was corrected and verified; the earlier spawn
  screenshots alone did not reveal it.
- Independent integration review caught a newly revealed killer missing from
  the older interpolation buffer, stale profile forms overwriting queued scope/
  touch saves, and next-round controls displaying a map different from the
  sanitized server choice. Current-server killer fallback, one owned-field write
  queue and authoritative selector reconciliation fix these cases. Seven focused
  regressions cover the delayed states rather than only the happy path.

## Resource evidence boundaries

The pure simulation probe ran 78 eight-player cases. Worst measured p95 was
0.681 ms, first cold step 5.841 ms and peak sampled process RSS 193 MB. It excludes
bots, networking, storage, renderer and resource quotas; it is not a production
capacity result. `test-results/oct14-simulation-probe.json`.

The separate bot probe used four human actors and eight spawned enemies. Total
p95 reached 5.94 ms in Catacombs/RG6, whose maximum step was 53.02 ms. Across all
cases the highest maximum was 100.88 ms in Pyramid/minigun, including cold cache
work. Some genuine defeats ended cases early. `test-results/oct14-bot-probe.json`
records duration and counts; these measurements prompted prewarming and do not
replace the soak.

Docker Desktop's Linux engine was initially unavailable. It subsequently became
accessible through WSL after Adithya enabled it. The production Docker build
passed; two containers completed the full thirty-minute PvP/Survival tests with
verified 256 MiB limits, one CPU and no extra swap. Earlier native services have
the same verified limits and remain separately labelled; neither is used as a
substitute for container evidence. Both native runs completed 1,800 seconds and
360 samples without failures: PvP saved 15 rounds, peaked at 142 MB RSS and
5.64 ms sampled simulation p95; Survival saved 17 rounds, reached eight enemies,
and peaked at 145 MB RSS and 2.30 ms p95. Both had zero sampled database queue
depth and no service restarts. The final five-minute RSS means were 142/143 MB,
respectively. Their task-owned services were stopped after completion. Reports:
`test-results/oct14-{pvp,survival}-1800-cgroup.json`.

Soak image: `sha256:0278815cac8d82e9145daf13e7af10e1cd13017652028f0a803947a3395b9e14`.
Every server/shared file hash in that image matches implementation `e05240a`.
The sorted source-manifest SHA-256 is
`660eec77d1eca38311ca3d6b42129c01dc5c1e5f42a35296150698a5d1178abb`.
Later fixes affected client preference/rule/camera integration only; the final
client image was rebuilt and passed the complete container check separately.

The container match-start logs establish Catacombs for both PvP and Survival.
The Survival workload uses Easy bots with flight disabled, four human input
streams and up to eight enemies. This exercises actor-count endurance on a
complex map; it does not establish every hard-bot/flight-enabled combination.
The separate bot probe covers those combinations for its recorded short duration.
Grenade inventories deplete normally; the soak is not continuous maximum grenade
spam. These boundaries remain visible alongside the individual arsenal tests.

Both production containers completed 1,800 seconds and 360 five-second samples.

| Measure | Eight-player PvP | Four-human Survival |
|---|---:|---:|
| Map | Catacombs | Catacombs |
| Completed and saved rounds | 15 | 18 |
| Peak active enemies | n/a | 8 |
| Maximum process RSS | 143 MB | 145 MB |
| Highest sampled simulation p95 | 2.75 ms | 2.35 ms |
| Mean RSS, minutes 1–6 | 139.97 MB | 142.03 MB |
| Mean RSS, final five minutes | 142 MB | 142 MB |
| Maximum sampled database queue | 0 | 0 |
| Peak container memory | 96.24 MiB | 92.15 MiB |
| Failures / OOM / restarts | 0 / no / 0 | 0 / no / 0 |

No sustained growth appeared after warm-up. Each container had a verified
268,435,456-byte memory limit, the same total memory-plus-swap limit and one CPU.
Reports: `test-results/oct14-{pvp,survival}-1800-container.json`; complete logs:
`test-results/oct14-{pvp,survival}-container.log`. Independent one-room servers do
not establish two-room capacity. Their task-owned containers were removed after
capturing the final logs and limits.

The isolated production-container persistence suite passed all nine checks:
fabricated-state rejection, short/long real reconnects without refills or duplicate
participants, idempotent completed results, exact history/profile restoration
after restart and replacement, room churn, and interrupted checkpoint recovery
without false wins/MVP. The test removed its own disposable container/volume.
See [persistence evidence](PERSISTENCE_EVIDENCE.md).

Eight-player network probes passed at 50/100/150 ms imposed round-trip delay with
15/20/25 ms jitter, respectively. Measured heartbeat p95 was 62.0/143.9/207.0 ms;
input acknowledgement frame-age p95 was 83.3/150/200 ms. These are transport/input
measurements, not a subjective claim that aiming feels identical at each delay.
Each round saved. Maximum sampled RSS was 153 MB and simulation p95 stayed below
3.25 ms. Reports: `test-results/oct14-latency{50,100,150}.json`.

The ten-minute native graphics test passed: **59.62 mean rendered FPS**, 35,809
renderer submissions over 600.65 seconds on Windows Chrome 154 / Intel Arc 140T,
1920×1080, DPR 1, antialiasing on. All 60 ten-second samples exceeded 58 FPS.
Ice Box rendered 245 solid rectangles with Far scope selected and eight actor
records (four to eight alive through normal deaths). Death-camera transitions
occasionally narrow the view; this was not a permanently fixed Far camera or
eight simultaneously alive players. Peak observed projectiles were four, so this
does not establish the maximum-effect render case. See
[rendering evidence](RENDERING_EVIDENCE.md) for raw settings, timings and limits.

## Publication and live verification

The existing public workflow deployed `d171901900aa9bb55c6c152cbec4717d1cf08cc2`
at 04:39:43 AEDT on 14 October. Both the check job (including secret scans) and
deploy job passed: [workflow 38440125051](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/actions/runs/38440125051).
No manual duplicate deployment, course shipping command or tag change was used.

Fly's machine image label confirms that exact Git SHA. The sole machine remains
`7811ed5a0e37e8` in Sydney, shared CPU 1, 256 MB, with encrypted volume
`vol_4m3mgxpw3zy0g0gv` mounted at `/data`. Image digest:
`sha256:f4ae4382592088217509f6740d0d3980c7260817848f4cb1545aeec71a8b7c91`.
The site serves protocol 3, client `index-MbKx8yv3.js`, all six required new map
IDs (thirteen choices including retained arenas/Test Range), 23 equipment entries,
five throwables and the updated full README. Reports:
`test-results/oct14-live-fly-status.json` and `test-results/oct14-live-content.json`.

Read-only verification before and after deployment restored the exact existing
profile/preferences/aggregates and one unchanged completed match. Its detail
SHA-256 remained `43c2db246e749f66f281c76f3cc2a094ee17733b3378de2bd47940d070bdfa5e`.
No stored credential was printed. Reports:
`test-results/live-persistence-verify-oct14-{before,redeploy}.json`.

The first live revision browser completed all six desktop map rounds, saved
their results, verified independent observer state and exercised scope,
accessibility and staged-rule controls. During the phone pass, another live
player started a round. The capacity guard correctly rejected the test's Start;
its observer then timed out waiting for a match that had not started. This failed
attempt is retained in `test-results/oct14-live-classic-revision/report.json`.
`test-results/oct14-live-first-browser-server.log` records the explicit capacity
rejection. The test left its own lobby; the real player's round was untouched.
After Adithya stopped his round, a focused phone pass completed all six new maps
without failures. Saved scope/touch/accessibility preferences survived reload,
Lunarcy forced rules and staged next-round controls agreed with the server, and
each round saved with independent observer state. Screenshots were inspected.
Report: `test-results/oct14-live-classic-phone/report.json`. The harness now allows
`VIEWPORTS=phone` so a partial retry does not unnecessarily occupy capacity by
repeating already verified desktop rounds.

A subsequent two-identity desktop/phone browser pass completed all five modes
with identical saved results and no failures. Flag Delivery ended naturally at
the one-delivery limit, 1–0. FFA, TDM, Survival and Training were host-ended smoke
rounds; Training used one fighter plus spectator. This regression uses the
retained map IDs, while the new layouts have the separate six-map browser passes
and thirty-case local network matrix. Report: `test-results/oct14-live-modes.json`.

## Remaining human and device evidence

One active room stays the production limit. Do not infer two-room capacity from
separate test servers.

A returning player/newcomer playtest, physical-phone performance and a subjective
sound/reference comparison remain unperformed. Automated tests do not establish
familiarity, fairness, enjoyment or original-audio resemblance. The sixteen
credited CC0 clips remain reusable replacements, not Mini Militia recordings.
