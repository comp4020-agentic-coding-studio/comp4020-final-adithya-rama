import type { Rect } from "./types.ts";

// The shield is a vertical panel in front of the torso, never a force field.
// Rendering and authoritative ray tests share these dimensions.
export function shieldBox(body: Rect, aim: number): Rect {
  const exposedHead = Math.min(12, body.h * .3);
  return {
    x: Math.cos(aim) >= 0 ? body.x + body.w : body.x - 6,
    y: body.y + exposedHead,
    w: 6,
    h: body.h - exposedHead,
  };
}

export function headHit(body: Rect, hitY: number): boolean {
  return hitY >= body.y - .001 && hitY < body.y + Math.min(12, body.h * .3);
}
