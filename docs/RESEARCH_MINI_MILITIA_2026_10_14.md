# Mini Militia research and Jet Skirmish gap review

Date: 14 October 2026. Baseline inspected: `eb9488a`.
Status: research and planning, not an implemented or deployed revision.

## What was actually inspected

Read relevant wiki article bodies through search-indexed copies; direct web retrieval often returned robots/402/cache errors. A separate Chrome browser inspection successfully opened the live Maps catalogue, its labelled full-resolution images and Game Modes. Eight map images were visually inspected. Developer announcements were opened directly. The supplied screenshots were also inspected.

This is a broad review of the game's systems, not a claim to have played original v4, watched every linked video, listened to its audio, read every wiki revision, or recovered source code. Embedded scope/tutorial videos were discovered but not assessed frame by frame. Exact motion, audio resemblance and original collision masks remain unverified.

The wiki combines original DA2 v4, later MMC Classic-v4 rules and newer MMC features. Its weapon table says v0.10.5; its map catalogue says beta v0.14.4 (88). Several articles are incomplete or internally inconsistent. Every implementation value needs a provenance label: developer-confirmed behavior, community description, observed reference image, direct user requirement, or authored tuning.

## Main conclusion

The present game has a substantial functional foundation, but a catalogue of weapons and differently coloured arenas does not establish the reference game's feel. The largest gaps are weapon-specific behavior, the relationship between camera and reach, useful crouching/cover, authored route topology, foliage, equipment handling feedback and traversal-aware bots. The next revision should make these systems agree before adding more catalogue entries.

## Source ledger and bounded findings

These are concise paraphrases, not copied guides. Proposed implementation details belong in the [revision plan](REVISION_2026_10_14_PLAN.md).

