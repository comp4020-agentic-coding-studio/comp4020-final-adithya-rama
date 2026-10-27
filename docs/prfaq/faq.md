[Overview](README.md) · [Press release](press-release.md) · [Users](users.md) · [FAQ](faq.md) · [RICE](rice.md)

# Jet Skirmish FAQ

100 questions: 50 from customers, 30 from engineers and 20 from managers.
Answers describe the repository as of 28 October 2026. Where something is
implemented but unverified, or not done, the answer says so. Where older
documents disagree, the latest dated record wins.

---

## Customer FAQ (1–50)

### Getting started

**1. What is Jet Skirmish?**
A 2D browser arena shooter for up to eight players. You run, crouch, fly on a
jetpack, fight with three weapon slots and grenades, and in the main mode carry
your team's flag into the enemy goal.

**2. Do I need to download anything or make an account?**
No. Open the link and the game creates a guest pilot for you with a generated
name such as `Pilot-4F2A`. You can rename yourself straight away.

**3. Does it cost anything?**
No. There are no payments, ads or paid unlocks, and all equipment is available
from the start.

**4. Which devices does it work on?**
Desktop browsers with keyboard and mouse are the primary target. Phones get
on-screen touch controls and menus that fit a narrow screen. The touch layout
has only been tested in phone-sized emulation on a desktop, not on a physical
phone, so phone performance is not yet claimed.

**5. How do I play with my friends?**
Create a room and share its five-character code or invite link. Friends join
from the home screen, mark themselves ready, and the host starts the match.

**6. How many people can play together?**
Up to eight in a player-versus-player room, one to four in Survival, and one in
Training. Bots can fill empty slots.

**7. Can I play alone?**
Yes. Training pairs you with up to three bots and includes movement, equipment
and flag lessons. You can also fill a normal room with up to seven bots.

**8. Is this Mini Militia?**
No. Classic Mini Militia v4 is the reference for how flight and combat should
feel, but Jet Skirmish has original maps, characters, art and branding, and
uses credited free (CC0) sounds. Its weapon numbers are its own tuning, not the
original game's values.

### Controls and movement

**9. What are the basic desktop controls?**
A/D to move, W to jump, Space to fly toward your aim, S to crouch, and the
mouse to aim and fire. 1/2/3 select weapon slots, R reloads, E picks up,
X drops, G throws a grenade, V is melee, B shows the scoreboard and Escape
opens the menu.

**10. Can I play with only the keyboard?**
Yes. The numpad aims in eight directions and holds fire, with or without Num
Lock. Arrow keys plus J or Enter also aim and fire. Keyboard-only play is one of
the project's stated quality criteria.

**11. Can I change the key bindings?**
Yes. Every binding can be remapped, and your choices are saved with your
profile.

**12. How does flying work?**
Hold Space (or push the left touch stick up) to fly toward where you are
aiming. Flight uses fuel, which recharges faster on the ground than in the air.
Running out mid-air means falling.

**13. Can I move one way and shoot the other?**
Yes. Aiming is independent of movement, so you can retreat left while firing
right.

**14. What happens if I fly off the edge of the map?**
The flight area extends well beyond each map's edge. If you fall below the
terrain on a normal-gravity map without thrust, you get one second of grace and
then take steady damage until you fly back up.

**15. How do touch controls work?**
Two sticks: the left one moves, flies (up) and crouches (down), and the right
one aims and fires. Buttons cover weapon slots and actions. All eighteen touch
controls can be moved, resized and faded, and the layout is saved.

**16. Is there aim assist?**
Yes, gentle and optional, on by default. It corrects a small part of a near miss
toward a visible enemy in range. It never locks on, fires for you, leads
targets, steers projectiles, or targets teammates or hidden players. You can
turn it off in the pilot creator or the in-match menu. Whether it feels fair
has not yet been playtested.

