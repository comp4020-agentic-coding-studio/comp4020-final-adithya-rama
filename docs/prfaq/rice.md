[Overview](README.md) · [Press release](press-release.md) · [Users](users.md) · [FAQ](faq.md) · [RICE](rice.md)

# Jet Skirmish RICE: twenty candidate features

**How the scores work.**

- **Reach:** players affected per month, assuming 100 monthly players. No usage
  data exists, so this is an assumption.
- **Impact:** 3 is massive, 2 high, 1 medium, 0.5 low and 0.25 minimal.
- **Confidence:** how sure the estimate is, in percent.
- **Effort:** person-weeks.
- **Score:** Reach × Impact × Confidence ÷ Effort.

Each candidate starts from a gap recorded in the repository (see [FAQ](faq.md) Q99 and the
[14 October plan](../REVISION_2026_10_14_PLAN.md)'s "useful later additions"), not from a user request.

| Rank | Feature | Area | Reach | Impact | Conf. | Effort | **Score** |
|---|---|---|---|---|---|---|---|
| 1 | **First-match controls card.** A dismissible overlay showing move, fly, aim and fire, using the player's own bindings. Training already teaches this, but people who join a friend's room skip it. | User education | 60 | 2 | 80% | 0.5 | **192** |
| 2 | **Bullet wall-impact effects.** Sparks or dust where shots hit terrain, so misses read clearly. Currently missing. | Art | 100 | 1 | 80% | 0.5 | **160** |
| 3 | **Off-screen indicators** for teammates, both flags and the goals, at the screen edge. | UI | 80 | 2 | 80% | 1 | **128** |
| 4 | **Weapon role tooltips** in the loadout and pickup prompt, such as "close range, high spread". | User education | 70 | 1 | 80% | 0.5 | **112** |
| 5 | **Headshot labels and hit markers.** A headshot tag in the kill feed and a brief marker when your shot lands. | UI | 100 | 0.5 | 80% | 0.5 | **80** |
| 6 | **Flag Delivery explainer.** Three cards before a first Flag Delivery match: carry your own flag, no enemy pickup, and dropped flags stay put. | User education | 50 | 2 | 80% | 1 | **80** |
| 7 | **Grenade spin and bounce sound**, so a thrown grenade is visible and audible. | Art | 90 | 0.5 | 80% | 0.5 | **72** |
| 8 | **Distinct non-lethal EMP and poison hit effects**, replacing the generic blood puff. | Art | 50 | 0.5 | 80% | 0.5 | **40** |
| 9 | **Team auto-balance.** The host offers a shuffle between rounds when team sizes or skill drift apart. | Mechanics | 50 | 1 | 80% | 1 | **40** |
| 10 | **Adaptive camera** that cuts the 160 ms smoothing lag during fast flight. | Mechanics | 80 | 1 | 50% | 1 | **40** |
| 11 | **Throw-arm and release animation** for grenades. | Art | 90 | 0.5 | 80% | 1 | **36** |
| 12 | **Directional melee slash** that follows the aim instead of a generic swing. | Actions | 40 | 0.5 | 80% | 0.5 | **32** |
| 13 | **Map voting and rotation** between rounds. | Elements | 60 | 1 | 80% | 1.5 | **32** |
| 14 | **Team pings and quick callouts** such as "flag here", "help" or "enemy carrier". | Actions | 60 | 2 | 50% | 2 | **30** |
| 15 | **Host kick and room mute controls.** | Actions | 30 | 1 | 80% | 1 | **24** |
| 16 | **Minimap** showing terrain, teammates and flags. | UI | 90 | 1 | 50% | 3 | **15** |
| 17 | **VIP or bomb mode** as a sixth game mode. | Mechanics | 40 | 2 | 50% | 4 | **10** |
| 18 | **Practice challenges**, such as a timed flight course or target range with personal bests. | User education | 40 | 1 | 50% | 3 | **6.7** |
| 19 | **Colour-blind team palette.** Teams already carry YOU/ALLY/ENEMY text labels, so the impact is lower. | UI | 8 | 1 | 80% | 1 | **6.4** |
| 20 | **Six new maps:** Subdivision, Bottleneck, No Escape, So Long, Cliffhanger and Crossfire. | Elements | 70 | 1 | 50% | 6 | **5.8** |

**What the ranking says.** Cheap fixes that make the game easier to understand
lead the table: a controls card, impact effects, edge indicators and weapon
tooltips. They help every match, while new modes and maps are slow to build.
The Reach figures are assumptions; the planned playtest would be the first real
evidence to re-score against.
