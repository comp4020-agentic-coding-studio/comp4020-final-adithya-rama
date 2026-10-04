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
  overReason: "time" | "limit" | null;
  history: HistoryEntry[];
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
  };
  if (settings.mapPickups) {
    map.pickups.forEach((mp, i) => {
      if (mp.kind === "weapon" && (!mp.item || !settings.weapons.includes(mp.item))) return;
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
  return { weapon, mag: def.mag, reserve: def.reserve, reloadEnd: 0 };
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
  };
  w.players.set(p.id, p);
  respawn(w, p);
  return p;
}

const sameTeam = (w: World, a: Player, b: Player): boolean =>
  isTeamMode(w.settings) && a.team !== -1 && a.team === b.team;

const enemies = (w: World, a: Player, b: Player): boolean => a !== b && !sameTeam(w, a, b);

export function respawn(w: World, p: Player): void {
  const s = w.settings;
  const teamSpawns = w.map.spawns.filter((sp) => (isTeamMode(s) ? sp.team === p.team : true));
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
    alive: true,
    protectUntil: w.tick + SPAWN_PROTECT_TICKS,
    active: 0,
    cooldownUntil: 0,
    meleeUntil: 0,
    throwUntil: 0,
    damageLog: [],
  });
  p.slots = [freshSlot(s.loadout[0]), s.loadout[1] ? freshSlot(s.loadout[1]) : null];
  p.throwables = s.throwables.includes("frag") ? { frag: DEFAULT_FRAGS } : {};
  w.events.push({ t: "spawn", id: p.id });
}

export function applyDamage(w: World, victim: Player, attackerId: number | null, amount: number, weapon: string): number {
  if (!victim.alive || amount <= 0) return 0;
  if (w.tick < victim.protectUntil) return 0;
  const attacker = attackerId === null ? undefined : w.players.get(attackerId);
  if (attacker && attacker !== victim && sameTeam(w, attacker, victim) && !w.settings.friendlyFire) return 0;
  const dealt = Math.min(victim.hp, amount);
  victim.hp -= amount;
  if (attacker && attacker !== victim) victim.damageLog.push({ from: attacker.id, amount: dealt, tick: w.tick });
  victim.damageLog = victim.damageLog.filter((d) => w.tick - d.tick <= ASSIST_WINDOW_TICKS);
  w.events.push({ t: "hurt", id: victim.id, amount: Math.round(dealt) });
  if (victim.hp <= 0) killPlayer(w, victim, attacker ?? null, weapon);
  return dealt;
}

