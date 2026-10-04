import type { MapDefinition, Rect } from "./types.ts";

const W = 2400;
const H = 1200;

// Mirror a rect about the vertical centre line, so the two halves are fair.
const mirror = (r: Rect): Rect => ({ x: W - r.x - r.w, y: r.y, w: r.w, h: r.h });
const both = (...rs: Rect[]): Rect[] => rs.flatMap((r) => [r, mirror(r)]);

const outpostYard: MapDefinition = {
  id: "outpost-yard",
  name: "Outpost Yard",
  width: W,
  height: H,
  theme: { sky: 0x9cc3d5, rock: 0x6b5a45, platform: 0x8f7a58, accent: 0xc9a227 },
  solids: [
    { x: 0, y: 1080, w: W, h: 120 },
    { x: 0, y: 0, w: 40, h: H },
    { x: W - 40, y: 0, w: 40, h: H },
    { x: 0, y: 0, w: W, h: 30 },
    { x: 1100, y: 880, w: 200, h: 200 },
    ...both(
      { x: 300, y: 980, w: 260, h: 100 },
      { x: 660, y: 700, w: 40, h: 380 },
      { x: 820, y: 300, w: 120, h: 40 },
      { x: 40, y: 760, w: 120, h: 30 },
    ),
  ],
  platforms: [
    { x: 1080, y: 460, w: 240, h: 14 },
    ...both(
      { x: 520, y: 800, w: 140, h: 14 },
      { x: 880, y: 640, w: 220, h: 14 },
      { x: 200, y: 600, w: 220, h: 14 },
      { x: 460, y: 420, w: 180, h: 14 },
    ),
  ],
  spawns: [
    { x: 110, y: 1080, team: 0 },
    { x: 230, y: 1080, team: 0 },
    { x: 400, y: 980, team: 0 },
    { x: 300, y: 600, team: 0 },
    { x: W - 110, y: 1080, team: 1 },
    { x: W - 230, y: 1080, team: 1 },
    { x: W - 400, y: 980, team: 1 },
    { x: W - 300, y: 600, team: 1 },
    { x: 1200, y: 460, team: -1 },
    { x: 900, y: 1080, team: -1 },
    { x: W - 900, y: 1080, team: -1 },
  ],
  pickups: [
    { x: 1200, y: 880, kind: "weapon", item: "ak47", respawnSec: 15 },
    { x: 1200, y: 460, kind: "weapon", item: "spas12", respawnSec: 15 },
    { x: 550, y: 420, kind: "weapon", item: "ak47", respawnSec: 20 },
    { x: W - 550, y: 420, kind: "weapon", item: "spas12", respawnSec: 20 },
    { x: 680, y: 700, kind: "health", respawnSec: 20 },
    { x: W - 680, y: 700, kind: "health", respawnSec: 20 },
    { x: 860, y: 1080, kind: "ammo", respawnSec: 20 },
    { x: W - 860, y: 1080, kind: "ammo", respawnSec: 20 },
    { x: 880, y: 300, kind: "fuel", respawnSec: 20 },
    { x: W - 880, y: 300, kind: "fuel", respawnSec: 20 },
  ],
  goals: [
    { team: 0, rect: { x: 40, y: 960, w: 130, h: 120 } },
    { team: 1, rect: { x: W - 170, y: 960, w: 130, h: 120 } },
  ],
  flagHomes: [
    { team: 0, x: 430, y: 980 },
    { team: 1, x: W - 430, y: 980 },
  ],
  navNodes: [
    { x: 200, y: 1080 },
    { x: 430, y: 980 },
    { x: 600, y: 800 },
    { x: 990, y: 640 },
    { x: 1200, y: 880 },
    { x: 1200, y: 460 },
    { x: W - 990, y: 640 },
    { x: W - 600, y: 800 },
    { x: W - 430, y: 980 },
    { x: W - 200, y: 1080 },
  ],
};

// A small developer range for movement and weapon practice in training.
const testRange: MapDefinition = {
  id: "test-range",
  name: "Test Range",
  width: 1800,
  height: 1000,
  theme: { sky: 0x2d3540, rock: 0x4a5560, platform: 0xc9a227, accent: 0xe0603c },
  solids: [
    { x: 0, y: 900, w: 1800, h: 100 },
    { x: 0, y: 0, w: 40, h: 1000 },
    { x: 1760, y: 0, w: 40, h: 1000 },
    { x: 0, y: 0, w: 1800, h: 30 },
    { x: 400, y: 820, w: 80, h: 80 },
    { x: 560, y: 740, w: 80, h: 160 },
    { x: 720, y: 660, w: 80, h: 240 },
    { x: 1100, y: 400, w: 40, h: 500 },
    { x: 1400, y: 560, w: 200, h: 30 },
  ],
  platforms: [
    { x: 160, y: 760, w: 180, h: 14 },
    { x: 160, y: 620, w: 180, h: 14 },
    { x: 160, y: 480, w: 180, h: 14 },
    { x: 860, y: 520, w: 200, h: 14 },
    { x: 1220, y: 760, w: 260, h: 14 },
  ],
  spawns: [
    { x: 100, y: 900, team: -1 },
    { x: 960, y: 900, team: -1 },
    { x: 1500, y: 900, team: -1 },
    { x: 1500, y: 560, team: -1 },
  ],
  pickups: [
    { x: 250, y: 480, kind: "weapon", item: "ak47", respawnSec: 5 },
    { x: 960, y: 520, kind: "weapon", item: "spas12", respawnSec: 5 },
    { x: 1300, y: 900, kind: "weapon", item: "uzi", respawnSec: 5 },
    { x: 1350, y: 760, kind: "ammo", respawnSec: 5 },
    { x: 1500, y: 560, kind: "health", respawnSec: 5 },
    { x: 760, y: 660, kind: "fuel", respawnSec: 5 },
  ],
  goals: [],
  flagHomes: [],
  navNodes: [
    { x: 100, y: 900 },
    { x: 960, y: 900 },
    { x: 1500, y: 900 },
  ],
};

export const MAPS: Record<string, MapDefinition> = {
  [outpostYard.id]: outpostYard,
  [testRange.id]: testRange,
};
