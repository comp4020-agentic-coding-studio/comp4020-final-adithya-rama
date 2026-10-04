# Validation record

This is an evidence ledger, not a claim of historical parity or finished balance.
Dates below are 4–5 October 2026; UTC and Australia/Sydney differ at midnight.

## Local functional verification

- Integrated check: **96 simulation tests + five touch-input tests + 32 server/API/storage/course checks**.
  TypeScript checks and the production client build pass.
- The starter HTTP and complete server-rendered README invariants are preserved.
- Desktop 1920×1080 and touch 390×844 both play a practice round, finish it,
  see saved results and find their history. Screenshots were visually inspected.
  This found a phone camera/control overlap; corrected screenshots show the pilot
  above the controls.
- [Arsenal browser run](browser-arsenal-note.md): all 21 firearms, both equipment
  entries and all four throwables exercised through real browser input, HUD and
  authoritative events. 24 saved training sessions; zero browser errors.
- [Persistence acceptance](PERSISTENCE_EVIDENCE.md): nine checks pass against a
  production Docker image limited to one CPU and 256 MiB, including restart and
  container recreation against the same persistent volume.
- Independent desktop/touch sessions agree on saved FFA, TDM, Flag Delivery and
  survival outcomes. Flag Delivery includes collecting the own flag and walking
  into the opposing goal to end at one delivery. FFA/TDM/survival used host-end
  in this smoke test; this does not replace natural timeout/limit tests.
- A separate training browser run joins a private one-player room as a touch
  spectator, then verifies the same saved result in both browsers.
- Eight preferences/room browser flows pass: persistent customization and
  preferences, key remapping, chat mute, preset save/apply and consecutive
  staged next-round settings. This exposed and fixed a stale loadout selection
  and a chat checkbox update race.
- Course evidence check passes with the supplied Crit 8 reflection and real,
  resolving commit references. Personal judgments came directly from Adithya.

## Thirty-minute capacity tests

Each test used its own production container with one CPU, a 256 MiB memory
limit, no additional swap, and two active rooms. Each collected 360 five-second
samples over 1,800 seconds. The image was
`sha256:5673780050c5bc854220761271884ed31277c8b082b6919c33b829a88e0a6f20`.
Later changes cover zero-contribution MVP award eligibility and client rendering;
this record identifies the image actually measured.

| Measure | Two PvP rooms | Two survival rooms |
|---|---:|---:|
| Human clients per room | 8 | 4 |
| Peak active enemies in each room | n/a | 8, 8 |
| Completed and saved rounds | 30 | 294 |
| Maximum process RSS | 136 MB | 140 MB |
| Highest sampled simulation p95 | 3.20 ms | 4.70 ms |
| Mean RSS, minutes 1–6 | 133.48 MB | 137.90 MB |
| Mean RSS, last five minutes | 135.00 MB | 137.00 MB |
| Maximum sampled DB queue | 0 | 1 |
| Peak container cgroup memory | 83.20 MiB | 86.92 MiB |
| Unexpected failures / OOM | 0 / no | 0 / no |

The clients continually submit legal movement, aiming, firing, switching and
throw requests, including minigun/saw and rocket/launcher loadouts for PvP.
Survival rematches exercise room lifecycle and repeated result writes. Enemy
counts of eight were observed in both rooms; they are peak populations, not a
claim that all eight were alive throughout every sample. No sustained process
memory growth appeared after warm-up. These are synthetic clients on the
development host, not simultaneous human internet play.

The deployment remains at the conservative default of one active room.
Two-room acceptance used an explicit isolated environment override.

## Network delay

An ordered bidirectional WebSocket proxy delays data and heartbeat frames.
Each row is a separate 25-second, eight-client run with a saved result and no
harness failure. Input acknowledgement age is in simulation-frame time.

| Injected RTT / jitter | Measured ping p95 | Input ack age p95 | Max RSS | Highest sampled sim p95 |
|---|---:|---:|---:|---:|
| 50 / 10 ms | 56 ms | 83 ms | 132 MB | 1.05 ms |
| 100 / 15 ms | 110 ms | 150 ms | 133 MB | 1.00 ms |
| 150 / 20 ms | 190 ms | 200 ms | 134 MB | 0.94 ms |

