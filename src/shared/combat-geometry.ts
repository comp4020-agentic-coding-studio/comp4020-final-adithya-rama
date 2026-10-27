import type { Rect } from "./types.ts";
import { rayRect } from "./physics.ts";

/** A finite plate, oriented with the aim. Local X is its outward normal. */
export interface ShieldPanel { x: number; y: number; angle: number; depth: number; length: number }
export function shieldPanel(body: Rect, aim: number): ShieldPanel {
  const c = Math.cos(aim), s = Math.sin(aim);
  const offset = Math.abs(c) * body.w / 2 + Math.abs(s) * body.h / 2 + 4;
  return { x: body.x + body.w / 2 + c * offset, y: body.y + body.h / 2 + s * offset,
    angle: aim, depth: 6, length: Math.max(22, body.h - 8) };
}
export function shieldCorners(panel: ShieldPanel, inset = 0): number[] {
  const c = Math.cos(panel.angle), s = Math.sin(panel.angle);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].flatMap(([x,y]) => {
    const nx = x * Math.max(.5, panel.depth / 2 - inset), ny = y * (panel.length / 2 - inset);
    return [panel.x + c * nx - s * ny, panel.y + s * nx + c * ny];
  });
}
/** Broad-phase bounds only. Collision must use rayShield, not this AABB. */
export function shieldBox(body: Rect, aim: number): Rect {
  const points = shieldCorners(shieldPanel(body, aim)), xs = points.filter((_,i) => i % 2 === 0), ys = points.filter((_,i) => i % 2 === 1);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs)-Math.min(...xs), h: Math.max(...ys)-Math.min(...ys) };
}
export function rayShield(x: number, y: number, dx: number, dy: number, panel: ShieldPanel, radius = 0): number {
  const c = Math.cos(panel.angle), s = Math.sin(panel.angle), ox = x-panel.x, oy = y-panel.y;
  return rayRect(ox*c+oy*s, -ox*s+oy*c, dx*c+dy*s, -dx*s+dy*c,
    {x:-panel.depth/2-radius,y:-panel.length/2-radius,w:panel.depth+radius*2,h:panel.length+radius*2});
}
/** Unit contact normal for a swept ray, including simultaneous corner hits. */
export function rectContactNormal(x: number, y: number, dx: number, dy: number, r: Rect): {x:number;y:number} {
  let nx = 0, ny = 0;
  if (dx > 0 && Math.abs(x-r.x) < 1e-5) nx = -1;
  else if (dx < 0 && Math.abs(x-r.x-r.w) < 1e-5) nx = 1;
  if (dy > 0 && Math.abs(y-r.y) < 1e-5) ny = -1;
  else if (dy < 0 && Math.abs(y-r.y-r.h) < 1e-5) ny = 1;
  const n = Math.hypot(nx,ny);
  return n ? {x:nx/n,y:ny/n} : Math.abs(dx)>Math.abs(dy) ? {x:-Math.sign(dx),y:0} : {x:0,y:-Math.sign(dy)};
}
export function headHit(body: Rect, hitY: number): boolean {
  return hitY >= body.y - .001 && hitY < body.y + Math.min(12, body.h * .3);
}
