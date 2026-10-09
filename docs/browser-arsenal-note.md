# Desktop arsenal browser evidence

For changed October code, see [October validation](OCTOBER_VALIDATION.md). The measurements below describe the earlier release.

Executed on 4 October 2026 against a production client build served locally on port 8094, using Playwright Chromium at 1920 x 1080. The server used a temporary SQLite database, which was removed after the check; the isolated server was stopped.

## Reproduce

```sh
mise exec -- pnpm build
mise exec -- node scripts/browser-arsenal.ts
```

The script creates authenticated private training rooms through the HTTP API, joins through the visible invitation dialog, and starts rounds through the lobby. Gameplay uses real keyboard input. It observes outgoing WebSocket input frames and incoming authoritative snapshots/events; it does not change browser-side game state or simulation objects.

## Observed results

- All 21 firearms showed the correct weapon in the HUD, sent fire input, consumed ammunition, and produced their corresponding authoritative shot or projectile event/state.
- The machete produced an authoritative melee event. The riot shield entered dual wield with a compatible sidearm and produced frontal-block events against a training bot.
- The player physically walked through Test Range pickups, selected grenade types with the keyboard, and threw fragmentation, gas, EMP and proximity mines. Fragmentation and EMP explosion events, a gas area, and an attached/armed mine were observed.
- Every session followed End round -> saved confirmation -> Leave. Personal history returned 24 completed sessions.
- No page errors or browser console errors were recorded.
- The TypeScript check also passed after adding the script.

Machine-readable results and screenshots are generated under `test-results/browser-arsenal/`, including `report.json`, per-weapon gameplay/results images, and grenade images. These generated files are ignored by Git. The AK-47 HUD screenshot and gas screenshot were visually inspected.

This evidence covers the local desktop browser and transport/render/HUD integration. It does not establish damage correctness for every weapon against human opponents, balance, phone arsenal coverage, network-latency tolerance, or live deployment. Those require their respective simulation, browser, multiplayer, playtest and deployment checks.