export function killPlayer(w: World, victim: Player, killer: Player | null, weapon: string): void {
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
    if (isTeamMode(w.settings) && killer.team !== -1) w.teamScores[killer.team]++;
  }

  const byAttacker = new Map<number, number>();
  for (const d of victim.damageLog) {
    if (w.tick - d.tick > ASSIST_WINDOW_TICKS) continue;
    byAttacker.set(d.from, (byAttacker.get(d.from) ?? 0) + d.amount);
  }
  for (const [id, total] of byAttacker) {
    const helper = w.players.get(id);
    if (!helper || helper === killer || !enemies(w, helper, victim)) continue;
    if (total >= ASSIST_MIN_FRACTION * maxHealth(w.settings)) helper.assists++;
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
  if (slot.reloadEnd !== 0 || slot.mag >= def.mag) return;
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
  const cur = p.slots[p.active];
  if (cur) cur.reloadEnd = 0;
  p.active = idx;
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

function fire(w: World, p: Player, slot: SlotState, viewTick: number | undefined): void {
  const def = WEAPONS[slot.weapon];
  slot.mag--;
  p.cooldownUntil = w.tick + ticks(def.cooldownMs);
  p.protectUntil = 0;
  const { x: ox, y: oy } = muzzleOf(p);
  const rewound = boxesAt(w, viewTick);
  for (let i = 0; i < def.pellets; i++) {
    const angle = p.aim + (rng(w) - 0.5) * def.spread;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let dist = raycastMap(w.map, ox, oy, dx, dy, def.range);
    let target: Player | null = null;
    for (const o of w.players.values()) {
      if (!o.alive || o === p) continue;
      if (sameTeam(w, p, o) && !w.settings.friendlyFire) continue;
      const box = rewound?.get(o.id) ?? boxOf(o);
      const t = rayRect(ox, oy, dx, dy, box);
      if (t < dist) {
        dist = t;
        target = o;
      }
    }
    if (target) applyDamage(w, target, p.id, def.damage * w.settings.damage, def.id);
    w.events.push({
      t: "shot",
      by: p.id,
      w: def.id,
      x1: Math.round(ox),
      y1: Math.round(oy),
      x2: Math.round(ox + dx * dist),
      y2: Math.round(oy + dy * dist),
      hit: target !== null,
    });
  }
  if (slot.mag === 0) startReload(w, p, slot);
}

function melee(w: World, p: Player): void {
  p.meleeUntil = w.tick + MELEE_COOLDOWN_TICKS;
  p.protectUntil = 0;
  const dir = Math.cos(p.aim) >= 0 ? 1 : -1;
  const reach: Rect = {
    x: dir > 0 ? p.x : p.x - MELEE_RANGE - PLAYER_W / 2,
    y: p.y - heightOf(p),
    w: MELEE_RANGE + PLAYER_W / 2,
    h: heightOf(p),
  };
  for (const o of w.players.values()) {
    if (!o.alive || o === p) continue;
    const b = boxOf(o);
    if (b.x < reach.x + reach.w && b.x + b.w > reach.x && b.y < reach.y + reach.h && b.y + b.h > reach.y) {
      applyDamage(w, o, p.id, MELEE_DAMAGE * w.settings.damage, "melee");
    }
  }
  w.events.push({ t: "melee", by: p.id, x: Math.round(p.x + dir * 30), y: Math.round(p.y - 25) });
}

function throwGrenade(w: World, p: Player): void {
  const def = THROWABLES[p.throwable];
  if (!def || (p.throwables[p.throwable] ?? 0) <= 0) return;
  p.throwables[p.throwable]--;
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
  const owned = p.slots.findIndex((s) => s?.weapon === incoming.weapon);
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
  consumePickup(w, best);
  w.events.push({ t: "pickup", id: p.id, item: incoming.weapon });
}

function dropActive(w: World, p: Player): void {
  const slot = p.slots[p.active];
  if (!slot) return;
  dropWeapon(w, p.x, p.y - 10, { ...slot, reloadEnd: 0 });
  p.slots[p.active] = null;
  const other = (1 - p.active) as 0 | 1;
  if (p.slots[other]) p.active = other;
}

function autoPickups(w: World, p: Player): void {
  for (const pk of w.pickups) {
    if (pk.kind === "weapon" || !pickupAvailable(w, pk) || !nearPickup(p, pk)) continue;
    if (pk.kind === "health") {
      const max = maxHealth(w.settings);
      if (p.hp >= max) continue;
      p.hp = Math.min(max, p.hp + 50 * w.settings.health);
    } else if (pk.kind === "fuel") {
      const max = maxFuel(w.settings);
      if (p.fuel >= max) continue;
      p.fuel = max;
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
          p.throwables.frag = DEFAULT_FRAGS;
          used = true;
        }
      }
      if (!used) continue;
    }
    consumePickup(w, pk);
    w.events.push({ t: "pickup", id: p.id, item: pk.kind });
  }
}

function stepProjectiles(w: World): void {
  const g = GRAVITY * w.settings.gravity;
  const keep: Projectile[] = [];
  for (const pr of w.projectiles) {
    const def = THROWABLES[pr.kind];
    for (let sub = 0; sub < 2; sub++) {
      const dt = DT / 2;
      pr.vy += g * dt;
      const nx = pr.x + pr.vx * dt;
      if (pointInSolid(w.map, nx, pr.y)) {
        pr.vx = -pr.vx * def.bounce;
      } else pr.x = nx;
      const ny = pr.y + pr.vy * dt;
      let landed = pointInSolid(w.map, pr.x, ny);
      if (!landed && pr.vy > 0) {
        for (const pl of w.map.platforms) {
          if (pr.y <= pl.y && ny >= pl.y && pr.x >= pl.x && pr.x <= pl.x + pl.w) landed = true;
        }
      }
      if (landed) {
        pr.vy = -pr.vy * def.bounce;
        pr.vx *= 0.7;
        if (Math.abs(pr.vy) < 40) pr.vy = 0;
      } else pr.y = ny;
    }
    if (pr.y > w.map.height + OUT_OF_BOUNDS_MARGIN) continue;
    if (w.tick >= pr.explodeTick) {
      explode(w, pr);
      continue;
    }
    keep.push(pr);
  }
  w.projectiles = keep;
}

