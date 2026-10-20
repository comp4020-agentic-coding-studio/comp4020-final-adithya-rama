import {
  ASSIST_MIN_FRACTION,
  ASSIST_WINDOW_TICKS,
  BASE_HEALTH,
  DEFAULT_FRAGS,
  FALL_EXPOSURE_GRACE_TICKS,
  FALL_DAMAGE_INTERVAL_TICKS,
  FALL_DAMAGE_PER_INTERVAL,
  DROPPED_WEAPON_TTL_TICKS,
  DT,
  GAMEPLAY_VERSION,
  CONCEAL_REVEAL_TICKS,
  HEALTH_REGEN_DELAY_TICKS,
  HEALTH_REGEN_INTERVAL_TICKS,
  LAG_COMP_MAX_TICKS,
  MAX_THROWABLES,
  MELEE_COOLDOWN_TICKS,
  MELEE_DAMAGE,
  MELEE_RANGE,
  OUT_OF_BOUNDS_MARGIN,
  PICKUP_RADIUS,
  PLAYER_W,
  PLAYER_H,
  SPAWN_PROTECT_TICKS,
  SPACE_SPEED,
  TICK_RATE,
} from "./constants.ts";
import { MAPS } from "./maps.ts";
import { headHit, shieldBox } from "./combat-geometry.ts";
import {
  boxOf,
  groundBelow,
  gravityFor,
  heightOf,
  isFallingBelowMap,
  lineOfSight,
  maxFuel,
  type MoveState,
  pointInSolid,
  playerTravelBounds,
  overlaps,
  raycastMap,
  rayRect,
  stepMovement,
} from "./physics.ts";
import { TEAM_MODES } from "./settings.ts";
import {
  Btn,
  type GameEvent,
  type FlagState,
  type SurvivalState,
  type WeaponStats,
  type InputFrame,
  type MapDefinition,
  type MatchResult,
  type ParticipantResult,
  type PickupKind,
  PF,
  type PlayerSnap,
  type Rect,
  type RoomSettings,
  type SlotState,
  type SlotIndex,
  type Inventory,
  type Team,
  type WorldSnapshot,
} from "./types.ts";
import { equippedMovementMultiplier, THROWABLES, WEAPONS } from "./weapons.ts";

export interface Player extends MoveState {
  id: number;
  key: string;
  name: string;
  team: Team;
  color: number;
  bot: boolean;
  aim: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTick: number;
  protectUntil: number;
  slots: Inventory;
  active: SlotIndex;
  throwables: Record<string, number>;
  throwable: string;
  cooldownUntil: number;
  meleeUntil: number;
  throwUntil: number;
  prevButtons: number;
  kills: number;
  deaths: number;
  assists: number;
  deliveries: number;
  damageLog: { from: number; amount: number; tick: number }[];
  connected: boolean;
  reserved?: boolean;
  dual: boolean;
  empUntil: number;
  flashUntil: number;
  flashStrength: number;
  regenAt: number;
  fallExposureTicks: number;
  lastSpawn: { x: number; y: number } | null;
  revealUntil: number;
  weaponStats: Record<string, WeaponStats>;
}

export interface Projectile {
  id: number;
  kind: string;
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  explodeTick: number;
  weapon?: string;
  armedAt?: number;
  stuck?: boolean;
  bounces?: number;
  traveled?: number;
  hitIds?: number[];
  radius?: number;
}
export interface GasArea {
  id: number;
  owner: number;
  x: number;
  y: number;
  radius: number;
  until: number;
  nextDamageTick: number;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  item: string | null;
  x: number;
  y: number;
  spawnIndex: number;
  respawnTicks: number;
  availableAt: number;
  expiresAt: number;
  slot: SlotState | null;
  vx?: number;
  vy?: number;
}

interface HistoryEntry {
  tick: number;
  boxes: Map<number, Rect>;
  shields: Map<number, Rect>;
  crouched: Set<number>;
}

export interface World {
  tick: number;
  startTick: number;
  endTick: number;
  map: MapDefinition;
  settings: RoomSettings;
  players: Map<number, Player>;
  projectiles: Projectile[];
  pickups: Pickup[];
  events: GameEvent[];
  nextId: number;
  seed: number;
  teamScores: [number, number];
  over: boolean;
  overReason: "time" | "limit" | "defeat" | null;
  history: HistoryEntry[];
  flags: FlagState[];
  areas: GasArea[];
  survival: SurvivalState | null;
}

export function rng(w: World): number {
  // mulberry32: deterministic, so a replayed world behaves identically
  w.seed = (w.seed + 0x6d2b79f5) | 0;
  let t = w.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const isTeamMode = (s: RoomSettings): boolean => TEAM_MODES.includes(s.mode);
export const maxHealth = (s: RoomSettings): number => BASE_HEALTH * s.health;
const ticks = (ms: number): number => Math.max(1, Math.round((ms / 1000) * TICK_RATE));

export function createWorld(settings: RoomSettings, seed = 1): World {
  const map = MAPS[settings.map];
  const w: World = {
    tick: 0,
    startTick: 0,
    endTick: settings.durationMin * 60 * TICK_RATE,
    map,
    settings,
    players: new Map(),
    projectiles: [],
    pickups: [],
    events: [],
    nextId: 1,
    seed,
    teamScores: [0, 0],
    over: false,
    overReason: null,
    history: [],
    flags: (settings.mode === "flag" || (settings.mode === "training" &&
      [0, 1].every(team => map.flagHomes.some(home => home.team === team) && map.goals.some(goal => goal.team === team))))
      ? ([0, 1] as const).map((owner) => {
      const home = map.flagHomes.find((h) => h.team === owner) ?? map.spawns.find((sp) => sp.team === owner) ?? map.spawns[0];
      return { owner, state: "home", carrier: null, x: home.x, y: home.y, vx: 0, vy: 0, generation: 0, availableTick: 0 };
    }) : [],
    areas: [],
    survival: settings.mode === "survival" ? { wave: 0, remaining: 0, toSpawn: 0, nextSpawnTick: 0, nextWaveTick: 1, cleared: 0 } : null,
  };
  if (settings.mapPickups) {
    map.pickups.forEach((mp, i) => {
      if (mp.kind === "weapon" && (!mp.item || !settings.weapons.includes(mp.item))) return;
      if (mp.kind === "throwable" && (!mp.item || !settings.throwables.includes(mp.item))) return;
      w.pickups.push({
        id: w.nextId++,
        kind: mp.kind,
        item: mp.item ?? null,
        x: mp.x,
        y: mp.y,
        spawnIndex: i,
        respawnTicks: mp.respawnSec * TICK_RATE,
        availableAt: 0,
        expiresAt: 0,
        slot: null,
      });
    });
  }
  return w;
}

export function freshSlot(weapon: string): SlotState {
  const def = WEAPONS[weapon];
  return { weapon, mag: def.mag, reserve: def.reserve, reloadEnd: 0, cooldownUntil: 0, burstRemaining: 0, nextBurstTick: 0, chargeTicks: 0 };
}

export function addPlayer(
  w: World,
  opts: { id: number; key: string; name: string; team: Team; color: number; bot: boolean },
): Player {
  const p: Player = {
    ...opts,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    crouch: false,
    onGround: false,
    jetting: false,
    fuel: maxFuel(w.settings),
    jetCooldown: 0,
    dropTicks: 0,
    aim: 0,
    hp: 0,
    maxHp: maxHealth(w.settings),
    alive: false,
    respawnTick: w.tick,
    protectUntil: 0,
    slots: [null, null, null],
    active: 0,
    throwables: {},
    throwable: "frag",
    cooldownUntil: 0,
    meleeUntil: 0,
    throwUntil: 0,
    prevButtons: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    deliveries: 0,
    damageLog: [],
    connected: true,
    dual: false,
    empUntil: 0,
    flashUntil: 0,
    flashStrength: 0,
    regenAt: w.tick + HEALTH_REGEN_DELAY_TICKS,
    fallExposureTicks: 0,
    lastSpawn: null,
    revealUntil: 0,
    weaponStats: {},
  };
  if (w.settings.mode === "survival" || w.settings.mode === "training") p.team = p.bot ? 1 : 0;
  w.nextId = Math.max(w.nextId, p.id + 1);
  w.players.set(p.id, p);
  respawn(w, p);
  return p;
}

const sameTeam = (w: World, a: Player, b: Player): boolean =>
  (isTeamMode(w.settings) || w.settings.mode === "survival" || w.settings.mode === "training") && a.team !== -1 && a.team === b.team;

const enemies = (w: World, a: Player, b: Player): boolean => a !== b && !sameTeam(w, a, b);

/** A deterministic safety heuristic, not a guarantee against an incoming attack. */
function spawnHazards(w: World, p: Player, x: number, y: number): number {
  const cy = y - PLAYER_H / 2;
  const canHarm = (ownerId: number): boolean => {
    const owner = w.players.get(ownerId);
    return !owner || owner === p || !sameTeam(w, p, owner) || w.settings.friendlyFire;
  };
  let hazards = 0;
  for (const area of w.areas) {
    if (area.until > w.tick &&
        Math.hypot(x - area.x, cy - area.y) <= area.radius + PLAYER_W / 2 &&
        lineOfSight(w.map, area.x, area.y, x, cy)) hazards++;
  }
  for (const pr of w.projectiles) {
    if (pr.explodeTick <= w.tick || (pr.kind !== "gas" && !canHarm(pr.owner))) continue;
    const wd = pr.weapon ? WEAPONS[pr.weapon] : undefined, td = THROWABLES[pr.kind];
    if (!wd && !td) continue;
    const seconds = pr.stuck ? 0 : Math.min(.5, (pr.explodeTick - w.tick) / TICK_RATE);
    let dx = pr.vx * seconds, dy = pr.vy * seconds;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      const distance = raycastMap(w.map, pr.x, pr.y, dx / length, dy / length, length);
      dx *= distance / length; dy *= distance / length;
    }
    const t = dx || dy ? Math.max(0, Math.min(1, ((x - pr.x) * dx + (cy - pr.y) * dy) / (dx * dx + dy * dy))) : 0;
    const hx = pr.x + dx * t, hy = pr.y + dy * t;
    const radius = wd?.blastRadius ?? td?.radius ?? PLAYER_W;
    if (Math.hypot(x - hx, cy - hy) <= radius + PLAYER_W / 2 && lineOfSight(w.map, hx, hy, x, cy)) hazards++;
  }
  return hazards;
}

