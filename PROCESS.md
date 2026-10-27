# Process overview

## October 21: player identity and aiming release pass

Adithya reported UAT difficulty aiming, requested complete character choices and
a loading screen, then asked for attention to small launch details. Codex
consulted the supplied M93BA wiki, the Classic settings/character guides and
Garena's official aim-mode explanation. The sources informed a bounded near-miss
assist and visual sight dots; they did not justify copying all historical values
or claiming to reproduce Free Fire's targeting. The requested sniper body damage
remains deliberate project tuning.

The work extended the existing profile and roster contract through validation,
persistence, menus and in-game drawing. Two independent browser contexts checked
saved appearances and preferences. Deliberately failing a settings request
revealed that the old save helper swallowed its error; that was corrected so the
new aim controls visibly restore the saved setting. Loading checks delay real
snapshots rather than fake success. Startup retry, gun sound previews, lobby
portraits, accurate map counts and touch pickup wording address small omissions.
The [release record](docs/PILOT_RELEASE_2026_10_21.md) holds the research,
verification commands and remaining human feel/balance questions. No new
personal reflection or human playtest outcome was invented.

Implementation commit `e78a1fb` passed 425 unit and 40 server/spec checks,
desktop/phone practice, then the normal hosted checks/deployment. The live pilot
acceptance passed in two independent browser contexts at 04:46 AEDT. Read-only
verification retained the pre-existing guest and exact saved match digest while
recognizing the documented new cosmetic defaults. This is automated release
evidence; Adithya's next human play session must judge assistance strength.

This account separates Adithya's direction from the agents' implementation and
verification. It describes work actually carried out; the validation record is
the source for current deployment and acceptance status.

## Direction before implementation

The course brief asks for a working app and an argued definition of good.
Adithya chose a browser version of the jetpack arena combat remembered from older
Mini Militia. The early ambition was an enhanced PC edition. The discussion then
made the boundaries concrete: online browser play, no offline LAN, eight players
per PvP room, a broad arsenal, configurable rooms, and persistent results.
Original branding, art and authored map geometry distinguish Jet Skirmish from
a claim to reproduce the original game's assets or exact balance.

The most important direction was the flag rule. Adithya remembered a mode in
which a team carries its own flag into the opposing goal. There can be only one
flag per team in play, and scoring makes the next one available at home.
Clarification fixed the dropped-flag behavior: it remains where it lands until
a teammate recovers it, with only an out-of-bounds return. This is easy for an
agent to replace accidentally with conventional capture-the-enemy-flag or an
automatic return timer. The written plan and tests explicitly prevent that.

