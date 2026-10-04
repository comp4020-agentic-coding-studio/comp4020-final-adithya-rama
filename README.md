# Jet Skirmish

A 2D online jetpack arena shooter for up to eight players in the browser. It
takes its feel from the classic Mini Militia v4: run, jetpack, aim with the
mouse or a thumbstick, and fight over a small map. The characters, maps and
branding are its own.

> **Status: first playable version (crit 8).** Free-for-all, team deathmatch
> and training against bots work, with four guns and fragmentation grenades on
> one map. The signature mode, Flag Delivery, isn't built yet. The full list of
> what is and isn't done is in [the feature checklist](docs/FEATURES.md).

## What good means for this game

> **Draft for Adithya to write.** This section is yours. An agent can
> structure it, but shouldn't decide what good means, or claim what you read
> and looked at to get there. Some starting points from the agreed plan:
>
> - who it's for (returning Mini Militia players, newcomers, a handful of
>   friends in one room?), and what they should feel in the first minute
> - what "familiar" means: which parts of v4's flight, aiming and weapons must
>   feel right, and which you are deliberately changing
> - what makes a round fair, and what makes it fun, and how you'll know
>   (the plan calls for playtests with one returning player and one newcomer)
> - why Flag Delivery uses your *own* flag, and what that changes about how a
>   round plays
> - what you read or looked at while deciding (the brief's notes on the small
>   web, games for a handful of friends; Mini Militia itself)

## How to play

Open the site, then pick **Quick play** to join or open a public room,
**Practice against bots** for a solo round, or a room code from a friend. Your
pilot (name, colour and match history) is remembered in this browser.

| Action | Keyboard and mouse | Touch |
|---|---|---|
| Move | A / D | left stick |
| Jump | W | Jump |
| Jetpack | Space | push the left stick up |
| Crouch, or drop through a platform | S | pull the left stick down |
| Aim and fire | mouse, left click (or arrow keys and J / Enter) | right stick; push it past halfway to fire |
| Zoom | right click | Zoom |
| Weapon slot / swap | 1, 2 / Q | Swap |
| Reload, pick up, drop | R, E, X | Reload, Pick up, Drop |
| Grenade, next grenade type | G, T | Nade |
| Melee | V | Melee |
| Scoreboard, menu | Tab, Esc | Score, Menu |

## Modes

- **Team deathmatch**: Ember against Tide. Only enemy kills score; a level
  score at the end is a draw.
- **Free-for-all**: everyone for themselves, scored by kills.
- **Training**: you against up to three bots. Results are saved but don't
  count toward your player-versus-player stats.

The results screen shows the scoring rule: contribution is 2 × kills +
assists. An assist is at least 20% of the victim's health in damage within the
eight seconds before they die, and MVP is the highest contribution.

## How it's built

TypeScript throughout. One simulation in `src/shared/` runs authoritatively on
the server at 60 ticks a second, and the browser runs the same movement code to
predict your pilot without waiting for the network. PixiJS draws the game;
menus and HUD are plain HTML. The server is Node 24 with `ws`, and SQLite keeps
pilots and results on the Fly volume. The reasons are in
[the stack decision](docs/decisions/0001-stack.md), and the full plan is in
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Running it locally

```sh
mise install
pnpm install
pnpm build          # the browser client
pnpm start          # http://localhost:8080
pnpm check          # typecheck, unit tests, and the spec against the running app
pnpm check:browser  # plays a round at 1920×1080 and on a 390×844 phone
```

## Limits

- One live match at a time on the server, plus up to four waiting rooms and 24
  connected players.
- Your identity is a cookie in this browser; clearing site data makes a new
  pilot.
- No sound yet. Shooting isn't predicted, so your own tracers appear after one
  network round trip.
