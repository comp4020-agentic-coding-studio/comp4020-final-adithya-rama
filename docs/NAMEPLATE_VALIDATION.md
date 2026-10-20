# Readable player identification — 21 October 2026

Adithya reports that players cannot reliably read names or distinguish teams.
The previous 11-world-unit text shrank with zoom and used one colour for everyone.

Nameplates now use 13 CSS-pixel bold text, dark backing and a matching health
bar. The viewer's teammates are green `ALLY`, opponents red `ENEMY`, and the
viewer green `YOU`. Text remains useful without colour discrimination. Either
team receives the same relative treatment. Free-for-all opponents are enemies;
spectators see the actual Ember/Tide labels rather than an invented allegiance.
Long names are abbreviated on the plate; the roster retains full names.

Nameplates use only actors already permitted by the server. Concealed enemies
receive no marker; authorized allies remain identifiable. Dead or absent actors
have no lingering label. Screen-space placement separates nearby labels and
connects each to its actor with a small line. Off-screen actors get no label;
when the playable screen cannot fit all labels, an unplaceable label is omitted
rather than overlapping another name.

## Verification

- Unit cases cover both team perspectives, free-for-all, spectators,
  concealment/death, Unicode names and crowded phone placement.
- `scripts/browser-nameplates.ts` joins one browser and two independently
  authenticated scripted guests to a private TDM round. Normal authoritative
  inputs bring the guests into view; read-only render diagnostics check colours,
  name text, font size and non-overlap at desktop/phone widths and Near/Far scopes.
- The first screenshot review found overlapping names at phone Far scope. The
  corrected layout and additional non-overlap assertion address that finding.
- Local verification commands: production build, `pnpm check`,
  `pnpm check:browser`, and `APP_URL=http://localhost:8111 node scripts/browser-nameplates.ts`.
  The integrated check passed **398 unit tests and 40 server/spec tests**.
  Desktop and touch-phone practice rounds passed; four nameplate views passed
  across separate desktop and touch-phone contexts with Near/Far scopes.
  Local raw reports/screenshots are ignored under `test-results/nameplates-local`.
- Live verification is a separate post-deployment step using the same script
  with the Fly `APP_URL` and `REPORT_TAG=nameplates-live`. The local results above
  are not a claim of live deployment or human acceptance.
