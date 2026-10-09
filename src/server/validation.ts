import { ALL_BUTTONS } from "../shared/types.ts";

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value as Record<string, unknown>;
}

export function sanitizePrefs(value: unknown, previous: Record<string, unknown> = {}): Record<string, unknown> {
  const input = objectBody(value);
  const output: Record<string, unknown> = {};
  const merged = { ...previous, ...input };
  for (const key of ["reducedShake", "muted", "chatMuted"]) {
    if (merged[key] !== undefined) {
      if (typeof merged[key] !== "boolean") throw new Error(key + " must be true or false");
      output[key] = merged[key];
    }
  }
  if (merged.volume !== undefined) {
    if (typeof merged.volume !== "number" || !Number.isFinite(merged.volume) || merged.volume < 0 || merged.volume > 1) throw new Error("Volume must be between zero and one");
    output.volume = merged.volume;
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
