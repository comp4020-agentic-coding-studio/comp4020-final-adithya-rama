import { ALL_BUTTONS } from "../shared/types.ts";
import { WEAPONS } from "../shared/weapons.ts";
import { TOUCH_LAYOUT_KEYS, TOUCH_LAYOUT_SCALE, TOUCH_LAYOUT_OPACITY, normalizeTouchLayout } from "../shared/touch-layout.ts";

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value as Record<string, unknown>;
}

export function sanitizePrefs(value: unknown, previous: Record<string, unknown> = {}): Record<string, unknown> {
  const input = objectBody(value);
  const output: Record<string, unknown> = {};
  const merged = { ...previous, ...input };
  for (const key of ["reducedShake", "muted", "chatMuted", "lowFlash", "reducedBlood", "cameraLookAhead", "trainingTipsHidden"]) {
    if (merged[key] !== undefined) {
      if (typeof merged[key] !== "boolean") throw new Error(key + " must be true or false");
      output[key] = merged[key];
    }
  }
  if (merged.volume !== undefined) {
    if (typeof merged.volume !== "number" || !Number.isFinite(merged.volume) || merged.volume < 0 || merged.volume > 1) throw new Error("Volume must be between zero and one");
    output.volume = merged.volume;
  }
  if (merged.scopes !== undefined) {
    const scopes = objectBody(merged.scopes);
    if (Object.keys(scopes).length > Object.keys(WEAPONS).length) throw new Error("Too many scope preferences");
    const clean: Record<string, number> = {};
    for (const [id, level] of Object.entries(scopes)) {
      if (!Object.hasOwn(WEAPONS, id) || typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > 3) throw new Error("Invalid scope preference");
      clean[id] = level;
    }
    output.scopes = clean;
  }
  if(merged.touchLayout!==undefined){
    const layout=objectBody(merged.touchLayout),positions=objectBody(layout.positions);
    for(const [key,range] of [["scale",TOUCH_LAYOUT_SCALE],["opacity",TOUCH_LAYOUT_OPACITY]] as const){
      const n=layout[key];if(typeof n!=="number"||!Number.isFinite(n)||n<range.min||n>range.max)throw new Error("Invalid touch control "+key);
    }
    if(Object.keys(positions).length>TOUCH_LAYOUT_KEYS.length)throw new Error("Too many touch controls");
    for(const [key,raw] of Object.entries(positions)){
      if(!TOUCH_LAYOUT_KEYS.includes(key as typeof TOUCH_LAYOUT_KEYS[number]))throw new Error("Unknown touch control");
      const point=objectBody(raw);
      for(const axis of ["x","y"]){const n=point[axis];if(typeof n!=="number"||!Number.isFinite(n)||n<0||n>1)throw new Error("Invalid touch position");}
    }
    output.touchLayout=normalizeTouchLayout(layout);
  }
  if (merged.avatar !== undefined) {
    const avatar = objectBody(merged.avatar);
    const choices = { helmet: ["pilot", "visor", "cap", "mohawk"], face: ["light", "medium", "dark", "robot"], emblem: ["star", "bolt", "skull"] };
    const clean: Record<string, string> = {};
    for (const [key, values] of Object.entries(choices)) {
      if (!values.includes(avatar[key] as string)) throw new Error("Invalid avatar " + key);
      clean[key] = avatar[key] as string;
    }
    output.avatar = clean;
  }
  if (merged.bindings !== undefined) {
    const bindings = objectBody(merged.bindings);
    if (Object.keys(bindings).length > 40) throw new Error("Too many key bindings");
    const clean: Record<string, number> = {};
    for (const [key, value] of Object.entries(bindings)) {
      if (!/^[A-Za-z][A-Za-z0-9]{1,24}$/.test(key) || typeof value !== "number" || !Number.isInteger(value) ||
        ((value < -11 || value === 0 || value > ALL_BUTTONS) || (value > 0 && (value & (value - 1)) !== 0))) throw new Error("Invalid key binding");
      clean[key] = value;
    }
    output.bindings = clean;
  }
  return output;
}
