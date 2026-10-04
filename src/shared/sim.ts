import {
  ASSIST_MIN_FRACTION,
  ASSIST_WINDOW_TICKS,
  BASE_HEALTH,
  DEFAULT_FRAGS,
  DROPPED_WEAPON_TTL_TICKS,
  DT,
  GRAVITY,
  LAG_COMP_MAX_TICKS,
  MAX_THROWABLES,
  MELEE_COOLDOWN_TICKS,
  MELEE_DAMAGE,
  MELEE_RANGE,
  OUT_OF_BOUNDS_MARGIN,
  PICKUP_RADIUS,
  PLAYER_W,
  SPAWN_PROTECT_TICKS,
  TICK_RATE,
} from "./constants.ts";
import { MAPS } from "./maps.ts";
import {
  boxOf,
  groundBelow,
  heightOf,
  lineOfSight,
  maxFuel,
  type MoveState,
  pointInSolid,
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
  type Team,
  type WorldSnapshot,
} from "./types.ts";
import { THROWABLES, WEAPONS } from "./weapons.ts";

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
  slots: [SlotState | null, SlotState | null];
  active: 0 | 1;
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
}

interface HistoryEntry {
  tick: number;
  boxes: Map<number, Rect>;
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
    flags: settings.mode === "flag" ? ([0, 1] as const).map((owner) => {
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
  return { weapon, mag: def.mag, reserve: def.reserve, reloadEnd: 0, cooldownUntil: 0 };
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
    slots: [null, null],
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
    weaponStats: {},
  };
  if (w.settings.mode === "survival") p.team = p.bot ? 1 : 0;
  w.nextId = Math.max(w.nextId, p.id + 1);
  w.players.set(p.id, p);
  respawn(w, p);
  return p;
}

const sameTeam = (w: World, a: Player, b: Player): boolean =>
  (isTeamMode(w.settings) || w.settings.mode === "survival") && a.team !== -1 && a.team === b.team;

const enemies = (w: World, a: Player, b: Player): boolean => a !== b && !sameTeam(w, a, b);

export function respawn(w: World, p: Player): void {
  const s = w.settings;
  const teamSpawns = w.map.spawns.filter((sp) => (isTeamMode(s) || s.mode === "survival" ? sp.team === p.team : true));
  const spawns = teamSpawns.length > 0 ? teamSpawns : w.map.spawns;
  const foes = [...w.players.values()].filter((o) => o.alive && enemies(w, p, o));
  let best = spawns[0];
  let bestScore = -Infinity;
  for (const sp of spawns) {
    const nearest = foes.reduce((m, o) => Math.min(m, Math.hypot(o.x - sp.x, o.y - sp.y)), 5000);
    const score = nearest + rng(w) * 60;
    if (score > bestScore) {
      bestScore = score;
      best = sp;
    }
  }
  Object.assign(p, {
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
    prevButtons: 0,
  });
  p.slots = [freshSlot(s.loadout[0]), s.loadout[1] ? freshSlot(s.loadout[1]) : null];
  p.throwables = s.throwables.includes("frag") ? { frag: DEFAULT_FRAGS } : {};
  p.throwable = s.throwables.includes("frag") ? "frag" : (s.throwables[0] ?? "frag");
  w.events.push({ t: "spawn", id: p.id });
}

function statsFor(p: Player, weapon: string): WeaponStats {
  return p.weaponStats[weapon] ??= { shots: 0, hits: 0, damage: 0, kills: 0 };
}

function shieldRaised(p: Player): boolean {
  return p.slots.some((s, i) => s?.weapon === "riot-shield" && (i === p.active || p.dual));
}

export function applyDamage(w: World, victim: Player, attackerId: number | null, amount: number, weapon: string): number {
  if (!victim.alive || amount <= 0 || !Number.isFinite(amount)) return 0;
  if (w.tick < victim.protectUntil) return 0;
  const attacker = attackerId === null ? undefined : w.players.get(attackerId);
  if (attacker && attacker !== victim && sameTeam(w, attacker, victim) && !w.settings.friendlyFire) return 0;
  // Shields stop frontal direct fire, not blast, gas or melee damage.
  const behavior = WEAPONS[weapon]?.behavior;
  if (attacker && attacker !== victim && shieldRaised(victim) &&
      (behavior === "hitscan" || behavior === "beam" || behavior === "emp" || weapon === "saw-launcher")) {
    const incoming = Math.atan2(attacker.y - victim.y, attacker.x - victim.x);
    if (Math.cos(incoming - victim.aim) > .35) {
      amount *= .15;
      w.events.push({ t: "shield", id: victim.id });
    }
  }
  const dealt = Math.min(victim.hp, amount);
  victim.hp -= dealt;
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
  victim.deaths++;
  victim.respawnTick = w.tick + w.settings.respawnSec * TICK_RATE;

  const held = victim.slots[victim.active];
  if (held && !w.settings.loadout.includes(held.weapon)) dropWeapon(w, victim.x, victim.y - 10, { ...held, reloadEnd: 0 });

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
  for (const [id, total] of byAttacker) {
    const helper = w.players.get(id);
    if (!helper || helper === killer || !enemies(w, helper, victim)) continue;
    if (total >= ASSIST_MIN_FRACTION * victim.maxHp) helper.assists++;
  }
  victim.damageLog = [];
  w.events.push({ t: "kill", killer: credited ? killer.id : null, victim: victim.id, w: weapon });
}

function dropWeapon(w: World, x: number, y: number, slot: SlotState): void {
  const gy = groundBelow(w.map, x, y);
  if (gy > w.map.height) return;
  w.pickups.push({
    id: w.nextId++,
    kind: "weapon",
    item: slot.weapon,
    x,
    y: gy,
    spawnIndex: -1,
    respawnTicks: 0,
    availableAt: 0,
    expiresAt: w.tick + DROPPED_WEAPON_TTL_TICKS,
    slot,
  });
}

function consumePickup(w: World, pk: Pickup): void {
  if (pk.spawnIndex >= 0) pk.availableAt = w.tick + pk.respawnTicks;
  else w.pickups = w.pickups.filter((o) => o !== pk);
}

const pickupAvailable = (w: World, pk: Pickup): boolean => pk.availableAt <= w.tick;

function nearPickup(p: Player, pk: Pickup): boolean {
  return Math.abs(pk.x - p.x) <= PICKUP_RADIUS && pk.y >= p.y - heightOf(p) - 10 && pk.y <= p.y + 20;
}

function startReload(w: World, p: Player, slot: SlotState): void {
  const def = WEAPONS[slot.weapon];
  if (def.category === "equipment" || slot.reloadEnd !== 0 || slot.mag >= def.mag) return;
  if (!w.settings.unlimitedAmmo && slot.reserve <= 0) return;
  slot.reloadEnd = w.tick + ticks(def.reloadMs);
  w.events.push({ t: "reload", id: p.id });
}

function finishReload(w: World, slot: SlotState): void {
  const def = WEAPONS[slot.weapon];
  const need = def.mag - slot.mag;
  const take = w.settings.unlimitedAmmo ? need : Math.min(need, slot.reserve);
  slot.mag += take;
  if (!w.settings.unlimitedAmmo) slot.reserve -= take;
  slot.reloadEnd = 0;
}

function switchTo(p: Player, idx: 0 | 1): void {
  if (idx === p.active || !p.slots[idx]) return;
  // Single-weapon switching keeps its established reload cancellation; dual
  // slots reload concurrently and never reset the other slot's cooldown.
  const cur = p.slots[p.active];
  if (cur && !p.dual) cur.reloadEnd = 0;
  p.active = idx;
}
export function canDual(p: Player): boolean {
  return p.slots.every((slot) => slot !== null && WEAPONS[slot.weapon].oneHanded && !WEAPONS[slot.weapon].heavy)
    && !p.slots.every((slot) => slot?.weapon === "riot-shield");
}

function boxesAt(w: World, viewTick: number | undefined): Map<number, Rect> | null {
  if (viewTick === undefined) return null;
  const target = Math.max(w.tick - LAG_COMP_MAX_TICKS, Math.min(w.tick, Math.floor(viewTick)));
  for (let i = w.history.length - 1; i >= 0; i--) {
    if (w.history[i].tick <= target) return w.history[i].boxes;
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
  if (def.behavior === "melee") { melee(w, p, def.damage, def.range, def.id); return; }
  slot.mag--;
  const { x: ox, y: oy } = muzzleOf(p);
  if (def.behavior === "projectile") {
    w.projectiles.push({ id: w.nextId++, kind: def.id, weapon: def.id, owner: p.id,
      x: ox, y: oy, vx: Math.cos(p.aim) * def.projectileSpeed!, vy: Math.sin(p.aim) * def.projectileSpeed!,
      explodeTick: w.tick + (def.id === "rg6" ? ticks(1800) : ticks(def.range / def.projectileSpeed! * 1000)), bounces: 0 });
  } else {
    const rewound = def.behavior !== "flame" ? boxesAt(w, viewTick) : null;
    const rays = def.behavior === "flame" ? 3 : def.pellets;
    const burned = new Set<number>();
    for (let i = 0; i < rays; i++) {
      const angle = p.aim + (def.behavior === "flame" ? (i - 1) * def.spread / 2 : (rng(w) - .5) * def.spread);
      const dx = Math.cos(angle), dy = Math.sin(angle);
      let dist = raycastMap(w.map, ox, oy, dx, dy, def.range);
      const targets: { p: Player; distance: number }[] = [];
      for (const other of w.players.values()) {
        if (!other.alive || other === p || (sameTeam(w, p, other) && !w.settings.friendlyFire)) continue;
        const distance = rayRect(ox, oy, dx, dy, rewound?.get(other.id) ?? boxOf(other));
        if (distance < dist) targets.push({ p: other, distance });
      }
      targets.sort((a, b) => a.distance - b.distance || a.p.id - b.p.id);
      const selected = def.behavior === "beam" ? targets : targets.slice(0, 1);
      if (selected.length > 0 && def.behavior !== "beam") dist = selected[0].distance;
      for (const hit of selected) {
        if (def.behavior === "flame" && burned.has(hit.p.id)) continue;
        burned.add(hit.p.id);
        if (def.behavior === "emp") disableFlight(w, hit.p, def.empMs!, p.id);
        applyDamage(w, hit.p, p.id, def.damage * w.settings.damage, def.id);
      }
      w.events.push({ t: "shot", by: p.id, w: def.id, x1: Math.round(ox), y1: Math.round(oy),
        x2: Math.round(ox + dx * dist), y2: Math.round(oy + dy * dist), hit: selected.length > 0 });
    }
  }
  if (slot.mag === 0) startReload(w, p, slot);
}

function melee(w: World, p: Player, damage = MELEE_DAMAGE, range = MELEE_RANGE, weapon = "melee"): void {
  p.meleeUntil = w.tick + MELEE_COOLDOWN_TICKS;
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
      if (lineOfSight(w.map, p.x, p.y - heightOf(p) / 2, o.x, o.y - heightOf(o) / 2)) applyDamage(w, o, p.id, damage * w.settings.damage, weapon);
    }
  }
  w.events.push({ t: "melee", by: p.id, x: Math.round(p.x + dir * 30), y: Math.round(p.y - 25) });
}

