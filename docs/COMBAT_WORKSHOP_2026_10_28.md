# Directional combat and visual pilot workshop — 28 October 2026

This revision follows Adithya's latest play feedback. It supersedes the 21 October
one-shot-body sniper tuning. [Research and source limits](COMBAT_REFERENCE_2026_10_28.md)
distinguish original-game reference behavior from this game's authored rules.

## Chosen behavior

- A finite shield plate follows aim through 360 degrees. Rendering, current
  collision and lag-compensated history use the same oriented geometry. Aim it
  upward to cover the head; a shot that reaches exposed flesh first still hits.
  Holding the shield does not grant all-direction immunity. Knife pairing and
  dropping the shield when selecting a firearm remain unchanged.
- M93BA: 60 body / 120 exposed standing-head damage, two body hits or one
  headshot against ordinary 100 HP. Existing crouch cover, spawn protection and
  health/damage multipliers remain. No range attenuation inside its finite reach.
- SMAW: 160 direct impact damage, including contact with a shield. This kills
  standard-health targets even while crouching. The direct victim is damaged
  once; other actors receive independently calculated splash within 170 units.
- Frag: 170 peak damage, 155-unit radius. RG6: 140 / 150. Blast exposure samples
  head, torso and legs with weights 25/50/25%, allowing partial terrain cover.
  The inner 18% of the radius has full damage, then falloff reaches zero at the
  perimeter. Shield-covered samples receive 35% of normal blast damage. Grounded
  crouch retains its 0.65 multiplier. These are authored balance choices.
- Self damage, room friendly-fire rules and spawn protection remain explicit;
  explosive splash does not silently enable team damage. Poison continues to
  harm everyone. Immune contacts do not delay regeneration or apply knockback.
- Saw discs use a shared 10-unit visible/collision radius, swept surface normals
  and residual frame time after rebounds. They preserve speed, can cut their
  shooter after a bounce, pierce each actor once, and burst after four contacts
  or the existing finite lifetime/range. No historical five-second parity claimed.
- Rocket kills emit impact direction for bounded original head, helmet, torso,
  arm, leg and boot fragments. Flame plumes follow actual collision-limited fire;
  spinning saw teeth and trails show rebound motion. Hide blood removes organic
  fragments; Reduce screen shake now controls only camera movement. Low flash
  dims these effects as well as using dark flashbang obscuration.
- The pilot creator uses visual radio tiles and category tabs with a large
  animated preview on the right, stacked above choices on phones. Five eyebrow
  styles persist and render in matches. Idle/Flight previews honor reduced motion;
  save failures retain the draft. Old avatars receive natural brows without losing
  existing choices or identity.
- Protocol 5 requires old clients to reload so outdated shield graphics cannot
  misrepresent the new collision model. Results record classic-pc-2026-10-28.

## Verification

Local unit, server, actual-browser and deployment evidence are recorded below
as checks finish. Test databases are isolated. No personal reflections or course
cutoff tags are changed, and no human UAT is invented.

Initial local evidence: all directional combat regressions and the visual creator
checks passed. Production-browser practice rounds and sniper/poison acceptance
passed at 1920×1080 and 390×844. The first effects harness attempt exposed a phone
selector error (hidden desktop menu); this was corrected before the final pass.

Remaining human evidence: perceived balance, resemblance, animation preference,
physical phone performance and a returning player's acceptance. This revision
has not rerun a 30-minute 256 MB production-container soak.

## Local acceptance completed

- Production build and `APP_URL=http://localhost:8130 pnpm check`: **482 unit +
  40 server/spec checks passed**. This includes 47 new directional-combat cases,
  creator/accessibility checks, bounded effects, and first-frame aiming.
- `scripts/browser-creator.ts`: all visual choices, eyebrows, reload persistence,
  failed-save recovery and reduced motion at both marking viewports.
- `scripts/browser-directional-combat.ts`: two independent clients agreed on
  frontal/overhead shield blocking, 60 body damage, and a lethal uncovered head
  hit from full health; the diagonal and overhead rendered plate were inspected.
- `scripts/browser-poison-sniper.ts`: two body shots, correct ammo and universal
  poison damage through actual keyboard/touch UI in both viewports.
- `scripts/browser-combat-effects.ts`: actual rocket kills, flame damage, saw
  launch and accessibility controls in both viewports. Rocket breakup
  produced 19 parts, effects peaked at 59 desktop / 57 phone (cap 180), no
  browser errors. Screenshots inspected; this is not subjective human approval.
- A real phone test exposed stale aim on the first touch-fired rocket. Sampling
  aim and fire together before sending input fixed it; the browser now asserts
  the direction of the first actual authoritative rocket event. Mouse/numpad
  first-frame cases have deterministic regressions too.
- 60-second, eight-client localhost regression with 100 ms bidirectional latency
  and 20 ms jitter: one completed saved match, no failures, max RSS 143 MB,
  maximum sampled simulation p95 2.105 ms, measured ping p95 143.2 ms. This is a
  short local regression, not the 30-minute 256 MB production-container gate.
- `pnpm check:evidence` passed against real history; `git diff --check` clean.

Reports and screenshots are under ignored `test-results/`, with reproducible
scripts committed. Publication/live verification is separate and recorded next.

Final production-browser practice and two-profile pilot acceptance also passed: startup recovery, all 16 recorded sounds, full cosmetic rosters, real loading stages, saved settings with failure rollback, and committed results in both histories.

## Published and verified on Fly

Gameplay commit [`2a4b400`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/2a4b40099f5a4fc5d00dfe6254fcd6c6f5dbbffb)
passed [workflow 40548372485](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/actions/runs/40548372485),
including production-container checks, secret scans and normal Fly deployment.
The live site served `index-BSDSEi7w.js` and returned healthy with no active round
before private acceptance began.

Live browser acceptance on 28 October (AEDT):

- Visual creator at desktop and phone: every option selectable, full saved
  appearance/brows survive reload, save-error recovery and reduced motion pass.
- Independent clients agree on shield blocking from the front and overhead,
  60-damage exposed body hit and lethal uncovered headshot from 100 HP.
  Diagonal and overhead plate screenshots confirm the rendered orientation.
- Actual desktop and touch combat rounds verify rocket kills with 19 body/equipment
  fragments, damaging flame streams, saw launch and low-flash/hidden-blood options.
  Peak cosmetic effects 57 in each viewport, below the 180 cap; no browser errors.
- Read-only verification of the original acceptance guest passes after deployment:
  identity, preferences and aggregates retained with the natural-brow default;
  one unchanged history row; exact saved match digest
  `43c2db246e749f66f281c76f3cc2a094ee17733b3378de2bd47940d070bdfa5e`.
  A pre-deploy run using the new schema initially failed because the old live
  profile did not yet include eyebrows; a read-only old-schema comparison
  confirmed that was the sole difference. The private baseline was never rewritten.

Live reports: `test-results/creator-combat-live/`,
`test-results/directional-combat-live/`, `test-results/combat-effects-live/`.
These are automated live checks, separate from human balance acceptance.

The live two-profile pilot regression also passed at 04:17 AEDT: both complete
cosmetic rosters agreed, all sixteen recorded sound previews loaded, real loading
stages completed, failed preference writes rolled back visibly, and both players
retained their committed result and settings on returning. Report:
`test-results/pilots-combat-live/report.json`. All private acceptance rooms were
left after their results saved.
