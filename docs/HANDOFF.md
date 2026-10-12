# Integration handoff: October 13 combat and arena revision

Continue the existing game. Read [the current revision contract](REVISION_2026_10_13.md),
[feature checklist](FEATURES.md) and [acceptance evidence](REVISION_2026_10_13_VALIDATION.md).
The October 10 release is historical context, not evidence for changed code.

## Current behavior

- Physical shield panel paired only with machete; firearm selection drops it.
  Exposed head/rear rays remain vulnerable. One-hit machete respects walls,
  friendly-fire policy and protection; sniper head damage is proportional.
- Distinct gun silhouettes, authored range falloff, bounded projectile travel,
  authoritative launcher firing events, small-gun dual wield.
- Spawn four grenades (2 frag/1 flash/1 gas), auto-collect to six, T changes stocked
  types, G throws. HUD shows bag capacity and every allowed type.
- Live killer-follow until respawn, self/environment fallback, rocket-only
  bounded debris. Reduce shake & debris disables that motion.
- Six arenas: Outpost Yard, Skyshaft, Cryptworks, Crosscurrent, Sirocco Dunes and
  Sunspire Palace. Test Range is separate. All six retain own-flag routes.
- Sixteen CC0 recorded gun/voice clips, credited under src/client/public/audio.
  The user approved easily available similar sound assets as the alternate
  approach. The recordings are not Mini Militia rips. No developer contact was sent.

## Running and checking

See [DEVELOPMENT.md](DEVELOPMENT.md). Node 24.21.0 via mise; build before starting.
Use isolated databases/ports for acceptance, never the real player database.

```sh
mise exec -- pnpm build
PORT=8081 DB_PATH=/tmp/jet-acceptance.sqlite mise exec -- pnpm start
APP_URL=http://localhost:8081 mise exec -- pnpm check
APP_URL=http://localhost:8081 mise exec -- pnpm check:browser
APP_URL=http://localhost:8081 mise exec -- node scripts/browser-refresh.ts
mise exec -- node scripts/browser-arsenal.ts
mise exec -- node scripts/browser-death.ts
mise exec -- pnpm check:evidence
```

Art/audio fixture checks use a separate Vite server on 8100:
`scripts/browser-map-previews.ts` and `scripts/browser-audio.ts`.
Arsenal/death scripts create disposable servers/databases. Real-network browser
checks observe snapshots/events while driving normal controls; fixtures are
labelled separately. Raw reports/screenshots remain ignored in test-results/.

## Preserved boundaries

One shared CPU, 256 MB, one /data volume, default one active room. Do not increase
production capacity based on a short or unconstrained check. Authored balance
and hit geometry are not recovered original game physics.

The public repository and immutable crit-8 tag at
`e6b4df425c06d822c13578559610160be6bfe4f7` remain. Do not run /ship or retag.
The existing main workflow checks and deploys to
https://comp4020-final-adithya-rama.fly.dev/. Keep credentials in the configured
ignored environment and never print them. Current publication/live status is
recorded in the acceptance document, separately from local results.

Adithya directs the product, architecture and quality criteria. Preserve his
Crit 8 reflection. No returning-player/newcomer playtest, physical-phone
performance or subjective sound assessment should be invented.