export function respawn(w: World, p: Player): void {
  const s = w.settings;
  const teamSpawns = w.map.spawns.filter((sp) => (isTeamMode(s) || s.mode === "survival" || s.mode === "training" ? sp.team === p.team : true));
  const spawns = teamSpawns.length > 0 ? teamSpawns : w.map.spawns;
  const foes = [...w.players.values()].filter((o) => o.alive && enemies(w, p, o));
  const candidates: { sp: typeof spawns[number]; score: number; hazards: number; exposure: number }[] = [];
  for (const sp of spawns) {
    const body = { x: sp.x - PLAYER_W / 2, y: sp.y - PLAYER_H, w: PLAYER_W, h: PLAYER_H };
    if (body.x < 0 || body.x + body.w > w.map.width || body.y < 0 || sp.y > w.map.height ||
        w.map.solids.some(solid => overlaps(body, solid))) continue;
    const supported = w.map.physics === "space" || [...w.map.solids, ...w.map.platforms].some(surface =>
      Math.abs(surface.y - sp.y) < .05 && body.x < surface.x + surface.w && body.x + body.w > surface.x);
    if (!supported) continue;
    let nearest = 5000, exposure = 0;
    for (const foe of foes) {
      const distance = Math.hypot(foe.x - sp.x, foe.y - sp.y);
      nearest = Math.min(nearest, distance);
      const range = WEAPONS[foe.slots[foe.active]?.weapon ?? "mini-eagle"].range;
      if (distance < range && lineOfSight(w.map, foe.x, foe.y - heightOf(foe) / 2, sp.x, sp.y - PLAYER_H / 2))
        exposure += (range - distance) * 1.25;
    }
    const hazards = spawnHazards(w, p, sp.x, sp.y);
    candidates.push({ sp, hazards, exposure, score: nearest - exposure - hazards * 20_000 });
  }
  // Authored maps are validated to have clear supported team spawns. Never
  // silently put an actor into a solid if future content violates that contract.
  if (!candidates.length) throw new Error(`No safe authored spawn for team ${p.team} in ${w.map.id}`);
  let selected = candidates[0];
  if (s.randomSpawns !== false) {
    const minHazards = Math.min(...candidates.map(candidate => candidate.hazards));
    const leastHazardous = candidates.filter(candidate => candidate.hazards === minHazards);
    const safest = leastHazardous.reduce((best, candidate) => candidate.score > best.score ? candidate : best);
    // A 100-unit score tolerance allows variety without sacrificing a clearly
    // safer position. Never exchange clear cover for a visible firing lane.
    let similar = leastHazardous.filter(candidate => candidate.score >= safest.score - 100 &&
      (safest.exposure > 0 || candidate.exposure === 0));
    const different = similar.filter(candidate => !p.lastSpawn || candidate.sp.x !== p.lastSpawn.x || candidate.sp.y !== p.lastSpawn.y);
    if (different.length) similar = different;
    selected = similar[Math.floor(rng(w) * similar.length)];
  } else {
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const score = candidate.score + rng(w) * 60;
      if (score > bestScore) { bestScore = score; selected = candidate; }
    }
  }
  const best = selected.sp;
  Object.assign(p, {
    lastSpawn: { x: best.x, y: best.y },
    fallExposureTicks: 0,
    x: best.x,
    y: best.y,
    vx: 0,
    vy: 0,
    crouch: false,
    onGround: true,
    jetting: false,
    fuel: maxFuel(s),
    jetCooldown: 0,
    dropTicks: 0,
    hp: maxHealth(s),
    maxHp: maxHealth(s),
    alive: true,
    protectUntil: w.tick + SPAWN_PROTECT_TICKS,
    active: 0,
    cooldownUntil: 0,
    meleeUntil: 0,
    throwUntil: 0,
    damageLog: [],
    dual: false,
    empUntil: 0,
    flashUntil: 0,
    flashStrength: 0,
    regenAt: w.tick + HEALTH_REGEN_DELAY_TICKS,
    revealUntil: 0,
    prevButtons: 0,
  });
  p.slots = [freshSlot(s.loadout[0]), s.loadout[1] ? freshSlot(s.loadout[1]) : null, s.loadout[2] ? freshSlot(s.loadout[2]) : null];
  if (p.slots[0]?.weapon === "riot-shield" || p.slots[0]?.weapon === "machete") equipSelected(w, p);
  p.throwables = {};
  // The default 2 frag + 1 flash + 1 gas leaves two spaces for floor pickups.
  // Optional types each get one; a single-type room still starts with two.
  const initialTypes = [...s.throwables].sort((a, b) => a === "frag" ? -1 : b === "frag" ? 1 : 0);
  let remaining = Math.min(MAX_THROWABLES - 1, Math.max(4, initialTypes.length));
  for (let round = 0; round < 2; round++) for (const id of initialTypes) {
    if (remaining > 0) { p.throwables[id] = (p.throwables[id] ?? 0) + 1; remaining--; }
  }
  p.throwable = s.throwables.includes("frag") ? "frag" : (s.throwables[0] ?? "frag");
  w.events.push({ t: "spawn", id: p.id });
}

function statsFor(p: Player, weapon: string): WeaponStats {
  return p.weaponStats[weapon] ??= { shots: 0, hits: 0, damage: 0, kills: 0 };
}

function shieldRaised(p: Player): boolean {
  const partner = p.dual ? dualPartner(p) : null;
  return p.slots.some((s, i) => s?.weapon === "riot-shield" && (i === p.active || i === partner));
}

export function applyDamage(w: World, victim: Player, attackerId: number | null, amount: number, weapon: string): number {
  if (!victim.alive || amount <= 0 || !Number.isFinite(amount)) return 0;
  if (w.tick < victim.protectUntil) return 0;
  const attacker = attackerId === null ? undefined : w.players.get(attackerId);
  // Poison is a shared environmental hazard, including its owner's team.
  if (weapon !== "gas" && attacker && attacker !== victim && sameTeam(w, attacker, victim) && !w.settings.friendlyFire) return 0;
  const dealt = Math.min(victim.hp, amount);
  victim.hp -= dealt;
  combat(w, victim);
  if (attacker) combat(w, attacker);
  if (attacker && attacker !== victim) {
    victim.damageLog.push({ from: attacker.id, amount: dealt, tick: w.tick });
    const stats = statsFor(attacker, weapon);
    stats.hits++;
    stats.damage += dealt;
  }
  victim.damageLog = victim.damageLog.filter((d) => w.tick - d.tick <= ASSIST_WINDOW_TICKS);
  w.events.push({ t: "hurt", id: victim.id, amount: Math.round(dealt) });
  if (victim.hp <= 0) killPlayer(w, victim, attacker ?? null, weapon);
  return dealt;
}

