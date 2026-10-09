# Development and controls

## Run

The project pins Node 24.21.0 and pnpm 11.9 through mise. SQLite runs in a database
worker; browser assets are built by Vite. Run from the repository root:

```sh
mise install
mise exec -- pnpm install
mise exec -- pnpm build
mise exec -- pnpm start
```

The app listens on port 8080. For an isolated test instance, set PORT and DB_PATH
to a different port and database path. Never point destructive acceptance or
restart tests at a real player's database.

```sh
PORT=8081 DB_PATH=/tmp/jet-skirmish-acceptance.sqlite mise exec -- pnpm start
APP_URL=http://localhost:8081 mise exec -- pnpm check
APP_URL=http://localhost:8081 mise exec -- pnpm check:browser
mise exec -- pnpm check:evidence
```

The server exposes /healthz, /readme/, authenticated guest/profile/history APIs
and /ws. A browser gets its opaque session cookie from /api/session. Do not put
session cookies or deployment tokens in logs or commits.

## Default controls

| Action | Desktop | Touch |
|---|---|---|
| Move | A / D | left stick |
| Jump | W | Jump |
| Flight | Space, directed towards aim | left stick up |
| Crouch / drop through platform | S | left stick down |
| Aim / fire | mouse / left click | right stick |
| Directional aim + held fire | Numpad 2 / 4 / 6 / 8; combine for diagonals | right stick |
| Alternate aim / fire | arrow keys / J or Enter | right stick |
| Zoom | right click | Zoom |
| Select slot / switch | 1, 2, 3 / Tab or Q | Slot 1, 2, 3 / Swap |
| Dual wield | F | Dual |
| Reload / pick up / drop | R / E / X | matching action buttons |
| Throw / change throwable | G / T | Throw / Type |
| Melee | V | Melee |
| Scoreboard / menu | B / Escape | Score / Menu |

Holding a numpad direction fires at the selected weapon's normal cadence and
resumes after automatic reload. R reloads early. A/D sets facing when there is
no explicit aim; actual mouse movement takes over from keyboard aim. Physical
numpad key codes work with Num Lock on or off. Menu Tab retains normal focus
navigation. Dual wielding pairs the selected compatible weapon with another
compatible carried slot; the third item stays carried.

After six quiet seconds, health returns in one-point increments four times a
second. Damage, attacking and nearby enemy fire delay recovery. Standard rooms
start with two each of frag, flashbang and poison smoke (six total). EMP grenades
and mines remain available in the advanced room allowlist. Flash exposure is
shorter/weaker with distance and cover; it also impairs bots.

The controls menu saves remapped bindings with the pilot's preferences. Blur and
hidden-tab transitions clear held actions. Settings and bindings should be
checked in the current build before a human playtest.

## Scope and architecture

The server owns movement, combat, inventory, scoring, flags and bots. Shared
TypeScript implements the game rules. The browser predicts its own movement and
interpolates other players; PixiJS draws the scene and HTML supplies the menus.

The deployment remains one shared CPU, 256 MB RAM and a persistent /data volume.
The default admission limit is one active round, four waiting rooms and 24 total
connections. ACTIVE_ROOM_LIMIT=2 is available for isolated capacity acceptance;
do not enable it for players until the two-room tests pass.

Persistent data includes sessions, pilots, preferences, saved room presets,
matches, participants and weapon statistics. Unfinished matches are marked
interrupted at startup. Finalization is idempotent, and training/survival remain
separate from human PvP totals. Clearing site data loses access to that guest
identity; there is no password-based account recovery.

## Acceptance

```sh
APP_URL=http://localhost:8081 DURATION_S=60 mise exec -- node scripts/acceptance-load.ts
APP_URL=http://localhost:8081 ROOMS=2 LOAD_MODE=survival DURATION_S=1800 mise exec -- node scripts/acceptance-load.ts
```

Use isolated production containers for memory and CPU acceptance. Record image,
limits, duration, mode, client count and measurements in VALIDATION.md. A passing
short probe does not satisfy the thirty-minute soak requirement.

The Fly token is read through the course's configured mise environment. Keep
mise.local.toml ignored. The Fly application and resource shape are already
defined in fly.toml. Local success and live acceptance are separate records.

## Evidence

- [Feature checklist](FEATURES.md)
- [Validation record](VALIDATION.md)
- [Human playtest record](PLAYTEST.md)
- [Stack decision](decisions/0001-stack.md)
- [Agreed implementation plan](IMPLEMENTATION_PLAN.md)