function throwGrenade(w: World, p: Player): void {
  const def = THROWABLES[p.throwable];
  if (!def || (p.throwables[p.throwable] ?? 0) <= 0) return;
  p.throwables[p.throwable]--;
  statsFor(p, def.id).shots++;
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
}

function tryPickupWeapon(w: World, p: Player): void {
  let best: Pickup | null = null;
  let bestD = Infinity;
  for (const pk of w.pickups) {
    if (pk.kind !== "weapon" || !pk.item || !pickupAvailable(w, pk) || !nearPickup(p, pk)) continue;
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
      switchTo(p, empty as 0 | 1);
    } else {
      const old = p.slots[p.active]!;
      dropWeapon(w, p.x, p.y - 10, { ...old, reloadEnd: 0 });
      p.slots[p.active] = incoming;
    }
  }
  if (p.dual && !canDual(p)) p.dual = false;
  consumePickup(w, best);
  w.events.push({ t: "pickup", id: p.id, item: incoming.weapon });
}

function dropActive(w: World, p: Player): void {
  const slot = p.slots[p.active];
  if (!slot) return;
  dropWeapon(w, p.x, p.y - 10, { ...slot, reloadEnd: 0 });
  p.slots[p.active] = null;
  p.dual = false;
  const other = (1 - p.active) as 0 | 1;
  if (p.slots[other]) p.active = other;
}

