import { MAPS } from "../shared/maps.ts";
import { MULTIPLIERS } from "../shared/settings.ts";
import type { RoomSettings } from "../shared/types.ts";

export const capacityOptions = (s: RoomSettings): [number, string][] =>
  (s.mode === "training" ? [1] : s.mode === "survival" ? [1, 2, 3, 4] : [2, 3, 4, 5, 6, 7, 8]).map(n => [n, String(n)]);
export const botOptions = (s: RoomSettings): [number, string][] =>
  (s.mode === "survival" ? [0] : s.mode === "training" ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5, 6, 7]).map(n => [n, s.mode === "survival" ? "Wave enemies" : String(n)]);
export const spaceRules = (s: RoomSettings): boolean => MAPS[s.map]?.physics === "space";

/** Reconcile dependent selectors with the server's sanitized next-round rules. */
export function syncRuleFields(root: HTMLElement, s: RoomSettings): void {
  const options = (key: string, entries: [number | string, string][]) => {
    const field = root.querySelector<HTMLSelectElement>('[data-setting="' + key + '"]');
    if (!field) return;
    field.replaceChildren(...entries.map(([value, label]) => {
      const option = field.ownerDocument.createElement("option");
      option.value = String(value); option.textContent = label; return option;
    }));
  };
  options("map", Object.values(MAPS).filter(m => s.mode === "training" || m.id !== "test-range" || m.id === s.map).map(m => [m.id, m.name]));
  options("capacity", capacityOptions(s));
  options("bots", botOptions(s));
  options("gravity", spaceRules(s) ? [[1, "Zero gravity (map rule)"]] : MULTIPLIERS.map(n => [n, n + "×"]));
  for (const field of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]")) {
    const key = field.dataset.setting as keyof RoomSettings;
    if (field.tagName === "INPUT" && (field as HTMLInputElement).type === "checkbox")
      (field as HTMLInputElement).checked = Boolean(s[key]);
    else field.value = String(key === "gravity" && spaceRules(s) ? 1 : s[key]);
    if (key === "capacity") field.disabled = s.mode === "training";
    else if (key === "bots") field.disabled = s.mode === "survival";
    else if (["gravity", "flight", "unlimitedFuel", "fuelCapacity", "recharge"].includes(key))
      field.disabled = spaceRules(s);
  }
}
