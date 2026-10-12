# October 13 revision acceptance

All timestamps refer to Australia/Sydney on 13 October 2026. This record verifies
[the combat/arena revision](REVISION_2026_10_13.md). Older releases' soaks and live
checks are not treated as current results.

## Completed local checks

- Typecheck and **201 unit tests** passed; **33 running-app spec tests** passed
  against the production build. Process evidence and diff checks passed. Tests
  include front-panel blocking, head/rear paths, historical shield poses,
  equipment switching, duplicate equipment pickups, lethal blade protections,
  grenade quantities/collection/cycling, range falloff, swept projectiles,
  launcher firing events and bot slot selection.
- All six arenas support both own-flag directions with flight disabled, gravity
  at 2x and speed at 0.5x. Palace stairs reach the upper galleries under those
  limits. Bot delivery checks cover both teams, with and without flight.
- Arsenal browser: **29 completed, saved rounds**, all 21 firearms, machete,
  shield-and-knife pairing and physical shield drop, three slots and all five
  throwable types. Real pickup traversal and authoritative launcher events were
  observed. No browser errors. `test-results/browser-arsenal/report.json`.
- Death browser: two independent sessions using real input. Rocket attribution,
  following a moving attacker (camera x=757 to 947), respawn restoration,
  self-kill fallback, no breakup for bullet kills, no debris with reduced
  effects. Rocket peak 14 fragments, limit 96. Four groups passed, zero errors.
  `test-results/oct13-death/` contains the report and phone screenshots.
- Audio browser: all **16 shipped recordings** decoded in Chromium; 15
  conventional firearm profiles scheduled, one sound per shotgun discharge,
  hurt/death voices, mute and distance attenuation. Clips total **177,441 bytes**.
  `test-results/audio-revision/report.json`. This verifies playback plumbing,
  not perceived sound quality or a match to the original game's audio.
- Actual-renderer art fixtures: six arena overviews, five closeups and desktop/
  phone contact sheets of 23 weapons/equipment. Review prompted a second palace
  pass with recessed arches and warm gallery masonry. No browser errors.
  `test-results/map-revision/`. Fixtures are not multiplayer evidence.
- Desktop and 390x844 touch practice flows completed and saved; the refresh
  browser observed numpad aim/fire, three slots, held fire across reload,
  regeneration after damage, flash expiry, poison damage, readiness and separate
  identities. No failures. `test-results/oct13-check/` and `oct13-refresh/`.
- Catalogue browser selected all six arenas through real room settings and
  verified server acknowledgement, previews, all 23 armory cards and profile
  layouts at both viewports. No horizontal overflow or browser errors.
  `test-results/oct13-catalogue/report.json`.
- Two browser identities completed all five mode flows with matching saved
  results and history. Cryptworks Flag Delivery ended through an actual delivery
  [1,0]; other short flows were host-ended. Survival recorded two humans and six
  enemies during its brief flow. `test-results/oct13-final-modes.json`.

## Resource checks and investigated failure

Docker Desktop's Linux engine was unavailable in this local environment. The
production source was instead run in a Linux user service with verified cgroup
limits: `MemoryMax=268435456` and `CPUQuotaPerSecUSec=1s`. Node retained its
160 MB heap cap. This is a bounded native-process test, not a container soak.

The initial 300-second unconstrained eight-player desert probe failed: all eight
connections closed with code 1008 after its first natural rematch. Its original
harness did not record the close reason and continued sampling an empty server.
Consequently, its low resource readings do not count as a passing load result.
The harness now records close reasons and fails promptly on a lost connection.
Follow-up direct tests passed: five rapid rounds in 45 seconds and two rounds
across a natural timer/rematch in 155 seconds. The original close reason remains
unknown. The later latency-start failure was traced to a fixed readiness pause;
the harness now awaits the server's all-ready state. Logs also showed a backward
wall-clock adjustment. Proxy scheduling, WebSocket rate limits and heartbeat RTT
now use monotonic time, with three focused regression tests. This hardens a
reproducible timing weakness without claiming it proves the first close's cause.

