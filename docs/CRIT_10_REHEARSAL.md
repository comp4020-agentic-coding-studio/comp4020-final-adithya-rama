# Crit 10 rehearsal: narrate the server, not the screen

This is a procedure to perform, not a claim of a completed human rehearsal.
Use the deployed version containing the Crit 10 changes. Record its revision
and the actual date; automated/local evidence is separate.

## Two independent people

Create two separate Chrome profiles; sign-in is unnecessary. Independently open
[Jet Skirmish](https://comp4020-final-adithya-rama.fly.dev/). Two ordinary windows
in one profile share a guest. Several Incognito windows can also share one
Incognito session, so they do not reliably represent independent people.

Each person uses **Your pilot** to choose a name such as CritA or CritB.
Only the URL and page should be needed: no supplied cookie, token, source-code
instructions or pre-existing sign-in. Names help the narrator; profile IDs
distinguish duplicates. If both windows become the same pilot, correct the
browser-profile setup before continuing.

In a separate WSL terminal:

```sh
cd /home/adithyarama/comp4020/comp4020-final-adithya-rama
mise exec -- /home/adithyarama/.fly/bin/flyctl logs -a comp4020-final-adithya-rama
```

Use the configured ignored environment; never display/copy the deployment
token. Start with the complete JSON stream so filtering does not hide a failure.
Distinguish unrelated rooms by code. The narrator watches only this terminal
while the participants operate their browsers independently.

## Shared-room sequence

Use a new private, password-free room so strangers are not invited. Do not
modify someone else's match. Leave after saving to free the single active slot.

| Participants' action | Narration supported by the terminal |
|---|---|
| Open fresh profiles and rename both pilots | Two `guest_created.profile` IDs; `rename` links generated names to CritA/CritB. Existing profiles need not create another guest event. |
| CritA uses **Create a room**, selects **Flag Delivery**, shares **Copy invite link** | `room_created` identifies the creator, `join` each entrant, and `host_transfer` the actual host. |
| Choose opposing teams and zero bots | `team` identifies fighter/team; the host's `settings.changes` shows accepted changes. |
| CritB clicks **I'm ready** | `ready` records identity and true state. A later lobby settings change means CritB must ready again. |
| Host starts | `start_requested` names the requester; `match_start` confirms actual mode, map, human/bot counts and match ID. |
| Collect your own flag, fight, drop/recover it and deliver | `flag` identifies owner team/action/actor; `kill` identifies attacker/victim by names and IDs. A drop alone does not explain why: look for the adjacent kill/disconnect/leave. |
| A carrier closes the window briefly and returns in the same profile | `flag:drop`, `disconnect` and any `host_transfer` explain the change. `reconnect` identifies the same guest if the reservation remains. Returning does not reclaim host. |
| Finish, or let the current host end the round | `match_end` supplies reason/scores; `match_saved` confirms storage. A request alone does not prove success. |

The objective is **your own flag into the opposite goal**. One flag exists per
team; only teammates recover an in-bounds dropped flag, which has no return
timer. Do not narrate conventional enemy-flag capture. Movement and firing
deliberately do not produce per-input/per-shot logs.

## Demonstrate a server refusal

A disabled control proves the interface, not server enforcement. In this same
room, while CritB is a non-host in the lobby, deliberately enable and change one
disabled rule using that browser's DevTools. This uses CritB's existing
connection, not another identity. Choose a terrestrial map with multiplier
gravity. In CritB's console only:

```js
const gravity = document.querySelector('[data-setting="gravity"]');
gravity.disabled = false;
gravity.value = "2";
gravity.dispatchEvent(new Event("change", { bubbles: true }));
```

The narrator should see `rejected`, CritB's current name/profile,
`action:"settings"` and the host-only reason. Confirm authoritative gravity
remains unchanged. Close DevTools and refresh that window to restore normal
controls. This deliberate tampering is a separate authority demonstration;
normal joining and play must work from the URL and page alone.

Optionally have the host change gravity legitimately afterward. Its
`settings.changes.gravity` distinguishes an accepted change from the refusal.
During play, `deferred:true` means next round, not current physics.

## Record what happened

Record deployed revision/date, two names/profile IDs, room/match ID, first
refusal/reason, host after disconnect and whether `match_saved` appeared.
Keep a short relevant excerpt without passwords, cookies, chat or tokens.
Do not invent an uninterrupted pass if a step failed or the server was busy.

The narrator should account for identity, accepted actions, refusals, authority
transfer and committed outcomes from the terminal. These logs cannot establish
exact movement, every shot, enjoyment or unlogged chat. Browser observations can
confirm the rehearsal afterward but should not supply missing facts during the
log-only narration.

See [ADR 0005](decisions/0005-who-may-see-and-change-what.md) for the rules and
visibility limits, and `spec/server-logs.test.ts` for automated coverage.
Neither document is a personal reflection.
