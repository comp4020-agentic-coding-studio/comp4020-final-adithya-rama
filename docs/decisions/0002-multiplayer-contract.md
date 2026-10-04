# Decision 0002: finishing the multiplayer contract

**Status:** accepted for implementation, 4 October 2026. Validation results are
recorded separately in [VALIDATION.md](../VALIDATION.md).

## Context

The P2 handoff delivered the first complete small match. The user then authorized
implementation of the entire agreed plan. Its ownership table was a proposed
handoff sequence, not a reason to stop with required features unfinished. One
Codex integrator now coordinates separate ownership of simulation, server/storage,
and client/maps. Claude's existing commits remain intact.

## Decisions

Keep one active room as the default. Support an explicit test override of two
active rooms, with a separate production-shaped soak for two eight-player PvP
rooms and two survival rooms. Passing a short probe does not establish capacity.

Preserve one flag object per team. Its state is home, carried, dropped or
respawning, and its generation advances on a delivery. Movement and all damage
resolve before both delivery checks. Dropped flags have physical motion and no
return timer. After scoring, availability advances by one simulation tick.

Retain participant identity and inventory across disconnection. Clear input
queues and restart sequence acknowledgement when a browser reconnects. Transfer
host management immediately to the oldest connected fighter. Keep disconnected
bodies vulnerable for ten seconds and seats for thirty seconds.

Require other fighters to mark ready before a host starts. Reserve active-room
admission while the database records match creation. Reject participation changes
that could invalidate admission during that interval. Stage changed gameplay
settings for the following round.

Coalesce checkpoints and bound outstanding database requests. Finalization
updates the result and PvP aggregates once in one transaction, including weapon
statistics. Failed storage remains visible and can be retried; it cannot enable
a rematch while pretending the result is saved.

## Consequences and evidence

This keeps the agreed rules explicit at the shared simulation boundary, with
HTTP/WebSocket checks for room authority and worker-backed checks for storage.
It also exposes real limitations: live rounds cannot resume after deployment,
guest identity depends on browser cookies, and human playtesting is still needed
to judge balance and enjoyment.

Review found concrete corrections: survival bots must ignore fellow raiders,
the training range cannot host an objective it does not contain, and every
supported flight/gravity combination needs a recoverable route for flags.
Regression tests accompany these corrections. See the feature checklist and
validation record for what has actually passed.
