# 5. Who may see and change what, and how the server knows who did it

Date: 2026-10-20 · Status: proposed · Crit 10 ("Fly by instruments")

Drafted by the agent from the server code as it stands at this commit, for
Adithya to confirm or correct before the crit; the judgement is Adithya's.
Where a "why" below is the agent's reading rather than Adithya's stated
reason, it says so.

## The question

Two or more people, each in their own browser, act on one shared room and
match. What counts as a person, what may each of them see and change, and
where is that decided?

## What counts as a person

A person is a **browser holding a guest session**. The first request without a
session cookie creates a profile with an opaque id and a generated name
(`Pilot-XXXX`), and sets an `HttpOnly`, `SameSite=Lax` cookie holding a random
token; only the token's hash is stored (`src/server/main.ts`, `ensureSession`).
Two Chrome profiles or an incognito window are therefore two people, with no
sign-up step: everything needed to get in is on the page.

Why: the game is drop-in arena play, and the crit (and the marking) open the
app from its URL alone. An account system would add a step that protects
nothing the game needs protected. The cost is that clearing cookies makes you a
new person, and a profile's history cannot follow you to another device.

## What each person may change

Every rule below is checked in the server's message handler
(`Room.handle` in `src/server/rooms.ts`) or HTTP API, never only in the UI.
A refused request is answered with an error and logged as `rejected`.

| Action | Who may | Enforced in |
|---|---|---|
| Change room settings (mode, map, gravity, capacity…) | The room's **host** only | `handle` → `settings` |
| Start, end, or rematch a round | The host only | `handle` → `start`/`end`/`rematch` |
| Ready up, pick a team | Each fighter, for **themselves** only, in the lobby | `handle` → `ready`/`team` |
| Move, shoot, use items | Each fighter, only **their own** player, via input frames | `queueInput`; the simulation decides outcomes (decision 3) |
| Become a spectator / fighter | Each person, for themselves, between rounds | `handle` → `spectate` |
| Join a password room | Anyone with the password; checked with a timing-safe compare | `Room.join` |
| Rename, recolour, set preferences | Only your own profile (`/api/me`) | the session cookie selects the profile; there is no id parameter to point elsewhere |
| Read match history, weapon stats, presets | Only your own (`/api/me/*`, `/api/presets`) | same |

**Host** is the earliest-joined connected fighter. If the host disconnects or
becomes a spectator, it passes to the next one (`transferHost`, logged as
`host_transfer`). Nobody can claim host; it is a consequence of join order.

Why (agent's reading of the existing design): a room needs exactly one person
who can change the rules of the next round, or two people race each other's
settings. Tying it to join order and connection keeps a room usable when its
creator leaves without needing a separate claim/kick mechanism.

## What each person may see

Visibility is filtered **on the server, per viewer, before serialization**
(`snapshotForViewer` in `src/server/visibility.ts`), so a modified browser
cannot read positions it was not sent:

- A living fighter receives their own player, their teammates (in team modes),
  and opponents within line of sight (`canSeePlayer`). Flag carriers are always
  revealed (decision 4).
- A dead fighter additionally follows only the player who actually killed them,
  until that killer dies or disconnects, and never the killer's whole team.
- Spectators are deliberately omniscient observers. They cannot also fight in
  that round.
- Everyone receives the scoreboard (kills, deaths, deliveries, alive and
  connected flags), which carries no positions.

Why: hiding opponents only in the renderer would leak them to anyone who opens
dev tools; filtering before send is the only version that holds.

## How the server knows who did what

Every log line is one JSON object on stdout, so it appears in
`flyctl logs -a comp4020-final-adithya-rama`. Lines about a person carry
both the opaque `profile` id and the `name` other players see on screen:

- identity: `guest_created`, `rename` (from → to)
- room: `join`, `reconnect`, `disconnect`, `leave`, `host_transfer`, `spectate`
- lobby actions: `ready`, `team`, `settings`, `start_requested`,
  `end_requested`, `rematch_requested`
- refusals: `rejected` (who, and the reason they were given)
- play: `kill` (by, victim, weapon) and `flag` (team, pickup/drop/return/delivery, by)
- match lifecycle: `match_start`, `match_end`, `match_saved`

Shots, damage and explosions are not logged: at 60 Hz they would bury the
lines that answer "who did what". Session tokens are never logged.

`spec/server-logs.test.ts` checks that joins, accepted and refused actions,
kills and flag actions name the person, and that shots stay out of the log.

## Open for Adithya to confirm

- Is join-order host the rule you want, or should the room's creator keep it?
- Should spectators stay omniscient, given they could relay positions to a
  fighter over voice? (Accepted risk today.)
