# Combat presentation completeness audit — 28 October 2026

This is a read-only audit of the working tree during the 28 October combat
revision, prompted by the user's observation that fragmentation deaths lacked
body breakup. It is **not** a claim that every item below was fixed or shipped.
The prior published baseline was `d5458da85f33d6858079e6566eb36b691213da5c`
(following gameplay commit `2a4b400`); local changes were in progress while
this audit was written. Final verification belongs in the release record.

## Follow-up status in the working tree

The audit below records what was found before the fixes, so it remains useful
process evidence. The following corrections are now implemented locally:

- Physical blast death classification uses the authoritative explosion origin;
  direct saw cuts and electrical/poison kills remain distinct.
- Shield events now call a visible panel-contact cue only when that actor exists
  in the current authorized snapshot.
- EMP grenade events carry an optional electrical effect kind. The client draws
  an electric pulse and plays a brief electrical cue; EMP kills no longer carry
  physical-blast metadata. Older untyped explosion events still render as blasts.
- Firing events carry an optional discharge identity. Same-gun dual slots produce
  two cues, while shotgun pellets produce one per actual discharge. Legacy events
  retain their short deduplication interval; the recent-event cache is bounded.
- Renderer changes attenuate explosion shake by distance and make small cosmetic
  particles obey the space map's zero-gravity rule.

`test/combat-event-feedback.test.ts` passed six tests exercising actual audio-event
dispatch with hardware emitters replaced by recorders, plus authoritative
simulation events. Together with the directional suite, 53 tests passed in that
run. TypeScript passed. This does **not** claim the new effects have been deployed
or that these tests reproduce their sound through real speakers.

Throw/release animation, grenade bounce/rotation/contact sound, explicit bullet
wall-contact effects, generic melee-slash direction and separate headshot labels
remain recorded presentation limitations. They are not silently marked complete.

Nonlethal hit particles currently follow a decrease in snapshot HP rather than an
authoritative damage-cause field. Consequently EMP and poison damage can still
produce the same small generic blood puff as physical hits, unless reduced blood
is enabled. Electrical detonation and death classification are now distinct;
this remaining cosmetic distinction is recorded, not claimed fixed.

The final integration review found no release-blocking defect in the shared
SVG/Pixi path catalogue and bounded appearance cache, creator controls preserving
saved appearance, optional event-field compatibility, shield visibility filtering,
or physical-blast classification and preference handling. This is a source review;
it does not replace the separately recorded browser and deployment evidence.

## Concrete omissions found at the start of this audit

| Priority | Evidence in the audited code | Consequence | Suggested bounded correction |
| --- | --- | --- | --- |
| High | `Renderer.addDeath` gates fragments with `isRocketDeath(weapon)`, which recognizes only `smaw`, although authoritative kill events already carry `blast` for physical explosions. | Frag, RG6, mine and terminal saw blast deaths receive the ordinary blood puff instead of explosive breakup. | Classify the authoritative cause as a physical blast. Keep direct saw contact, poison, EMP and ordinary bullets out of explosive breakup. This fix has been assigned separately; it was not complete when inspected. |
| High | `GameSession.onEvent` has no `shield` visual handler. `GameAudio.event` does have a metallic shield cue. `addTracer` creates a spark only for `hit`, while a shield-blocked shot has `hit: false`. | A successful block can sound correct but the panel gives no visible impact confirmation, particularly when sound is muted. | Add a short bounded shield glint/contact cue at the visible panel, with reduced-flash support. Do not fabricate health damage. |
| Medium | `Renderer.addExplosion` sets camera shake to 9 for every received explosion, without checking distance. Explosion events are broadcast independently of camera location. | A far-away explosion shakes a player's view as strongly as a nearby one. | Attenuate shake by camera distance and retain the explicit reduced-shake preference. |
| Medium | `GameAudio.event` deduplicates `shot` events by shooter plus weapon within 18 ms. Two same-weapon dual slots share that key. | Simultaneous dual Uzis or pistols collapse to one firing sound. Shotgun pellets correctly need one sound per discharge, but two actual guns are separate discharges. | Add slot/discharge identity to authoritative firing events and deduplicate pellets within that discharge. Preserve independent shooters. |
| Medium | `explode` emits only position and radius. EMP grenade explosions therefore take the same `addExplosion` and bass/noise audio path as frag/rocket explosions. | Electrical EMP detonation appears as an ordinary orange fireball, despite a blue disabled-flight ring on affected actors. | Carry an effect kind and select an electrical pulse rather than physical blast styling. Keep EMP damage/flight rules separate. |
| Medium | `throwGrenade` updates inventory and creates a projectile, but emits no throw event. `PlayerSnap` carries no throwing pose; `throwUntil` remains simulation-only. | There is no throw-arm or release audio cue, even though the grenade is working. | Expose a bounded release/pose event; retain server validation and visibility filtering. |
| Low | `advanceProjectile` changes grenade velocity on terrain contact without a bounce event. `drawThrowable` draws its body upright at every position. | Frags visibly travel and bounce but have no contact sound, rotation or contact puff. | Add lightweight rotation and an appropriately throttled terrain-contact cue; do not imply these are missing collision rules. |
| Low | The casing/blood branch in `Renderer.frame` always adds `120 * dt * dt`; its movement does not inspect map physics. `advanceDebris` correctly uses zero gravity in space. | Small cosmetic casings/blood fall downward on Lunarcy while larger body debris coasts. | Apply the map's space rule consistently to these cosmetic trajectories. |
| Low | Hitscan `shot.hit` indicates successful body damage, not wall contact. `addTracer` only adds an impact spark for `hit`. M14/EMP projectiles emit a launch event but no distinct terminal impact event. | Bullets stop at walls correctly, but wall impacts and travelling-bullet termination lack explicit material/contact feedback. | Distinguish authoritative contact from range expiry and body damage before adding sparks/audio. |

