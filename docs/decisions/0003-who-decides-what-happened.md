# 3. When browsers disagree, the server decides what happened

Date: 2026-10-14 · Status: accepted · Crit 9 ("All at once")

Drafted from Adithya's Crit 9 reflection and the existing multiplayer
contract; the judgement is his.

## The question

Eight people play one match at once, each seeing the world slightly late. On
one screen a shot lands; on another the target already reached cover. One
player crosses a goal with their flag in the same tick they are killed. **Whose
version counts?**

## What good means here

The README defines fairness as "both browsers agree on damage, ammunition and
scoring". Flag Delivery depends on it: deaths resolve before deliveries, and
simultaneous deliveries are judged together. If two browsers can record
different outcomes, neither rule means anything.

## Options weighed

1. **Each browser decides its own shots (client authority).** Hits feel
   instant for the shooter, and the server stays simple. But a modified or
   lagging browser can award itself kills and deliveries, and two players can
   each "win" the same exchange. That fails the README's fairness test.
2. **Peers agree in lockstep.** Every browser runs the same simulation on
   the same inputs. It is fair without a referee, but the whole match moves at
   the pace of the slowest connection, one stalled phone freezes everyone, and
   it does not suit drop-in, drop-out rooms.
3. **The server decides; browsers predict (chosen).** Browsers send inputs
   only. The server runs the one shared simulation (`src/shared/`) at 60 Hz
   and owns positions, damage, ammunition, fuel, kills and deliveries. It
   sends snapshots 20 times a second. Each browser predicts its own movement
   with the same `stepMovement` so controls feel immediate, and shows other
   players 100 ms behind. Hitscan shots are checked against where targets were
   when the shooter fired, up to 150 ms back (`LAG_COMP_MAX_TICKS`).
   Projectiles, explosions and flags use current server state.

## What this costs

- **Confirmation lags input.** A kill, pickup or delivery appears only after
  the server confirms it. In the 100 ms round-trip, eight-player run, ping and
  input-acknowledgement age were both about 133 ms at p95
  ([validation](../REVISION_2026_10_13_VALIDATION.md)).
- **Some hits that look right do not count, and some deaths feel unfair.** A
  rocket aimed at where a target appears can miss, because projectiles use
  current state. A player who has already reached cover can still take a
  rewound hitscan hit, up to 150 ms late.
- **The match depends on one machine.** A server restart or deploy ends
  live rounds; they cannot resume. Capacity is one active room on one shared
  CPU and 256 MB.
- **More to build and test.** Prediction, reconciliation, interpolation and
  rewind history all have to agree with the shared simulation.

## Why this one

Fairness is the property the README asks the group to judge, and only one
referee can deliver it for a match that friends join and leave freely. The
cost is about 100–150 ms of perceived delay on outcomes, not on movement,
which prediction keeps immediate. For a casual friends' match, a short wait
for an agreed result is better than an instant one people can dispute.

## The case for the rejected option

The pod is expected to argue for client authority: it feels better to shoot,
and friends are not likely to cheat. Cheating is not the main concern. Even
honest browsers disagree under lag, and the flag rules need one ordering of
deaths and deliveries. A shooter-favoured compromise is already in place:
hitscan rewind gives back up to 150 ms of the shooter's view.
