import { CONCEAL_DETECT_RADIUS, PLAYER_W } from "./constants.ts";
import { heightOf, lineOfSight } from "./physics.ts";
import { PF, type MapDefinition, type Team } from "./types.ts";

export interface VisibilityActor {
  id: number;
  x: number;
  y: number;
  team?: Team;
  crouch?: boolean;
  onGround?: boolean;
  alive?: boolean;
  f?: number;
  revealUntil?: number;
}
export interface VisibilityOptions { teamMode?: boolean; carryingFlag?: boolean }

/** Partial bodies remain visible. Only fully covered, supported crouches hide. */
export function concealed(target: VisibilityActor, map: MapDefinition, tick: number): boolean {
  const crouch = target.crouch ?? !!((target.f ?? 0) & PF.CROUCH);
  const grounded = target.onGround ?? !!((target.f ?? 0) & PF.GROUND);
  const alive = target.alive ?? !!((target.f ?? PF.ALIVE) & PF.ALIVE);
  if (!alive || !crouch || !grounded || tick < (target.revealUntil ?? 0)) return false;
  const top = target.y - heightOf({ crouch: true });
  return (map.concealment ?? []).some((r) =>
    target.x - PLAYER_W / 2 >= r.x && target.x + PLAYER_W / 2 <= r.x + r.w && top >= r.y && target.y <= r.y + r.h);
}

export function canSeePlayer(viewer: VisibilityActor | null, target: VisibilityActor, map: MapDefinition,
  tick: number, options: VisibilityOptions = {}): boolean {
  if (viewer?.id === target.id || options.carryingFlag) return true;
  if (options.teamMode && viewer?.team !== undefined && viewer.team !== -1 && viewer.team === target.team) return true;
  if (!concealed(target, map, tick)) return true;
  return !!viewer && Math.hypot(viewer.x - target.x, viewer.y - target.y) <= CONCEAL_DETECT_RADIUS &&
    lineOfSight(map, viewer.x, viewer.y - 20, target.x, target.y - 14);
}