The agreed scope and agent rules were saved before the initial build in
[`c9a6d0b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/c9a6d0b).
The plan retains every weapon, mode and setting even while a smaller first slice
is being built. Only the named map reductions were authorized; all four maps
were ultimately implemented.

## Foundation and handoff

Claude built P0–P2 in
[`6f60466`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/6f60466):
a shared simulation, a Pixi browser client, HTTP/WebSocket rooms, SQLite
persistence, four guns, fragmentation grenades, bots, and saved matches.
[`f868182`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/f868182)
recorded the handoff and process account. These three stages landed together
because the first runnable match required their connected parts. The history
records that honestly rather than constructing a retrospective series of
smaller commits.

The handoff described local checks and an unavailable deployment token. Codex
checked the repository and environment again rather than treating the handoff as
current truth. The token was now available through the configured mechanism,
without being printed. The unchanged starter assumed in the original plan had
also become a working P2 implementation. Preserving that work was the starting
point for integration.

The user then explicitly authorized implementing the complete plan. Its original
Claude/Codex ownership table became a coordination guide, rather than a reason
to stop after another partial handoff. One integrator directed separate agents
with non-overlapping ownership of shared game rules, server/storage, and
client/maps. Interfaces were coordinated before changes were combined.

## Architecture and trade-offs

The [first decision record](docs/decisions/0001-stack.md) explains the prescribed
stack. TypeScript carries the shared data and simulation. Pixi draws; it does not
decide hits or scoring. The browser predicts its own movement with the same
movement function used by the server. The server advances the authoritative
world at a fixed rate and bounds how many input frames each player can consume,
so extra messages cannot buy speed.

SQLite runs through one worker because the Node API is synchronous. Match
creation is recorded before play. Coalesced five-second checkpoints limit write
pressure, and final results and aggregates share an idempotent transaction.
A restart preserves completed history and marks unfinished rounds interrupted,
rather than implying that a partial checkpoint is a completed win.

The hosting allowance remains one shared CPU, 256 MB and one persistent volume.
The default is one active room. Two-room admission is an explicit acceptance
override; short successful probes do not establish that higher capacity. The
[second decision record](docs/decisions/0002-multiplayer-contract.md) explains
the multiplayer boundaries and subsequent corrections.

## Grounding, review and correction

The shared-core/server milestone was committed as
[`225a493`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/225a493).
It includes the full arsenal, own-flag state machine, survival waves and durable
room lifecycle, with regression tests. The integrator read the implementation
independently and sent concrete failure cases back to the owning agents.

Review found that survival bots could select other raiders as targets. The
targeting rule was corrected and tested with a closer ally and a farther human.
The training range could initially be selected for Flag Delivery even though
it had no goals. Settings now choose a compatible arena. A route test at double
gravity, half speed and disabled flight found an Outpost obstruction; authored
stairs corrected the route. All four arenas then passed the own-flag route test.

Reconnect review found a subtler problem: hiding a disconnected body after ten
seconds could make its return look like a fresh spawn, restoring ammunition and
health. The implementation now distinguishes a reserved hidden body from an
actual death. A real 10.5-second disconnect test verifies retained state.
Admission review also found that an asynchronous database write needed to
reserve the active-room slot before another start request could arrive.

Visual inspection added evidence that functional assertions missed. Phone
practice could finish successfully while its ground-level pilot was hidden
behind touch buttons. The camera now reserves the controls' actual screen area.
The corrected screenshots were inspected at 390×844. This correction matters
because “touch controls exist” is weaker than “a player can see and use them.”

The responsive client and original visual/audio work were committed in
[`71ccc7c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/71ccc7c).
A final input audit reproduced held touch movement returning after a blur. Clearing
both the shared input and its touch source fixed it; five DOM regressions cover
that boundary. Performance review also separated renderer cost from simulation
cost: native Intel graphics submitted about 60 frames per second, while WSL's
software graphics slowed at full antialiased resolution. A measured software-only
pixel budget improved that fallback while preserving hardware rendering quality.

## Evidence and personal learning

The integrated local check passed 96 simulation tests, five touch-input tests and 32 running-app,
storage and room checks. The browser arsenal run used real keyboard input,
actual pickups, HUD observations and authoritative events for all equipment,
then verified 24 completed training sessions in history. Separate browser
identities agreed on match results, including an actual own-flag delivery.
Container tests checked restart, recreation against the same volume, partial
checkpoints, duplicate finalization and fabricated score/damage commands.
The release and reproducible acceptance tools were committed in
[`5d05174`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/5d05174).
The game was then deployed to the existing Fly app. Separate live browsers
completed all five mode flows; a dedicated saved result survived an explicit
restart, cold start and redeployment. Current measurements and limitations are
kept in [VALIDATION.md](docs/VALIDATION.md).

These checks do not establish fun or familiar feel. The returning-player and
newcomer playtest record remains unfilled until people actually participate.
The README credits material used during development without attributing an
agent's reading or experience to Adithya.

Adithya supplied the personal reflection directly: the breakthrough was using
agents deliberately, testing their output and correcting the process. The
preferred role is to think, brainstorm, define how the system should work and
direct capable agents toward that intention. [The Crit 8 reflection](reflections/crit-8.md)
edits those supplied words without inventing an experience. Defining quality
and reviewing evidence remain part of that role after the initial prompt.

## October revision: feedback changes the quality criteria