export function killPlayer(w: World, victim: Player, killer: Player | null, weapon: string): void {
  if (!victim.alive) return;
  dropFlags(w, victim.id);
  victim.alive = false;
  victim.hp = 0;
  victim.jetting = false;
  for (const slot of victim.slots) if (slot) { slot.chargeTicks = 0; slot.burstRemaining = 0; slot.reloadEnd = 0; }
  victim.deaths++;
  victim.respawnTick = w.tick + w.settings.respawnSec * TICK_RATE;

  const held = victim.slots[victim.active];
  if (held && !w.settings.loadout.includes(held.weapon)) dropWeapon(w, victim.x, victim.y - 12, { ...held, reloadEnd: 0 }, victim.vx, victim.vy);

  const credited = killer !== null && enemies(w, killer, victim);
  if (credited) {
    killer.kills++;
    statsFor(killer, weapon).kills++;
    if (w.settings.mode === "tdm" && killer.team !== -1) w.teamScores[killer.team]++;
  }

  const byAttacker = new Map<number, number>();
  for (const d of victim.damageLog) {
    if (w.tick - d.tick > ASSIST_WINDOW_TICKS) continue;
    byAttacker.set(d.from, (byAttacker.get(d.from) ?? 0) + d.amount);
  }
  for (const [id, total] of credited ? byAttacker : []) {
    const helper = w.players.get(id);
    if (!helper || helper === killer || !enemies(w, helper, victim)) continue;
    if (total >= ASSIST_MIN_FRACTION * victim.maxHp) helper.assists++;
  }
  victim.damageLog = [];
  w.events.push({ t: "kill", killer: credited ? killer.id : null, attacker: killer?.id ?? null, victim: victim.id, w: weapon });
}

function dropWeapon(w: World, x: number, y: number, slot: SlotState, vx = 0, vy = 0): void {
  const gy = w.map.physics === "space" ? y : groundBelow(w.map, x, y);
  if (gy > w.map.height) return;
  w.pickups.push({
    id: w.nextId++,
    kind: "weapon",
    item: slot.weapon,
    x,
    y: gy,
    vx: w.map.physics === "space" ? vx : 0,
    vy: w.map.physics === "space" ? vy : 0,
    spawnIndex: -1,
    respawnTicks: 0,
    availableAt: 0,
    expiresAt: w.tick + DROPPED_WEAPON_TTL_TICKS,
    slot: { ...slot, reloadEnd: 0, burstRemaining: 0, nextBurstTick: 0, chargeTicks: 0 },
  });
}

function consumePickup(w: World, pk: Pickup): void {
  if (pk.spawnIndex >= 0) pk.availableAt = w.tick + pk.respawnTicks;
  else w.pickups = w.pickups.filter((o) => o !== pk);
}

const pickupAvailable = (w: World, pk: Pickup): boolean => pk.availableAt <= w.tick;

function nearPickup(w: World, p: Player, pk: Pickup): boolean {
  return Math.abs(pk.x - p.x) <= PICKUP_RADIUS && pk.y >= p.y - heightOf(p) - 10 && pk.y <= p.y + 20 &&
    lineOfSight(w.map, p.x, p.y - 12, pk.x, pk.y - 1);
}

function startReload(w: World, p: Player, slot: SlotState, automatic = false): void {
  const def = WEAPONS[slot.weapon];
  if (def.category === "equipment" || slot.reloadEnd !== 0 || slot.mag >= def.mag || (def.autoRefill && !automatic)) return;
  if (!def.autoRefill && !w.settings.unlimitedAmmo && slot.reserve <= 0) return;
  slot.burstRemaining = 0;
  slot.chargeTicks = 0;
  slot.reloadEnd = w.tick + ticks(def.reloadMs);
  w.events.push({ t: "reload", id: p.id });
}

function finishReload(w: World, slot: SlotState): void {
  const def = WEAPONS[slot.weapon];
  const need = def.mag - slot.mag;
  const take = def.autoRefill || w.settings.unlimitedAmmo ? need : Math.min(need, slot.reserve);
  slot.mag += take;
  if (!def.autoRefill && !w.settings.unlimitedAmmo) slot.reserve -= take;
  slot.reloadEnd = 0;
}

function equipSelected(w: World, p: Player): void {
  const selected = p.slots[p.active];
  if (!selected) return;
  if (WEAPONS[selected.weapon].category !== "equipment") {
    // A firearm needs the shield hand. Keep every other slot and its ammo.
    for (const index of [0, 1, 2] as const) {
      const slot = p.slots[index];
      if (slot?.weapon !== "riot-shield") continue;
      dropWeapon(w, p.x, p.y - 12, { ...slot, reloadEnd: 0 }, p.vx, p.vy);
      p.slots[index] = null;
    }
  } else if (selected.weapon === "riot-shield" || selected.weapon === "machete") {
    const partner = dualPartner(p);
    p.dual = partner !== null && (selected.weapon === "riot-shield" || p.slots[partner]?.weapon === "riot-shield");
  }
  if (!canDual(p)) p.dual = false;
}
function switchTo(w: World, p: Player, idx: SlotIndex): void {
  if (!p.slots[idx]) return;
  if (idx !== p.active) {
    const cur = p.slots[p.active];
    if (cur) { cur.burstRemaining = 0; cur.chargeTicks = 0; }
    p.active = idx;
  }
  equipSelected(w, p);
}
function cycleSlot(w: World, p: Player): void {
  for (let offset = 1; offset <= 3; offset++) {
    const index = ((p.active + offset) % 3) as SlotIndex;
    if (p.slots[index]) { switchTo(w, p, index); return; }
  }
}
export function dualPartner(p: Player): SlotIndex | null {
  const selected = p.slots[p.active];
  const compatible = (slot: SlotState | null): boolean =>
    !!slot && WEAPONS[slot.weapon].oneHanded && !WEAPONS[slot.weapon].heavy;
  if (!compatible(selected)) return null;
  for (const index of [0, 1, 2] as const) {
    const slot = p.slots[index];
    if (index === p.active || !compatible(slot)) continue;
    const equipment = WEAPONS[selected!.weapon].category === "equipment" || WEAPONS[slot!.weapon].category === "equipment";
    if (equipment && !((selected!.weapon === "riot-shield" && slot!.weapon === "machete") ||
        (selected!.weapon === "machete" && slot!.weapon === "riot-shield"))) continue;
    return index;
  }
  return null;
}
export function canDual(p: Player): boolean { return dualPartner(p) !== null; }

function combat(w: World, p: Player): void {
  p.regenAt = w.tick + HEALTH_REGEN_DELAY_TICKS;
}
// Only enemy fire that passes near the player on a visible segment suppresses healing.
function suppressNearShot(w: World, shooter: Player, x: number, y: number, ex: number, ey: number, radius = 96): void {
  const dx = ex - x, dy = ey - y, length2 = dx * dx + dy * dy;
  for (const p of w.players.values()) {
    if (!p.alive || !p.connected || !enemies(w, shooter, p)) continue;
    const cy = p.y - heightOf(p) / 2;
    const t = length2 ? Math.max(0, Math.min(1, ((p.x - x) * dx + (cy - y) * dy) / length2)) : 0;
    const px = x + dx * t, py = y + dy * t;
    if (Math.hypot(p.x - px, cy - py) <= radius && lineOfSight(w.map, px, py, p.x, cy)) combat(w, p);
  }
}
function regenerate(w: World): void {
  for (const p of w.players.values()) {
    if (!p.alive || !p.connected || p.reserved || p.hp >= p.maxHp || w.tick < p.regenAt) continue;
    p.hp = Math.min(p.maxHp, p.hp + 1);
    p.regenAt = w.tick + HEALTH_REGEN_INTERVAL_TICKS;
  }
}

function historyAt(w: World, viewTick: number | undefined): HistoryEntry | null {
  if (viewTick === undefined) return null;
  const target = Math.max(w.tick - LAG_COMP_MAX_TICKS, Math.min(w.tick, Math.floor(viewTick)));
  for (let i = w.history.length - 1; i >= 0; i--) {
    if (w.history[i].tick <= target) return w.history[i];
  }
  return null;
}

export const muzzleOf = (p: Player): { x: number; y: number } => ({ x: p.x, y: p.y - heightOf(p) * 0.68 });

function disableFlight(w: World, p: Player, durationMs: number, owner: number): void {
  const attacker = w.players.get(owner);
  if (!p.alive || w.tick < p.protectUntil || (attacker && attacker !== p && sameTeam(w, attacker, p) && !w.settings.friendlyFire)) return;
  p.empUntil = Math.max(p.empUntil, w.tick + ticks(durationMs));
  p.jetting = false;
  w.events.push({ t: "emp", id: p.id, until: p.empUntil });
}

