# Jet Skirmish

A browser arena shooter for a handful of friends: run through tunnels, fly over
cover, switch weapons, and bring your own team's flag into the opposing goal.
Classic Mini Militia v4 is the reference for the feel; Jet Skirmish uses original
maps, characters, effects and branding. All equipment is available from the start.

**Development build.** The [feature checklist](docs/FEATURES.md) distinguishes
implementation, local tests and live verification. The [validation record](docs/VALIDATION.md)
records measured results and outstanding acceptance work. Balance and enjoyment
still need human playtesting.

## What good means

These criteria translate Adithya's stated aims into things a player can judge.
The intended audience includes returning Mini Militia players, newcomers, and a
small group of friends who want to get into a match together. The first success
is simple: a stranger can join, understand movement and flight, finish a round,
and return to find their result. Joining should not require an account or an
explanation from the developer.

Familiarity means fluid directional flight, meaningful fuel management, two
weapon slots, and clear differences between weapons. It does not mean claiming
that authored weapon values reproduce the original game's balance. The arsenal
should create different decisions: a close-range shotgun, a precision rifle and
an explosive launcher should change how someone moves through a map.

Flag Delivery is the central design choice. Each team carries **its own flag**
into the opposing goal. Only one flag per team can be in play. A dropped flag
stays where it lands until a teammate recovers it; only leaving the playable
world returns it home. This should make escorts, interceptions and recoveries
matter throughout the round. Opponents stop a delivery through combat. Both
teams can deliver simultaneously.

Fairness means both browsers agree on damage, ammunition and scoring. A server
decides these outcomes. Deaths resolve before deliveries, and simultaneous
deliveries are considered together. Results explain assists and MVP rather than
hiding the ranking rule. Readable team names and shapes support the colours.
Desktop is the primary experience, but touch players need working movement,
aiming and actions, with menus that fit a narrow screen.

Persistence is part of the promise. A result says “saved” only after storage
confirms it. Returning in the same browser restores the pilot and history.
Clearing browser data creates a new identity. A server restart interrupts live
rounds and preserves their latest checkpoint; it does not pretend they finished.

Good also means being able to explain what was tested and what changed. Automated
checks can establish flag ownership and durable results. They cannot establish
whether flight feels right or a match is fun. A returning player and a newcomer
will be observed using the [playtest record](docs/PLAYTEST.md); no such experience
is claimed before it happens.

## What informed these choices

Adithya's memories of the older game and explicit own-flag rules establish the
gameplay direction. The [developers' Classic v4 discussion](https://groups.google.com/g/mini-militia-classic-alpha-force/c/q04io0qi72c)
is a historical reference, not recovered balance data. The
[course brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
asks what makes this particular app good. Robin Sloan's
[“An app can be a home-cooked meal”](https://www.robinsloan.com/notes/home-cooked-app/),
read during agent-assisted development, supports judging a small app by its value
to the people using it rather than its audience size.

## Play and build

Choose **Quick play**, create a room, or practise against bots. Use A/D to move,
W to jump, Space to fly and the mouse to aim/fire. The controls menu lists and
remaps actions; touch uses two sticks and action buttons.

See [development and controls](docs/DEVELOPMENT.md), the
[implementation plan](docs/IMPLEMENTATION_PLAN.md), and [process account](PROCESS.md).