On 10 October, Adithya said the working maps and mechanics were not yet good
enough. He supplied jungle and snowy-fort screenshots, described keyboard-only
directional firing, three carried weapons, gradual recovery, easier bot levels,
flash and poison grenades, and asked for clearer start/profile/room screens.
Implementation is committed in
[`c61b96d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/c61b96d).
[The revision contract](docs/REVISION_2026_10_10.md) records that direction and
takes precedence over the older plan where they differ.

The integrator divided work into shared rules/server, map/rendering, and
input/UI, with explicit file ownership. Three-slot snapshots and input bits were
agreed before clients consumed them. Old two-slot saved presets normalize into
the new form. Aim-only arrow keys remain available alongside the requested
numpad aim-and-fire actions; saved custom bindings are preserved.

Independent browser checks observed server snapshots and combat events rather
than mutating game state. They established firing through an empty magazine and
reload, gradual recovery after real self-damage, flash exposure and expiry, and
poison-area damage. A short touch tap initially vanished between simulation
frames. Latching discrete actions until the next input sample fixed that
boundary, with regression coverage. Visual review also caught a lobby badge
inheriting a full-screen waiting layout and a weapon panel obscuring a pilot at
the floor edge; both were corrected.

Map review rejected four similar compositions with different scenery.
Crosscurrent became a coastal broken viaduct and Cryptworks gained enclosed
chambers, while the snow forts have actual collision openings. Route checks use
disabled flight, doubled gravity and halved speed; art previews are separately
labelled fixtures, not proof of multiplayer behavior.

This is technical and product feedback, not a fabricated human playtest.
Performance and release evidence for changed code are recorded separately from
the earlier release. The user's published crit-8 snapshot remains unchanged.

Rendering measurement caught a regression that screenshots did not: the new
illustrated scene ran at about 60 FPS on the measured Intel GPU but was slower
on SwiftShader. The same-build ten-second comparison improved software desktop
from 26.8 to 42.6 submitted FPS by caching static terrain/scenery and flattening
the software background into one moving layer, at unchanged 1280×720. Hardware
keeps its separate parallax layers. The phone viewport remained about 60 FPS.
This tradeoff preserves live actors, pickups, flags and effects; it does not
claim 60 FPS for software desktop or every machine.

Adithya explicitly approved publishing and deploying the October update. The
public workflow passed and deployed f518792. Independent live desktop/touch
sessions then passed the revised mechanics and all five modes, and the saved
acceptance profile/result remained unchanged after deployment. The original
crit-8 tag was preserved. [October validation](docs/OCTOBER_VALIDATION.md) records
this evidence separately from the earlier release and remaining human playtests.

## October 13: recognizable weapons and physical combat

Adithya's next review made the quality gap more specific: similar-looking guns,
indistinct sound, repetitive environments, shield handling, grenade collection
and the view after death. The [new contract](docs/REVISION_2026_10_13.md) records
those requests. Research distinguished developer announcements and screenshots
from a community table for a later Classic release. The shield-and-knife-only
rule is the user's chosen behavior; it is not presented as verified v4 parity.

Agents again worked with explicit ownership: shared combat and bots, authored
weapon/map art, and client feedback/camera behavior. The integrator implemented
range roles, sound playback, attribution and the armory presentation. Recorded
CC0 gunshots and hurt/death voices replace the earlier conventional-gun tones.
Adithya approved this alternate approach after confirming he had no original
asset pack. Sources, transformations and hashes accompany the shipped clips;
no Mini Militia sound extraction or developer contact was performed.

Review connected the shield's drawing to the exact collision panel, so exposed
head and rear shots have consistent geometry. Tests caught slot selection and
duplicate equipment pickup cases. Browser checks caught missing launcher shot
events, which would otherwise leave the launch audio silent. Visual review
rejected a first palace pass as too similar to floating platforms; arches,
recessed windows and masonry galleries made the environment more distinct.

The evidence separates unit checks, actual browser play, renderer fixtures and
resource measurements. In particular, successful audio decoding cannot establish
that a returning player likes the sound. A failed extended rematch probe is
recorded and investigated rather than counted as load-test success. Current
results and release status are in the [October 13 acceptance record](docs/REVISION_2026_10_13_VALIDATION.md).
The user's personal reflection and published crit-8 snapshot are preserved.

The extended network probe exposed a test setup error: a fixed pause was used
in place of waiting for every player's server-confirmed readiness. System logs
also showed the host wall clock moving backwards. Network scheduling and
connection rate/round-trip measurements were changed to monotonic time; stored
calendar timestamps retain their purpose. The first disconnect's precise cause
was not captured, so this is not described as a proven diagnosis of that event.
The improved harness records close reasons and stops immediately on a lost
connection. Both failures and subsequent results remain in the acceptance record.

The combat, audio, map and timing changes are committed in
[`0790c1b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/0790c1b).
The final local check passed 201 unit tests and 33 running-app spec tests.
An enforced one-CPU/256-MB process completed the eight-player delayed-network
rematch probe, and palace survival reached four humans plus eight active enemies.
These short runs are recorded separately from the planned container soak.