function fire(w: World, p: Player, slot: SlotState, viewTick: number | undefined): void {
  const def = WEAPONS[slot.weapon];
  if (def.behavior === "shield") return;
  slot.cooldownUntil = w.tick + ticks(def.cooldownMs);
  p.cooldownUntil = slot.cooldownUntil;
  p.protectUntil = 0;
  statsFor(p, def.id).shots++;
  p.revealUntil = w.tick + CONCEAL_REVEAL_TICKS;
  combat(w, p);
  if (def.behavior === "melee") { melee(w, p, def.damage, def.range, def.id); return; }
  slot.mag--;
  const { x: ox, y: oy } = muzzleOf(p);
  if (def.behavior === "projectile") {
    w.projectiles.push({ id: w.nextId++, kind: def.id, weapon: def.id, owner: p.id,
      x: ox, y: oy, vx: Math.cos(p.aim) * def.projectileSpeed!, vy: Math.sin(p.aim) * def.projectileSpeed!,
      explodeTick: w.tick + (def.id === "rg6" ? ticks(1800) : ticks(def.range / def.projectileSpeed! * 1000)), bounces: 0, traveled: 0 });
    // Launch audio and muzzle feedback use the same authoritative discharge event.
    // This short segment is not a hitscan hit; the projectile resolves damage later.
    w.events.push({ t: "shot", by: p.id, w: def.id, x1: Math.round(ox), y1: Math.round(oy),
      x2: Math.round(ox + Math.cos(p.aim) * 32), y2: Math.round(oy + Math.sin(p.aim) * 32), hit: false });
  } else {
    const rewound = def.behavior !== "flame" ? historyAt(w, viewTick) : null;
    const rays = def.behavior === "flame" ? 3 : def.pellets;
    const burned = new Set<number>();
    for (let i = 0; i < rays; i++) {
      const angle = p.aim + (def.behavior === "flame" ? (i - 1) * def.spread / 2 : (rng(w) - .5) * def.spread);
      const dx = Math.cos(angle), dy = Math.sin(angle);
      let dist = raycastMap(w.map, ox, oy, dx, dy, def.range);
      const targets: { p: Player; distance: number; shield: boolean; body: Rect }[] = [];
      for (const other of w.players.values()) {
        if (!other.alive || other === p || (sameTeam(w, p, other) && !w.settings.friendlyFire)) continue;
        const body = rewound?.boxes.get(other.id) ?? boxOf(other);
        const distance = rayRect(ox, oy, dx, dy, body);
        if (distance < dist) targets.push({ p: other, distance, shield: false, body });
        if (def.behavior !== "flame") {
          const panel = rewound ? rewound.shields.get(other.id) : shieldRaised(other) ? shieldBox(body, other.aim) : undefined;
          const shieldDistance = panel ? rayRect(ox, oy, dx, dy, panel) : Infinity;
          if (shieldDistance < dist) targets.push({ p: other, distance: shieldDistance, shield: true, body });
        }
      }
      targets.sort((a, b) => a.distance - b.distance || Number(b.shield) - Number(a.shield) || a.p.id - b.p.id);
      let landed = false;
      for (const hit of targets) {
        if (hit.shield) {
          w.events.push({ t: "shield", id: hit.p.id });
          combat(w, hit.p);
          dist = hit.distance;
          break;
        }
        if (def.behavior === "flame" && burned.has(hit.p.id)) continue;
        burned.add(hit.p.id);
        const crouched = rewound ? rewound.crouched.has(hit.p.id) : hit.p.crouch;
        const headMultiplier = !crouched && headHit(hit.body, oy + dy * hit.distance) ? def.headshotMultiplier ?? 1 : 1;
        landed = applyDamage(w, hit.p, p.id, def.damage * headMultiplier * w.settings.damage, def.id) > 0 || landed;
        if (def.behavior !== "beam") { dist = hit.distance; break; }
      }
      suppressNearShot(w, p, ox, oy, ox + dx * dist, oy + dy * dist);
      w.events.push({ t: "shot", by: p.id, w: def.id, x1: Math.round(ox), y1: Math.round(oy),
        x2: Math.round(ox + dx * dist), y2: Math.round(oy + dy * dist), hit: landed });
    }
  }
  if (slot.mag === 0) startReload(w, p, slot);
}

function melee(w: World, p: Player, damage = MELEE_DAMAGE, range = MELEE_RANGE, weapon = "melee"): void {
  p.meleeUntil = w.tick + MELEE_COOLDOWN_TICKS;
  p.revealUntil = w.tick + CONCEAL_REVEAL_TICKS;
  combat(w, p);
  suppressNearShot(w, p, p.x, p.y - heightOf(p) / 2, p.x + Math.cos(p.aim) * range, p.y - heightOf(p) / 2, 60);
  p.protectUntil = 0;
  const dir = Math.cos(p.aim) >= 0 ? 1 : -1;
  const reach: Rect = {
    x: dir > 0 ? p.x : p.x - range - PLAYER_W / 2,
    y: p.y - heightOf(p),
    w: range + PLAYER_W / 2,
    h: heightOf(p),
  };
  for (const o of w.players.values()) {
    if (!o.alive || o === p) continue;
    const b = boxOf(o);
    if (b.x < reach.x + reach.w && b.x + b.w > reach.x && b.y < reach.y + reach.h && b.y + b.h > reach.y) {
      if (lineOfSight(w.map, p.x, p.y - heightOf(p) / 2, o.x, o.y - heightOf(o) / 2)) applyDamage(w, o, p.id, weapon === "machete" ? o.hp : damage * w.settings.damage, weapon);
    }
  }
  w.events.push({ t: "melee", by: p.id, x: Math.round(p.x + dir * 30), y: Math.round(p.y - 25) });
}

function throwGrenade(w: World, p: Player): void {
  const def = THROWABLES[p.throwable];
  if (!def || (p.throwables[p.throwable] ?? 0) <= 0) return;
  const thrown = p.throwable;
  p.throwables[thrown]--;
  statsFor(p, def.id).shots++;
  p.revealUntil = w.tick + CONCEAL_REVEAL_TICKS;
  combat(w, p);
  p.throwUntil = w.tick + 24;
  p.protectUntil = 0;
  const m = muzzleOf(p);
  w.projectiles.push({
    id: w.nextId++,
    kind: def.id,
    owner: p.id,
    x: m.x,
    y: m.y,
    vx: Math.cos(p.aim) * def.throwSpeed + p.vx * 0.4,
    vy: Math.sin(p.aim) * def.throwSpeed + p.vy * 0.4,
    explodeTick: w.tick + ticks(def.fuseMs),
    armedAt: def.armMs ? w.tick + ticks(def.armMs) : 0,
    stuck: false,
  });
  if (p.throwables[thrown] === 0) cycleThrowable(w, p);
}

function cycleThrowable(w: World, p: Player): void {
  const types = w.settings.throwables;
  const current = types.indexOf(p.throwable);
  for (let offset = 1; offset <= types.length; offset++) {
    const next = types[(current + offset + types.length) % types.length];
    if ((p.throwables[next] ?? 0) > 0) { p.throwable = next; return; }
  }
}

function tryPickupWeapon(w: World, p: Player): void {
  let best: Pickup | null = null;
  let bestD = Infinity;
  for (const pk of w.pickups) {
    if (pk.kind !== "weapon" || !pk.item || !pickupAvailable(w, pk) || !nearPickup(w, p, pk)) continue;
    // Equipment has no reserve ammunition to merge: leave a duplicate for others.
    if (WEAPONS[pk.item].category === "equipment" && p.slots.some((slot) => slot?.weapon === pk.item)) continue;
    const d = Math.abs(pk.x - p.x);
    if (d < bestD) {
      bestD = d;
      best = pk;
    }
  }
  if (!best || !best.item) return;
  const incoming = best.slot ? { ...best.slot } : freshSlot(best.item);
  const empty = p.slots.findIndex((s) => s === null);
  const owned = empty < 0 ? p.slots.findIndex((s) => s?.weapon === incoming.weapon) : -1;
  if (owned >= 0) {
    const slot = p.slots[owned]!;
    const def = WEAPONS[slot.weapon];
    slot.reserve = Math.min(def.reserve * 2, slot.reserve + incoming.mag + incoming.reserve);
  } else {
    const empty = p.slots.findIndex((s) => s === null);
    if (empty >= 0) {
      p.slots[empty] = incoming;
      switchTo(w, p, empty as SlotIndex);
    } else {
      const old = p.slots[p.active]!;
      dropWeapon(w, p.x, p.y - 12, { ...old, reloadEnd: 0 }, p.vx, p.vy);
      p.slots[p.active] = incoming;
      equipSelected(w, p);
    }
  }
  if (p.dual && !canDual(p)) p.dual = false;
  consumePickup(w, best);
  w.events.push({ t: "pickup", id: p.id, item: incoming.weapon });
}

function dropActive(w: World, p: Player): void {
  const slot = p.slots[p.active];
  if (!slot) return;
  dropWeapon(w, p.x, p.y - 12, { ...slot, reloadEnd: 0 }, p.vx, p.vy);
  p.slots[p.active] = null;
  p.dual = false;
  cycleSlot(w, p);
}