**17. How do I recover health?**
After six seconds without taking or dealing damage, health regenerates
steadily.

**18. What happens when I die?**
The camera follows the player who killed you until you respawn, after three
seconds by default. You spawn with two seconds of protection, which ends early
if you fire, throw, melee or pick up a flag.

**19. Can I hide?**
Yes. Crouching fully inside a bush on the ground hides you from opponents, and
the server doesn't even send your position to their browsers. Carrying a flag
always reveals you.

**20. What do scopes do?**
Right click or Z cycles Near, Field, Far and Range views. Scopes change how much
of the map you can see, not a weapon's reach or damage. Each weapon remembers
its own level.

### Modes and Flag Delivery

**21. Which game modes are there?**
Five: Free-for-all, Team deathmatch, Flag Delivery, Survival and Training.

**22. How is Flag Delivery different from capture the flag?**
In capture the flag you steal the enemy's flag. In Flag Delivery you carry *your
own* team's flag into the *opponent's* goal. Enemies can't pick up your flag;
they stop you by fighting.

**23. What happens if the flag carrier dies?**
The flag drops where they were and stays there indefinitely. Only a teammate can
pick it up. There is no return timer.

**24. Can a flag ever go back home by itself?**
Only if it leaves the playable world. Then it returns home as the same flag.

**25. Can a team have more than one flag in play?**
No. Each team has exactly one. A new one appears at home only after a delivery.

**26. Can both teams score at the same moment?**
Yes. Simultaneous deliveries both count. Deaths are resolved first, so a carrier
killed on the same tick they reach the goal doesn't score.

**27. Can I fight while carrying the flag?**
Yes. Carriers keep their weapons, jetpack and grenades. You can't throw the
flag away on purpose.

**28. How is a round won?**
Team deathmatch: most enemy kills when time runs out, or first to an optional
kill limit. Flag Delivery: most deliveries, with an optional delivery limit.
Equal scores are a draw.

**29. How does Survival work?**
One to four players face waves of bots, with up to eight enemies active at once.
Each wave is larger and enemy health grows, capped at double. At the start of
each wave, survivors are restored and fallen teammates revived.

**30. How is the MVP chosen?**
By contribution: in deathmatch, two points per kill plus one per assist; in
Flag Delivery, ten per delivery plus the same. An assist needs at least 20% of
the victim's health dealt in the previous eight seconds. Ties go to fewer
deaths, then the award is shared. The results screen shows how it was decided.

### Weapons and maps

**31. How many weapons are there?**
21 firearms, a machete and a riot shield, plus five throwables: frag grenade,
flashbang, poison smoke, EMP grenade and proximity mine.

**32. Do I have to unlock weapons?**
No. Everything is available from the first match. Hosts can restrict which
weapons a room allows.

**33. How do I tell the weapons apart?**
Each has its own silhouette, so you can recognise it by shape, and recorded or
synthesised sound. Weapons are designed to change how you move: a shotgun wants
you close, a precision rifle far away, a launcher behind cover.

**34. Can I carry two guns at once?**
Yes. You have three slots, and compatible small guns can be dual-wielded with F.
The riot shield pairs only with the machete.

**35. Can poison hurt my own team?**
Yes. Poison damages everyone in the cloud, including you and teammates, even with
friendly fire off. Use it carefully.

**36. How many maps are there?**
Thirteen: six layouts added on 14 October (Outpost, High Tower, Ice Box,
Pyramid, Lunarcy and Catacombs), six earlier arenas, and the Test Range practice
map.

**37. What is special about Lunarcy?**
It's a zero-gravity space map with unlimited boost and no fall damage. EMP still
knocks out your thrust.

**38. Are the maps copies of Mini Militia maps?**
No. Six are authored reconstructions inspired by remembered layouts, not
extracted original files. The rest are original.

### Rooms, friends and bots

**39. Can I make a private room?**
Yes. Rooms can be private and use an optional password of up to 64 characters,
checked by the server. Note that the room code itself is an invitation, not a
password.

