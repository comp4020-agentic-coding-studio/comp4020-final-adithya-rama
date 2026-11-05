# Jet Skirmish

[Play Jet Skirmish](https://comp4020-final-adithya-rama.fly.dev/).
I made this game for a small group of friends who want to play together,
compete, and have a reason to come back for another round.

## Why I wanted to build it

I first imagined a 3D shooter like the games I already knew. Then I remembered
playing Mini Militia when I was younger. Its flight and small arenas stayed
with me, but I also remembered things I wanted to change. I chose 2D so I could
concentrate on movement, readable combat and teamwork. The
[Classic developers' account](https://groups.google.com/g/mini-militia-classic-alpha-force/c/q04io0qi72c)
and [reference research](docs/RESEARCH_MINI_MILITIA_2026_10_14.md) helped ground
that memory. This is my adaptation, with authored art and rules, rather than a
claim to reproduce every historical detail.

Robin Sloan's [home-cooked software](https://www.robinsloan.com/notes/home-cooked-app/)
gives me a useful way to judge its scale: something can matter to the people
using it without needing a huge audience. I don't need an account system,
paid unlocks or a first-person world for that. I do need a match people can
enter and understand without me standing beside them.

## What good means here

My main idea is that another player should change what I decide to do.
In Flag Delivery, each team carries its own flag into the opposite goal.
A dropped flag stays available for teammates to recover, with no return timer;
leaving the map returns it home. That creates choices about escorting,
intercepting and recovering, beyond simply chasing the next kill.

The [MDA framework](https://www.cs.northwestern.edu/~hunicke/MDA.pdf) connects
rules to the behaviour and experience they create. I use that distinction here:
a working flag counter is a checkable rule; teammates choosing to protect a
carrier is the experience I want. More weapons alone would not establish that.
They need clear roles, readable damage and controls that let players act on
their decisions. Movement must not unexpectedly turn their aim. A shield's
visible direction must explain what it protects.

## What I can check, and what people judge

I enforce shared outcomes on the server: clients request actions, while the
server decides hits, inventory and scores. Only hosts change room rules.
Cosmetics give no combat advantage. A result is labelled saved only after the
database confirms it. Completed history survives restarts; unfinished rounds
are marked interrupted. Browser cookies restore a guest's identity, so clearing
site data loses access to that pilot.

These promises are mapped to [agent rules](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/CLAUDE.md)
and [checks](docs/QUALITY_CONTRACT.md). Flight feel, readable artwork and enjoyment
still need people. During crits I saw peers struggle to acquire and switch
weapons, defend from above and understand rocket damage. Their reactions changed
my priorities; the [playtest record](docs/PLAYTEST.md) connects observations to
corrections. I have not measured learning time or long-term enjoyment;
[test records](docs/CHARACTER_EFFECTS_2026_10_28.md) establish narrower behaviours.

## Start playing

Open the game, choose a name in your profile, then practise or create a room.
Share its invitation link; choose teams, mark ready and let the host start.
Rooms support eight fighters; this small server runs one live round at a time.
Separate Chrome profiles create separate pilots. A/D moves, W jumps, Space
flies, mouse aims/fires, E picks up equipment and 1/2/3 or Tab switches it.
Touch controls and keyboard aiming are available. The
[controls guide](docs/DEVELOPMENT.md) explains these, preferences and accessibility
options. Return in the same browser to find your match history.