function autoPickups(w: World, p: Player): void {
  for (const pk of w.pickups) {
    if (pk.kind === "weapon" || !pickupAvailable(w, pk) || !nearPickup(w, p, pk)) continue;
    if (pk.kind === "health") {
      const max = p.maxHp;
      if (p.hp >= max) continue;
      p.hp = Math.min(max, p.hp + 50 * w.settings.health);
    } else if (pk.kind === "fuel") {
      const max = maxFuel(w.settings);
      if (p.fuel >= max) continue;
      p.fuel = max;
    } else if (pk.kind === "throwable") {
      if (!pk.item || !w.settings.throwables.includes(pk.item)) continue;
      const total = Object.values(p.throwables).reduce((a, b) => a + b, 0);
      if (total >= MAX_THROWABLES) continue;
      p.throwables[pk.item] = (p.throwables[pk.item] ?? 0) + 1;
      if ((p.throwables[p.throwable] ?? 0) === 0) p.throwable = pk.item;
    } else {
      let used = false;
      for (const slot of p.slots) {
        if (!slot) continue;
        const def = WEAPONS[slot.weapon];
        if (slot.reserve < def.reserve) {
          slot.reserve = def.reserve;
          used = true;
        }
      }
      if (w.settings.throwables.includes("frag")) {
        const total = Object.values(p.throwables).reduce((a, b) => a + b, 0);
        if ((p.throwables.frag ?? 0) < DEFAULT_FRAGS && total < MAX_THROWABLES) {
          p.throwables.frag = Math.min(DEFAULT_FRAGS, (p.throwables.frag ?? 0) + MAX_THROWABLES - total);
          used = true;
        }
      }
      if (!used) continue;
    }
    consumePickup(w, pk);
    w.events.push({ t: "pickup", id: p.id, item: pk.kind === "throwable" ? pk.item! : pk.kind });
  }
}

// Swept segments, rather than endpoint tests, prevent fast rockets/discs from
// crossing thin walls. One-way platforms catch falling physical projectiles.
function advanceProjectile(w: World, pr: Projectile, maxDistance = Infinity): { x: number; y: number; wall: boolean; distance: number } {
  const wd = pr.weapon ? WEAPONS[pr.weapon] : undefined;
  const td = THROWABLES[pr.kind];
  const gravity = wd?.projectileGravity ?? 1;
  pr.vy += gravityFor(w.map, w.settings) * gravity * DT;
  const dx = pr.vx * DT, dy = pr.vy * DT, length = Math.hypot(dx, dy);
  if (length === 0) return { x: pr.x, y: pr.y, wall: false, distance: 0 };
  const ux = dx / length, uy = dy / length;
  let distance = Math.min(length, maxDistance), hit: Rect | null = null;
  for (const solid of w.map.solids) {
    const radius = pr.radius ?? 0;
    const r = radius ? { x: solid.x - radius, y: solid.y - radius, w: solid.w + radius * 2, h: solid.h + radius * 2 } : solid;
    const d = rayRect(pr.x, pr.y, ux, uy, r);
    if (d <= distance) { distance = d; hit = r; }
  }
  if (dy > 0) for (const platform of w.map.platforms) {
    const radius = pr.radius ?? 0;
    const r = { ...platform, x: platform.x - radius, y: platform.y - radius, w: platform.w + radius * 2 };
    if (pr.y > r.y + .01) continue;
    const d = (r.y - pr.y) / uy, x = pr.x + ux * d;
    if (d >= 0 && d <= distance && x >= r.x && x <= r.x + r.w) { distance = d; hit = r; }
  }
  const x = pr.x + ux * distance, y = pr.y + uy * distance;
  if (hit) {
    const bounce = wd?.bounce ?? td?.bounce ?? 0;
    pr.x += ux * Math.max(0, distance - .2);
    pr.y += uy * Math.max(0, distance - .2);
    if (Math.abs(y - hit.y) < .5 || Math.abs(y - hit.y - hit.h) < .5) {
      pr.vy *= -bounce;
      pr.vx *= wd ? 1 : .7;
      if (Math.abs(pr.vy) < 35) pr.vy = 0;
      if (distance < .21) pr.y = Math.abs(y - hit.y) < .5 ? hit.y - .2 : hit.y + hit.h + .2;
    } else {
      pr.vx *= -bounce;
      if (distance < .21) pr.x = Math.abs(x - hit.x) < .5 ? hit.x - .2 : hit.x + hit.w + .2;
    }
  } else { pr.x += ux * distance; pr.y += uy * distance; }
  return { x, y, wall: hit !== null, distance };
}

function stepProjectiles(w: World): void {
  const keep: Projectile[] = [];
  const travel = playerTravelBounds(w.map);
  const disarmed = new Set<number>();
  for (const pr of w.projectiles) {
    const wd = pr.weapon ? WEAPONS[pr.weapon] : undefined;
    const td = THROWABLES[pr.kind];
    if (!wd && !td) continue;
    const ox = pr.x, oy = pr.y;
    let wall = false, blockedByShield = false, playerHit: Player | null = null;
    if (!pr.stuck) {
      const step = advanceProjectile(w, pr, wd ? Math.max(0, wd.range - (pr.traveled ?? 0)) : Infinity);
      if (wd) pr.traveled = (pr.traveled ?? 0) + step.distance;
      const shooter = w.players.get(pr.owner);
      if (shooter && wd) suppressNearShot(w, shooter, ox, oy, step.x, step.y, 110);
      wall = step.wall;
      if (wd) {
        const length = Math.hypot(step.x - ox, step.y - oy);
        if (length > 0) {
          const dx = (step.x - ox) / length, dy = (step.y - oy) / length;
          const hits: { player: Player; at: number; shield: boolean }[] = [];
          for (const victim of w.players.values()) {
            if (!victim.alive || victim.id === pr.owner || pr.hitIds?.includes(victim.id) ||
                (shooter && sameTeam(w, shooter, victim) && !w.settings.friendlyFire)) continue;
            const body = boxOf(victim);
            const at = rayRect(ox, oy, dx, dy, body);
            const shieldAt = ["saw-launcher", "m14", "emp-gun"].includes(wd.id) && shieldRaised(victim)
              ? rayRect(ox, oy, dx, dy, shieldBox(body, victim.aim)) : Infinity;
            const nearest = Math.min(at, shieldAt);
            if (nearest <= length) hits.push({ player: victim, at: nearest, shield: shieldAt <= at });
          }
          hits.sort((a, b) => a.at - b.at || a.player.id - b.player.id);
          const first = hits[0];
          // A pulse is consumed by its first mine or actor; a wall already bounds the segment.
          let mine: { id: number; at: number } | undefined;
          if (wd.id === "emp-gun") for (const candidate of w.projectiles) {
            if (candidate.kind !== "mine" || disarmed.has(candidate.id)) continue;
            const mineOwner = w.players.get(candidate.owner);
            if (shooter && mineOwner && mineOwner !== shooter && sameTeam(w, shooter, mineOwner) && !w.settings.friendlyFire) continue;
            const at = rayRect(ox, oy, dx, dy, { x: candidate.x - 9, y: candidate.y - 9, w: 18, h: 18 });
            if (at <= length && (!mine || at < mine.at)) mine = { id: candidate.id, at };
          }
          if (mine && (!first || mine.at < first.at)) { disarmed.add(mine.id); continue; }
          if (wd.id === "saw-launcher") {
            pr.hitIds ??= [];
            for (const hit of hits) {
              if (hit.shield) {
                w.events.push({ t: "shield", id: hit.player.id }); combat(w, hit.player);
                pr.x = ox + dx * hit.at; pr.y = oy + dy * hit.at; blockedByShield = true; break;
              }
              applyDamage(w, hit.player, pr.owner, wd.damage * w.settings.damage, wd.id);
              pr.hitIds.push(hit.player.id);
            }
          } else if (first) {
            playerHit = first.player;
            pr.x = ox + dx * first.at; pr.y = oy + dy * first.at;
            blockedByShield = first.shield;
          }
        }
      }
      if (td?.effect === "mine" && wall) {
        pr.stuck = true; pr.vx = 0; pr.vy = 0; pr.armedAt = w.tick + ticks(td.armMs!);
      }
    }
    // Combat remains usable throughout the actor envelope; preserve the prior
    // projectile-only cushion beyond it. Range, fuse, TTL and collision still win.
    if (pr.x < travel.x - OUT_OF_BOUNDS_MARGIN || pr.x > travel.x + travel.w + OUT_OF_BOUNDS_MARGIN ||
        pr.y > travel.y + travel.h + OUT_OF_BOUNDS_MARGIN || pr.y < travel.y - OUT_OF_BOUNDS_MARGIN) continue;
    if (wd?.id === "saw-launcher") {
      if (wall) pr.bounces = (pr.bounces ?? 0) + 1;
      if (blockedByShield || (pr.bounces ?? 0) >= 4 || w.tick >= pr.explodeTick ||
          (pr.traveled ?? 0) >= wd.range || (pr.hitIds?.length ?? 0) >= 32) {
        explode(w, pr); continue;
      }
    } else if (wd?.id === "m14" || wd?.id === "emp-gun") {
      if (playerHit) {
        if (blockedByShield) { w.events.push({ t: "shield", id: playerHit.id }); combat(w, playerHit); }
        else {
          if (wd.id === "emp-gun") disableFlight(w, playerHit, wd.empMs!, pr.owner);
          applyDamage(w, playerHit, pr.owner, wd.damage * w.settings.damage, wd.id);
        }
        continue;
      }
      if (wall || w.tick >= pr.explodeTick || (pr.traveled ?? 0) >= wd.range) continue;
    } else if (wd && (playerHit || (wall && wd.id !== "rg6") || w.tick >= pr.explodeTick || (pr.traveled ?? 0) >= wd.range)) {
      explode(w, pr); continue;
    } else if (td?.effect === "mine") {
      if (w.tick >= pr.explodeTick || disarmed.has(pr.id)) continue;
      if (pr.stuck && w.tick >= (pr.armedAt ?? Infinity)) {
        const owner = w.players.get(pr.owner);
        const triggered = [...w.players.values()].some((target) => target.alive && target.id !== pr.owner &&
          (!owner || enemies(w, owner, target)) && Math.hypot(target.x - pr.x, target.y - heightOf(target) / 2 - pr.y) < 75 &&
          lineOfSight(w.map, pr.x, pr.y - 1, target.x, target.y - heightOf(target) / 2));
        if (triggered) { explode(w, pr); continue; }
      }
    } else if (td && w.tick >= pr.explodeTick) { explode(w, pr); continue; }
    keep.push(pr);
  }
  w.projectiles = keep.filter((p) => !disarmed.has(p.id));
}

