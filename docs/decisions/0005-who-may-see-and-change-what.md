# 5. Guest identity, room authority and readable server evidence

Date: 2026-10-21 · Status: accepted implementation decision · Crit 10 ("Fly by instruments")

This records existing rules and the requested Crit 10 observability work. It is
grounded in the [agreed scope](../IMPLEMENTATION_PLAN.md), [server-authority
decision](0003-who-decides-what-happened.md) and [Classic PC
rules](0004-classic-pc-gameplay.md). It is not personal testimony or a claim that
a human rehearsal has happened.

## Identity and access

A guest session identifies a browser cookie store, not a verified human.
`POST /api/session` restores a profile or creates one with an opaque ID and
generated `Pilot-XXXX` name. The random token is in an HttpOnly, SameSite=Lax
cookie (Secure on HTTPS); SQLite stores its hash. Names may be duplicated or
changed and are not authorization keys.

Separate Chrome profiles have separate cookie stores. Ordinary windows in one
profile share their guest; several Incognito windows can also share one
Incognito session. Use independent profiles for the rehearsal.

URL-only entry supports the stated goal of a stranger joining and returning to
find their result. Clearing the cookie loses access to that guest. There is no
cross-device account recovery. A room password authorizes entry; its code/link
is an invitation, not a secret account credential.

## Who may change what

The HTTP session and WebSocket connection select the actor, not a
client-supplied profile ID. These rules are checked on the server.

| Action | Authority and limits |
|---|---|
| Room rules | Current host only. Settings are sanitized. During play changes are staged for the next round; live rules remain fixed. Lobby edits clear readiness. |
| Start, end, rematch | Current host only, with state, readiness, team, capacity and saved-result checks. Enabling a disabled button grants no authority. |
| Ready, team | Only the connected fighter's own lobby state. Team selection requires a team mode; spectators cannot ready up. |
| Movement, equipment | Inputs apply only to that connection's fighter. The simulation decides health, ammunition, kills and flags. |
| Spectator/fighter status | Members change their own status between rounds, subject to capacity. They cannot become an omniscient observer during a live round. |
| Name, colour, preferences | The session's `/api/me` profile. Successful edits refresh matching live connections, including connections not yet in a room. |
| History, weapon statistics | `/api/me/matches` and `/api/me/weapons` select the session's profile. |
| Presets | List/create/delete only the session's presets. Deletion requires preset ID and owner profile ID. Applying a preset to shared rules still uses the host-only settings action. |
| Saved match details | `/api/matches/:id` requires participation. A fighter can read the whole shared result; an unrelated guest or spectator cannot use a guessed ID to read it later. |
| Room admission | Password and capacity checks run on the server. The page's link/code flow requires no manually obtained token. |

The current host remains host while connected and fighting. On leave,
disconnect or becoming a spectator, authority transfers to the earliest-joined
remaining connected fighter. With no such fighter there is no host. A returning
former host does not displace the current host. Creating a room reserves no
permanent ownership: the first connected fighter becomes host. This keeps one
editor for shared settings while allowing the room to continue after its
original host leaves.

## Who may see what

`snapshotForViewer` filters player records before serialization:

- Ordinary non-concealed opponents are sent even behind terrain. This is
  **foliage concealment**, not general line-of-sight fog of war.
- A fully covered, supported crouching enemy can be omitted. Revealing actions
  and carried flags expose the actor. Nearby detection of a concealed enemy
  requires both the distance threshold and line of sight.
- Fighters receive their own actor and team allies in team modes/Survival.
- A dead fighter's camera may follow only the actual available attacker.
  That actor can be disclosed even if concealed; the exception does not reveal
  the attacker's whole team. Death/disconnect permanently ends that follow
  grant for this death. Normal visibility still applies to other actors:
  the entire snapshot is not restricted to one killer.
- Spectators deliberately receive full observer vision and cannot fight in the
  live round. Relaying information outside the game remains a known social risk.
- Public scores contain identity, kills, deaths, assists, deliveries, alive and
  connected flags, without coordinates. Public flags and combat effects do not
  promise to conceal every indirect clue.

Renderer-only hiding would leave coordinates available to a modified browser.
The server omits concealed records and their actor-specific events before
sending. Operator logs are not a public in-game feed.

## How the operator identifies actions

Application logs are JSON objects on stdout. Identity/room actions carry
`profile` and current `name`, plus `room` where relevant. Combat lines include
names, `byPlayer`/`byProfile` and victim equivalents, with match ID and tick.
Bots have player IDs and bot markers, without human profiles. Duplicate names
therefore remain distinguishable.

Events include:

- `guest_created` and `rename` (old/new name);
- `room_created`, `join`, `reconnect`, `disconnect`, `leave`, `host_transfer`,
  `spectate`;
- `ready`, `team`, `settings` (actual sanitized changes and whether deferred),
  `start_requested`, `end_requested`, `rematch_requested`;
- `rejected` for domain refusals, including non-host commands, join/password
  failures and unavailable saved matches/presets;
- `kill`, `flag` (pickup/drop/return/delivery), `match_start`, `match_end`,
  `match_saved` and storage failures.

A request log does not prove success: `match_start` confirms admission and
`match_saved` confirms committed storage. Disconnect/leave can drop flags
outside a simulation step. The room consumes that event immediately and retains
it for the next/final snapshot, including the last player leaving.

Continuous input, shots, damage, explosions, heartbeat traffic and chat text
are not logged. Neither session tokens/cookies nor room passwords are logged.
Malformed high-frequency frames can be ignored or rate-limited without a log
per frame; this is not a complete security audit trail. Logs contain names and
opaque IDs: share the relevant demo excerpt, not an unrestricted production
archive.

## Verification and trade-offs

`spec/server-logs.test.ts` covers real room actions and simulation kills,
same-name players, immediate disconnect and final-leave flag drops, plus an
isolated server's HTTP/WebSocket guest/rename/join/refusal flow. It checks that
chat, passwords and cookies are absent and another identity cannot delete a
preset or read a saved match. Existing room/storage/visibility tests separately
cover authority, ownership and killer-only follow.

This stream explains who changed a room and which outcomes committed. It is not
a movement replay, verified-person identity, subjective fairness result or
replacement for the [two-person rehearsal](../CRIT_10_REHEARSAL.md).