function autoPickups(w: World, p: Player): void {
  for (const pk of w.pickups) {
    if (pk.kind === "weapon" || !pickupAvailable(w, pk) || !nearPickup(p, pk)) continue;
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
    w.events.push({ t: "pickup", id: p.id, item: pk.kind });
  }
}

// Swept segments, rather than endpoint tests, prevent fast rockets/discs from
// crossing thin walls. One-way platforms catch falling physical projectiles.
function advanceProjectile(w: World, pr: Projectile): { x: number; y: number; wall: boolean; distance: number } {
  const wd = pr.weapon ? WEAPONS[pr.weapon] : undefined;
  const td = THROWABLES[pr.kind];
  const gravity = wd?.projectileGravity ?? 1;
  pr.vy += GRAVITY * w.settings.gravity * gravity * DT;
  const dx = pr.vx * DT, dy = pr.vy * DT, length = Math.hypot(dx, dy);
  if (length === 0) return { x: pr.x, y: pr.y, wall: false, distance: 0 };
  const ux = dx / length, uy = dy / length;
  let distance = length, hit: Rect | null = null;
  for (const r of w.map.solids) {
    const d = rayRect(pr.x, pr.y, ux, uy, r);
    if (d <= distance) { distance = d; hit = r; }
  }
  if (dy > 0) for (const r of w.map.platforms) {
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
  } else { pr.x += dx; pr.y += dy; }
  return { x, y, wall: hit !== null, distance };
}

