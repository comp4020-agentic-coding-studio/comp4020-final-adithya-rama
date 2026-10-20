import type { Inventory, SlotIndex, ThrowableDefinition, WeaponDefinition } from "./types.ts";

// Authored tuning. These are deliberately not claims of recovered v4 balance.
function gun(id: string, name: string, category: WeaponDefinition["category"],
  damage: number, cooldownMs: number, mag: number, reserve: number,
  extra: Partial<WeaponDefinition> = {}): WeaponDefinition {
  return { id, name, category, damage, cooldownMs, mag, reserve,
    pellets: 1, spread: 0.025, auto: true, reloadMs: 1500, range: 850, zoom: 1,
    oneHanded: false, heavy: false, color: 0x9aadb8, behavior: "hitscan", ...extra };
}
export const WEAPONS: Record<string, WeaponDefinition> = {
  "mini-eagle": gun("mini-eagle", "Mini Eagle", "sidearm", 24, 260, 12, 48,
    { auto: false, spread: .02, reloadMs: 1100, range: 500, oneHanded: true, color: 0xd9d4c7 }),
  "golden-eagle": gun("golden-eagle", "Golden Eagle", "sidearm", 34, 380, 8, 32,
    { auto: false, reloadMs: 1250, range: 600, oneHanded: true, color: 0xf9c74f }),
  magnum: gun("magnum", "Magnum", "sidearm", 48, 560, 6, 24,
    { auto: false, reloadMs: 1700, range: 650, oneHanded: true, color: 0xcab9ac }),
  uzi: gun("uzi", "Uzi", "smg", 9, 70, 30, 120,
    { spread: .11, reloadMs: 1300, range: 500, oneHanded: true, color: 0x6f7a80 }),
  tec9: gun("tec9", "Tec-9", "smg", 12, 110, 24, 96,
    { spread: .085, reloadMs: 1200, range: 600, oneHanded: true, color: 0xb1b5a3 }),
  mp5: gun("mp5", "MP5", "smg", 13, 95, 30, 90,
    { spread: .04, reloadMs: 1400, range: 700, color: 0x768c9b }),
  ak47: gun("ak47", "AK-47", "rifle", 17, 115, 30, 90,
    { spread: .045, reloadMs: 1700, range: 800, zoom: 1.25, color: 0x8a5a2b }),
  m4: gun("m4", "M4", "rifle", 15, 460, 30, 120,
    { auto: false, burstCount: 3, burstIntervalMs: 90, spread: .03, reloadMs: 1600, range: 1000, zoom: 1.3, color: 0x7c9185 }),
  "tavor-x95": gun("tavor-x95", "Tavor X95", "rifle", 19, 145, 28, 84,
    { spread: .018, reloadMs: 1550, range: 800, zoom: 1.4, color: 0xd0b080 }),
  xm8: gun("xm8", "XM8", "rifle", 14, 85, 36, 108,
    { spread: .055, reloadMs: 1800, range: 875, zoom: 1.2, color: 0xc79461 }),
  m14: gun("m14", "M14", "precision", 43, 440, 14, 42,
    { auto: false, behavior: "projectile", projectileSpeed: 1600, projectileGravity: 0, spread: .006, reloadMs: 1900, range: 1200, zoom: 1.65, color: 0xa98c6e }),
  m93ba: gun("m93ba", "M93BA", "precision", 100, 1250, 5, 20,
    { auto: false, spread: 0, reloadMs: 2500, range: 1500, headshotMultiplier: 1.5, zoom: 2, heavy: true, color: 0x99a7bd }),
  spas12: gun("spas12", "SPAS-12", "shotgun", 11, 720, 6, 24,
    { auto: false, pellets: 7, spread: .2, reloadMs: 2000, range: 325, color: 0x3b3f44 }),
  aa20: gun("aa20", "AA-20", "shotgun", 8, 330, 12, 36,
    { pellets: 6, spread: .27, reloadMs: 2400, range: 480, heavy: true, color: 0x737474 }),
  minigun: gun("minigun", "Minigun", "heavy", 8, 50, 100, 200,
    { chargeMs: 650, spread: .12, reloadMs: 3300, range: 750, heavy: true, color: 0x89909c }),
  smaw: gun("smaw", "SMAW", "heavy", 125, 1000, 1, 5,
    { auto: false, reloadMs: 2300, range: 1600, heavy: true, behavior: "projectile",
      projectileSpeed: 950, projectileGravity: 0, blastRadius: 140, color: 0x72845d }),
  rg6: gun("rg6", "RG6", "heavy", 95, 650, 6, 18,
    { auto: false, reloadMs: 2800, range: 1000, heavy: true, behavior: "projectile",
      projectileSpeed: 620, projectileGravity: 1, blastRadius: 120, bounce: .38, color: 0xaaba6c }),
  "saw-launcher": gun("saw-launcher", "Saw launcher", "heavy", 65, 700, 5, 15,
    { auto: false, chargeMs: 500, blastRadius: 90, reloadMs: 2400, range: 1250, heavy: true, behavior: "projectile",
      projectileSpeed: 780, projectileGravity: 0, bounce: 1, color: 0xe0dccc }),
  flamethrower: gun("flamethrower", "Flamethrower", "special", 8, 80, 80, 0,
    { autoRefill: true, spread: .3, reloadMs: 2600, range: 190, heavy: true, behavior: "flame", color: 0xff8b39 }),
  phasr: gun("phasr", "PHASR beam", "special", 18, 150, 30, 0,
    { autoRefill: true, spread: 0, reloadMs: 2200, range: 1150, behavior: "beam", zoom: 1.4, color: 0xa66cff }),
  "emp-gun": gun("emp-gun", "EMP gun", "special", 14, 430, 10, 30,
    { spread: .01, reloadMs: 1800, range: 850, behavior: "projectile", projectileSpeed: 500, projectileGravity: 0, empMs: 2400, color: 0x4ae0ed }),
  machete: gun("machete", "Machete", "equipment", 100, 430, 0, 0,
    { auto: false, reloadMs: 0, range: 65, oneHanded: true, behavior: "melee", color: 0xd3e0e0 }),
  "riot-shield": gun("riot-shield", "Riot shield", "equipment", 0, 0, 0, 0,
    { auto: false, reloadMs: 0, range: 0, oneHanded: true, behavior: "shield", color: 0x64a3bd }),
};
export const THROWABLES: Record<string, ThrowableDefinition> = {
  frag: { id: "frag", name: "Fragmentation grenade", fuseMs: 2200, radius: 135,
    maxDamage: 110, minDamage: 15, throwSpeed: 640, bounce: .42, effect: "blast" },
  flash: { id: "flash", name: "Flashbang", fuseMs: 1400, radius: 360,
    maxDamage: 0, minDamage: 0, throwSpeed: 620, bounce: .38, effect: "flash", durationMs: 3000 },
  gas: { id: "gas", name: "Poison smoke", fuseMs: 1600, radius: 135,
    maxDamage: 6, minDamage: 6, throwSpeed: 600, bounce: .3, effect: "gas", durationMs: 6000 },
  emp: { id: "emp", name: "EMP grenade", fuseMs: 1500, radius: 180,
    maxDamage: 10, minDamage: 0, throwSpeed: 630, bounce: .4, effect: "emp", durationMs: 4000 },
  mine: { id: "mine", name: "Proximity mine", fuseMs: 120000, radius: 115,
    maxDamage: 110, minDamage: 15, throwSpeed: 470, bounce: 0, effect: "mine", armMs: 900 },
};
export const IMPLEMENTED_WEAPONS = Object.keys(WEAPONS);
export const IMPLEMENTED_THROWABLES = Object.keys(THROWABLES);