The normal public workflow deployed
[`777848f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/777848f).
Live checks confirmed all six map choices, the weapon catalogue and all recorded
audio files. Separate desktop and phone identities completed all five modes
across two runs. The first survival attempt missed both browser heartbeats and
became a saved abandoned match; a fresh survival/training run succeeded. That
failure is preserved in the report rather than silently replaced by the retry.
The existing acceptance guest's profile and match details survived deployment
unchanged. No human playtest or listening assessment is inferred from these checks.

## October 14: reference research before the next gameplay revision

Adithya asked for a broader review of Mini Militia, including the guides he
supplied, after identifying unsatisfactory weapon reach/view, crouching,
repetitive maps and missing hiding places. Implementation edits were stopped
before any game source changed. Three read-only work streams compared combat
rules, labelled map references and the current client/server behavior. The
integrator reviewed the wider controls, rooms, loadouts, progression and
supporting guides.

The [research ledger](docs/RESEARCH_MINI_MILITIA_2026_10_14.md) records sources,
access limits and concrete gaps. Most article text was available through the
search index; Chrome also opened the Maps catalogue, full-resolution references
and the incomplete Game Modes article. Developer announcements clarified that
CV4, original v4 and modern MMC settings are not interchangeable. Map labels
corrected the supplied tall image to Cliffhanger and provided the actual
Catacombs layout.

The [proposed implementation plan](docs/REVISION_2026_10_14_PLAN.md) keeps the
user's custom rules and working systems, targets six reference layouts, and
sets behavior, browser, performance and human-review gates. Independent review
added explicit space flag boundaries, recovery from narrow pockets, server-bound
killer-follow visibility, equivalent low-flash impairment, and reload behavior.
The code audit also found a concrete level-shot/crouch hitbox mismatch, alongside
the existing S-to-drop behavior and rocket-camera mismatch.

This is research and a proposal, not a gameplay release. The isolated geometry
probe and camera calculations are distinguished from full test-suite/browser
acceptance. No original v4 play session, audio resemblance assessment or human
playtest is invented. Crit 9 reflection and decision commits remain unchanged.

## October 14: implementation and corrections after the research

The subsequent instruction to implement turned the proposal into coordinated
work. One integrator owned the shared interfaces and release; separate agents
owned map/navigation work, combat/physics review, and art/touch rendering.
[ADR 0004](docs/decisions/0004-classic-pc-gameplay.md) resolves physical crouch
versus historical head interception and keeps Adithya's custom own-flag,
shield/knife, keyboard and Lunarcy rules explicit. No additional game modes,
economy or paid content were inferred from the reference research.

The first baseline passed 201 unit tests. Implementation added tests that exposed
blocked bot routes, an M4 burst cancelled by quick clicks, charge weapons that
Easy bots could not fire, and a cold navigation pause. Those failures changed
geometry/navigation, the burst state machine, bot timing and pre-match preparation.
Actual phone flight then revealed an equipment panel covering the pilot; the
camera now uses the clear band between HUD and controls. Spawn screenshots alone
had missed that problem.

The implementation is committed in
[`e05240a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/e05240a).
The final local source checkpoint passed typecheck and 334 unit tests. Running
server/browser, latency, constrained memory and native rendering evidence is
being recorded in [the acceptance record](docs/REVISION_2026_10_14_VALIDATION.md),
including failed first attempts and their explanations. The source and tests
changed together because shared protocol, movement prediction and rendering must
agree. The research commit remains a separate historical checkpoint.

