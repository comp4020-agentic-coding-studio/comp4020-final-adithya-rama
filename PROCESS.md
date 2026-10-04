# Process overview

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
Current performance and live results are kept in [VALIDATION.md](docs/VALIDATION.md).

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
