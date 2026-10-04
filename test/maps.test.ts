import { describe, expect, it } from "vitest";
import { PLAYER_H, PLAYER_W } from "../src/shared/constants.ts";
import { MAPS } from "../src/shared/maps.ts";
import { boxOf, overlaps } from "../src/shared/physics.ts";
import { createWorld, stepWorld } from "../src/shared/sim.ts";
import { defaultSettings, sanitizeSettings } from "../src/shared/settings.ts";
import { Btn } from "../src/shared/types.ts";
import { hold, player, run } from "./helpers.ts";

const arenas = Object.values(MAPS).filter((map) => map.id !== "flat-test");
describe("authored map validity", () => {
  it.each(arenas.map((map) => map.id))("%s has collision-free, supported player spawns", (id) => {
    const map = MAPS[id];
    for (const sp of map.spawns) {
      const body = { x: sp.x - PLAYER_W / 2, y: sp.y - PLAYER_H, w: PLAYER_W, h: PLAYER_H };
      expect(map.solids.some((solid) => overlaps(body, solid)), `${id} spawn ${sp.x},${sp.y} intersects terrain`).toBe(false);
      expect([...map.solids, ...map.platforms].some((r) =>
        Math.abs(r.y - sp.y) < .1 && r.x < sp.x + PLAYER_W / 2 && r.x + r.w > sp.x - PLAYER_W / 2)).toBe(true);
    }
  });

  it.each(arenas.filter((map) => map.flagHomes.length === 2).map((map) => map.id))(
    "%s permits both flag deliveries with flight off, double gravity and half running speed", (id) => {
      for (const team of [0, 1] as const) {
        const w = createWorld(sanitizeSettings({ ...defaultSettings(), map: id, mode: "flag",
          flight: false, gravity: 2, moveSpeed: .5, mapPickups: false }));
        const home = w.map.flagHomes.find((h) => h.team === team)!;
        const start = w.map.spawns.find((sp) => sp.team === team)!;
        const p = player(w, team, start);
        for (let tick = 0; tick < 1500 && w.flags[team].carrier !== p.id; tick++)
          stepWorld(w, hold(p.id, (p.x < home.x ? Btn.RIGHT : Btn.LEFT) | Btn.JUMP));
        expect(w.flags[team].carrier, `${id} team ${team} cannot reach its flag from its ground spawn`).toBe(p.id);
        for (let tick = 0; tick < 3000 && p.deliveries === 0; tick++)
          stepWorld(w, hold(p.id, (team === 0 ? Btn.RIGHT : Btn.LEFT) | Btn.JUMP));
        expect(p.deliveries, `${id} team ${team} stopped at ${p.x},${p.y}`).toBe(1);
        expect(w.map.solids.some((r) => overlaps(boxOf(p), r))).toBe(false);
      }
    },
  );
});