/** Player-facing role; world units stay in the armory comparison, not the HUD. */
export function weaponRangeLabel(id: string): string {
  const w = WEAPONS[id];
  if (!w) return "Empty";
  if (w.behavior === "shield") return "Frontal cover";
  if (w.behavior === "melee") return "One-hit melee";
  return w.range <= 550 ? "Close range" : w.range <= 900 ? "Mid range" : w.range <= 1200 ? "Long range" : "Very long range";
}

export function weaponHandling(id: string): string {
  const w = WEAPONS[id];
  if (!w) return "";
  if (w.behavior === "shield") return "Pairs with machete; selecting a gun drops it";
  if (w.behavior === "melee") return "One clean strike; pair with a shield";
  if (w.burstCount) return "Three shots per press; aim-fire hold repeats";
  if (w.autoRefill) return "Refills automatically when empty";
  if (id === "emp-gun") return "Travelling pulse disables thrust and disarms mines";
  if (id === "m14") return "Finite-speed precision bullet";
  if (id === "m93ba") return "One-shot at standard health/damage; shields still block";
  if (id === "saw-launcher") return "Charge, pierce, ricochet and burst";
  if (w.chargeMs) return "Spin up before sustained fire";
  return w.oneHanded ? "Dual-wield compatible" : w.heavy ? "Two-handed heavy; slower movement" : "Two-handed";
}
/** Only equipped hands affect movement; inventory weight is not a penalty. */
export function equippedMovementMultiplier(slots: Inventory, active: SlotIndex, partner: SlotIndex | null = null): number {
  const factor = (index: SlotIndex): number => {
    const definition = WEAPONS[slots[index]?.weapon ?? ""];
    return definition?.movementMultiplier ?? (definition?.behavior === "shield" ? .72 : definition?.heavy ? .85 : 1);
  };
  return partner === null ? factor(active) : Math.min(factor(active), factor(partner));
}
