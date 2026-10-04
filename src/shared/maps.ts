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
    { x: 1100, y: 880, w: 200, h: 90 },
    ...both(
      { x: 228, y: 1050, w: 30, h: 30 },
      { x: 252, y: 1020, w: 30, h: 60 },
      { x: 276, y: 990, w: 30, h: 90 },
      { x: 300, y: 980, w: 260, h: 100 },
      { x: 560, y: 1010, w: 30, h: 70 },
      { x: 584, y: 1040, w: 30, h: 40 },
      { x: 608, y: 1070, w: 30, h: 10 },
      { x: 660, y: 700, w: 40, h: 240 },
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
    { x: 195, y: 1080, team: 0 },
    { x: 400, y: 980, team: 0 },
    { x: 300, y: 600, team: 0 },
    { x: W - 110, y: 1080, team: 1 },
    { x: W - 195, y: 1080, team: 1 },
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


// All arena floor lanes remain connected without flight. Elevated routes are
// optional flanks; both goals and flag homes have ground access.
function arena(id: string, name: string, width: number, height: number, theme: MapDefinition["theme"], solids: Rect[], platforms: Rect[], weaponIds: string[]): MapDefinition {
  const floor = height - 100;
  const nodes = platforms.map(p => ({ x: p.x + p.w / 2, y: p.y }));
  const groundNodes = Array.from({ length: Math.ceil((width - 120) / 160) }, (_, i) => ({ x: 70 + i * 160, y: floor }));
  const pickupSpots = [...nodes, ...groundNodes.filter((_, i) => i % 2 === 1)];
  return {
    id, name, width, height, theme,
    solids: [
      { x: 0, y: floor, w: width, h: 100 },
      { x: 0, y: 0, w: 32, h: height }, { x: width - 32, y: 0, w: 32, h: height },
      { x: 0, y: 0, w: width, h: 24 }, ...solids,
    ],
    platforms,
    spawns: [
      { x: 100, y: floor, team: 0 }, { x: 220, y: floor, team: 0 },
      { x: 340, y: floor, team: 0 }, { x: 460, y: floor, team: 0 },
      { x: width - 100, y: floor, team: 1 }, { x: width - 220, y: floor, team: 1 },
      { x: width - 340, y: floor, team: 1 }, { x: width - 460, y: floor, team: 1 },
      ...nodes.filter((_, i) => i % 2 === 0).map(p => ({ ...p, team: -1 as const })),
    ],
    pickups: [
      ...weaponIds.map((item, i) => ({ ...pickupSpots[i % pickupSpots.length], kind: "weapon" as const, item, respawnSec: 18 + i % 3 * 4 })),
      ...["frag", "gas", "emp", "mine"].map((item, i) => ({ x: width * (0.24 + i * 0.17), y: floor, kind: "throwable" as const, item, respawnSec: 20 })),
      ...[0.18, 0.82].map(f => ({ x: width * f, y: floor, kind: "health" as const, respawnSec: 25 })),
      ...[0.34, 0.66].map(f => ({ x: width * f, y: floor, kind: "ammo" as const, respawnSec: 20 })),
      ...[0.4, 0.6].map(f => ({ x: width * f, y: floor, kind: "fuel" as const, respawnSec: 15 })),
    ],
    goals: [
      { team: 0, rect: { x: 48, y: floor - 125, w: 130, h: 125 } },
      { team: 1, rect: { x: width - 178, y: floor - 125, w: 130, h: 125 } },
    ],
    flagHomes: [{ team: 0, x: 330, y: floor }, { team: 1, x: width - 330, y: floor }],
    navNodes: [...groundNodes, ...nodes, ...solids.filter(r => r.y > 60).map(r => ({ x: r.x + r.w / 2, y: r.y }))],
  };
}

const cryptworks = arena("cryptworks", "Cryptworks", 2400, 1300,
  { sky: 0x1c263a, rock: 0x3c4259, platform: 0x8e7894, accent: 0x61e0c5 },
  [
    { x: 350, y: 940, w: 540, h: 80 }, { x: 1510, y: 940, w: 540, h: 80 },
    { x: 1030, y: 780, w: 340, h: 70 },
    { x: 480, y: 590, w: 400, h: 70 }, { x: 1520, y: 590, w: 400, h: 70 },
    { x: 990, y: 330, w: 420, h: 65 },
    { x: 300, y: 280, w: 180, h: 70 }, { x: 1920, y: 280, w: 180, h: 70 },
  ],
  [
    { x: 140, y: 1080, w: 140, h: 12 }, { x: 2120, y: 1080, w: 140, h: 12 },
    { x: 950, y: 1060, w: 170, h: 12 }, { x: 1280, y: 1060, w: 170, h: 12 },
    { x: 230, y: 780, w: 180, h: 12 }, { x: 1990, y: 780, w: 180, h: 12 },
    { x: 840, y: 700, w: 180, h: 12 }, { x: 1380, y: 700, w: 180, h: 12 },
    { x: 230, y: 460, w: 220, h: 12 }, { x: 1950, y: 460, w: 220, h: 12 },
    { x: 1040, y: 520, w: 320, h: 12 },
  ], ["spas12", "aa20", "saw-launcher", "flamethrower", "machete", "riot-shield", "tec9", "magnum", "rg6", "emp-gun", "mp5"]);

const crosscurrent = arena("crosscurrent", "Crosscurrent", 2700, 1200,
  { sky: 0x83beca, rock: 0x405b62, platform: 0xa5c7bc, accent: 0xffd179 },
  [
    { x: 420, y: 850, w: 340, h: 60 }, { x: 1940, y: 850, w: 340, h: 60 },
    { x: 960, y: 750, w: 780, h: 55 },
    { x: 430, y: 440, w: 300, h: 50 }, { x: 1970, y: 440, w: 300, h: 50 },
    { x: 1210, y: 310, w: 280, h: 50 },
  ],
  [
    { x: 190, y: 970, w: 150, h: 12 }, { x: 2360, y: 970, w: 150, h: 12 },
    { x: 800, y: 970, w: 210, h: 12 }, { x: 1690, y: 970, w: 210, h: 12 },
    { x: 330, y: 660, w: 230, h: 12 }, { x: 2140, y: 660, w: 230, h: 12 },
    { x: 820, y: 550, w: 220, h: 12 }, { x: 1660, y: 550, w: 220, h: 12 },
    { x: 1200, y: 510, w: 300, h: 12 },
  ], ["ak47", "m4", "tavor-x95", "xm8", "m14", "golden-eagle", "uzi", "mini-eagle", "rg6", "riot-shield"]);

const skyshaft = arena("skyshaft", "Skyshaft", 2000, 1600,
  { sky: 0x24324b, rock: 0x4b566a, platform: 0xc5a069, accent: 0xf4b35e },
  [
    { x: 480, y: 1190, w: 220, h: 55 }, { x: 1300, y: 1190, w: 220, h: 55 },
    { x: 830, y: 940, w: 340, h: 60 },
    { x: 340, y: 680, w: 310, h: 55 }, { x: 1350, y: 680, w: 310, h: 55 },
    { x: 850, y: 390, w: 300, h: 50 },
  ],
  [
    { x: 150, y: 1350, w: 230, h: 12 }, { x: 1620, y: 1350, w: 230, h: 12 },
    { x: 800, y: 1340, w: 400, h: 12 },
    { x: 170, y: 1050, w: 230, h: 12 }, { x: 1600, y: 1050, w: 230, h: 12 },
    { x: 550, y: 880, w: 230, h: 12 }, { x: 1220, y: 880, w: 230, h: 12 },
    { x: 820, y: 680, w: 360, h: 12 },
    { x: 230, y: 460, w: 250, h: 12 }, { x: 1520, y: 460, w: 250, h: 12 },
    { x: 530, y: 280, w: 200, h: 12 }, { x: 1270, y: 280, w: 200, h: 12 },
  ], ["m93ba", "m14", "smaw", "minigun", "phasr", "emp-gun", "saw-launcher", "mp5", "tavor-x95"]);

outpostYard.pickups.push(
  { x: 300, y: 600, kind: "weapon", item: "m4", respawnSec: 18 },
  { x: 2100, y: 600, kind: "weapon", item: "xm8", respawnSec: 18 },
  { x: 950, y: 1080, kind: "throwable", item: "gas", respawnSec: 20 },
  { x: 1450, y: 1080, kind: "throwable", item: "emp", respawnSec: 20 },
  { x: 1700, y: 1080, kind: "throwable", item: "mine", respawnSec: 20 },
  { x: 1500, y: 640, kind: "weapon", item: "smaw", respawnSec: 25 },
  { x: 500, y: 1080, kind: "weapon", item: "magnum", respawnSec: 15 },
);
// Test range exposes the complete catalogue at ground level for inspection.
const rangeWeapons = ["mini-eagle", "golden-eagle", "magnum", "uzi", "tec9", "mp5", "ak47", "m4", "tavor-x95", "xm8", "m14", "m93ba", "spas12", "aa20", "minigun", "smaw", "rg6", "saw-launcher", "flamethrower", "phasr", "emp-gun", "machete", "riot-shield"];
testRange.solids = testRange.solids.filter(r => r.x === 0 || r.x === 1760);
testRange.pickups = rangeWeapons.map((item, i) => ({ x: 90 + i * 70, y: 900, kind: "weapon", item, respawnSec: 5 }));
testRange.pickups.push(...["frag", "gas", "emp", "mine"].map((item, i) => ({ x: 200 + i * 400, y: 900, kind: "throwable" as const, item, respawnSec: 5 })));
testRange.spawns = [{ x: 100, y: 900, team: -1 }, { x: 960, y: 900, team: -1 }, { x: 1500, y: 900, team: -1 }];
testRange.navNodes = Array.from({ length: 11 }, (_, i) => ({ x: 100 + 150 * i, y: 900 }));

export const MAPS: Record<string, MapDefinition> = {
  [cryptworks.id]: cryptworks,
  [crosscurrent.id]: crosscurrent,
  [skyshaft.id]: skyshaft,
  [outpostYard.id]: outpostYard,
  [testRange.id]: testRange,
};