function explode(w: World, pr: Projectile): void {
  const td = THROWABLES[pr.kind], wd = pr.weapon ? WEAPONS[pr.weapon] : undefined;
  const radius = wd?.blastRadius ?? td?.radius ?? 0;
  if (td?.effect === "flash") {
    w.events.push({ t: "flashbang", x: Math.round(pr.x), y: Math.round(pr.y), r: radius });
    const owner = w.players.get(pr.owner);
    for (const p of w.players.values()) {
      if (!p.alive || !p.connected || p.reserved || w.tick < p.protectUntil ||
          (owner && owner !== p && sameTeam(w, owner, p) && !w.settings.friendlyFire)) continue;
      const cy = p.y - heightOf(p) / 2;
      const distance = Math.hypot(p.x - pr.x, cy - pr.y);
      if (distance >= radius) continue;
      const visible = lineOfSight(w.map, pr.x, pr.y - 2, p.x, cy);
      const strength = Math.max(0, (1 - distance / radius) * (visible ? 1 : .2));
      const duration = Math.max(1, Math.round(ticks(td.durationMs!) * strength));
      p.flashStrength = Math.max(w.tick < p.flashUntil ? p.flashStrength : 0, strength);
      p.flashUntil = Math.max(p.flashUntil, w.tick + duration);
      combat(w, p);
      w.events.push({ t: "flash", id: p.id, until: p.flashUntil, strength });
    }
    return;
  }
  if (td?.effect === "gas") {
    w.areas.push({ id: pr.id, owner: pr.owner, x: pr.x, y: pr.y - 2, radius,
      until: w.tick + ticks(td.durationMs!), nextDamageTick: w.tick });
    return;
  }
  w.events.push({ t: "explode", x: Math.round(pr.x), y: Math.round(pr.y), r: radius });
  const ey = pr.y - 2;
  const owner = w.players.get(pr.owner);
  for (const other of w.players.values()) {
    if (!other.alive) continue;
    const cy = other.y - 22;
    const d = Math.hypot(other.x - pr.x, cy - ey);
    if (d > radius || !lineOfSight(w.map, pr.x, ey, other.x, cy)) continue;
    if (td?.effect === "emp") disableFlight(w, other, td.durationMs!, pr.owner);
    const maximum = wd?.damage ?? td.maxDamage, minimum = wd ? maximum * .15 : td.minDamage;
    const crouchFactor = other.crouch && other.onGround && td?.effect !== "emp" ? .65 : 1;
    const dmg = (maximum - (maximum - minimum) * (d / radius)) * crouchFactor;
    if (w.tick >= other.protectUntil && !(owner && owner !== other && sameTeam(w, owner, other) && !w.settings.friendlyFire) && td?.effect !== "emp") {
      const impulse = 420 * (1 - d / radius);
      const dx = other.x - pr.x, dy = cy - ey;
      const length = Math.max(1, Math.hypot(dx, dy));
      other.vx = Math.max(-650, Math.min(650, other.vx + dx / length * impulse));
      other.vy = Math.max(-650, Math.min(650, other.vy + (length === 1 && dx === 0 && dy === 0 ? -1 : dy / length) * impulse));
      other.onGround = false;
    }
    applyDamage(w, other, pr.owner, dmg * w.settings.damage, wd?.id ?? td.id);
  }
}

function stepAreas(w: World): void {
  w.areas = w.areas.filter((area) => area.until > w.tick);
  for (const area of w.areas) {
    if (w.tick < area.nextDamageTick) continue;
    area.nextDamageTick = w.tick + 12;
    for (const p of w.players.values()) {
      const cy = p.y - heightOf(p) / 2;
      if (p.alive && Math.hypot(p.x - area.x, cy - area.y) < area.radius && lineOfSight(w.map, area.x, area.y, p.x, cy))
        applyDamage(w, p, area.owner, THROWABLES.gas.maxDamage * w.settings.damage, "gas");
    }
  }
}

function flagHome(w: World, flag: FlagState): { x: number; y: number } {
  return w.map.flagHomes.find((home) => home.team === flag.owner) ??
    w.map.spawns.find((spawn) => spawn.team === flag.owner) ?? w.map.spawns[0];
}
function resetFlag(w: World, flag: FlagState): void {
  Object.assign(flag, flagHome(w, flag), { state: "home", carrier: null, vx: 0, vy: 0, availableTick: w.tick });
}

// Called immediately by the room layer on disconnect, and synchronously on death.
export function dropFlags(w: World, playerId: number): void {
  const p = w.players.get(playerId);
  for (const flag of w.flags) {
    if (flag.state !== "carried" || flag.carrier !== playerId) continue;
    Object.assign(flag, { state: "dropped", carrier: null, x: p?.x ?? flag.x, y: p ? p.y - 12 : flag.y, vx: p?.vx ?? 0, vy: p?.vy ?? 0 });
    if (w.map.physics === "space") {
      // Keep inertia, bounded below the slowest equipped player's thrust cap.
      const speed = Math.hypot(flag.vx, flag.vy), cap = SPACE_SPEED * w.settings.moveSpeed * .55;
      if (speed > cap) { flag.vx *= cap / speed; flag.vy *= cap / speed; }
    }
    w.events.push({ t: "flag", owner: flag.owner, action: "drop", by: playerId });
  }
}

function prepareFlags(w: World): void {
  for (const flag of w.flags) {
    if (flag.state === "respawning" && w.tick >= flag.availableTick) resetFlag(w, flag);
    if (flag.state === "carried") {
      const p = flag.carrier === null ? undefined : w.players.get(flag.carrier);
      if (!p || !p.alive || !p.connected) dropFlags(w, flag.carrier!);
    }
    if (flag.state !== "dropped") continue;
    // Dropped flags are physical objects without any return timer.
    const body: Projectile = { id: -1, kind: "mine", owner: -1, x: flag.x, y: flag.y, vx: flag.vx, vy: flag.vy, explodeTick: Infinity, radius: w.map.physics === "space" ? 10 : 0 };
    advanceProjectile(w, body);
    flag.x = body.x; flag.y = body.y; flag.vx = body.vx; flag.vy = body.vy;
    if (flag.x < 0 || flag.x > w.map.width || flag.y < 0 || flag.y > w.map.height) {
      resetFlag(w, flag);
      w.events.push({ t: "flag", owner: flag.owner, action: "return", by: null });
    }
  }
}

function collectFlags(w: World): void {
  for (const flag of w.flags) {
    if (flag.state === "home" || flag.state === "dropped") {
      const p = [...w.players.values()].filter((p) => p.alive && p.connected && p.team === flag.owner &&
        Math.abs(p.x - flag.x) < PICKUP_RADIUS && flag.y >= p.y - heightOf(p) - 10 && flag.y <= p.y + 20 &&
        lineOfSight(w.map, p.x, p.y - 12, flag.x, flag.y - 1)).sort((a, b) => a.id - b.id)[0];
      if (p) {
        flag.state = "carried"; flag.carrier = p.id; p.protectUntil = 0;
        w.events.push({ t: "flag", owner: flag.owner, action: "pickup", by: p.id });
      }
    }
  }
}

