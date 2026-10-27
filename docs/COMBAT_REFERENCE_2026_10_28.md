# Combat reference audit — 28 October 2026

Baseline: `f4b2500`. This records research and defects found before implementation;
it is not test or deployment evidence. The user's latest request supersedes the
21 October one-shot-body sniper tuning. Original artwork and licensed replacement
audio remain the asset policy.

## Sources and version boundaries

Developer announcements were read directly. The older Doodle Army 2 wiki article
bodies below were accessible. The requested Classic wiki returned robots, 402 or
cache errors on direct retrieval; relevant search-indexed article text was read
where available. No original executable, source code, collision mask or
frame-by-frame gameplay measurement was inspected in this pass.

| Source | Finding and limit |
| --- | --- |
| [Developer: Classic v4 configuration, February 2023](https://groups.google.com/g/mini-militia-classic-alpha-force/c/q04io0qi72c) | The developers describe a particular MMC configuration as similar to v4.0.42, rather than saying every contemporary mechanic exactly reproduces it. They also report a then-known crouch-defense defect. |
| [Developer: sniper and CV4 cover clarification](https://groups.google.com/g/mini-militia-classic-alpha-force/c/CecBQ5mszok) | Weapon-distance attenuation was disabled for CV4 games from v0.9.2. The restored crouching head-cover mechanism is distinct from the carried riot shield. Later sniper magazine changes discussed here concern non-CV4 loadouts. |
| [Developer: March 2022 damage investigation](https://groups.google.com/g/mini-militia-classic-alpha-force/c/b0YONZIZcJw) | Earlier versions had differing damage paths and defects across modes; later alpha behavior therefore cannot establish one exact historical-v4 formula. The developers explicitly identify inadequate intermediate-range testing as a problem. |
| [Community: M93BA](https://doodlearmy2.fandom.com/wiki/M93BA) | Describes a lethal headshot and a body hit requiring another shot or melee follow-up. Recommends a riot shield against sniper fire. This supports the requested head/body distinction but supplies no reliable numeric hit-region dimensions. |
| [Community: Riot Shield](https://doodlearmy2.fandom.com/wiki/Riot_Shield) | Describes protection from bullets when pointed at the attacker, with exposed directions remaining vulnerable. It describes explosions, flame and melee as counters, and allows handheld equipment combinations. It does not substantiate a specific shield blast-reduction coefficient. |
| [Community: Saw Gun](https://doodlearmy2.fandom.com/wiki/Saw_Gun) | Describes wall rebounds, danger to the shooter from returning blades and eventual explosion (approximately five seconds). It supplies no surface-normal equation, collision radius or trustworthy damage curve. |
| [Community: Frag](https://doodlearmy2.fandom.com/wiki/Frag) | Describes a timed grenade rather than impact detonation. Its approximate fuse description is not sufficient reason to silently replace this project's established fuse. |
| [Community: grenade impact blocking](https://doodlearmy2.fandom.com/wiki/Tips_and_Tricks) | Describes crouching as reducing nearby grenade damage, with a warning about a grenade directly underneath. This is not evidence that a held shield provides the same defense. |
| [Classic: Items & Weapons](https://mini-militia-classic.fandom.com/wiki/Items_%26_Weapons) | Search-indexed text identifies a travelling rocket that explodes on impact, a dual-hand shield, and weapon-specific behaviors. The page mixes later MMC material; its tables are not imported as an original-v4 numerical specification. |
| [Classic: How does Damage Work?](https://mini-militia-classic.fandom.com/wiki/How_does_Damage_Work%3F) | Search-indexed text discusses changing modern attenuation models. The later developer clarification above is the stronger evidence for CV4's no-attenuation rule. |

The requested **partial directional blast shielding** is deliberate Jet Skirmish
tuning. It should not be presented as recovered original-v4 behavior: the
accessible shield article instead describes explosives as a counter. The user's
knife-only shield pairing also remains a project rule, despite broader pairings
in the reference. No source above establishes the original direct-impact damage,
blast coefficients, grenade damage radius, exact recoil or cosmetic animation.

## Confirmed baseline defects and implementation implications

- `combat-geometry.ts` places a vertical shield using only the sign of
  `cos(aim)`. Aiming upward cannot protect the head. Rendered coverage,
  current-state collision and lag-compensated historical collision need the same
  rotated shape; an axis-aligned bounding rectangle alone would falsely block
  shots beside a diagonal panel.
- `explode` has no held-shield attenuation. Its target height is fixed at
  `y - 22`, including crouched actors, and its radial damage starts decreasing
  immediately from a point. A floor grenade loses damage before reaching even
  a player standing directly above it. Use posture-correct geometry and an
  explicit close-blast policy; do not merely increase every radius.
- A rocket hitting a body takes the ordinary splash path. Direct impact needs
  an explicit authoritative result, separate from distance-based damage to
  nearby actors, without accidentally damaging its direct victim twice.
- `advanceProjectile` chooses bounce axis using a coordinate tolerance, ignores
  the remaining travel time after an impact, and fired saws have point geometry.
  Use swept geometry with an explicit contact normal and bounded remaining-time
  processing. Preserve tangent velocity on a smooth wall reflection; handle
  corners without repeated zero-distance contacts.
- Saw contact excludes the owner forever, although the reference describes
  returning-blade self-harm. A launch clearance rule can protect the muzzle
  while allowing a bounced disc to threaten its shooter. Damage bookkeeping
  must prevent dozens of hits while one disc remains overlapping a body.
- M93BA body damage is 100 at the baseline. Restore the requested two-body-hit
  behavior and lethal uncovered head hit at standard room settings. Keep
  health/damage multipliers, protection, cover and finite weapon range explicit.

## Acceptance cases to retain or add

1. Shield left, right, up, down and diagonal: bullets stop only when the actual
   panel is encountered before the body; rear shots and uncovered edges pass.
   Historical shield pose and historical body pose agree during compensation.
2. Direct rocket hits standing/crouched shield users at normal settings; splash
   reaches several actors once each, decreasing with distance. Compare a
   shield facing the blast with the same actor facing away. Exercise a nearby
   stone, a fully intervening wall, wall-edge exposure, spawn protection and
   the room's friendly-fire rule. Preserve poison's separate all-team rule.
3. Frags at the feet, near/far positions and just outside radius; stance uses
   actual height. Damage and impulse obey the same eligible-target checks.
4. Sniper chest hit survives, second chest hit kills; uncovered head hit kills;
   upward shield intercepts an overhead headshot. Test altered room health and
   damage rather than treating the default result as unconditional.
5. Saw shallow/steep wall, floor, ceiling and corner impacts; thin walls cannot
   be crossed, speed does not grow, tangent direction is preserved, and a tick
   with a bounce can still hit a later actor. Test shooter return, multiple
   bodies, shield contact, repeat overlap and one terminal explosion.
6. Damage events and cosmetic effects agree across independent clients, while
   concealment, reduced blood/flash options and bounded effect counts remain.

Automated checks can establish these rules, not subjective balance or exact
Mini Militia resemblance. Those still need the user's returning-player feedback.