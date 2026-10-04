import { MAX_ROOM_PLAYERS } from "./constants.ts";
import { MAPS } from "./maps.ts";
import type { BotDifficulty, Mode, Multiplier, RoomSettings } from "./types.ts";
import { IMPLEMENTED_THROWABLES, IMPLEMENTED_WEAPONS, WEAPONS } from "./weapons.ts";

export const MULTIPLIERS: readonly Multiplier[] = [0.5, 1, 1.5, 2];
export const DURATIONS = [2, 5, 10, 15] as const;
export const AVAILABLE_MODES: readonly Mode[] = ["ffa", "tdm", "training", "flag", "survival"];
export const MODE_NAMES: Record<Mode, string> = {
  ffa: "Free-for-all",
  tdm: "Team deathmatch",
  training: "Training",
  flag: "Flag Delivery",
  survival: "Survival",
};
export const TEAM_MODES: readonly Mode[] = ["tdm", "flag"];
export const PVP_MODES: readonly Mode[] = ["ffa", "tdm", "flag"];

export function defaultSettings(): RoomSettings {
  return {
    map: "outpost-yard",
    mode: "tdm",
    capacity: MAX_ROOM_PLAYERS,
    durationMin: 5,
    scoreLimit: 0,
    flight: true,
    thrust: 1,
    fuelCapacity: 1,
    recharge: 1,
    unlimitedFuel: false,
    gravity: 1,
    moveSpeed: 1,
    health: 1,
    damage: 1,
    respawnSec: 3,
    weapons: [...IMPLEMENTED_WEAPONS],
    throwables: [...IMPLEMENTED_THROWABLES],
    loadout: ["mini-eagle", "uzi"],
    mapPickups: true,
    unlimitedAmmo: false,
    friendlyFire: false,
    bots: 0,
    botDifficulty: "normal",
  };
}

const mult = (v: unknown, fallback: Multiplier): Multiplier =>
  MULTIPLIERS.includes(v as Multiplier) ? (v as Multiplier) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const int = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback;

// Accepts untrusted input and returns settings that are always legal.
export function sanitizeSettings(input: unknown, base: RoomSettings = defaultSettings()): RoomSettings {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const mode = AVAILABLE_MODES.includes(o.mode as Mode) ? (o.mode as Mode) : base.mode;
  let map = typeof o.map === "string" && Object.hasOwn(MAPS, o.map) ? o.map : base.map;
  if (mode === "flag" && ([0, 1] as const).some((team) =>
    !MAPS[map].goals.some((goal) => goal.team === team) || !MAPS[map].flagHomes.some((home) => home.team === team))) map = "outpost-yard";
  const weapons = Array.isArray(o.weapons)
    ? o.weapons.filter((w): w is string => typeof w === "string" && Object.hasOwn(WEAPONS, w))
    : base.weapons;
  const throwables = Array.isArray(o.throwables)
    ? o.throwables.filter((t): t is string => typeof t === "string" && IMPLEMENTED_THROWABLES.includes(t))
    : base.throwables;
  let loadout = base.loadout;
  if (Array.isArray(o.loadout) && typeof o.loadout[0] === "string" && Object.hasOwn(WEAPONS, o.loadout[0])) {
    const second = typeof o.loadout[1] === "string" && Object.hasOwn(WEAPONS, o.loadout[1]) ? o.loadout[1] : null;
    loadout = [o.loadout[0], second];
  }
  const maxBots = mode === "survival" ? 0 : mode === "training" ? 3 : MAX_ROOM_PLAYERS - 1;
  const legalWeapons = [...new Set(weapons.length > 0 ? weapons : base.weapons)];
  if (!legalWeapons.includes(loadout[0])) loadout = [legalWeapons[0], loadout[1]];
  if (loadout[1] && !legalWeapons.includes(loadout[1])) loadout = [loadout[0], null];
  return {
    map,
    mode,
    capacity: mode === "training" ? 1 : mode === "survival" ? int(o.capacity, 1, 4, Math.min(4, base.capacity)) : int(o.capacity, 2, MAX_ROOM_PLAYERS, Math.max(2, Math.min(MAX_ROOM_PLAYERS, base.capacity))),
    durationMin: DURATIONS.includes(o.durationMin as 2) ? (o.durationMin as 2 | 5 | 10 | 15) : base.durationMin,
    scoreLimit: int(o.scoreLimit, 0, 200, base.scoreLimit),
    flight: bool(o.flight, base.flight),
    thrust: mult(o.thrust, base.thrust),
    fuelCapacity: mult(o.fuelCapacity, base.fuelCapacity),
    recharge: mult(o.recharge, base.recharge),
    unlimitedFuel: bool(o.unlimitedFuel, base.unlimitedFuel),
    gravity: mult(o.gravity, base.gravity),
    moveSpeed: mult(o.moveSpeed, base.moveSpeed),
    health: mult(o.health, base.health),
    damage: mult(o.damage, base.damage),
    respawnSec: int(o.respawnSec, 1, 10, base.respawnSec),
    weapons: legalWeapons,
    throwables: [...new Set(throwables)],
    loadout,
    mapPickups: bool(o.mapPickups, base.mapPickups),
    unlimitedAmmo: bool(o.unlimitedAmmo, base.unlimitedAmmo),
    friendlyFire: bool(o.friendlyFire, base.friendlyFire),
    bots: Math.min(int(o.bots, 0, MAX_ROOM_PLAYERS - 1, base.bots), maxBots),
    botDifficulty: (["easy", "normal", "hard"] as const).includes(o.botDifficulty as BotDifficulty)
      ? (o.botDifficulty as BotDifficulty)
      : base.botDifficulty,
  };
}