No private session credential, original-game asset pack or personal reflection
was generated as evidence. Sixteen credited CC0 sound replacements remain the
approved alternative. Human judgements about resemblance and fun are still for
Adithya and actual players to supply; automated success is reported separately.

After Adithya enabled Docker, the actual production image passed 334 unit tests
and 35 server/storage checks. Two independent one-CPU/256-MB containers each ran
for thirty minutes on Catacombs: eight-player PvP and four-human Survival with
up to eight enemies. They saved 15/18 rounds with no failures or restarts,
maximum RSS 143/145 MB and highest sampled simulation p95 2.75/2.35 ms.
Survival used Easy bots without flight; this is bounded endurance evidence.
The separate native desktop run averaged 59.62 rendered FPS over ten minutes.
All thirty new-map/mode combinations passed the network matrix; the actual-app
browser exercised the new layouts and saved controls at both marking viewports.
The final arsenal run plus its focused shield retry are reported together,
without hiding the earlier snapshot-timing failures. Publication/live checks
follow this local checkpoint and are recorded separately.

The normal workflow published and deployed
[`d171901`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/d171901),
with build/spec/evidence/secret checks passing. The live image's Git SHA and client
bundle matched the tested release, on the unchanged one-CPU/256-MB Sydney machine.
The existing profile and match-detail digest survived deployment unchanged.
All six new maps then passed live desktop rounds. Adithya began playing during
the phone pass; the capacity guard rejected the test's Start, and the harness
reported a timeout. Logs established the cause. We left his round untouched and
retained that report. After he stopped, a focused phone retry passed all six maps,
saved preferences and staged rules. The subsequent independent desktop/phone
pass agreed on saved outcomes in all five modes, including a real 1–0 flag
delivery. The final documentation records those live observations separately
from local simulation coverage and still-unperformed human playtesting.

## October 21: Crit 10, user acceptance testing and observable corrections

Adithya supplied the Crit 10 brief and asked for the remaining identity,
permissions, logging and reflection gaps to be completed. He also described
camera panning on direction changes, losing sight of the pilot beyond terrain,
an obstructive inventory, and repeated spawn locations. Those concrete examples
became the acceptance criteria. His reflection account explains that observing
other people play, noting their issues and giving agents explicit visual and
behavioral references improved the work.

The starting commit `24753d1` already named many lifecycle events. Independent
review found gaps: duplicate display names were ambiguous in combat logs;
settings logs omitted what actually changed; a last-player flag drop could be
lost before the next simulation tick; and renaming a connected guest before
joining left the socket's profile stale. The follow-up fixes these paths and
tests actual room actions, HTTP/WebSocket ownership and simulation events.
ADR 0005 now accurately describes server visibility as foliage concealment,
not general line-of-sight fog, and documents the limits of killer-follow and
omniscient spectators.