**40. Can I find public games?**
Public rooms appear in a list with the map, player and bot counts, and whether a
password is set, and there is a quick-join option. This is implemented but has
not had a dedicated check on the live site.

**41. Can I join a match already in progress?**
Yes, late joining is supported. You can also watch as a spectator and switch
between spectating and fighting between rounds.

**42. What happens if my internet drops?**
Your seat is held for 30 seconds, and you come back with the same pilot, health
and ammunition. Your body stays in the world for 10 seconds and can still be
shot. If you were carrying a flag, it drops immediately.

**43. What if the host leaves?**
Host passes immediately to the longest-connected remaining fighter, and the match
continues. A returning former host doesn't take it back.

**44. How good are the bots?**
Easy, Normal and Hard, with faster reactions and more accurate bursts at higher
levels. They navigate the maps and can't see players hidden in bushes. Whether
their difficulty feels right has not been playtested.

**45. Can the host change the rules?**
Yes: map, mode, duration, score limit, gravity, speed, health and damage
multipliers, fuel and flight, respawn time, allowed weapons, starting loadout,
pickups, unlimited ammo, friendly fire and bots. Changes made during a match
apply to the next round.

### Your pilot, saving and accessibility

**46. Can I customise my character?**
Yes. The pilot workshop lets you choose callsign, colour, body style, outfit,
headgear, twelve hairstyles, hair colour, eyebrows, facial hair, eyewear, skin
and emblem, starting from four presets. The same art appears in matches.

**47. Do cosmetics give an advantage?**
No. Cosmetics never change health, hitbox or any combat value.

**48. Are my results saved?**
Yes. Match history, weapon statistics, your pilot and your settings are saved on
the server. The game says "saved" only after storage has confirmed it; if a save
fails, it says so and retries.

**49. What if I clear my browser data or switch devices?**
Your guest identity lives in a browser cookie. Clearing it, or using another
browser or device, starts a new pilot. There is no account recovery or
cross-device sync.

**50. What accessibility options are there?**
Remappable keys, keyboard-only play, an editable touch layout, mute and volume,
reduced screen shake, reduced or hidden blood, a low-flash mode for flashbangs,
reduced motion in the creator, and toggles for aim assist and the sight guide.
Teams are labelled YOU, ALLY and ENEMY in text as well as colour. Menus are
plain HTML, but no screen-reader testing has been recorded.

---

## Engineer FAQ (51–80)

### Architecture

**51. What is the stack?**
TypeScript throughout. A shared deterministic simulation in `src/shared/`,
PixiJS 8 for rendering, native HTML/CSS for menus and the HUD, Node 24 with `ws`
for the server, and SQLite through `node:sqlite`. Vite builds the client. See
[ADR 0001](../decisions/0001-stack.md).

**52. Why one shared simulation?**
The server runs it as the authority and the client runs its movement part for
prediction. With one copy of the rules, client and server can't drift apart.

**53. Why PixiJS for the game but HTML for menus?**
Pixi only draws, so game rules never depend on frame rate. HTML menus get
keyboard navigation, screen-reader semantics and phone layouts without
rebuilding them inside a canvas.

**54. Why run TypeScript directly on the server?**
Node's type stripping removes the server build step. The cost is a rule: only
erasable syntax (no enums, namespaces or parameter properties), enforced by the
compiler setting `erasableSyntaxOnly`.

**55. Why SQLite instead of a database server?**
The hosting allowance is one small machine with one volume, and no separate
database. SQLite on the volume fits, and its single file survives restarts.

**56. Isn't `node:sqlite` experimental?**
It is release-candidate in Node 24. Node is pinned to 24.21.0 in both
`mise.toml` and the Dockerfile so the API can't change underneath the project.

