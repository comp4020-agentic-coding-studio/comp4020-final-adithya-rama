# Sniper and poison follow-up — 21 October 2026

Adithya requested a one-shot sniper and poison damage for anyone who enters a
cloud. Inspection confirmed M93BA body damage was 90, leaving 10 HP at standard
settings; self-poison already worked but friendly-fire-off blocked allied damage.

M93BA now deals 100 body damage, with its existing 1.5× exposed-head multiplier,
finite range, cooldown and physical shield intersection. Custom health/damage
settings and spawn protection still apply. The faster M14 remains distinct.
This is requested authored tuning, not a recovered historical statistic.

Poison bypasses team immunity only. It retains solid-wall occlusion, protection,
six-second duration and 6 damage every 12 simulation ticks at 1× damage. Self
and allied deaths award no kills or team points. Spawn safety treats allied
clouds and incoming gas grenades as hazards. Other friendly-fire rules remain.

The renderer uses authoritative expiry for bloom/fade, animated smoke lobes,
rising bubbles, a pulsing full-radius boundary and a skull cue. Graphics do not
change damage geometry or introduce cosmetic particles into server simulation.

Local checks: production build; **407 unit tests and 40 server/spec tests**.
The required `pnpm check:browser` passed normal desktop/touch practice rounds.
`scripts/browser-poison-sniper.ts` separately uses one browser and two independent
scripted guests, actual movement/firing/throwing inputs, and observed snapshots.
It checks one shot against a 100 HP opponent, then damage to owner/ally/enemy
with friendly fire off; two screenshots per viewport show the cloud animation.
Raw evidence is ignored under `test-results/poison-sniper-local`.
Both viewport runs passed: one shot killed the 100 HP enemy and consumed one
sniper round; the first cloud pulse reduced owner, ally and opponent from
100 to 94 HP with friendly fire off. No browser errors were reported. The
desktop and phone cloud screenshots were visually inspected.

Live verification runs the same harness after deployment with the Fly
`APP_URL` and `REPORT_TAG=poison-sniper-live`. Local results do not imply live
verification. Screenshots and automation are not a human balance playtest or
a new maximum-activity performance soak.