function resolveFlags(w: World): void {
  for (const flag of w.flags) {
    if (flag.state !== "carried") continue;
    const p = w.players.get(flag.carrier!);
    if (!p?.alive || !p.connected) { dropFlags(w, flag.carrier!); continue; }
    flag.x = p.x; flag.y = p.y - 12;
    if (flag.x < 0 || flag.x > w.map.width || flag.y < 0 || flag.y > w.map.height) {
      resetFlag(w, flag);
      w.events.push({ t: "flag", owner: flag.owner, action: "return", by: null });
      continue;
    }
    const box = boxOf(p);
    const delivered = w.map.goals.some((goal) => goal.team !== flag.owner &&
      box.x < goal.rect.x + goal.rect.w && box.x + box.w > goal.rect.x &&
      box.y < goal.rect.y + goal.rect.h && box.y + box.h > goal.rect.y);
    if (!delivered) continue;
    p.deliveries++; w.teamScores[flag.owner]++;
    flag.generation++; flag.state = "respawning"; flag.carrier = null; flag.availableTick = w.tick + 1;
    flag.vx = 0; flag.vy = 0;
    w.events.push({ t: "flag", owner: flag.owner, action: "delivery", by: p.id });
  }
}

function stepSurvival(w: World): void {
  const survival = w.survival;
  if (!survival) return;
  const humans = [...w.players.values()].filter((p) => !p.bot && (p.connected || p.reserved));
  if (humans.length === 0) return;
  // The room may hide a disconnected body after ten seconds while retaining
  // its health/inventory for the thirty-second reconnect reservation.
  if (survival.wave > 0 && humans.some((p) => p.connected) &&
      humans.every((p) => !p.alive && !(p.reserved && p.hp > 0))) {
    w.over = true; w.overReason = "defeat"; return;
  }
  if (survival.nextWaveTick > 0 && w.tick >= survival.nextWaveTick) {
    survival.wave++;
    survival.toSpawn = 4 + survival.wave * 2;
    survival.remaining = survival.toSpawn;
    survival.nextSpawnTick = w.tick;
    survival.nextWaveTick = 0;
    for (const p of humans) {
      if (!p.connected) continue;
      if (!p.alive) respawn(w, p);
      else { p.hp = maxHealth(w.settings); p.fuel = maxFuel(w.settings); }
    }
    w.events.push({ t: "wave", wave: survival.wave });
  }
  const bots = [...w.players.values()].filter((p) => p.bot);
  let alive = bots.filter((p) => p.alive).length;
  if (survival.toSpawn > 0 && alive < 8 && w.tick >= survival.nextSpawnTick) {
    let bot = bots.find((p) => !p.alive);
    if (!bot) bot = addPlayer(w, { id: w.nextId++, key: "enemy-" + bots.length, name: "Raider " + (bots.length + 1), team: 1, color: 0xe76f51, bot: true });
    else respawn(w, bot);
    bot.maxHp = maxHealth(w.settings) * Math.min(2, 1 + .1 * (survival.wave - 1));
    bot.hp = bot.maxHp;
    const pool = w.settings.weapons.filter((id) => WEAPONS[id].category !== "equipment");
    const weapon = pool[(survival.wave + bots.length) % pool.length] ?? w.settings.loadout[0];
    bot.slots = [freshSlot(weapon), null, null];
    bot.throwables = {};
    survival.toSpawn--; alive++;
    survival.nextSpawnTick = w.tick + Math.max(15, 60 - survival.wave * 3);
  }
  survival.remaining = survival.toSpawn + alive;
  if (survival.remaining === 0 && survival.nextWaveTick === 0 && survival.wave > 0) {
    survival.cleared = survival.wave;
    survival.nextWaveTick = w.tick + 3 * TICK_RATE;
  }
}

function recordHistory(w: World): void {
  const boxes = new Map<number, Rect>(), shields = new Map<number, Rect>(), crouched = new Set<number>();
  for (const p of w.players.values()) if (p.alive) {
    const body = boxOf(p);
    boxes.set(p.id, body);
    if (p.crouch) crouched.add(p.id);
    if (shieldRaised(p)) shields.set(p.id, shieldBox(body, p.aim));
  }
  w.history.push({ tick: w.tick, boxes, shields, crouched });
  if (w.history.length > LAG_COMP_MAX_TICKS + 2) w.history.shift();
}

export function stepWorld(w: World, inputs: Map<number, InputFrame>): void {
  if (w.over) return;
  w.tick++;
  prepareFlags(w);
  const players = [...w.players.values()].sort((a, b) => a.id - b.id);
  const actions = new Map<number, { b: number; pressed: number; inp: InputFrame | undefined }>();
  for (const p of players) {
    if (!p.alive) {
      if (p.connected && !w.survival && w.tick >= p.respawnTick) respawn(w, p);
      continue;
    }
    const inp = inputs.get(p.id);
    const b = p.connected && inp ? inp.b : 0;
    if (p.connected && inp && Number.isFinite(inp.aim)) p.aim = Math.atan2(Math.sin(inp.aim), Math.cos(inp.aim));
    const pressed = b & ~p.prevButtons;
    p.prevButtons = b;
    stepMovement(p, b, w.map, w.settings, { thrustDisabled: w.tick < p.empUntil,
      movementMultiplier: equippedMovementMultiplier(p.slots, p.active, p.dual ? dualPartner(p) : null) });
    actions.set(p.id, { b, pressed, inp });
  }
  // Collecting ends protection before this tick's damage is resolved.
  collectFlags(w);
  for (const p of players) {
    const action = actions.get(p.id);
    if (!p.alive || !action) continue;
    const { b, pressed, inp } = action;
    if (pressed & Btn.SWITCH) cycleSlot(w, p);
    if (pressed & Btn.SLOT1) switchTo(w, p, 0);
    if (pressed & Btn.SLOT2) switchTo(w, p, 1);
    if (pressed & Btn.SLOT3) switchTo(w, p, 2);
    if (pressed & Btn.DUAL) p.dual = !p.dual && canDual(p);
    if (p.dual && !canDual(p)) p.dual = false;
    // Every slot owns its timer. Reloading one dual weapon never stalls its partner.
    for (const slot of p.slots) if (slot && slot.reloadEnd > 0 && w.tick >= slot.reloadEnd) finishReload(w, slot);
    const partner = p.dual ? dualPartner(p) : null;
    const activeSlots = partner === null ? [p.slots[p.active]] : [p.slots[p.active], p.slots[partner]];
    for (const slot of p.slots) {
      if (!slot) continue;
      if (!activeSlots.includes(slot) || !p.connected || !inp) { slot.burstRemaining = 0; slot.chargeTicks = 0; }
    }
    for (const slot of activeSlots) {
      if (!slot) continue;
      const def = WEAPONS[slot.weapon];
      if (pressed & Btn.RELOAD) startReload(w, p, slot);
      const held = !!(b & Btn.FIRE);
      const continuous = def.auto || !!(b & Btn.CONTINUOUS_FIRE);
      const trigger = continuous ? held : !!(pressed & Btn.FIRE);
      if (!held) slot.chargeTicks = Math.max(0, (slot.chargeTicks ?? 0) - 2);
      if (slot.reloadEnd !== 0) continue;
      if (def.chargeMs && held && (continuous || trigger || (slot.chargeTicks ?? 0) > 0)) {
        slot.chargeTicks = Math.min(ticks(def.chargeMs), (slot.chargeTicks ?? 0) + 1);
      }
      const charged = !def.chargeMs || (slot.chargeTicks ?? 0) >= ticks(def.chargeMs);
      if (def.burstCount) {
        if (trigger && !slot.burstRemaining && w.tick >= slot.cooldownUntil) {
          slot.burstRemaining = def.burstCount;
          slot.nextBurstTick = w.tick;
        }
        // A click commits one finite burst. Released input completes it; a
        // missing input, switch, reload or disconnected actor cancels it above.
        if (slot.burstRemaining && w.tick >= (slot.nextBurstTick ?? 0)) {
          if (slot.mag > 0) {
            fire(w, p, slot, inp?.view);
            slot.burstRemaining--;
            slot.nextBurstTick = w.tick + ticks(def.burstIntervalMs ?? 90);
          } else startReload(w, p, slot, true);
        }
      } else if (charged && held && (trigger || !!def.chargeMs) && w.tick >= slot.cooldownUntil) {
        if (slot.mag > 0 || def.category === "equipment") {
          fire(w, p, slot, inp?.view);
          if (def.chargeMs && !def.auto) slot.chargeTicks = 0;
        } else startReload(w, p, slot, true);
      }
      if (def.autoRefill && slot.mag === 0) startReload(w, p, slot, true);
    }
    if (pressed & Btn.MELEE && w.tick >= p.meleeUntil) {
      const blade = activeSlots.some((slot) => slot?.weapon === "machete");
      melee(w, p, blade ? WEAPONS.machete.damage : MELEE_DAMAGE, blade ? WEAPONS.machete.range : MELEE_RANGE, blade ? "machete" : "melee");
    }
    if (pressed & Btn.NEXT_THROWABLE) cycleThrowable(w, p);
    if (pressed & Btn.THROW && w.tick >= p.throwUntil) throwGrenade(w, p);
    if (pressed & Btn.PICKUP) tryPickupWeapon(w, p);
    if (pressed & Btn.DROP) dropActive(w, p);
    if (p.alive) autoPickups(w, p);
    if (p.alive) {
      if (w.map.physics === "space" || p.y <= w.map.height) p.fallExposureTicks = 0;
      else if (isFallingBelowMap(p, w.map)) {
        // Brief powered puffs pause exposure but cannot restart the grace period.
        // Re-entering the map is the recovery condition. Boundary pressure is
        // environmental damage, so protection and combat multipliers do not apply.
        p.fallExposureTicks++;
        combat(w, p);
        if (p.fallExposureTicks > FALL_EXPOSURE_GRACE_TICKS &&
            (p.fallExposureTicks - FALL_EXPOSURE_GRACE_TICKS) % FALL_DAMAGE_INTERVAL_TICKS === 0) {
          p.protectUntil = 0;
          applyDamage(w, p, null, FALL_DAMAGE_PER_INTERVAL, "fall");
        }
      }
    }
  }
  stepProjectiles(w);
  if (w.map.physics === "space") for (const pickup of w.pickups) {
    if (pickup.spawnIndex >= 0) continue;
    const body: Projectile = { id: pickup.id, kind: "mine", owner: -1, x: pickup.x, y: pickup.y,
      vx: pickup.vx ?? 0, vy: pickup.vy ?? 0, explodeTick: Infinity, radius: 6 };
    advanceProjectile(w, body);
    Object.assign(pickup, { x: body.x, y: body.y, vx: body.vx, vy: body.vy });
    if (pickup.x < 0 || pickup.x > w.map.width || pickup.y < 0 || pickup.y > w.map.height) pickup.expiresAt = w.tick;
  }
  stepAreas(w);
  regenerate(w);
  // All attacks and environmental damage resolve before either team's deliveries.
  resolveFlags(w);
  stepSurvival(w);
  w.pickups = w.pickups.filter((pk) => pk.expiresAt === 0 || pk.expiresAt > w.tick);
  recordHistory(w);
  checkEnd(w);
}