function explode(w: World, pr: Projectile): void {
  const def = THROWABLES[pr.kind];
  w.events.push({ t: "explode", x: Math.round(pr.x), y: Math.round(pr.y), r: def.radius });
  const ey = pr.y - 2;
  for (const o of w.players.values()) {
    if (!o.alive) continue;
    const cy = o.y - heightOf(o) / 2;
    const d = Math.hypot(o.x - pr.x, cy - ey);
    if (d > def.radius) continue;
    if (!lineOfSight(w.map, pr.x, ey, o.x, cy)) continue;
    const dmg = def.maxDamage - (def.maxDamage - def.minDamage) * (d / def.radius);
    applyDamage(w, o, pr.owner, dmg * w.settings.damage, def.id);
  }
}

function recordHistory(w: World): void {
  const boxes = new Map<number, Rect>();
  for (const p of w.players.values()) if (p.alive) boxes.set(p.id, boxOf(p));
  w.history.push({ tick: w.tick, boxes });
  if (w.history.length > LAG_COMP_MAX_TICKS + 2) w.history.shift();
}

export function stepWorld(w: World, inputs: Map<number, InputFrame>): void {
  w.tick++;
  const players = [...w.players.values()].sort((a, b) => a.id - b.id);
  for (const p of players) {
    if (!p.alive) {
      if (p.connected && !w.over && w.tick >= p.respawnTick) respawn(w, p);
      continue;
    }
    const inp = inputs.get(p.id);
    const b = p.connected && !w.over && inp ? inp.b : 0;
    if (inp && Number.isFinite(inp.aim)) p.aim = Math.atan2(Math.sin(inp.aim), Math.cos(inp.aim));
    const pressed = b & ~p.prevButtons;
    p.prevButtons = b;

    stepMovement(p, b, w.map, w.settings);

    if (pressed & Btn.SWITCH) switchTo(p, (1 - p.active) as 0 | 1);
    if (pressed & Btn.SLOT1) switchTo(p, 0);
    if (pressed & Btn.SLOT2) switchTo(p, 1);

    const slot = p.slots[p.active];
    if (slot && slot.reloadEnd !== 0 && w.tick >= slot.reloadEnd) finishReload(w, slot);
    if (slot && pressed & Btn.RELOAD) startReload(w, p, slot);
    if (slot) {
      const def = WEAPONS[slot.weapon];
      const wantFire = def.auto ? (b & Btn.FIRE) !== 0 : (pressed & Btn.FIRE) !== 0;
      if (wantFire && w.tick >= p.cooldownUntil && slot.reloadEnd === 0) {
        if (slot.mag > 0) fire(w, p, slot, inp?.view);
        else startReload(w, p, slot);
      }
    }
    if (pressed & Btn.MELEE && w.tick >= p.meleeUntil) melee(w, p);
    if (pressed & Btn.THROW && w.tick >= p.throwUntil) throwGrenade(w, p);
    if (pressed & Btn.PICKUP) tryPickupWeapon(w, p);
    if (pressed & Btn.DROP) dropActive(w, p);
    if (pressed & Btn.NEXT_THROWABLE) {
      const owned = Object.keys(p.throwables).filter((k) => p.throwables[k] > 0);
      if (owned.length > 0) p.throwable = owned[(owned.indexOf(p.throwable) + 1) % owned.length];
    }

    if (p.alive) autoPickups(w, p);
    if (p.alive && p.y > w.map.height + OUT_OF_BOUNDS_MARGIN) {
      p.protectUntil = 0;
      applyDamage(w, p, null, p.hp, "fall");
    }
  }

  stepProjectiles(w);
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
  if (w.settings.scoreLimit > 0 && topScore(w) >= w.settings.scoreLimit) {
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
  }));

  let draw = false;
  let winnerTeam: Team | null = null;
  let winnerKeys: string[] = [];
  if (reason !== "abandoned") {
    if (isTeamMode(w.settings)) {
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
    const bestScore = Math.max(0, ...participants.map((p) => p.score));
    if (bestScore > 0) {
      const contenders = participants.filter((p) => p.score === bestScore);
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
    rs: p.alive ? 0 : Math.max(0, p.respawnTick - w.tick),
  };
}

export function snapshot(w: World, events: GameEvent[]): Omit<WorldSnapshot, "ack"> {
  return {
    tick: w.tick,
    endTick: w.endTick,
    ts: [...w.teamScores],
    players: [...w.players.values()].map((p) => snapPlayer(w, p)),
    projectiles: w.projectiles.map((p) => ({ id: p.id, k: p.kind, x: r2(p.x), y: r2(p.y) })),
    pickups: w.pickups
      .filter((pk) => pickupAvailable(w, pk))
      .map((pk) => ({ id: pk.id, k: pk.kind, i: pk.item, x: pk.x, y: pk.y })),
    events,
  };
}
