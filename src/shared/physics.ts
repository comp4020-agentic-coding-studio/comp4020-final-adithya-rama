import {
  AIR_ACCEL,
  BASE_FUEL,
  DROP_THROUGH_TICKS,
  DT,
  FUEL_DRAIN,
  FUEL_REGEN_AIR,
  FUEL_REGEN_DELAY_TICKS,
  FUEL_REGEN_GROUND,
  GRAVITY,
  GROUND_ACCEL,
  JET_LIFT,
  JET_MAX_RISE,
  JUMP_SPEED,
  MAX_FALL,
  PLAYER_CROUCH_H,
  PLAYER_H,
  PLAYER_W,
  RUN_SPEED,
} from "./constants.ts";
import { Btn, type MapDefinition, type Rect, type RoomSettings } from "./types.ts";

// The part of a player that movement touches. The server steps it
// authoritatively; the client steps the same code to predict its own player.
export interface MoveState {
  x: number; // centre
  y: number; // feet
  vx: number;
  vy: number;
  crouch: boolean;
  onGround: boolean;
  jetting: boolean;
  fuel: number;
  jetCooldown: number;
  dropTicks: number;
}

const EPS = 0.01;

export const maxFuel = (s: RoomSettings): number => BASE_FUEL * s.fuelCapacity;
export const heightOf = (p: { crouch: boolean }): number => (p.crouch ? PLAYER_CROUCH_H : PLAYER_H);

export function boxOf(p: MoveState): Rect {
  const h = heightOf(p);
  return { x: p.x - PLAYER_W / 2, y: p.y - h, w: PLAYER_W, h };
}

export const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;

function blocked(map: MapDefinition, box: Rect): boolean {
  for (const s of map.solids) if (overlaps(box, s)) return true;
  return false;
}

function onPlatform(p: MoveState, map: MapDefinition): boolean {
  const l = p.x - PLAYER_W / 2;
  const r = p.x + PLAYER_W / 2;
  let platform = false;
  for (const s of map.solids) {
    if (Math.abs(s.y - p.y) < 0.5 && l < s.x + s.w && r > s.x) return false;
  }
  for (const pl of map.platforms) {
    if (Math.abs(pl.y - p.y) < 0.5 && l < pl.x + pl.w && r > pl.x) platform = true;
  }
  return platform;
}

const approach = (v: number, target: number, step: number): number =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);

export function stepMovement(p: MoveState, b: number, map: MapDefinition, s: RoomSettings): void {
  const dir = (b & Btn.RIGHT ? 1 : 0) - (b & Btn.LEFT ? 1 : 0);
  const down = (b & Btn.CROUCH) !== 0;

  if (down && p.onGround && p.dropTicks === 0 && onPlatform(p, map)) {
    p.dropTicks = DROP_THROUGH_TICKS;
    p.onGround = false;
  } else if (down && p.onGround) {
    p.crouch = true;
  } else if (p.crouch && (!down || !p.onGround)) {
    const standing = { ...p, crouch: false };
    if (!blocked(map, boxOf(standing))) p.crouch = false;
  }

  const speed = RUN_SPEED * s.moveSpeed * (p.crouch ? 0.45 : 1);
  p.vx = approach(p.vx, dir * speed, (p.onGround ? GROUND_ACCEL : AIR_ACCEL) * DT);

  if (b & Btn.JUMP && p.onGround && !p.crouch) {
    p.vy = -JUMP_SPEED;
    p.onGround = false;
  }

  p.vy = Math.min(p.vy + GRAVITY * s.gravity * DT, MAX_FALL);

  const fuelMax = maxFuel(s);
  p.jetting = (b & Btn.JET) !== 0 && s.flight && (s.unlimitedFuel || p.fuel > 0);
  if (p.jetting) {
    p.crouch = false;
    p.vy = Math.max(p.vy - (GRAVITY * s.gravity + JET_LIFT * s.thrust) * DT, -JET_MAX_RISE * s.thrust);
    if (!s.unlimitedFuel) p.fuel = Math.max(0, p.fuel - FUEL_DRAIN * DT);
    p.jetCooldown = FUEL_REGEN_DELAY_TICKS;
  } else if (p.jetCooldown > 0) {
    p.jetCooldown--;
  } else {
    const regen = (p.onGround ? FUEL_REGEN_GROUND : FUEL_REGEN_AIR) * s.recharge;
    p.fuel = Math.min(fuelMax, p.fuel + regen * DT);
  }
  if (s.unlimitedFuel) p.fuel = fuelMax;

  // x axis
  p.x += p.vx * DT;
  let box = boxOf(p);
  for (const r of map.solids) {
    if (!overlaps(box, r)) continue;
    const pushLeft = box.x + box.w - r.x;
    const pushRight = r.x + r.w - box.x;
    if (p.vx > 0 || (p.vx === 0 && pushLeft < pushRight)) p.x = r.x - PLAYER_W / 2;
    else p.x = r.x + r.w + PLAYER_W / 2;
    p.vx = 0;
    box = boxOf(p);
  }

  // y axis
  const prevY = p.y;
  p.y += p.vy * DT;
  p.onGround = false;
  box = boxOf(p);
  const h = heightOf(p);
  for (const r of map.solids) {
    if (!overlaps(box, r)) continue;
    if (p.vy >= 0) {
      p.y = r.y;
      p.onGround = true;
    } else {
      p.y = r.y + r.h + h;
    }
    p.vy = 0;
    box = boxOf(p);
  }
  if (p.dropTicks > 0) {
    p.dropTicks--;
  } else if (p.vy >= 0) {
    for (const r of map.platforms) {
      if (prevY <= r.y + EPS && p.y >= r.y && box.x < r.x + r.w && box.x + box.w > r.x) {
        p.y = r.y;
        p.vy = 0;
        p.onGround = true;
      }
    }
  }
}

// Slab test: distance along a unit ray to rect r, or Infinity.
export function rayRect(x0: number, y0: number, dx: number, dy: number, r: Rect): number {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (x0 < r.x || x0 > r.x + r.w) return Infinity;
  } else {
    let t1 = (r.x - x0) / dx;
    let t2 = (r.x + r.w - x0) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dy) < 1e-9) {
    if (y0 < r.y || y0 > r.y + r.h) return Infinity;
  } else {
    let t1 = (r.y - y0) / dy;
    let t2 = (r.y + r.h - y0) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  return tmin <= tmax ? tmin : Infinity;
}

// Distance to the first solid along the ray, capped at maxDist. Bullets pass
// through one-way platforms.
export function raycastMap(map: MapDefinition, x0: number, y0: number, dx: number, dy: number, maxDist: number): number {
  let best = maxDist;
  for (const r of map.solids) {
    const t = rayRect(x0, y0, dx, dy, r);
    if (t < best) best = t;
  }
  return best;
}

export function lineOfSight(map: MapDefinition, x0: number, y0: number, x1: number, y1: number): boolean {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1e-6) return true;
  return raycastMap(map, x0, y0, (x1 - x0) / len, (y1 - y0) / len, len) >= len - 0.5;
}

export function pointInSolid(map: MapDefinition, x: number, y: number): boolean {
  for (const r of map.solids) if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
  return false;
}

// The first surface (solid or platform top) at or below (x, y).
export function groundBelow(map: MapDefinition, x: number, y: number): number {
  let best = map.height + 1000;
  for (const r of [...map.solids, ...map.platforms]) {
    if (x >= r.x && x <= r.x + r.w && r.y >= y - 1 && r.y < best) best = r.y;
  }
  return best;
}