The actual measured RTT includes scheduling and proxy jitter; injected delay
alone is not a measurement. Synthetic delay is not evidence of all internet
conditions. Separate real 350 ms and 10.5-second disconnect/rejoin checks retain
participant identity, health and ammunition without duplicate results.

## Rendering

A controlled native Windows Chrome measurement on the developer's Intel Arc
140T GPU reached approximately 60 FPS at 1920×1080. WSL headless Chromium used
SwiftShader software graphics and was substantially slower at full resolution.
Rendering measurements and fallback details are recorded separately in
[RENDERING_EVIDENCE.md](RENDERING_EVIDENCE.md). This is measured desktop evidence,
not a claim about every PC or a physical phone.

## Live verification

Deployed at **https://comp4020-final-adithya-rama.fly.dev/** on 5 October 2026
Australia/Sydney (4 October UTC), from release commit `5d05174`.

- The full `pnpm check` command passes with APP_URL pointing at Fly: 101 local
  unit checks plus the 32-test spec suite. HTTP/API/WS checks use Fly; isolated
  storage/room tests remain local. This is not a claim that all 133 execute remotely.
- Live Playwright sessions at 1920×1080 and 390×844 agree on saved results in all
  five modes. The flag round ends naturally at the one-delivery limit with
  scores 1–0. FFA/TDM/survival smoke rounds are ended by the host. Training uses
  one human plus a separate touch spectator.
- Both viewports independently complete Practice, see saved results and return
  to their history. Zero failures were reported by the live mode harness.
- A dedicated acceptance guest saved profile/customization, submitted actual
  gameplay input, and completed a private training round. Exact profile,
  history and match details were unchanged after an explicit machine restart,
  a stopped-machine cold start, and a real redeployment. Each history query
  found exactly one matching completed result.
- Cold-start verification completed in 4.4 seconds, including the HTTP startup
  and three authenticated checks. This is one observation, not a latency promise.
- Fly status confirms one machine (`7811ed5a0e37e8`) in Sydney and one encrypted
  1 GB volume (`vol_vgn9dwn2786d6qz4`) mounted at /data. The configured shape
  remains shared CPU 1× / 256 MB, with one active room by default.
- The initial deployed image was
  `registry.fly.io/comp4020-final-adithya-rama:deployment-01M43H2HTN97NGDAYG02T59QBC`.
  Its explicit redeployment advanced the machine to version 2. Later evidence-only
  releases update these public documentation pages without changing gameplay.

The private persistence session is kept only in ignored, owner-readable local
state. Reports contain match identifiers and a detail digest, never the cookie.
The first Fly CLI DNS probe timed out contacting 8.8.8.8 over UDP; real HTTPS,
assets, WebSockets and browser checks succeeded. Subsequent deploys skip that
blocked diagnostic and still run the normal machine checks.

## Repository and cutoff

Implementation and evidence were pushed to the existing private GitHub repository.
A pre-publication scan checked seven reachable commits, 105 historical blobs and
86 current files without finding credentials. The course hook also passed.
Local credentials, database files and raw test reports are ignored and excluded
from the Docker build context. This is bounded scan evidence, not a guarantee
about every possible secret format.

The supplied group is Dàchī, Wednesday 10:30am. Its cutoff is Wednesday
7 October 2026, 08:30 Canberra/Sydney. Public publication, successful course CI
and the annotated `crit-8` tag remain pending; they have not been claimed.
Starting /ship exactly at the cutoff would finish its CI/tagging afterward.
The user has been asked to choose earlier scheduled publication or their own /ship.
No publication automation has been created while that timing choice is pending.


## Human evidence and limits

The [playtest template](PLAYTEST.md) remains unfilled: no returning-player or
newcomer feedback has been invented. Weapon tuning, fairness, sound and enjoyment
still require that evidence.

The in-app browser runtime could not start because of a Windows sandbox helper
failure. The repository's standalone Playwright checks were used instead.
Raw reports and screenshots are under ignored `test-results/`; durable summaries
are recorded here and in linked evidence files.