**57. How do you stop database writes stalling the game?**
`DatabaseSync` blocks, so every query runs on a worker thread
(`src/server/db-worker.ts`), never on the game loop. Checkpoints are combined and
outstanding requests are bounded.

**58. What is the wire protocol?**
Compact, versioned JSON over WebSockets, with maps and weapon definitions sent
separately from recurring snapshots. The protocol is at version 5; stale clients
are asked to reload. A binary format is deferred until JSON proves too heavy.

**59. How are game rules kept from being changed for convenience?**
`CLAUDE.md` fixes them for every agent. Flag Delivery uses each team's own flag,
dropped flags stay put, and there's no return timer or enemy pickup. Changes
need the user's explicit approval, and tests in `spec/` and the unit suite pin
the rules.

**60. What does "Classic PC gameplay" mean?**
[ADR 0004](../decisions/0004-classic-pc-gameplay.md) records it: flat bullet damage
to a finite range, a physical crouch with no invisible head shield, scopes that
change view not range, server-side bush concealment, and map and rules versions
stored with each result.

### Networking and fairness

**61. Who decides whether a shot hit?**
The server. Browsers send inputs only; the server owns positions, damage,
ammunition, fuel, kills and deliveries.
[ADR 0003](../decisions/0003-who-decides-what-happened.md) weighs this against
browser-decided hits and peer lockstep.

**62. Why not let each browser decide its own hits?**
Hits would feel instant, but two lagging browsers could each "win" the same
exchange, and a modified browser could award itself kills. That fails the
README's fairness test, and Flag Delivery needs a single ordering of deaths and
deliveries.

**63. Why not lockstep?**
It's fair without a referee, but the whole match runs at the pace of the slowest
connection, and one stalled phone freezes everyone. It also suits drop-in rooms
badly.

**64. What rates does the game run at?**
A 60 Hz server simulation, 20 snapshots per second, and input sent 30 times a
second in batches.

**65. How does it feel responsive with a server in charge?**
Each browser predicts its own movement with the same `stepMovement` code and
reconciles against server acknowledgements. Other players are shown 100 ms
behind and smoothly interpolated.

**66. What is the lag compensation?**
Hitscan shots are checked against where targets were when the shooter fired, up
to 150 ms back. Projectiles, explosions and flags use current server state.

**67. Can a cheating client speed up or deal fake damage?**
Server time limits how much input is processed, so extra messages can't buy
speed. A test sending fabricated damage was rejected. Messages are capped at
4 KB, rate-limited and queue-bounded, with origin and session checks.

### Persistence

**68. What is stored?**
Guest sessions (only a hash of the token), pilots, preferences including
bindings and touch layout, room presets, matches, participants and per-weapon
statistics.

**69. When is a match written?**
It's recorded before play starts and checkpointed every five seconds. The final
result and aggregate statistics are written in one transaction that is safe to
repeat.

**70. What happens to a live match during a redeploy or restart?**
It ends and cannot resume. It's marked "interrupted" with its last checkpoint,
up to five seconds old, and no win or MVP is awarded. Completed results survive.

**71. How do you know results survive deploys?**
One saved acceptance result has survived an explicit restart, a cold start and
redeploys. Its match-detail SHA-256 has been checked unchanged across every
deploy through 28 October. Container restart and recreation tests also passed.

**72. What if storage fails?**
The failure is shown and retried with back-off capped at 30 seconds. The game
never reports a result as saved when it isn't, and a rematch can't hide an
unsaved result.

**73. How is memory kept under 256 MB?**
The Node heap is capped at 160 MB, and the database runs on a worker. Peak
resident memory in load tests has stayed between about 126 and 153 MB. If a
long soak shows growth, precompiling the server to JavaScript is the first
lever.

### Security and privacy

**74. How does identity work without accounts?**
`POST /api/session` creates an opaque ID. A random token goes into an HttpOnly,
SameSite=Lax cookie (Secure over HTTPS), and SQLite stores only its hash. Names
can repeat and are never used for authorisation.

