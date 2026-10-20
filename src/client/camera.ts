import { WEAPONS } from "../shared/weapons.ts";

export type ScopeLevel = 0 | 1 | 2 | 3;
export const SCOPE_LABELS = ["Near", "Field", "Far", "Range"] as const;

export function scopesOf(value: unknown): Record<string, ScopeLevel> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, level]) =>
    Object.hasOwn(WEAPONS, id) && Number.isInteger(level) && Number(level) >= 0 && Number(level) <= 3)) as Record<string, ScopeLevel>;
}

/** Authored PC framing. Wider views never change simulation range or accuracy. */
export function weaponViewWidth(id: string | null, portrait: boolean, level: ScopeLevel): number {
  const w = WEAPONS[id ?? ""];
  const range = w?.range ?? 500;
  const desktop = Math.max(940, Math.min(2250, range * 1.38));
  // At default phone framing a crouched pilot remains legible. Far views are an
  // explicit player choice instead of shrinking every sniper user to a speck.
  const near = portrait ? Math.min(680, desktop) : desktop;
  const fullRange = Math.max(near, (range + 100) * 2);
  const spans = [near, near * 1.2, Math.max(near * 1.5, fullRange * .8), Math.max(near * 1.8, fullRange)];
  return spans[level];
}

/** The pilot stays at the center of the clear play area, irrespective of aim. */
export function cameraFrame(actor: { x: number; y: number; aim?: number; weapon: string | null },
  viewport: { width: number; height: number; playableHeight: number }, level: ScopeLevel,
): { x: number; y: number; visibleWidth: number; smoothingMs: number } {
  let width = weaponViewWidth(actor.weapon, viewport.width < viewport.height, level);
  if (level === 3) {
    const range = WEAPONS[actor.weapon ?? ""]?.range ?? 500;
    // Centered framing must fit reach on both sides and along the shorter axis.
    width = Math.max(width, (range + 100) * 2 * Math.max(1, viewport.width / Math.max(1, viewport.playableHeight)));
  }
  return { x: actor.x, y: actor.y, visibleWidth: width, smoothingMs: 160 };
}

/** Smooth only actual target movement. Terrain bounds never constrain the view. */
export function followCamera(current: {x:number;y:number}, target: {x:number;y:number}, elapsedMs:number, smoothingMs:number, snap=false): {x:number;y:number} {
  const blend = snap || smoothingMs <= 0 ? 1 : 1 - Math.exp(-Math.max(0, Math.min(100, elapsedMs)) / smoothingMs);
  return {x:current.x + (target.x-current.x)*blend, y:current.y + (target.y-current.y)*blend};
}