A 60-second bounded palace survival run reached **four humans plus eight active
enemies**, saved its result, and reported no failures. Peak sampled process RSS
was 129 MB; maximum sampled simulation p95 was 2.37 ms. No cgroup OOM event or
service restart occurred. `test-results/oct13-cgroup-palace-survival.json`.

The current native Intel Arc 140T / Chrome 154 sample measured **60.0 FPS desktop**
and **60.1 FPS in the phone viewport**. SwiftShader repeated at about **21 FPS
desktop and 43–46 FPS phone viewport**, below the earlier sample and the target;
the cause is unproven. These are ten-second practice samples.

Current render measurements and their software/native distinction are in
[RENDERING_EVIDENCE.md](RENDERING_EVIDENCE.md). A short probe does not certify
30-minute stability, worst-case graphics, every weapon combination, or phones.

The final bounded desert run passed **180 seconds with eight players**, a
100 ms round-trip proxy and +/-15 ms jitter. Two matches completed and saved,
including a natural timer and rematch. Maximum sampled process RSS was **137 MB**;
maximum sampled simulation p95 was **6.49 ms**, with the last sample at 1.69 ms.
Measured ping p95 was 133.3 ms and input-acknowledgement frame age p95 was 133.3 ms.
There were no disconnects, failed assertions, OOM events or service restarts.
Cgroup peak charged memory was 84,725,760 bytes; this differs from process RSS
because shared-page accounting differs. See
`test-results/oct13-cgroup-desert-100ms-final.json`. An earlier retest was
intentionally interrupted to restart with the fix and records code 1012; it is
not counted as a passing run.

These short checks do not complete the planned 30-minute production-container
soak or the full latency matrix for this revision. One active room remains the
production limit. Two-room capacity is not enabled by these results.

## Release

The implementation is committed in `0790c1b`; acceptance follow-up `777848f`
was pushed to the existing public main branch. [Workflow 38309016324](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/actions/runs/38309016324)
passed the production Docker build, all 234 checks, process evidence and secret
scans, then deployed successfully. The running Fly machine remained one shared
CPU / 256 MB in Sydney. The full updated README is served at /readme/.

Live verification on https://comp4020-final-adithya-rama.fly.dev/:

- All six arena choices were accepted by the server; 23 armory cards and profile
  screens fit both 1920x1080 and 390x844. No browser errors. Rooms were left after
  checking; `test-results/oct13-live-catalogue/report.json`.
- All 16 audio responses returned HTTP 200 and matched the local byte counts and
  SHA-256 hashes. All decoded to non-silent PCM in Chromium. Credits returned
  HTTP 200 as text and matched the local file. This is asset/playback validation,
  not listening feedback; `test-results/oct13-live-audio/report.json`.
- FFA, TDM and actual own-flag delivery passed with matching saved results for
  desktop and phone identities. The first survival attempt then lost both
  browser heartbeats; the server disconnected them and saved the abandoned
  match. No storage failure was logged. A shared host/browser/network pause is
  plausible but unproven. This failed attempt is retained in
  `test-results/oct13-live-modes.json` and the server log.
- Fresh survival and training runs both passed, including identical results,
  saved indicators and host history. Survival recorded two humans and six
  enemies. Together, the two runs establish successful live flows for all five
  modes without claiming the first full run passed.
  `test-results/oct13-live-modes-retry.json`.
- Read-only verification restored the existing acceptance guest's exact profile,
  preferences, aggregates, single saved history entry and match details after
  deployment. Match detail SHA-256 remained
  `43c2db246e749f66f281c76f3cc2a094ee17733b3378de2bd47940d070bdfa5e`.
  `test-results/live-persistence-verify-oct13-redeploy.json`.
- After the checks, the public health endpoint reported no active rooms, an empty
  database queue and the unchanged one-room limit. The test clients were closed.

The original crit-8 commit remains `e6b4df425c06d822c13578559610160be6bfe4f7`.
No /ship, retag or visibility change was performed. Human evidence and the longer
resource acceptance below remain separate from this successful deployment.

## Remaining human evidence

Returning-player/newcomer playtests, physical-phone performance, perceived
balance and auditory quality remain unmeasured. Exact historic v4 parity is not
claimed. Adithya approved similar reusable assets; the current sounds are
credited replacement recordings plus authored effects. Their closeness to the
reference has not been independently judged by a listener.