**75. Who may change what?**
[ADR 0005](../decisions/0005-who-may-see-and-change-what.md) tabulates it. The actor
is always the HTTP session or WebSocket connection, never a client-supplied ID.
Only the current host changes rules, starts, ends or rematches. Players change
only their own ready state, team, inputs, profile and presets. A match's detail
is readable only by its participants; a guessed ID returns nothing.

**76. Can players see opponents hiding in bushes by reading network traffic?**
No. The server filters each snapshot per viewer and leaves out a fully hidden
enemy. Public scores carry no coordinates. Spectators see everyone, a known
collusion risk accepted for a friends' game rather than a ranked service.

**77. How are deployment secrets handled?**
The Fly token lives in an ignored `mise.local.toml` and has never been
committed. CI uses a separate repository secret and runs two TruffleHog scans
on every push.

### Testing

**78. How is the game tested?**
Vitest unit tests on the simulation, spec tests over HTTP and WebSocket against
the running production container, and Playwright browser scripts at both marking
viewports. The latest count is 510 unit tests and 40 spec tests.

**79. What does CI do?**
Every push to `main` builds the production Docker image, starts it with a
throwaway `/data`, and runs typecheck, unit and spec tests, the evidence check
and secret scans. Only a green run deploys to Fly, which is then polled until the
site answers.

**80. How do you test multiplayer without other people?**
Two independent browser identities play through normal controls and must agree
on damage, ammunition and results. A latency proxy injects round-trip delay and
jitter, and harnesses wait for server confirmation rather than fixed pauses.

---

## Manager FAQ (81–100)

### Capacity, cost and risk

**81. Where is it hosted?**
Fly.io in Sydney: one `shared-cpu-1x` machine with 256 MB, one volume at
`/data`, HTTPS forced, and auto-stop when idle.

**82. What does it cost to run?**
One small auto-stopping machine and a 1 GB volume. The configuration notes that
auto-stop is why it costs "cents, not dollars", but actual bills haven't been
measured or recorded.

**83. How many matches can run at once?**
One active room in production, plus up to four waiting rooms and 24 connected
clients. A two-room setting exists for isolated testing only. This limit has
been hit live: a test start was refused while a real match was running.

**84. Why not enable two rooms? A two-room soak passed.**
The two-room soaks used synthetic clients on a development host, not
simultaneous human play over the internet. The project chose not to raise
production capacity on that evidence alone.

**85. What did the load tests show?**
The 14 October 30-minute runs in a container limited to 1 CPU and 256 MiB:
eight-player PvP peaked at 143 MB resident memory with simulation p95 of
2.75 ms; Survival (four humans, up to eight enemies) at 145 MB and 2.35 ms.
There were no failures, out-of-memory kills or restarts.

**86. Has the latest build been soak-tested?**
Not with the full 30-minute gate. Since 14 October the checks have been 60-second
regressions and live health checks; the last showed 126 MB and simulation p95
of 0.51 ms. A full soak on the current build is outstanding.

**87. Have tests ever failed?**
Yes, and the failures are kept in the record. On 13 October a 300-second
eight-player probe lost all connections after its first rematch, with close
code 1008 and a cause that is still unknown. The harness now records close
reasons and fails fast. A later stall traced to cold bot-navigation graphs
(up to 168.5 ms) led to prewarming.

**88. What does server authority cost the player?**
Kills, pickups and deliveries appear only once confirmed. At an injected 100 ms
round trip, recorded ping p95 was 133–144 ms and input-acknowledgement age p95
133–150 ms across the 13 and 14 October runs. Some shots that look right miss,
and a player behind cover can take a rewound hit up to 150 ms late.

