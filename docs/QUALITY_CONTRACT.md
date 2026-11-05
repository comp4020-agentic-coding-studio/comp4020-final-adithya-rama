# Current quality contract

Consolidated on **5 November 2026** for the final portfolio. This file brings the
current README's claims and later gameplay corrections into one place for agents
to read. It is a new consolidation, not evidence that every rule was written
before the earlier crits. The linked commits, decisions and tests show when those
parts actually changed. Older plans and dated validation records remain history.

## Joining and sharing a match

- A newcomer must be able to enter from the public URL, get a guest pilot and
  join or create a room without developer help. A guest identifies a browser's
  cookie store. Clearing cookies loses access; names are not authentication.
- The server must check room membership and authority. Only the current host may
  change shared rules or start/end/rematch. Everyone controls their own inputs,
  team choice and readiness. Changing lobby rules clears readiness; rules during
  a live round apply to the next round. Host departure transfers management.
- Clients send inputs, never authoritative damage or scores. A shared server
  simulation decides combat and objectives. Separate guests must receive the
  same result. Preserve bounded input processing, reconnect identity/inventory,
  and explicit capacity refusals.
- Keep one production active room, eight PvP fighters, one shared CPU, 256 MB and
  the persistent volume. Wider capacity needs its own measured acceptance; a
  short successful probe does not establish it.

Evidence: [server decision](decisions/0003-who-decides-what-happened.md),
[access decision](decisions/0005-who-may-see-and-change-what.md),
[`spec/alive.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/spec/alive.test.ts),
[`spec/server-rooms.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/spec/server-rooms.test.ts),
[`spec/server-logs.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/spec/server-logs.test.ts).

## Movement, combat and objectives must match what players see

- Movement/flight and gun aim are independent. Reversing A/D must not turn the
  gun. Keyboard/touch aim retains its last direction until deliberate aim input;
  focus loss clears held controls. S crouches; intentional platform descent is a
  separate action. Solid floors and low-ceiling clearance remain physical.
- The riot shield rotates with aim in all directions. Drawing, current collision
  and historical hit checks must use compatible geometry. At default health and
  damage, M93BA needs two body hits or one exposed standing-head hit. Spawn
  protection, room multipliers, cover and crouch rules still apply. A direct
  rocket defeats the shield; splash is evaluated for each victim's distance,
  terrain exposure and shield facing.
- A team's flag is its own delivery object. There is exactly one per team; only
  teammates collect it. Dropped flags stay until recovered or leaving the
  original map bounds. There is no timed return or enemy pickup. Damage resolves
  before deliveries; simultaneous valid deliveries are processed together.
- Foliage concealment is enforced before sending enemy coordinates or
  actor-specific events. It is not universal line-of-sight fog. Flag carriers
  reveal themselves. Dead players may follow only their actual eligible killer;
  spectators have the documented full observer view.
- Cosmetics must not change combat hitboxes or stats. Profile/editor artwork and
  the in-game pilot must agree. A physical explosive death gets the appropriate
  breakup regardless of weapon name; electrical, poison and direct-cut causes
  must not be classified as physical explosions.

Corrections: [independent aiming `0942d8f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/0942d8f),
[directional combat `2a4b400`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/2a4b400),
[explosive causes `1b8f02d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/commit/1b8f02d).
Checks: [`test/input.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/test/input.test.ts),
[`test/movement.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/test/movement.test.ts),
[`test/full-game.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/test/full-game.test.ts),
[`test/combat-directional.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/test/combat-directional.test.ts),
[`test/server-visibility.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/test/server-visibility.test.ts),
[`test/explosive-deaths.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/test/explosive-deaths.test.ts), and actual
input/browser scripts listed in [the check map](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/spec/README.md).

## Saved must mean committed

- Profiles, preferences, presets and completed results belong to the authenticated
  guest. One guest must not read or overwrite another guest's private records.
- Show saved success only after the database commits. Failed writes must remain
  visible and recoverable. Retrying finalization must not double-count statistics
  or allow a rematch to hide an unsaved result.
- Completed results must survive restart/redeployment. An unfinished round is
  marked interrupted from its latest checkpoint, without a completed-match win
  or MVP. Up to five seconds can be absent. Live rounds do not resume after a
  restart; do not promise they do.

Evidence: [`spec/server-storage.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/spec/server-storage.test.ts),
[`spec/server-api.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/spec/server-api.test.ts),
[`test/client-integration-regressions.test.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/test/client-integration-regressions.test.ts),
[`scripts/persistence-acceptance.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/scripts/persistence-acceptance.ts) and
[`scripts/live-persistence.ts`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/scripts/live-persistence.ts).
Run destructive restart tests only on isolated databases. Live persistence
verification must preserve its original baseline and never print credentials.

## A usable page and a judgeable game

- Publish the complete current README at `/readme/` as server-rendered HTML. Keep
  its joining directions sufficient for someone arriving with only the URL.
- Exercise desktop 1920×1080 and touch 390×844. Menus must fit, actions must remain
  reachable, and the HUD must leave the player visible while moving and flying.
  Keyboard menus and labelled native controls matter alongside canvas play.
- Preserve independent sound, low-flash, reduced-blood and reduced-shake
  preferences, and respect the system's reduced-motion setting in the creator
  and menus. An effect preference must not grant an unfair gameplay advantage.
  Failed preference saves must not pretend success.
- Team identity uses readable names and explicit ally/enemy text as well as
  colour. Concealment must also remove hidden enemy nameplates.
- Tests establish specified behaviour, not enjoyment or complete accessibility.
  Inspect actual graphics and interactions, then ask people to play. Record their
  observed confusion and comments separately from agent predictions and browser
  automation. Link a reported problem to its correction and regression where
  possible; never invent participant counts, quotes or successful retests.
- Preserve historical failures, source/version uncertainty and remaining gaps.
  The [combat audit](COMBAT_COMPLETENESS_AUDIT_2026_10_28.md) and
  [playtest record](PLAYTEST.md) are evidence boundaries, not permission to claim
  every aspect is finished. A green suite cannot certify fun or visual quality.

The [spec index](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/blob/main/spec/README.md) maps these claims to checks and records which
browser and deployment checks run separately from the ordinary CI suite.