| Source | Relevant finding / confidence boundary |
|---|---|
| [Developer: v0.10.5](https://groups.google.com/g/mini-militia-classic-alpha-force/c/q04io0qi72c) | CV4, zero loadout spending, CV4 weapon positioning and disabled enhanced visuals are described as resembling v4.0.42. This is an approximation target, not proof that all modern wiki values belong to original v4. |
| [Developer: February 2023 clarification](https://groups.google.com/g/mini-militia-classic-alpha-force/c/CecBQ5mszok) | Confirms CV4 attenuation was disabled and classic crouched-head blocking restored; the reduced sniper magazine discussed there targets non-CV4 loadout games. |
| [Developer: v0.8.0](https://groups.google.com/g/mini-militia-classic-alpha-force/c/XZu9vEOlIDg) | Documents a different damage model: full power through half range, decreasing thereafter. Older announcements cannot silently override the later CV4 distinction. |
| [Developer: v0.9.5 scope changes](https://groups.google.com/g/mini-militia-classic-alpha-force/c/paDo7y2AlcQ) | Explains newer scope/panning stabilization and expressly acknowledges differences from v4. Camera position, scope transition and aim guides are related but separate systems. |
| [Classic V4](https://mini-militia-classic.fandom.com/wiki/Classic_V4) | CV4 is a selectable ruleset; its intended historical target is v4.0.42. |
| [Items & Weapons](https://mini-militia-classic.fandom.com/wiki/Items_%26_Weapons) | Describes distinct firing, projectile, charge, reload and equipment behavior. Its malformed table cannot be imported as a complete v4 specification. |
| [How does Damage Work?](https://mini-militia-classic.fandom.com/wiki/How_does_Damage_Work%3F) | Separates CV4 full-range damage from evolving modern attenuation. Do not combine numbers from different eras into a supposedly exact v4 model. |
| [Crouching Guide](https://mini-militia-classic.fandom.com/wiki/Crouching_Guide) | Grounded crawling changes the hit regions. Classic head cover blocks shots; advanced crouch lets shots pass through that region. It describes grenade protection without giving a complete coefficient. This is different from physical riot-shield cover. |
| [How Scope/Zoom Work](https://mini-militia-classic.fandom.com/wiki/How_Scope/Zoom_Work) | Describes per-weapon selectable scope levels and saved device preferences. These modern options can inform a PC improvement without being labelled an original-v4 feature. |
| [Settings](https://mini-militia-classic.fandom.com/wiki/Settings_%28Gear%29) | Separates scope switching, panning, weapon offset, sound, blood and enhanced effects. Some numeric prose is corrupt; use behavior descriptions, not literal malformed values. |
| [Field of View](https://mini-militia-classic.fandom.com/wiki/Field_of_View) | Explains that changing visible world area changes perceived speed and that unequal axis scaling distorts the view. More visible detail also has a rendering cost. |
| [Game Controls](https://mini-militia-classic.fandom.com/wiki/Game_Controls) | Touch positions/sizes, opacity and optional controls are configurable. Useful precedent for an editable touch layout. |
| [Armory: Specials](https://mini-militia-classic.fandom.com/wiki/Armory%3A_Specials) | Covers reload continuation, regeneration, boost, accuracy and equipment modifiers. Regen multipliers conflict within the article, so no exact historical recharge rate is adopted. |
| [Default Loadouts](https://mini-militia-classic.fandom.com/wiki/Armory%3A_Default_Loadouts) | Includes Uzi with shield. Our knife-only pairing is an explicit user customization, not a documented universal Mini Militia rule. |
| [Custom Loadouts](https://mini-militia-classic.fandom.com/wiki/Armory%3A_Make_Custom_Loadouts) | Describes named combinations of primary, secondary, dual equipment, throwables and specials. Our three-slot inventory remains a separate PC choice. |
| [Loadouts in Quick Play](https://mini-militia-classic.fandom.com/wiki/How_Loadouts_Work_in_Quick_Play) | Describes server-approved respawn selections and conditions under which a picker appears. A clean default fallback matters more to this project than copying its currency workflow. |
| [Why Loadouts?](https://mini-militia-classic.fandom.com/wiki/Why_Loadouts%3F) | Frames equipment choice around access and strategy. Supports keeping all Jet Skirmish gameplay equipment available from the start. |
| [Maps](https://mini-militia-classic.fandom.com/wiki/Maps) | Live catalogue names 20 maps for a later beta. Labels and images identify layouts; they do not disclose exact hit geometry, pickup coordinates or original physics. |
| [Map designing](https://mini-militia-classic.fandom.com/wiki/Map_designing_in_Mini_Militia_Classic) | Community historical account and map list; unfinished and less reliable for chronology or physics. |
| [Custom map construction](https://mini-militia-classic.fandom.com/wiki/How_to_Make_Custom_Maps) | Identifies Tiled/Inkscape and discusses collision layers and server-owned spawning. Supports explicit map layers rather than treating every opaque image pixel as solid. |
| [Player spawning](https://mini-militia-classic.fandom.com/wiki/How_Player_Spawning_Works) | Spawn selection considers threats, players, teams, map and mode. The scoring coefficients are not published. |
| [Game Modes](https://mini-militia-classic.fandom.com/wiki/Game_Modes) | Live article is incomplete: enemy-flag CTF, rotating VIP, survival/training stubs and CV4 as a ruleset. It does not supply complete PTB or survival rules. Our own-flag delivery remains unchanged. |
| [Create a Game](https://mini-militia-classic.fandom.com/wiki/How_to_Create_a_Game) | Differentiates quick entry and configurable social rooms, including maps, teams and passwords. The original's player limits, billing and LAN do not replace our agreed online eight-player scope. |
| [Tips & Tricks](https://mini-militia-classic.fandom.com/wiki/Tips_%26_Tricks) | Emphasizes map knowledge, weapon roles, crouching and practice. Useful tasks for observed playtests, not numerical balance evidence. |
| [Avatars](https://mini-militia-classic.fandom.com/wiki/Avatars) | Character identity and editing are distinct from gameplay equipment. Cosmetic helmets should not imply undocumented armor bonuses. |
| [Experience & Rank](https://mini-militia-classic.fandom.com/wiki/Experience_Points_%26_Rank) | Distinguishes ranked and custom-game statistics. It does not justify mixing bot farming into human PvP aggregates. |
| [Battle Coins & Tokens](https://mini-militia-classic.fandom.com/wiki/Battle_Coins_%26_Tokens) | Separates equipment budgets and progression; parts are visibly incomplete. No currency or scoring formula is imported into this project. |
| [Feature Requests](https://mini-militia-classic.fandom.com/wiki/Feature_Requests) | Voice and clans are discussed as requests/plans, not proof of released functionality. Avoid treating roadmap ideas as missing v4 features. |
| [Connection Issues](https://mini-militia-classic.fandom.com/wiki/Connection_Issues) | Distinguishes rendering load from network trouble. Our testing must likewise separate FPS, server tick time and latency. |
| [Weapon Cloning](https://mini-militia-classic.fandom.com/wiki/Weapon_Cloning) | Explicitly identifies duplication as an exploit removed for fair play. We should preserve legitimate drops, not reproduce duplication. |
| [Custom Mods](https://mini-militia-classic.fandom.com/wiki/Custom_Mods) | Emphasizes shared, visible custom rules. Public room descriptions should expose gameplay-changing settings. |
| [Bug reports](https://mini-militia-classic.fandom.com/wiki/How_to_Make_a_Bug_Report) and [abuse reports](https://mini-militia-classic.fandom.com/wiki/How_to_Report_a_Cheater/Hacker/Abuse) | Concrete reproduction context and match/player identity help diagnosis. These guides do not establish an existing automated report system. |
| [Development FAQ](https://mini-militia-classic.fandom.com/wiki/MMC_Development) | Separates released behavior, compatibility changes and future work; roadmap statements are not implementation evidence. |
| [Wiki home](https://mini-militia-classic.fandom.com/wiki/Mini_Militia_Classic_Wiki) | Describes the twin-stick, flight, equipment and map combination. Its mixed historical feature list is not a single version's complete specification. |

## Map reference corrections

The supplied tall image `ed2ed193...` is **Cliffhanger**, and `f8078136...` is **Crossfire**. The user's list contains twelve names but eleven images. Catacombs must use the correctly labelled wiki reference.

Full-resolution image links inspected in the browser:

- [Outpost](https://static.wikia.nocookie.net/mini-militia-classic/images/d/d4/Output_full.png/revision/latest?cb=20260406173022)
- [High Tower](https://static.wikia.nocookie.net/mini-militia-classic/images/7/73/2highTower_new.png/revision/latest?cb=20260406175056)
- [Lunarcy](https://static.wikia.nocookie.net/mini-militia-classic/images/7/72/7lunarcy_new.png/revision/latest?cb=20260406175159)
- [Ice Box](https://static.wikia.nocookie.net/mini-militia-classic/images/1/14/8icebox_new.png/revision/latest?cb=20260406180558)
- [Pyramid](https://static.wikia.nocookie.net/mini-militia-classic/images/6/61/10pyramid_new.png/revision/latest?cb=20260406180600)
- [Catacombs](https://static.wikia.nocookie.net/mini-militia-classic/images/0/07/11catacombs_new.png/revision/latest?cb=20260406175157)
- [Cliffhanger](https://static.wikia.nocookie.net/mini-militia-classic/images/e/e1/14cliffhanger_new.png/revision/latest?cb=20260406180742)
- [Crossfire](https://static.wikia.nocookie.net/mini-militia-classic/images/d/de/15crossfire_new.png/revision/latest?cb=20260406180743)

These are reference links, not newly distributed game assets. Continue using authored art. They show geometry and visual layering, not complete original collision data.

## Facts still requiring observation or measurement

- Original movement acceleration, braking, boost angle/strength, fuel recharge, knockback and equipment speed penalties.
- Original projectile speed/lifetime, rocket blast values, exact shield geometry and grenade crouch reduction.
- Exact v4 pickup timing, death drops, spawn weights, scope defaults and starting quantities.
- Lunarcy's historical coefficients. Zero gravity and unlimited boost are the user's explicit requirements and can be implemented without claiming historical proof.
- Bush behavior. Foliage in images does not prove a binary invisibility, detection radius or reveal timer.
- Sound similarity, animation timing, spatial readability and whether revised bots are enjoyable.
- Exact values from malformed/conflicting wiki tables. Do not infer that a launcher's table range of 1 means a one-unit rocket trajectory.

Future reference sessions should identify game version/settings, record timestamps, and measure the same action repeatedly. Report observations separately from proposed balance. Human playtesting remains necessary.

## Current code audit

| System | Verified at baseline | Gap |
|---|---|---|
| Movement | Shared prediction and authoritative movement in `src/shared/physics.ts` | S triggers one-way drop; no map-specific space mode; crouch-to-jet clearance needs regression coverage. |
| Camera | `src/client/game.ts` chooses per-weapon zoom; `render.ts` scales world view | Player-centered camera, no saved scope presets. SMAW range is 1600 but zoom defaults to 1; M93BA range 1500 uses 2. Death follow ignores the target's weapon scope. |
| Damage | `sim.ts` has head hits, shields, range falloff and swept projectiles | Current 65%-range falloff to 55%/30% is authored, not CV4. Crouched rectangles still expose a headshot region. |
| Weapon handling | All 23 entries exist in `weapons.ts` | M4 is automatic; EMP/M14 use rays; no charge state; saw ends at first body; energy/flame share generic reload. |
| Map design | `maps.ts` has six arenas plus range | Shared arena factory injects a flat floor, perimeter walls and similarly placed objectives/pickups. Reference topology is not reproduced. |
| Concealment | Decorative fern scenery | No concealment volumes, foreground hiding, nameplate policy or corresponding bot perception. |
| Bots | Easy/normal/hard, sight/reaction/aim limits and navigation in `bot.ts` | No foliage perception or space traversal. Existing difficulty is real, but enjoyment is unmeasured. |
| Existing controls | Numpad aim/fire, movement-facing, 1/2/3, Tab/Q, T/G, remapping | Preserve these; improve feedback and separate crouch/drop. |
| Equipment | Knife/shield pairing, small-gun dual wield, grenade auto-pickup and capacity | These exist; review their affordances and edge cases, do not call them wholly absent. |
| Recovery / death | Six-second combat delay, then one HP per quarter-second; attacker-follow and bounded fragments | Improve clarity and scope/visibility consistency; rates are authored, not recovered v4. |
| Rooms / identity | Ready reasons, host controls, presets, profile, invitations, history | Refine information hierarchy and add reference-aware map/rules descriptions. Do not rebuild the working server foundation. |

Additional concrete findings: standing muzzle height is 44 x 0.68 = 29.92 units; crouched height is 30, so a level shot intersects its top (confirmed with the shared ray helper in an isolated probe). Portrait camera math makes a 44-unit sniper body about 13.8 CSS pixels at normal scope and 10.3 at held scope, before device pixel ratio; these are calculations, not newly measured browser frames. The lobby offers PvP capacity one even though validation requires two, and exposes a Survival bot selector although the server fixes that field to zero.

No full game test suite was rerun for this read-only research. Previous passing checks establish their documented scope, not reference fidelity or approval of the current feel.
