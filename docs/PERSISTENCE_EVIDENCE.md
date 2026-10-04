# Persistence and connection acceptance evidence

- Run: 2026-10-04T12:43:24.798Z (UTC).
- Result: **PASSED**; elapsed 27 seconds.
- Image: `sha256:5673780050c5bc854220761271884ed31277c8b082b6919c33b829a88e0a6f20`.
- Environment: isolated local Docker container, 1 CPU, 256 MiB memory, dedicated volume, localhost port 8085.
- Scope: local production-image verification; this does not establish Fly deployment or human playtest results.

| Check | Observed result |
|---|---|
| Isolated production constraints | Pinned image; one CPU; 256 MiB memory; dedicated persistent volume; localhost only. |
| Server authority | Fabricated damage/score messages left both health values at 100 and scores/kills at zero. |
| Real WebSocket reconnection | 350 ms and 10.5 s disconnects restored the same participant, health and ammunition; fresh input acknowledged; no duplicate player. |
| Completed result and idempotence | Real-input PvP round saved once; repeated end/retry-save commands preserved one history row and one profile match. |
| Container restart persistence | Same opaque session restored profile, cosmetics/preferences, aggregates and exact completed match detail. |
| Container recreation persistence | Removed/recreated application container using the same dedicated volume; saved profile and exact completed result remained unchanged. |
| Room churn | Four create/join/leave cycles released all rooms without exhausting waiting-room capacity. |
| Interrupted checkpoint recovery | Unfinished round became interrupted at its last five-second checkpoint; nonzero weapon-use progress preserved; no MVP/win or completed-match aggregate awarded. |
| Constraint verification | Docker inspect confirmed Memory=268435456 bytes and NanoCpus=1000000000. |

The script created only uniquely named/labeled test resources and removed its container and volume after the run. Session credentials and cookies were never written to this evidence.

Reproduce with `mise exec -- node scripts/persistence-acceptance.ts` after building `jet-skirmish:acceptance`. The script creates its own isolated container and does not accept a production app URL.
