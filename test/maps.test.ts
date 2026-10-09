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

  it("snow forts have working side entrances and an unobstructed interior", () => {
    const map=MAPS.skyshaft;
    for(const fort of map.scenery!.filter(p=>p.kind==="bunker")) {
      const w=createWorld(sanitizeSettings({...defaultSettings(),map:"skyshaft",mode:"training",flight:false,mapPickups:false,bots:0}));
      const p=player(w,-1,{x:fort.x-35,y:fort.y});
      for(let tick=0;tick<200&&p.x<fort.x+fort.w!+35;tick++) {
        stepWorld(w,hold(p.id,Btn.RIGHT|Btn.JUMP));
        expect(map.solids.some(r=>overlaps(boxOf(p),r)),"fort traversal intersects collision").toBe(false);
      }
      expect(p.x,"pilot cannot pass through fort "+fort.x+","+fort.y).toBeGreaterThan(fort.x+fort.w!+24);
    }
  });

  it.each(arenas.map(map=>map.id))("%s has supported, accessible pickup positions", id=>{
    const map=MAPS[id];
    for(const pk of map.pickups) {
      expect([...map.solids,...map.platforms].some(r=>Math.abs(r.y-pk.y)<.1&&pk.x>=r.x&&pk.x<=r.x+r.w),id+" unsupported pickup "+pk.x+","+pk.y).toBe(true);
      expect(map.solids.some(r=>overlaps({x:pk.x-7,y:pk.y-25,w:14,h:24},r)),id+" embedded pickup "+pk.x+","+pk.y).toBe(false);
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