The server/access/reflection checkpoint is
[`2c64cb3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/2c64cb3).
The camera, exterior physics, inventory and spawn implementation is
[`0ffc831`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/0ffc831).

Work was divided by file ownership: server access/logging, shared physics/spawn
rules, and client camera/HUD. The integrator reviewed the interfaces, wrote the
two-profile browser rehearsal, edited the supplied reflection, and integrated
documentation and release checks. A review caught another boundary mismatch:
projectiles needed to remain functional in the newly permitted exterior flight
area. Flag return bounds remain the original map rectangle.

The browser rehearsal uses the actual home-page profile, creation, joining,
readiness and rematch controls. It sends deliberately unauthorized host
commands through the guest's real connection, then uses ordinary movement,
melee and own-flag delivery to generate narratable server events. No injected
positions or fabricated kills stand in for gameplay. Both independent profiles
must agree on committed results and retain their own history.

The [Crit 10 validation record](docs/CRIT_10_VALIDATION.md) records local and
live outcomes separately. The [rehearsal guide](docs/CRIT_10_REHEARSAL.md) is for
the pod's actual log-only exercise; it does not claim that exercise has already
happened. The first-person reflection is an assisted edit of Adithya's supplied
experience, not an invented agent account. Previous reflections and crit tags
remain unchanged; `/ship` remains for Adithya to run.

The normal workflow published
[`2f5af60`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/2f5af60),
including successful production-container and secret checks. A live automated
two-profile rehearsal then produced actual named kill/delivery events, four
server refusals, identical committed outcomes and host transfer. Its Fly log
excerpt was checked against the browser's room and match IDs. The pre-existing
acceptance guest and exact saved match digest survived unchanged. These are
measured live results; they do not replace the pod's human log-only exercise.
Four further saved live rounds checked the camera, exterior flight and
terrestrial recovery at desktop and phone sizes, plus the inventory and
spawn-setting controls. The recorded limits distinguish settled centering
from intentional smoothing lag during fast flight.

Adithya then corrected the control contract: moving or flying in another
direction should not turn the gun. Removed the movement-to-aim fallback and
kept the last keyboard/touch aim when the aiming control is released. Mouse
aim remains cursor-based. Regression tests cover reversal, held directional
fire, releasing aim, focus cleanup and touch movement. A production-browser
check reads actual server snapshots and shot events after ordinary key presses.
Local verification passed 391 unit and 40 server/spec tests, plus desktop and
phone practice rounds. These checks establish the control behaviour; they
do not claim new human playtest feedback.

Adithya's next UAT finding was that names were hard to read and team allegiance
was unclear. The renderer now uses viewer-relative ally/enemy colours plus
explicit text markers, with screen-size nameplates. Screenshot review exposed
overlap at phone Far scope; the follow-up added label placement and a browser
non-overlap assertion. [The validation record](docs/NAMEPLATE_VALIDATION.md)
distinguishes local automated evidence from deployment and human acceptance.

Adithya then questioned sniper lethality and asked poison to hurt everyone.
Inspection found a 90-damage sniper body shot and a generic friendly-fire check
excluding teammates from poison. The revision changes those two rules, preserves
shield/protection/custom-room interactions, and updates spawn danger scoring.
Existing stance tests now use 200 HP so they still distinguish body damage
from head multipliers. An obsolete harmless-allied-gas spawn test now uses a
frag grenade, while new tests explicitly require allied poison to be dangerous.
The [combat follow-up record](docs/COMBAT_FOLLOWUP_VALIDATION.md) documents the
authored tuning, animation and local/live acceptance procedure.

## 28 October: combat corrections and a visual character workshop

Adithya corrected the previous sniper decision after playing: headshots should
be lethal, while body shots should need a follow-up. He also identified shield
coverage, weak explosions, saw rebounds and the dropdown creator as incomplete.
The integrator assigned separate reference/test, visual effects and creator work,
then reviewed their integration against shared authoritative collision and data.

The research distinguished the carried shield from Classic's crouch cover and
recorded version uncertainty. Partial blast shielding is our requested design,
not a recovered original formula. Review caught a visible/collision saw-radius
mismatch and an immune shield contact delaying regeneration; both were corrected
and covered by regressions. Tests that assumed one-shot-body snipers now exercise
headshots or two actual body hits rather than removing the original checks.

The creator is now a visual workshop with a large animated pilot and persisted
eyebrows. Browser verification checks real choices, failed saves, reloads and
reduced motion. Combat browser checks use normal inputs and independent guests;
no fabricated damage stands in for multiplayer evidence. See the
[revision record](docs/COMBAT_WORKSHOP_2026_10_28.md) for measured status and limits.

Phone acceptance additionally found a first-frame aiming defect: a touch gesture
could fire a rocket using the previous aim before the next render updated it.
The fix samples current aim and fire together before constructing the input
packet. Regression coverage includes touch, numpad and mouse, and the phone
browser now checks the first authoritative rocket's direction.
