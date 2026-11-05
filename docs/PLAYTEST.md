# Peer playtest: 21 October 2026

I wrote this record on 5 November, using my recollection, feedback I had already
reported, and saved match results recovered from the deployed game. I remembered
playing with my peers at about 11 am on 21 October. When the two rounds below
were found, I confirmed that they sounded like our session.

This is a retrospective account. The match records establish what the server
saved. My observations explain what players struggled with. They are different
kinds of evidence, and I have kept them separate.

## The session I can identify

The game was deployed at
[the Fly URL](https://comp4020-final-adithya-rama.fly.dev/). Both rounds used room
`Z9JXV`. Times below are AEDT, UTC+11.

| Saved round | Time on 21 October | Participants recorded | Saved outcome |
| --- | --- | --- | --- |
| Free-for-all, Outpost | 11:02:32–11:07:32 am | Five non-bot pilot records | Completed at the time limit. Recorded kills ranged from 6 to 14. |
| Team deathmatch, Catacombs | 11:09:23–11:14:23 am | Four non-bot pilot records, two on each team | Completed at the time limit, with team scores 20–7. |

Four of the same profiles appear in both rounds. That supports repeat play
within this session. It does not tell me why someone continued, whether everyone
enjoyed it, or why the fifth profile did not appear in the second round. The
uneven team score is a reason to look at balance, not proof of what caused it.

The [sanitized result extract](evidence/peer-playtest-2026-10-21.json) contains
both match IDs, timestamps, outcomes and participant scores. Pilot A–E are local
aliases; names and profile identifiers are omitted. It was recovered on
5 November through read-only queries of the production SQLite database. No
session credentials or private preferences were queried. The results still
being present corroborates persistence; it is not evidence that my peers
returned the next day themselves.

I did not record each person's browser, device, connection quality or previous
Mini Militia experience. The match rows do not store the deployed commit, so I
have not assigned an exact build to this session.

## What I noticed and changed

Watching people play helped me turn vague dissatisfaction into specific changes.
I had already reported these problems during development, and later confirmed
that the gameplay issues came from watching my peers. This table brings together
feedback from those sessions across the weeks. I cannot reliably assign every
observation to the two rounds above; some corresponding fixes were already in
place before 21 October at 11 am.

| What I noticed or was told | What changed | Lasting check |
| --- | --- | --- |
| Players struggled to acquire and switch weapons. | Three-slot switching in [c61b96d](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/c61b96d), followed by more useful nearby pickups and equipment pairing in [0790c1b](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/0790c1b). | `test/gameplay-refresh.test.ts` preserves ammo when switching and checks the third slot; `test/combat-revision.test.ts` checks pickup/pairing behaviour. |
| Players tried to protect their heads with a shield that only faced sideways. | [2a4b400](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/2a4b400) made the physical shield rotate with aim. | `test/combat-directional.test.ts` checks different incoming angles and historical upward coverage; a separate browser check fires an actual overhead shot. |
| Rockets did not cause the damage players expected. | [2a4b400](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/2a4b400) separates direct rocket impact from splash affected by distance, terrain and shield direction. | Directional-combat tests cover direct impact, nearby stone impacts and different victims' exposure. |
| My change to one-shot snipers made them too powerful. | I revised the lethal-body-hit choice from [3463a0d](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/3463a0d). [2a4b400](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/2a4b400) restores two body hits or one exposed standing-head hit at standard settings. | Directional-combat tests distinguish body/head hits, protection and room multipliers. This was also a correction to my own design judgement. |
| Moving and firing in different directions needed to work independently. | [0942d8f](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/0942d8f) separates movement/flight from aim. | `test/input.test.ts` and `scripts/browser-independent-aim.ts` cover mouse, numpad and touch aiming. |
| The camera could lose the pilot outside the terrain, while the large inventory blocked the view. | [0ffc831](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/0ffc831) changes camera tracking, exterior flight and the compact translucent inventory. | `test/camera.test.ts`, `test/outer-flight-spawns.test.ts` and the dated Crit 10 browser measurements. |
| Players could not clearly tell teammates from opponents. | [7bd1e35](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/7bd1e35) adds readable names, relative colours and explicit ALLY/ENEMY text. | `test/nameplates.test.ts` and the browser nameplate check cover team perspective, concealment and crowded phone labels. |
| Some players struggled to aim. | [e78a1fb](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/e78a1fb) adds optional gentle aim assistance, enabled by default. | `test/aim-assist.test.ts` bounds the correction, preserves accurate aim, respects disabling and prevents assistance through terrain. |

For these changes, I can point to the correction and its checks. I do not have
a recorded same-person retest for each issue. Passing a regression check is not
the same as a player saying the change feels better. The broader UAT lesson was
already recorded in my [Crit 10 reflection](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/reflections/crit-10.md); the
[process account](../PROCESS.md) explains how it changed my workflow.

## What happened to the event logs?

The server writes lifecycle, kill and flag events to stdout. It does not keep
an event-by-event replay in SQLite. The recovered database rows are final
results, so I cannot reconstruct individual shots, movement, shield attempts or
spoken reactions from them.

The recovery checked 61 local log/capture files in `.data/`, `test-results/` and
`.data-server.log`, plus the available Fly log buffer. No timestamped capture
was found in the searched 9 am–1 pm AEDT window on 21 October. The saved
`crit10-live-stream.jsonl` ends at about 12:35 am AEDT that day and belongs to
the documented automated rehearsal, not this peer session. The retrieved Fly
buffer contained 5 November events. Fly currently documents
[seven-day searchable log retention](https://docs.fly.io/monitoring/search-logs);
that is not a permanent playtest archive. This describes the sources checked,
not a claim that no copy could exist elsewhere.

## What this establishes, and what I still need to judge

I have evidence of people using shared matches, completed results remaining
available, and specific peer feedback leading to changes with regression checks.
The [two screenshots in PROCESS](../PROCESS.md) show later automated verification
of corrected labels and shielding. They are not pictures of this peer session.

These two recovered rounds were free-for-all and team deathmatch. They do not
show whether players understood own-flag delivery, chose to escort a carrier or
recovered a dropped flag together. I still need to observe that central teamwork
claim directly, along with whether the corrections feel fair and readable.

For that follow-up I would record the actual build and environment, observe a
returning Mini Militia player and a newcomer, and note where they need help.
I would watch joining, team identification, equipment use, own-flag delivery,
recovery and rematching. I would record their comments and any later retest
without treating a completed match as an automatic pass for enjoyment.