**89. What frame rate does it reach?**
On the test laptop's GPU (Intel Arc 140T, Chrome), 60 FPS at 1920×1080 and in a
390×844 phone viewport. A 10-minute run averaged 59.6 FPS. Software rendering in
WSL fell to about 21 FPS desktop, cause unproven, so 60 FPS isn't claimed
everywhere.

**90. How long does a cold start take?**
One live observation measured 4.4 seconds after the machine had auto-stopped.
That is a single observation, not a promise.

**91. Is the data backed up?**
The Fly volume is encrypted, 1 GB at creation, mounted at `/data`, and SQLite
runs in WAL mode. No backup or snapshot policy is documented, which is a risk if
the volume is lost.

**92. What is logged, and could we investigate a dispute?**
Structured JSON lines for joins, leaves, reconnects, host transfers, settings,
readiness, kills, flag events, match start, end and save, and rejected actions.
Duplicate names are told apart by ID, so a shared match can be explained from
logs. Inputs, shots, chat text, passwords, tokens and cookies are never logged.
It is not a complete security audit trail.

### Delivery and process

**93. How were AI agents used?**
Claude built the foundation. Codex then integrated work from separate agents
with non-overlapping file ownership: rules, server and storage, client and maps.
Adithya sets direction and quality criteria, reviews results, approves deploys
and publishes. `CLAUDE.md` forbids agents from inventing playtests,
measurements or reflections.

**94. What has review caught?**
Among others: survival bots attacking their own side, Training selectable for
Flag Delivery, a blocked Outpost route, an admission race for the active-room
slot, lost short touch taps, ambiguous duplicate names in logs, a silently
swallowed preference save, and a test harness that started on a fixed pause
instead of waiting for readiness. Each fix came with a regression test.

**95. What is verified live versus only locally?**
`docs/FEATURES.md` labels every feature as implemented, tested locally, verified
live or pending. Live-verified items include gameplay, persistence across
deploys, host transfer, the pilot workshop and touch layout. Public listing and
quick join are only implemented. The nameplate and poison/sniper follow-ups have
local evidence only.

**96. What hasn't been validated yet?**
A structured playtest with returning and new players, performance on a physical
phone, a subjective sound assessment, balance and fun, and a 30-minute soak on
the current build. The project claims none of these.

### Business, IP and roadmap

**97. What is the business model?**
None. It's an ANU course final project, built like a "home-cooked meal" app for
a group of friends. Monetisation, subscriptions and ranked matchmaking are
explicitly out of scope.

**98. Does it infringe Mini Militia's IP?**
It aims not to. Maps, characters, weapon art and branding are original vector
work. Reference screenshots were used only as references, and no sprites or
sounds were extracted. The audio is 16 CC0 clips from OpenGameArt plus
synthesised effects. The repository has no licence file of its own.

**99. What are the known rough edges?**
No throw-arm animation or grenade bounce sound, no wall-impact effect for
bullets, a generic melee slash direction, no headshot label in the kill feed,
160 ms of camera lag in fast flight, and a main client chunk over Vite's 500 kB
warning (about 164 kB gzipped).

**100. What comes next?**
[RICE](rice.md) ranks twenty candidate features. Separately, the human playtest and
a current-build soak are the validation gaps to close before claiming balance or
raising capacity.

---

## Sources

[README](../../README.md) · [Features](../FEATURES.md) · [Validation](../VALIDATION.md) ·
[14 October validation](../REVISION_2026_10_14_VALIDATION.md) ·
[14 October plan](../REVISION_2026_10_14_PLAN.md) ·
[Crit 10 validation](../CRIT_10_VALIDATION.md) ·
[Pilot release](../PILOT_RELEASE_2026_10_21.md) ·
[Combat workshop](../COMBAT_WORKSHOP_2026_10_28.md) ·
[Character effects](../CHARACTER_EFFECTS_2026_10_28.md) ·
[Persistence evidence](../PERSISTENCE_EVIDENCE.md) · [Playtest](../PLAYTEST.md) ·
[Decisions](../decisions/)
