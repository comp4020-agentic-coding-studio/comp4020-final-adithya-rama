# Jet Skirmish

A browser arena shooter for a handful of friends: run through tunnels, fly over
cover, switch weapons, and bring your own team's flag into the opposing goal.
Classic Mini Militia v4 is the reference for the feel; Jet Skirmish uses original
maps, characters, visual effects and branding, with credited CC0 audio. All equipment is available from the start.

**[Play Jet Skirmish](https://comp4020-final-adithya-rama.fly.dev/)**

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

Familiarity means fluid directional flight, meaningful fuel management, three
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

Players should also recognize their own pilot. **Customize pilot** offers saved
outfits, body styles, hair, facial hair, eyewear, headgear and callsigns; cosmetics
never change combat stats. **Gentle aim assist** is enabled by default and can be
disabled in the profile or field menu. It makes a small correction on near misses
against visible enemies, without locking on or firing automatically. A separate
dotted sight guide helps show gun direction. The [pilot release record](docs/PILOT_RELEASE_2026_10_21.md)
documents the reference research, limits and tests.

Persistence is part of the promise. A result says “saved” only after storage
confirms it. Returning in the same browser restores the pilot and history.
Clearing browser data creates a new identity. A server restart interrupts live
rounds and preserves their latest checkpoint; it does not pretend they finished.

Good also means being able to explain what was tested and what changed. Automated
checks can establish flag ownership and durable results. They cannot establish
whether flight feels right or a match is fun. Adithya reports that watching other
people play and noting their difficulties has guided improvements. A structured
returning-player/newcomer session using the [playtest record](docs/PLAYTEST.md)
still needs its own observations; that specific acceptance gate is not claimed.

The [October revision](docs/REVISION_2026_10_10.md) responds to Adithya's review:
the maps needed illustrated jungle cliffs, snowy shelters and stronger combat
feedback; the start screen and lobby needed clear choices and readiness. Good
now also means that a keyboard-only player can aim, fire, reload and switch
without fighting the controls, and that map art communicates real cover and
passable routes.

The [October 13 revision](docs/REVISION_2026_10_13.md) makes these criteria more
specific: recognize a gun from its silhouette and sound, understand the reach
tradeoff, see why a shield blocks a shot, and distinguish arenas by routes and
architecture. Recorded firearm and hurt/death clips replace generic beeps;
[their credits](/audio/CREDITS.md) distinguish them from Mini Militia's own audio.

The [October 14 research](docs/RESEARCH_MINI_MILITIA_2026_10_14.md) separates v4,
current Classic guides and our PC adaptations. The resulting
[Classic PC decision](docs/decisions/0004-classic-pc-gameplay.md) makes physical
crouching, usable weapon views and real concealment explicit. Good means that a
visible passage fits the player's body, a long-range weapon has an appropriate
view, and a hidden opponent is hidden from both the client and the bots. The six
new reference layouts are Outpost, High Tower, Ice Box, Pyramid, Lunarcy and
Catacombs. Their geometry and art are authored reconstructions, not extracted
original assets or a claim of exact historical collision parity.

For Crit 10, good also means being able to explain a shared match from the
server logs: distinguish pilots even when names match, describe accepted
actions and refusals, and identify the actor in a kill or flag delivery.
[The access decision](docs/decisions/0005-who-may-see-and-change-what.md)
records browser identity, host controls, personal history and visibility.
[The rehearsal guide](docs/CRIT_10_REHEARSAL.md) starts from the public URL alone.

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
W to jump and Space to fly. Aim/fire with the mouse, or hold Numpad 2/4/6/8
for directional fire (combine keys for diagonals). Movement and flight are
independent of aiming: move left while firing right, and keep your last aim
after releasing the numpad or touch aim stick. Mouse aiming follows the cursor.
Use 1/2/3 to select carried weapons, Tab to cycle and R to reload early. Empty
magazines reload automatically; a held directional trigger resumes afterward.
B shows the scoreboard. Touch uses two sticks, three slots and action buttons.
S crouches and crawls; Shift+S deliberately descends through marked one-way
platforms. Solid floors remain solid. Right click or Z cycles saved per-weapon
scope levels. The touch menu can rearrange, resize and fade the controls.

The camera follows your pilot, including beyond the terrain edges. Turning or
aiming in place does not pan the view. There is a finite flight area extending
1,000 world units beyond each edge. On normal-gravity maps, an unpowered fall
below the terrain gets one second of accumulated grace, then loses 5 health
every quarter-second. Working thrust pauses that damage; returning above the
bottom edge resets the grace period. Holding flight with an empty or disabled
pack does not protect you. Lunarcy has no gravity-driven fall damage. Flags
still return home on leaving the original map rectangle.

The smaller, translucent inventory keeps the arena visible behind it. Hosts
can toggle **Random spawns** in Advanced movement & combat: it is on by default
and chooses varied similarly safe authored positions, avoiding the last spot
when a safe alternative exists. Turning it off prioritizes the previous safety
scoring policy. Neither option guarantees immunity from camping; spawn
protection and hazard checks still apply.

Lunarcy is a special zero-gravity arena: A/D thrust sideways, W/Space upward,
and unsupported S downward. Releasing controls coasts; opposite thrust brakes.
Boost is unlimited there, while EMP still disables powered thrust. Fully covered
grounded crouching can conceal a pilot in bushes; firing or carrying a flag
reveals them. Spectators have an explicit all-player observer view.

Nameplates identify **YOU** and **ALLY** in green and **ENEMY** in red, with
matching health bars. Names keep a readable size when zooming out and separate
when nearby pilots overlap. Spectators see Ember/Tide team labels instead.
These markers do not reveal concealed enemies.

Practice starts with forgiving Easy bots; Normal and Hard offer faster reactions
and more accurate bursts. Frag, flashbang and poison smoke are the standard
throwables. Poison damages everyone in the cloud, including its thrower and
teammates, even with friendly fire off. Its swirling green smoke, bubbles and
skull mark the danger area. Spawn protection and solid cover still apply.
The M93BA deals 60 body damage and 120 on an exposed standing head: two body
hits or one headshot at standard settings. Room multipliers and crouch cover
still apply. The M14 is a separate marksman rifle. Aim the shield in any
direction, including above your head: its physical plate stops bullets and
reduces covered blast damage, but leaves exposed angles vulnerable. A direct
rocket defeats it; nearby explosions weaken with distance and intervening
cover. Frags are lethal at close range. Saw discs ricochet from terrain and
shields, can cut their shooter on the return, and burst at their travel limit.
Start with four grenades and automatically collect nearby grenades
up to six; T changes type and G throws. F pairs compatible small guns. A shield
pairs with a machete; switching to a firearm drops the shield. After a death,
the camera follows your attacker until respawn. Health slowly recovers after six seconds without combat. Your pilot,
preferences and history live in the profile panel. Customize your pilot with visual tiles and a large animated preview, including hairstyle, brows, outfit and eyewear. In a room, choose a team and
mark yourself ready; the host can start once everyone is ready. Changed lobby
rules clear readiness so the squad can review them. Practice includes movement,
equipment and own-flag tasks. Survival restores the surviving squad and revives
fallen teammates when the next wave starts.

See [development and controls](docs/DEVELOPMENT.md), the
[implementation plan](docs/IMPLEMENTATION_PLAN.md), and [process account](PROCESS.md).
