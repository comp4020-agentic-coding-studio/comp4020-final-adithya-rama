# Pilot identity, gentle aiming and the launch flow

Adithya reported that some UAT participants struggled to aim and could not find
enough character choices. He requested an optional, default-on assist, a complete
appearance editor, a loading screen and attention to small release details.
This record describes implemented choices, not a claim that new players have
already accepted the tuning.

## Reference findings and choices

| Source read | Finding | Jet Skirmish decision |
|---|---|---|
| [M93BA community guide](https://doodlearmy2.fandom.com/wiki/M93BA) | Describes lethal headshots, weaker body shots, a four-round magazine, slow firing and a wide scope. | Preserve Adithya's explicitly requested 100-damage body shot at standard room settings. Our five-round magazine, finite range and camera levels remain authored tuning, not recovered v4 statistics. Shields, protection and room multipliers still apply. |
| [Garena's official aim-mode explanation](https://ffsoporte.garena.com/hc/es-419/articles/360031211792--Cu%C3%A1l-es-la-diferencia-en-los-tipos-de-miras) | Describes default chest-focused assistance within a small radius, scope precision and full manual control. | Use the concept of limited assistance, not a copied targeting algorithm. Our correction is weaker, stateless and never locks or fires for the player. |
| [Classic settings guide](https://mini-militia-classic.fandom.com/wiki/Settings_(Gear)) | Describes aim dots/laser, callsigns, scope preferences and visual/sound settings. Aim dots are visual aids; the page is not proof of target magnetism in v4. | Add a separate saved dotted sight guide. Keep movement independent of aim and the camera centred, as Adithya requested. |
| [Classic character collection](https://mini-militia-classic.fandom.com/wiki/Classic_Collection) | Shows varied named character designs. This is a visual reference rather than a specification of combat advantages. | Four original starting looks plus independent appearance choices, rendered in original SVG/Pixi artwork. All looks share the same gameplay dimensions and stats. |

The community wikis mix Classic and historical material; they are not a single
verified v4 balance specification. No proprietary sprites or wiki audio were
copied. Existing sixteen CC0 recordings and their [credits](../src/client/public/audio/CREDITS.md)
remain. New armoury **Listen** buttons let players compare the actual in-game
firearm recordings and authored special-weapon sounds before joining.

## Character creator

Open **Customize pilot** on the home screen. Edit the callsign, colour, male/female
body style, armour/flight suit/jacket/dress, headgear, hairstyle, hair colour,
facial hair, eyewear, skin/material and emblem. Vanguard, Nova, Rook and Vesper
are editable starting looks; they do not overwrite the player's name.

The preview updates immediately. Save confirms the server write before closing.
The server validates choices and stores them in the existing guest profile.
Legacy three-field pilots receive defaults for new fields. The lobby and match
roster carry appearance; bots use varied original starting looks. Outfit colour
remains personal, with a team shoulder marker and the existing green ALLY/red
ENEMY nameplates. Cosmetics do not affect health, shields or hitboxes.

## Assistance contract

- Enabled by default when no saved preference exists. Optional in both the
  creator and the in-match field menu; the choice persists.
- Uses only currently server-authorized, alive, unprotected enemy actors within
  weapon range and a solid-terrain line of sight. It uses the displayed interpolated
  position, while revoking visibility immediately from the latest snapshot.
  Never assists toward teammates,
  hidden opponents, dead players or a target outside the cone.
- For hitscan/beam weapons, a near miss within 6 degrees receives 25% of the
  chest-angle error as correction, at most 1.5 degrees. Precision weapons use
  a 2-degree cone and at most 0.5 degrees.
- A manually aimed ray already intersecting a visible enemy body is untouched,
  preserving deliberate headshots. Corrections are recomputed from raw input,
  never accumulated; leaving the cone immediately removes assistance.
- Does not lead moving targets, steer rockets, curve grenades, swing melee,
  automate firing or alter recoil/spread, ammunition, damage or server authority.
- Mouse, keyboard and touch share the same final aim path. Movement still never
  selects the gun direction.

The separate dotted sight guide shows a short stretch of gun direction and stops
at solid walls. It does not highlight targets or promise a projectile trajectory.
The chosen assistance strength still needs human feedback under latency; passing
tests does not establish that it feels optimal.

## Launch and recovery details

The initial page has a visible hangar screen, including before JavaScript loads.
Guest-session startup has a twenty-second timeout and a working retry button.
Match loading shows the selected pilot, map and mode, with separate arena-ready
and live-snapshot stages. It ends as soon as both are ready: no artificial wait
or invented percentage. Slow connections and rendering failures have a visible
message and a leave action. Desktop and touch get appropriate control tips.

The acceptance run exposed a swallowed preference-save failure. The save helper
now reports success/failure, and the new aim/sight toggles roll back on failure
with an explanation. The creator prevents duplicate submissions while saving.
The homepage arena count now follows real map data. Phone pickup prompts say
“Pick up” rather than presenting only a desktop key.

## Verification

Local production verification uses an isolated database on port 8113:

```sh
mise exec -- pnpm build
PORT=8113 DB_PATH=.data/pilot-assist.sqlite mise exec -- pnpm start
APP_URL=http://localhost:8113 mise exec -- pnpm check
APP_URL=http://localhost:8113 mise exec -- node scripts/browser-pilots.ts
APP_URL=http://localhost:8113 mise exec -- pnpm check:browser
mise exec -- pnpm check:evidence
```

Targeted unit checks cover legacy/sanitized cosmetics, finite drawing geometry,
aim limits, direct head/body hits, friendly/protected/dead/out-of-range actors,
walls, angular wrap, precision limits, projectile exclusions, actual authoritative
sniper near-miss correction, and loading completion/failure cleanup.

The two-browser acceptance checks real saved profiles across reloads, distinct
identities, matching cosmetic rosters, delayed-snapshot loading, aim/sight
preferences, failed-save rollback, startup retry, sound-file delivery and saved
results. It delays snapshots and injects HTTP failures only in the test browser;
it does not fabricate authoritative match outcomes. Screenshots are retained
under ignored `test-results/pilots-local/`. Desktop is 1920×1080; touch phone is
390×844. These are automated Chromium checks, not physical-device UAT.

Final local checks passed: 425 unit + 40 server/spec tests, the two-browser pilot
acceptance, desktop/phone practice rounds, evidence checks and diff validation.
Live publication and verification are separate:
run the same pilot script with `APP_URL` set to the Fly URL and
`REPORT_TAG=pilots-live` after deployment, when the active-room slot is free.

### Live verification

Release `e78a1fbbc2636abb90f52a91a6503097c9403cfa` passed the normal
[checks and deployment workflow](https://github.com/comp4020-agentic-coding-studio/comp4020-final-adithya-rama/actions/runs/39468510671).
The live site served `index-n1mj-T3g.js`. On 21 October 2026 at 04:46 AEDT,
`scripts/browser-pilots.ts` passed against the Fly URL in independent desktop and
touch-phone contexts, with no page errors. Both profiles retained their full
appearance across reloads, both clients received matching cosmetic rosters,
startup retry and delayed-snapshot loading behaved correctly, aim/sight settings
persisted and failed saves rolled back, all sixteen credited sound clips loaded,
and both players received saved results. Evidence: ignored
`test-results/pilots-live/report.json` and the accompanying screenshots.

The existing acceptance guest and completed match also passed read-only
`scripts/live-persistence.ts verify pilot-release`. Its saved match detail
retained SHA-256
`43c2db246e749f66f281c76f3cc2a094ee17733b3378de2bd47940d070bdfa5e`.
The harness normalizes only the documented defaults for new avatar fields when
comparing its older baseline; it does not overwrite that baseline or relax
identity, existing preferences, statistics, history or match-detail checks.
The exact independent baseline remains private in ignored `.data/`.

Live browser checks establish behaviour and persistence. They do not establish
subjective aim balance, physical-device performance or sound resemblance.