These are observed event/data-path gaps, rather than speculative complaints about
balance. They are not all equally urgent, and a working collision or damage
system should not be described as absent merely because its feedback is sparse.

## Catalogue coverage checked

| Category | Present in the inspected implementation | Specific limit / follow-up |
| --- | --- | --- |
| Mini Eagle, Golden Eagle, Magnum | Distinct original gun outlines, per-gun recorded clip/rate/gain choices, traces, recoil, casing, reload state, pickups and HUD. | Same-weapon dual sound issue above. Subjective visual/sound differentiation still requires human feedback. |
| Uzi, Tec-9, MP5 | Different authored firing rates/spread, recorded audio variants, automatic fire, appropriate one-handed compatibility. | Uzi pair can collapse to one cue; outlines alone are not proof that every weapon is recognizable during play. |
| AK-47, M4, Tavor X95, XM8 | Rifle outlines, individual/burst behavior, recorded audio variants, reload and finite-range handling. | M4 burst has working simulation; no evidence here that it needs a new behavior. Wall-impact feedback is sparse across this group. |
| M14, M93BA | Travelling M14 round; hitscan sniper with restored head/body distinction, finite range and directional shielding. | M14 terminal contact cue absent. Sniper headshots are not separately labelled in the public event/kill feed; that is a known feedback limit, not a missing headshot calculation. |
| SPAS-12, AA-20 | Multiple authoritative pellets, distinct shotgun firing cadence/audio, deduplicated firing sound. | Dedupe must remain correct when fixing two-gun audio; do not turn one shotgun discharge into seven sound effects. |
| Minigun | Charge state, spinning gun detail, motor cue, sustained fire, HUD charge and reload. | No missing simulation behavior confirmed in this audit. |
| SMAW, RG6 | Actual projectile movement, launch sound, explosions, distance/cover damage, original gun outlines. | Explosive-death classification and universal camera shake above. Generic rocket/RG6 projectile art remains less detailed than their inventory art; aesthetic adequacy unverified. |
| Saw launcher | Current revision adds swept radius, true reflection, return-to-owner danger, piercing limits, trail, spinning teeth and contact spark inference. | Terminal blast death classification above. Impact sparkle inferred between snapshots is approximate and can miss multiple within-snapshot contacts; authoritative collision remains separate. |
| Flamethrower | Current revision has a bounded flame ribbon, heat core, wall-clipped authoritative rays and hiss. | Human judgement of the new effect remains pending; presence of a flame drawing is not proof it matches the reference's feel. |
| PHASR, EMP gun | Distinct projectile/beam colors and synthetic sounds, PHASR refill, travelling EMP and disabled-flight actor feedback. | EMP terminal contact cue and grenade detonation classification above. |
| Machete, riot shield | Melee slash/audio, blade equipment, 360-degree current shield collision and drawing, block sound. | No visible shield-contact reaction. Slash orientation is currently generic rather than carrying aim direction in its event. |
| Frag, flash, poison, EMP, mine | Five distinct inventory types; trajectories/fuses; flash impairment; visible poison area and all-team damage; EMP effect; mine arming color. | Throw/release and bounce feedback absent; physical blast-death and EMP styling gaps above. |

## Paths already present and preserved

- Nonlethal hits already update health bars and create a brief character hit
  flash/blood effect; hurt audio is throttled per actor. Reduced blood removes
  blood effects. These are not missing features.
- Reload starts have a local sound, state-driven gun pose and progress display.
  There is no separate reload-completion sound; the timer and ammunition update
  remain authoritative. No reload correctness defect was demonstrated here.
- Pickups already have a local cue and immediate inventory/HUD updates.
- Spawn protection has an actor ring/blink; death camera and kill feed are driven
  by authoritative kill events. `killPlayer` guards an already-dead victim, and
  the room drains collected events after snapshots. No duplicate-death effect
  was reproduced by this audit.
- Effects are bounded: FX list, body fragments, saw histories and audio sources
  all have caps; short motor envelopes do not persist as orphaned loops.
- Server visibility filtering removes actor-tagged events for hidden actors;
  rendering discards stale actor/saw tracks when they disappear. Any new throw,
  shield or impact event must preserve that boundary.
- Low flash, reduced blood, reduced shake, sound mute and volume are separate
  controls. Their existence was checked in code; each newly introduced cue needs
  a real preference-path test rather than inheriting an unverified claim.

## Evidence boundary

The directional revision has dedicated simulation tests and an actual-browser
plus independent-guest acceptance script. The latter observed side/upward blocks,
body damage, a full-health exposed headshot, and matching client health; screenshots
were visually inspected. Those checks do not establish every cosmetic catalogue
entry above. This audit inspected the code paths for all catalogue categories,
but did not listen to each new sound, obtain fresh human playtests, or verify a
new production deployment. The research source and historical-version boundaries
remain in [the combat reference ledger](COMBAT_REFERENCE_2026_10_28.md).