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
Follow-up rematch and constrained results are recorded below when complete;
no unproven server fix is claimed.

A 60-second bounded palace survival run reached **four humans plus eight active
enemies**, saved its result, and reported no failures. Peak sampled process RSS
was 129 MB; maximum sampled simulation p95 was 2.37 ms. No cgroup OOM event or
service restart occurred. `test-results/oct13-cgroup-palace-survival.json`.

Current render measurements and their software/native distinction are in
[RENDERING_EVIDENCE.md](RENDERING_EVIDENCE.md). A short probe does not certify
30-minute stability, worst-case graphics, every weapon combination, or phones.

## Release

Publication and live verification are pending. The original crit-8 tag remains
unchanged; no /ship or retag is part of this revision.

## Remaining human evidence

Returning-player/newcomer playtests, physical-phone performance, perceived
balance and auditory quality remain unmeasured. Exact historic v4 parity is not
claimed. Adithya approved similar reusable assets; the current sounds are
credited replacement recordings plus authored effects. Their closeness to the
reference has not been independently judged by a listener.