function stepProjectiles(w: World): void {
  const keep: Projectile[] = [];
  for (const pr of w.projectiles) {
    const wd = pr.weapon ? WEAPONS[pr.weapon] : undefined;
    const td = THROWABLES[pr.kind];
    if (!wd && !td) continue;
    const ox = pr.x, oy = pr.y;
    let wall = false, playerHit: Player | null = null;
    if (!pr.stuck) {
      const step = advanceProjectile(w, pr);
      wall = step.wall;
      if (wd) {
        const distance = Math.hypot(step.x - ox, step.y - oy);
        if (distance > 0) {
          const dx = (step.x - ox) / distance, dy = (step.y - oy) / distance;
          let nearest = distance + .001;
          const owner = w.players.get(pr.owner);
          for (const victim of w.players.values()) {
            if (!victim.alive || victim.id === pr.owner || (owner && sameTeam(w, owner, victim) && !w.settings.friendlyFire)) continue;
            const hitAt = rayRect(ox, oy, dx, dy, boxOf(victim));
            if (hitAt < nearest) { nearest = hitAt; playerHit = victim; }
          }
          if (playerHit) { pr.x = ox + dx * nearest; pr.y = oy + dy * nearest; }
        }
      }
      if (td?.effect === "mine" && wall) {
        pr.stuck = true; pr.vx = 0; pr.vy = 0;
        pr.armedAt = w.tick + ticks(td.armMs!);
      }
    }
    if (pr.x < -OUT_OF_BOUNDS_MARGIN || pr.x > w.map.width + OUT_OF_BOUNDS_MARGIN ||
        pr.y > w.map.height + OUT_OF_BOUNDS_MARGIN || pr.y < -OUT_OF_BOUNDS_MARGIN) continue;
    if (wd?.id === "saw-launcher") {
      if (playerHit) { applyDamage(w, playerHit, pr.owner, wd.damage * w.settings.damage, wd.id); continue; }
      if (wall) pr.bounces = (pr.bounces ?? 0) + 1;
      if ((pr.bounces ?? 0) >= 4 || w.tick >= pr.explodeTick) continue;
    } else if (wd && (playerHit || (wall && wd.id !== "rg6") || w.tick >= pr.explodeTick)) {
      explode(w, pr); continue;
    } else if (td?.effect === "mine") {
      if (w.tick >= pr.explodeTick) continue;
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
  w.projectiles = keep;
}

function explode(w: World, pr: Projectile): void {
  const td = THROWABLES[pr.kind], wd = pr.weapon ? WEAPONS[pr.weapon] : undefined;
  const radius = wd?.blastRadius ?? td?.radius ?? 0;
  if (td?.effect === "gas") {
    w.areas.push({ id: pr.id, owner: pr.owner, x: pr.x, y: pr.y - 2, radius,
      until: w.tick + ticks(td.durationMs!), nextDamageTick: w.tick });
    return;
  }
  w.events.push({ t: "explode", x: Math.round(pr.x), y: Math.round(pr.y), r: radius });
  const ey = pr.y - 2;
  for (const other of w.players.values()) {
    if (!other.alive) continue;
    const cy = other.y - heightOf(other) / 2;
    const d = Math.hypot(other.x - pr.x, cy - ey);
    if (d > radius || !lineOfSight(w.map, pr.x, ey, other.x, cy)) continue;
    if (td?.effect === "emp") disableFlight(w, other, td.durationMs!, pr.owner);
    const maximum = wd?.damage ?? td.maxDamage, minimum = wd ? maximum * .15 : td.minDamage;
    const dmg = maximum - (maximum - minimum) * (d / radius);
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
    const body: Projectile = { id: -1, kind: "mine", owner: -1, x: flag.x, y: flag.y, vx: flag.vx, vy: flag.vy, explodeTick: Infinity };
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
    bot.slots = [freshSlot(weapon), null];
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
  const boxes = new Map<number, Rect>();
  for (const p of w.players.values()) if (p.alive) boxes.set(p.id, boxOf(p));
  w.history.push({ tick: w.tick, boxes });
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
    stepMovement(p, w.tick < p.empUntil ? b & ~Btn.JET : b, w.map, w.settings);
    actions.set(p.id, { b, pressed, inp });
  }
  // Collecting ends protection before this tick's damage is resolved.
  collectFlags(w);
  for (const p of players) {
    const action = actions.get(p.id);
    if (!p.alive || !action) continue;
    const { b, pressed, inp } = action;
    if (pressed & Btn.SWITCH) switchTo(p, (1 - p.active) as 0 | 1);
    if (pressed & Btn.SLOT1) switchTo(p, 0);
    if (pressed & Btn.SLOT2) switchTo(p, 1);
    if (pressed & Btn.DUAL) p.dual = !p.dual && canDual(p);
    if (p.dual && !canDual(p)) p.dual = false;
    // Every slot owns its timer. Reloading one dual weapon never stalls its partner.
    for (const slot of p.slots) if (slot && slot.reloadEnd > 0 && w.tick >= slot.reloadEnd) finishReload(w, slot);
    const activeSlots = p.dual ? p.slots : [p.slots[p.active]];
    for (const slot of activeSlots) {
      if (!slot) continue;
      if (pressed & Btn.RELOAD) startReload(w, p, slot);
      const def = WEAPONS[slot.weapon];
      const wantFire = def.auto ? (b & Btn.FIRE) !== 0 : (pressed & Btn.FIRE) !== 0;
      if (wantFire && w.tick >= slot.cooldownUntil && slot.reloadEnd === 0) {
        if (slot.mag > 0 || def.category === "equipment") fire(w, p, slot, inp?.view);
        else startReload(w, p, slot);
      }
    }
    if (pressed & Btn.MELEE && w.tick >= p.meleeUntil) {
      const blade = activeSlots.some((slot) => slot?.weapon === "machete");
      melee(w, p, blade ? WEAPONS.machete.damage : MELEE_DAMAGE, blade ? WEAPONS.machete.range : MELEE_RANGE, blade ? "machete" : "melee");
    }
    if (pressed & Btn.NEXT_THROWABLE) {
      const owned = Object.keys(p.throwables).filter((k) => p.throwables[k] > 0);
      if (owned.length > 0) p.throwable = owned[(owned.indexOf(p.throwable) + 1) % owned.length];
    }
    if (pressed & Btn.THROW && w.tick >= p.throwUntil) throwGrenade(w, p);
    if (pressed & Btn.PICKUP) tryPickupWeapon(w, p);
    if (pressed & Btn.DROP) dropActive(w, p);
    if (p.alive) autoPickups(w, p);
    if (p.alive && (p.y > w.map.height + OUT_OF_BOUNDS_MARGIN || p.x < -OUT_OF_BOUNDS_MARGIN || p.x > w.map.width + OUT_OF_BOUNDS_MARGIN)) {
      p.protectUntil = 0;
      applyDamage(w, p, null, p.hp, "fall");
    }
  }
  stepProjectiles(w);
  stepAreas(w);
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
    if (bestScore > 0) {
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
    s: [p.slots[0]?.weapon ?? null, p.slots[1]?.weapon ?? null],
    a: p.active,
    mag: slot?.mag ?? 0,
    res: slot?.reserve ?? 0,
    rl: slot && slot.reloadEnd > 0 ? slot.reloadEnd - w.tick : 0,
    g: p.throwables[p.throwable] ?? 0,
    k: p.kills,
    d: p.deaths,
    as: p.assists,
    rs: p.alive || w.survival ? 0 : Math.max(0, p.respawnTick - w.tick),
    slots: p.slots.map((slot) => slot ? { ...slot } : null) as [SlotState | null, SlotState | null],
    dual: p.dual,
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
