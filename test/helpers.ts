import { defaultSettings, sanitizeSettings } from "../src/shared/settings.ts";
import { addPlayer, createWorld, type Player, stepWorld, type World } from "../src/shared/sim.ts";
import type { InputFrame, MapDefinition, RoomSettings, Team } from "../src/shared/types.ts";
import { MAPS } from "../src/shared/maps.ts";

export const FLAT: MapDefinition = {
  id: "flat-test",
  name: "Flat test",
  width: 2000,
  height: 1000,
  theme: { sky: 0, rock: 0, platform: 0, accent: 0 },
  solids: [
    { x: 0, y: 900, w: 2000, h: 100 },
    { x: 0, y: 0, w: 20, h: 1000 },
    { x: 1980, y: 0, w: 20, h: 1000 },
    { x: 1000, y: 700, w: 40, h: 200 },
  ],
  platforms: [{ x: 300, y: 800, w: 200, h: 14 }],
  spawns: [
    { x: 100, y: 900, team: 0 },
    { x: 1900, y: 900, team: 1 },
  ],
  pickups: [],
  goals: [{ team: 0, rect: { x: 40, y: 800, w: 110, h: 100 } }, { team: 1, rect: { x: 1850, y: 800, w: 110, h: 100 } }],
  flagHomes: [{ team: 0, x: 100, y: 900 }, { team: 1, x: 1900, y: 900 }],
  navNodes: [],
};
MAPS[FLAT.id] = FLAT;

export function world(over: Partial<RoomSettings> = {}): World {
  const s = sanitizeSettings({ ...defaultSettings(), map: FLAT.id, mapPickups: false, ...over });
  return createWorld(s, 42);
}

let nextKey = 1;
export function player(w: World, team: Team = -1, at?: { x: number; y: number }): Player {
  const id = w.nextId++;
  const p = addPlayer(w, { id, key: `p${nextKey++}`, name: `P${id}`, team, color: 0, bot: false });
  if (at) Object.assign(p, { x: at.x, y: at.y, vx: 0, vy: 0 });
  p.protectUntil = 0;
  return p;
}

export function run(w: World, ticks: number, inputs: (tick: number) => Map<number, InputFrame> = () => new Map()): void {
  for (let i = 0; i < ticks; i++) stepWorld(w, inputs(w.tick));
}

export const hold = (id: number, b: number, aim = 0): Map<number, InputFrame> => new Map([[id, { seq: 0, b, aim }]]);
