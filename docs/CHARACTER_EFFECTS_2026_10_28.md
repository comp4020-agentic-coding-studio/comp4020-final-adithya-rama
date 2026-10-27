# Character artwork and combat feedback — 28 October 2026

## Reason for this follow-up

Adithya found that lethal normal grenades lacked the breakup effect already used
for rockets, and rejected the quality of the hair and eyebrow artwork. The
previous automated checks established selectable, persistent choices and rocket
feedback; they did not establish visual satisfaction or complete explosive-cause
coverage. This revision addresses those specific gaps and the additional event
paths found in the [combat completeness audit](COMBAT_COMPLETENESS_AUDIT_2026_10_28.md).

## Character workshop

- Original shaded face geometry, two eyes, shaped brows, integrated eyewear,
  headgear and facial hair replace the previous coarse face shapes.
- Twelve hairstyle silhouettes include cropped, bob, ponytail, braids, curly,
  bald, side part, undercut, waves, high bun, afro and locs. Existing saved values
  remain valid; new styles are additive.
- A shared head path catalogue draws both the SVG portrait and live Pixi pilot.
  A bounded cache avoids rebuilding paths every frame. The full preview has
  revised armour, fabric, straps, gloves, boots and equipment detail.
- Head categories open a large face view. Full pilot framing remains available;
  framing changes do not alter saved headgear or other appearance settings.
  Choice tiles expose the selected feature when headgear would hide it.
- Keyboard tabs, labelled radio choices, mobile layout, reduced motion and save
  failure handling remain supported. Customization changes no health or hitbox.

## Combat feedback

- Physical blast deaths use the server's blast origin, covering frag, rockets,
  RG6, mines and the saw's terminal explosion. Direct saw cuts, ordinary bullets,
  poison and electrical EMP are not misclassified as physical explosions.
- Nonlethal explosions do not create body fragments. Debris remains bounded,
  collides with terrain, expires, and respects the reduced-blood preference.
- Shield contact receives visible directional feedback as well as its sound.
- Explosion shake attenuates with distance. Small casing/blood particles use
  zero gravity on Lunarcy consistently with the larger debris.
- EMP grenades carry an electrical effect kind for an electrical visual/audio
  response. Same-weapon dual shots have separate discharge identities while
  shotgun pellets still share one firing cue.

## Verification status

Local production verification passed on 28 October (AEDT):

- `pnpm build`, `pnpm check`: typecheck, 510 unit tests and 40 server/spec tests.
- `pnpm check:evidence`: the three existing reflections and cited commits resolve.
- `APP_URL=http://localhost:8140 pnpm check:browser`: completed desktop and touch
  phone practice rounds at 1920×1080 and 390×844.
- `scripts/browser-creator.ts`: every appearance option selectable; persisted
  choices survive reload; framing preserves equipment; failed saves remain
  recoverable; reduced motion stops preview animation; no horizontal overflow.
- `scripts/browser-combat-effects.ts`: real desktop/touch inputs with an
  independent guest. A frag killed two full-health pilots; both sessions agreed
  on victims and blast position. Normal rendering produced 38 pieces; reduced
  blood left four equipment pieces. EMP produced an electrical pulse and no
  fragments, leaving both pilots alive at 91 HP. Rocket, flame and saw checks
  still passed. No browser errors; peak effect counts 46 desktop / 59 phone.
- Inspected original-art contact sheets, detail tiles, actual SVG workshop,
  and actual Pixi pilots in both directions, standing/crouched, including unarmed
  arms/gloves. The head geometry has a 128-entry cache. The geometry-only CPU
  fixture is not an FPS or end-to-end performance claim.
- Read-only pre-release live persistence check restored the existing guest and
  exact historic match-detail digest; no baseline was replaced.

The build retains a Vite advisory about the main chunk exceeding 500 kB
(about 164 kB gzip). Deployment and live acceptance are pending. Artwork sheets
and automated checks do not establish the user's visual satisfaction.

## Remaining presentation work

Throw-arm/release animation, grenade rotation/contact sound and explicit bullet
wall-impact feedback remain recorded gaps. This pass does not claim every small
presentation detail is finished or that original Mini Militia assets were used.
