# October revision validation

Date: 10 October 2026 (Australia/Sydney). Implementation commit: c61b96d.
This record covers changed code; older release evidence is historical.

## Rules, server and browser

- Full check: 142 unit tests and 33 server/API/storage/course checks passed.
  The running-app portion used an isolated production build on port 8081.
- The revision browser harness passed ten groups of checks: numpad cardinal and
  diagonal aiming/firing, movement-facing, three-slot selection and Tab cycling,
  manual reload and 13 held-trigger shots across a 12-round magazine/reload,
  gradual health recovery (200 to 152 from frag damage, then 153 after the delay),
  flash exposure/expiry, poison damage, desktop/phone readiness and touch Slot 3,
  saved results, and gameplay rendering on all four arenas.
- Arsenal browser acceptance completed 29 saved training rounds with all 21
  firearms, machete, shield blocking, three-slot selection/dual/reload/drop/
  recovery, and all five throwable types. Grenade replenishment was checked
  after spending inventory. Optional EMP/mines were explicitly allowed in their
  rooms. Zero browser errors or failed cases.
- Eight preferences/lobby browser flows passed: profile persistence, custom
  remaps, three-slot presets, wrong-password rejection and correct joining,
  mute controls, spectating, staged settings/rematch, and private range invites.
- Fifteen geometry checks cover supported spawns/pickups, both flag routes on
  every arena with flight disabled/double gravity/half speed, and traversal
  through the four snow forts. Sixteen bot routes cover both teams on all four
  arenas with and without flight.
- The existing course browser harness passed desktop/phone Practice and saved
  history. All five modes passed in separate desktop and phone identities with
  identical saved results. Flag Delivery ended naturally at a 1–0 delivery limit;
  other smoke rounds were ended by their host.
- Type checking, production build and process-evidence checks passed.

Screenshots at 1920×1080 and 390×844 were inspected. Review found and corrected
short touch taps being lost between input samples, a stretched phone not-ready
badge, and a desktop loadout panel covering a ground-level pilot. The loadout
now sits above the arena and phone cards use the full panel width.

## Visual evidence

The actual renderer/map preview harness captured all four overviews and pilot/
effect closeups with no page errors. Closeup pilots are staged art fixtures;
they do not claim actual combat occurred. The revision browser screenshots use
real authoritative game sessions.

The final compositions are jungle cliffs, snowy log forts, connected cavern
chambers, and an asymmetric coastal viaduct. Rendered solid outlines follow the
collision rectangles; decorative vegetation, crates and rear walls do not
pretend to add collision.

## Performance and deployment

Current constrained-container, renderer and deployment results are recorded
below once measured. The previous release's thirty-minute two-room soaks do not
verify the October code. Admission remains one active room.

Human returning-player/newcomer testing remains outstanding. The user's supplied
feedback informed this revision, but these automated checks do not establish
fun, fairness, familiar feel or final bot difficulty.

### Production server budget

Two separate five-minute checks ran in the production image, one CPU, 256 MiB
memory with no swap allowance beyond that limit, and a disposable /data:

| Mode | Human clients | Peak active enemies | Peak process RSS | Largest observed rolling step p95 | Saved rounds |
|---|---:|---:|---:|---:|---:|
| FFA | 8 | 0 | 140 MB | 2.96 ms | 3 |
| Survival | 4 | 8 | 141 MB | 0.99 ms | 3 |

Both reported zero failures, zero queued database work in sampled health checks,
and no OOM kill. Each sampled 60 times. The same constrained container ran
sequentially; RSS settled near 137–139 MB. This is a bounded regression check,
not the planned thirty-minute soak, two-room certification, or proof of every
network condition. The one-active-room default remains.

Raw local records: test-results/oct10-pvp-1room.json and
test-results/oct10-survival-1room.json. Direct-localhost ping p95 was 2/3 ms;
those values are not internet latency claims.

### Rendering

On the Intel Core Ultra 9 285H / Intel Arc 140T Direct3D11 machine, isolated
native headless Chrome measured 60.1 submitted FPS at 1920×1080 and 60.0 at
390×844 with DPR 2, over ten seconds per case. Antialiasing and full hardware
resolution were preserved. The phone viewport used the desktop GPU; this is
not a physical-phone result or display latency measurement.

The first new-art software run fell to 24.7 FPS at the existing 1280×720 desktop
pixel budget. Rasterizing static scenery once and combining the software
background's relative parallax layers reduced drawing cost without reducing
resolution or omitting gameplay objects. The hardware path keeps independent
parallax layers. Final controlled software results are recorded in the rendering
follow-up below.

These samples use Practice with two active bots, not the maximum eight-player
visual workload. Process CPU cost and software GPU emulation are separate
bottlenecks. Raw records are under test-results/browser-performance-oct10-*.json.

### Release status

Local implementation and acceptance are complete for this revision's requested
changes. Deployment and post-deployment browser/persistence verification will be
recorded after the existing main-branch workflow completes.

### Rendering follow-up

The final same-build software comparison measured **26.8 FPS without static
caching and 42.6 FPS with it**, at unchanged 1280×720. Frame-interval p95 improved
from 41.6 to 26.5 ms. The phone viewport remained **60.0 FPS**, at 390×844 backing
pixels. Screenshots of the final path were inspected. The background's two
relative parallax motions are combined only for software rendering; live actors,
flags, pickups, projectiles and effects retain their independent behavior.
See [rendering method and follow-up](RENDERING_EVIDENCE.md).