export function topScore(w: World): number {
  if (isTeamMode(w.settings)) return Math.max(...w.teamScores);
  return [...w.players.values()].reduce((m, p) => Math.max(m, p.kills), 0);
}

function checkEnd(w: World): void {
  if (w.over) return;
  if (w.settings.scoreLimit > 0 && (w.survival ? w.survival.cleared : topScore(w)) >= w.settings.scoreLimit) {
    w.over = true;
    w.overReason = "limit";
  } else if (w.tick >= w.endTick) {
    w.over = true;
    w.overReason = "time";
  }
}

export function contributionScore(mode: RoomSettings["mode"], p: { kills: number; assists: number; deliveries: number }): number {
  return (mode === "flag" ? 10 * p.deliveries : 0) + 2 * p.kills + p.assists;
}

export function scoringNote(mode: RoomSettings["mode"]): string {
  const base =
    mode === "flag"
      ? "Contribution = 10 × deliveries + 2 × kills + assists."
      : "Contribution = 2 × kills + assists.";
  return `${base} An assist is at least 20% of the victim's maximum health in damage within the 8 seconds before their death. MVP is the highest contribution across both teams; ties go to fewer deaths, then share the award.`;
}

export function computeResult(
  w: World,
  matchId: string,
  reason: MatchResult["reason"],
  profileOf: (p: Player) => string | null,
): MatchResult {
  const mode = w.settings.mode;
  const participants: ParticipantResult[] = [...w.players.values()].map((p) => ({
    key: p.key,
    profileId: profileOf(p),
    name: p.name,
    team: p.team,
    bot: p.bot,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    deliveries: p.deliveries,
    score: contributionScore(mode, p),
    mvp: false,
    weaponStats: Object.fromEntries(Object.entries(p.weaponStats).map(([id, stats]) => [id, { ...stats, damage: Math.round(stats.damage) }])),
  }));

  let draw = false;
  let winnerTeam: Team | null = null;
  let winnerKeys: string[] = [];
  if (reason !== "abandoned") {
    if (mode === "survival") {
      winnerTeam = reason === "defeat" ? 1 : 0;
      winnerKeys = participants.filter((p) => p.team === winnerTeam && !p.bot).map((p) => p.key);
    } else if (isTeamMode(w.settings)) {
      const [a, b] = w.teamScores;
      draw = a === b;
      winnerTeam = draw ? null : a > b ? 0 : 1;
      winnerKeys = draw ? [] : participants.filter((p) => p.team === winnerTeam).map((p) => p.key);
    } else {
      const best = Math.max(0, ...participants.map((p) => p.kills));
      const top = participants.filter((p) => p.kills === best);
      draw = top.length !== 1;
      winnerKeys = draw ? [] : [top[0].key];
    }
    const eligible = mode === "survival" ? participants.filter((p) => !p.bot) : participants;
    const bestScore = Math.max(0, ...eligible.map((p) => p.score));
    if (eligible.length > 0) {
      const contenders = eligible.filter((p) => p.score === bestScore);
      const fewest = Math.min(...contenders.map((p) => p.deaths));
      for (const p of contenders) if (p.deaths === fewest) p.mvp = true;
    }
  }
  participants.sort((a, b) => b.score - a.score || a.deaths - b.deaths || a.name.localeCompare(b.name));
  return {
    matchId,
    mode,
    map: w.map.id,
    reason,
    draw,
    winnerTeam,
    winnerKeys,
    teamScores: [...w.teamScores],
    participants,
    durationSec: Math.round((w.tick - w.startTick) / TICK_RATE),
    endedAt: new Date().toISOString(),
    scoringNote: scoringNote(mode),
    wavesCleared: w.survival?.cleared,
    rulesVersion: GAMEPLAY_VERSION,
    mapVersion: w.map.version ?? 1,
  };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function snapPlayer(w: World, p: Player): PlayerSnap {
  const slot = p.slots[p.active];
  const f =
    (p.alive ? PF.ALIVE : 0) |
    (p.crouch ? PF.CROUCH : 0) |
    (p.onGround ? PF.GROUND : 0) |
    (w.tick < p.protectUntil ? PF.PROTECTED : 0) |
    (p.jetting ? PF.JETTING : 0) |
    (p.connected ? PF.CONNECTED : 0);
  return {
    id: p.id,
    revealUntil: p.revealUntil,
    x: r2(p.x),
    y: r2(p.y),
    vx: r2(p.vx),
    vy: r2(p.vy),
    aim: r2(p.aim),
    f,
    hp: Math.ceil(p.hp),
    maxHp: p.maxHp,
    fuel: r2(p.fuel),
    jc: p.jetCooldown,
    dt: p.dropTicks,
    s: [p.slots[0]?.weapon ?? null, p.slots[1]?.weapon ?? null, p.slots[2]?.weapon ?? null],
    a: p.active,
    mag: slot?.mag ?? 0,
    res: slot?.reserve ?? 0,
    rl: slot && slot.reloadEnd > 0 ? slot.reloadEnd - w.tick : 0,
    g: p.throwables[p.throwable] ?? 0,
    k: p.kills,
    d: p.deaths,
    as: p.assists,
    rs: p.alive || w.survival ? 0 : Math.max(0, p.respawnTick - w.tick),
    slots: p.slots.map((slot) => slot ? { ...slot } : null) as Inventory,
    dual: p.dual,
    dualSlot: p.dual ? dualPartner(p) : null,
    flash: Math.max(0, p.flashUntil - w.tick),
    flashStrength: w.tick < p.flashUntil ? p.flashStrength * Math.min(1, (p.flashUntil - w.tick) / 30) : 0,
    throwable: p.throwable,
    throwables: { ...p.throwables },
    emp: Math.max(0, p.empUntil - w.tick),
    deliveries: p.deliveries,
  };
}

export function snapshot(w: World, events: GameEvent[]): Omit<WorldSnapshot, "ack"> {
  return {
    tick: w.tick,
    endTick: w.endTick,
    ts: [...w.teamScores],
    players: [...w.players.values()].map((p) => snapPlayer(w, p)),
    projectiles: w.projectiles.map((p) => ({ id: p.id, k: p.kind, x: r2(p.x), y: r2(p.y), vx: r2(p.vx), vy: r2(p.vy), armed: !!p.stuck && w.tick >= (p.armedAt ?? Infinity) })),
    pickups: w.pickups
      .filter((pk) => pickupAvailable(w, pk))
      .map((pk) => ({ id: pk.id, k: pk.kind, i: pk.item, x: pk.x, y: pk.y })),
    events,
    flags: w.flags.map((flag) => ({ ...flag, x: r2(flag.x), y: r2(flag.y), vx: r2(flag.vx), vy: r2(flag.vy) })),
    areas: w.areas.map((area) => ({ id: area.id, k: "gas", x: r2(area.x), y: r2(area.y), r: area.radius, until: area.until })),
    survival: w.survival ? { ...w.survival } : null,
  };
}
