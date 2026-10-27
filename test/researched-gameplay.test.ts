import { describe, expect, it } from "vitest";
import { PLAYER_CROUCH_H, SPACE_SPEED } from "../src/shared/constants.ts";
import { boxOf, overlaps, stepMovement, type MoveState } from "../src/shared/physics.ts";
import { addPlayer, dropFlags, freshSlot, killPlayer, muzzleOf, respawn, snapPlayer, type Projectile } from "../src/shared/sim.ts";
import { defaultSettings } from "../src/shared/settings.ts";
import { Btn, type MapDefinition } from "../src/shared/types.ts";
import { equippedMovementMultiplier, WEAPONS } from "../src/shared/weapons.ts";
import { canSeePlayer, concealed } from "../src/shared/visibility.ts";
import { FLAT, hold, player, run, world } from "./helpers.ts";

const state = (x = 200, y = 500): MoveState => ({ x, y, vx: 0, vy: 0, crouch: false, onGround: false,
  jetting: false, fuel: 100, jetCooldown: 0, dropTicks: 0 });
const spaceMap: MapDefinition = { ...FLAT, physics: "space", solids: [], platforms: [] };
const spaceSettings = { ...defaultSettings(), flight: false, unlimitedFuel: false, gravity: 2 as const };
function spaceWorld() {
  const w = world({ mode: "ffa", flight: false }); w.map = { ...spaceMap }; return w;
}
const projectile = (id: number, kind: string, owner = -1, extra: Partial<Projectile> = {}): Projectile =>
  ({ id, kind, owner, x: 300, y: 500, vx: 100, vy: 0, explodeTick: 1000, ...extra });

describe("supported crouch and bounded collision", () => {
  it("crawls under a low roof without standing or jetting into its rock", () => {
    const map = { ...FLAT, solids: [...FLAT.solids, { x: 250, y: 800, w: 300, h: 69 }] };
    const p = state(200, 900);
    for (let i = 0; i < 65; i++) stepMovement(p, Btn.CROUCH | Btn.RIGHT, map, defaultSettings());
    expect(p.x).toBeGreaterThan(280); expect(p.crouch).toBe(true);
    stepMovement(p, 0, map, defaultSettings());
    expect(p.crouch).toBe(true);
    stepMovement(p, Btn.JET, map, defaultSettings());
    expect(p.crouch).toBe(true);
    expect(map.solids.some((r) => overlaps(boxOf(p), r))).toBe(false);
  });
  it("explicit descent cannot cross a solid slab", () => {
    const p = state(200, 900);
    for (let i = 0; i < 60; i++) stepMovement(p, Btn.CROUCH | Btn.DESCEND, FLAT, defaultSettings());
    expect(p.y).toBe(900); expect(p.crouch).toBe(true); expect(p.dropTicks).toBe(0);
  });
  it("walks supported contour steps in both directions without a jump", () => {
    const map = { ...FLAT, solids: [...FLAT.solids, { x: 300, y: 880, w: 200, h: 20 }] };
    for (const direction of [-1, 1]) {
      const p = state(direction === 1 ? 270 : 530, 900);
      let reachedTop = false;
      for (let tick = 0; tick < 70; tick++) {
        stepMovement(p, direction === 1 ? Btn.RIGHT : Btn.LEFT, map, defaultSettings());
        if (p.y === 880) reachedTop = true;
        expect(map.solids.some(r => overlaps(boxOf(p), r))).toBe(false);
      }
      expect(reachedTop).toBe(true);
      expect(direction * (p.x - (direction === 1 ? 500 : 300))).toBeGreaterThan(0);
    }
  });
  it("step-up refuses tall walls, blocked ceilings and unsupported airborne contacts", () => {
    const smallStep = { x: 300, y: 880, w: 200, h: 20 };
    for (const caseName of ["wall", "ceiling", "airborne"] as const) {
      const map = { ...FLAT, solids: [...FLAT.solids,
        caseName === "wall" ? { ...smallStep, y: 875, h: 25 } : smallStep,
        ...(caseName === "ceiling" ? [{ x: 290, y: 800, w: 230, h: 38 }] : [])] };
      const p = state(caseName === "airborne" ? 288 : 280, caseName === "airborne" ? 891 : 900);
      if (caseName === "airborne") p.vx = 230;
      for (let tick = 0; tick < (caseName === "airborne" ? 1 : 30); tick++)
        stepMovement(p, Btn.RIGHT, map, defaultSettings());
      expect(p.x).toBeLessThanOrEqual(289);
      expect(map.solids.some(r => overlaps(boxOf(p), r))).toBe(false);
    }
  });
  it("a fast impulse cannot tunnel through a thin wall", () => {
    const map = { ...spaceMap, solids: [{ x: 250, y: 0, w: 2, h: 1000 }] };
    const p = state(200, 500); p.vx = 6000;
    stepMovement(p, 0, map, defaultSettings());
    expect(p.x).toBeLessThanOrEqual(239); expect(p.vx).toBe(0);
  });
  it("level standing sniper fire clears crouch; deliberately lowered fire still hits without head bonus", () => {
    for (const lower of [false, true]) {
      const w = world({ mode: "ffa" }); const a = player(w, -1, { x: 200, y: 900 }); const b = player(w, -1, { x: 400, y: 900 });
      a.slots = [freshSlot("m93ba"), null, null];
      b.hp = b.maxHp = 200;
      run(w, 1, () => hold(b.id, Btn.CROUCH));
      const aim = lower ? Math.atan2(b.y - PLAYER_CROUCH_H + 2 - muzzleOf(a).y, b.x - a.x) : 0;
      run(w, 1, () => new Map([[a.id, { seq: 1, b: Btn.FIRE, aim }], [b.id, { seq: 1, b: Btn.CROUCH, aim: 0 }]]));
      expect(b.hp).toBe(lower ? 140 : 200);
    }
  });
  it("rewound sniper damage uses historical crouch stance as well as its box", () => {
    const w = world({ mode: "ffa" }), a = player(w, -1, { x: 200, y: 900 }), b = player(w, -1, { x: 400, y: 900 });
    a.slots = [freshSlot("m93ba"), null, null];
    b.hp = b.maxHp = 200;
    run(w, 2, () => hold(b.id, Btn.CROUCH)); const view = w.tick;
    run(w, 1); expect(b.crouch).toBe(false);
    const aim = Math.atan2(874 - muzzleOf(a).y, b.x - a.x);
    run(w, 1, () => new Map([[a.id, { seq: 1, b: Btn.FIRE, aim, view }]]));
    expect(b.hp).toBe(140);
  });
  it("holstered weight has no penalty while an equipped shield/heavy does", () => {
    const slots = [freshSlot("mini-eagle"), freshSlot("smaw"), freshSlot("riot-shield")] as const;
    expect(equippedMovementMultiplier([...slots], 0)).toBe(1);
    expect(equippedMovementMultiplier([...slots], 1)).toBeLessThan(1);
    expect(equippedMovementMultiplier([...slots], 2)).toBeLessThan(equippedMovementMultiplier([...slots], 1));
  });
});

describe("space physics across authoritative entities", () => {
  it("overrides no-flight/gravity settings, preserves coast and uses unlimited fuel", () => {
    const p = state();
    for (let i = 0; i < 60; i++) stepMovement(p, Btn.RIGHT | Btn.JET, spaceMap, spaceSettings);
    expect(p.y).toBeLessThan(500); expect(p.x).toBeGreaterThan(200); expect(p.fuel).toBe(100);
    const vx = p.vx, vy = p.vy, x = p.x, y = p.y;
    for (let i = 0; i < 30; i++) stepMovement(p, 0, spaceMap, spaceSettings);
    expect(p.vx).toBe(vx); expect(p.vy).toBe(vy);
    expect(p.x - x).toBeCloseTo(vx / 2); expect(p.y - y).toBeCloseTo(vy / 2);
  });
  it("normalizes diagonal speed and reverse input brakes before reversing", () => {
    const axis = state(), diagonal = state();
    for (let i = 0; i < 60; i++) {
      stepMovement(axis, Btn.RIGHT, spaceMap, spaceSettings);
      stepMovement(diagonal, Btn.RIGHT | Btn.CROUCH, spaceMap, spaceSettings);
    }
    expect(Math.hypot(diagonal.vx, diagonal.vy)).toBeCloseTo(SPACE_SPEED);
    expect(axis.vx).toBeCloseTo(SPACE_SPEED);
    stepMovement(axis, Btn.LEFT, spaceMap, spaceSettings);
    expect(axis.vx).toBeGreaterThan(0); expect(axis.vx).toBeLessThan(SPACE_SPEED);
    for (let i = 0; i < 50; i++) stepMovement(axis, Btn.LEFT, spaceMap, spaceSettings);
    expect(axis.vx).toBeLessThan(0);
  });
  it("supported space crouch crawls more slowly and EMP prevents a descent impulse", () => {
    const map = { ...FLAT, physics: "space" as const }, crawl = state(100, 900), standing = state(100, 900);
    for (let i = 0; i < 60; i++) {
      stepMovement(crawl, Btn.CROUCH | Btn.RIGHT, map, spaceSettings);
      stepMovement(standing, Btn.RIGHT, map, spaceSettings);
    }
    expect(crawl.crouch).toBe(true);
    expect(crawl.vx).toBeCloseTo(SPACE_SPEED * .45);
    expect(standing.vx).toBeCloseTo(SPACE_SPEED);
    const onOneWay = state(400, 800);
    stepMovement(onOneWay, Btn.DESCEND | Btn.CROUCH, map, spaceSettings, { thrustDisabled: true });
    expect(onOneWay.dropTicks).toBeGreaterThan(0);
    expect(onOneWay.y).toBe(800); expect(onOneWay.vy).toBe(0);
  });
  it("EMP suppresses every powered direction without erasing existing velocity", () => {
    const w = spaceWorld(), p = player(w, -1, { x: 500, y: 500 });
    p.empUntil = 100; p.vx = 40; p.vy = -20;
    run(w, 30, () => hold(p.id, Btn.RIGHT | Btn.CROUCH | Btn.JET));
    expect(p.vx).toBe(40); expect(p.vy).toBe(-20); expect(p.jetting).toBe(false);
    expect(p.x).toBeCloseTo(520); expect(p.y).toBeCloseTo(490);
  });
  it("supported S crouches but unsupported S accelerates down; descend leaves only one-way", () => {
    const map = { ...spaceMap, platforms: [{ x: 100, y: 600, w: 300, h: 10 }] };
    const p = state(200, 600);
    stepMovement(p, Btn.CROUCH, map, spaceSettings);
    expect(p.crouch).toBe(true); expect(p.y).toBe(600); expect(p.vy).toBe(0);
    stepMovement(p, Btn.DESCEND | Btn.CROUCH, map, spaceSettings);
    expect(p.y).toBeGreaterThan(600); expect(p.vy).toBeGreaterThan(0);
  });
  it("grenades and dropped equipment inherit motion without gravitational fall", () => {
    const w = spaceWorld(), p = player(w, -1, { x: 500, y: 500 });
    p.vx = 60; p.vy = 30;
    w.projectiles.push(projectile(900, "frag"));
    run(w, 1, () => hold(p.id, Btn.DROP));
    const dropped = w.pickups.find((pk) => pk.spawnIndex === -1)!;
    expect(dropped.vx).toBe(60); expect(dropped.vy).toBe(30);
    const x = dropped.x, y = dropped.y;
    run(w, 30);
    expect(dropped.x - x).toBeCloseTo(30); expect(dropped.y - y).toBeCloseTo(15);
    expect(w.projectiles[0].y).toBe(500); expect(w.projectiles[0].vy).toBe(0);
  });
  it("dropped own flag drifts, keeps identity, has no timer, and only a teammate recovers it", () => {
    const w = world({ mode: "flag" }); w.map = { ...spaceMap };
    const a = player(w, 0, { x: 500, y: 500 }), enemy = player(w, 1, { x: 700, y: 500 });
    const flag = w.flags[0]; Object.assign(flag, { state: "carried", carrier: a.id });
    a.vx = 10; a.vy = 0; dropFlags(w, a.id); a.x = 200;
    const generation = flag.generation;
    run(w, 120);
    expect(flag.state).toBe("dropped"); expect(flag.x).toBeCloseTo(520); expect(flag.y).toBe(488);
    enemy.x = flag.x; enemy.y = flag.y + 12; run(w, 1);
    expect(flag.carrier).toBeNull();
    a.x = flag.x; a.y = flag.y + 12; a.vx = 0; run(w, 1);
    expect(flag.carrier).toBe(a.id); expect(flag.generation).toBe(generation);
  });
  it.each([{ x: -1, y: 500 }, { x: 2001, y: 500 }, { x: 500, y: -1 }, { x: 500, y: 1001 }])("returns the same flag beyond boundary %j", (at) => {
    const w = world({ mode: "flag" }); w.map = { ...spaceMap };
    const f = w.flags[0]; Object.assign(f, at, { state: "dropped", vx: 0, vy: 0, generation: 7 });
    run(w, 1); expect(f.state).toBe("home"); expect(f.generation).toBe(7); expect(w.flags).toHaveLength(2);
  });
  it("caps flag drift below a slow shield carrier's speed without cancelling its direction", () => {
    const w = world({ mode: "flag", moveSpeed: .5 }); w.map = { ...spaceMap };
    const a = player(w, 0, { x: 500, y: 500 }); a.vx = 600; a.vy = -300;
    const flag = w.flags[0]; Object.assign(flag, { state: "carried", carrier: a.id });
    dropFlags(w, a.id);
    expect(Math.hypot(flag.vx, flag.vy)).toBeLessThan(SPACE_SPEED * .5 * .72);
    expect(flag.vy / flag.vx).toBeCloseTo(-.5);
  });
  it("space flag collision cannot enter an inaccessible narrow crack", () => {
    const w = world({ mode: "flag" });
    w.map = { ...spaceMap, solids: [{ x: 600, y: 0, w: 100, h: 480 }, { x: 600, y: 495, w: 100, h: 505 }] };
    const f = w.flags[0]; Object.assign(f, { state: "dropped", x: 550, y: 488, vx: 100, vy: 0 });
    run(w, 90); expect(f.x).toBeLessThanOrEqual(590); expect(f.state).toBe("dropped");
  });
  it("space actors survive the former top kill boundary", () => {
    const w = spaceWorld(), p = player(w, -1, { x: 500, y: -241 }); run(w, 1); expect(p.alive).toBe(true); expect(p.y).toBe(-241);
  });
});

describe("weapon firing state and finite travel", () => {
  it("M4 click commits three timed rounds, holds repeat only with continuous intent", () => {
    const w = world({ mode: "ffa" }), a = player(w, -1, { x: 200, y: 900 });
    a.slots = [freshSlot("m4"), freshSlot("mini-eagle"), null];
    run(w, 1, () => hold(a.id, Btn.FIRE));
    expect(a.weaponStats.m4.shots).toBe(1);
    run(w, 4, () => hold(a.id, 0)); expect(a.weaponStats.m4.shots).toBe(1);
    run(w, 1, () => hold(a.id, 0)); expect(a.weaponStats.m4.shots).toBe(2);
    run(w, 5, () => hold(a.id, 0)); expect(a.weaponStats.m4.shots).toBe(3);
    run(w, 60, () => hold(a.id, 0));
    expect(a.weaponStats.m4.shots).toBe(3); expect(a.slots[0]!.mag).toBe(27);
    run(w, 90, () => hold(a.id, Btn.FIRE));
    expect(a.weaponStats.m4.shots).toBe(6);
    run(w, 90, () => hold(a.id, Btn.FIRE | Btn.CONTINUOUS_FIRE));
    expect(a.weaponStats.m4.shots).toBeGreaterThan(6);
    run(w, 15, () => hold(a.id, 0)); const shots = a.weaponStats.m4.shots;
    run(w, 90, () => hold(a.id, 0)); expect(a.weaponStats.m4.shots).toBe(shots);
  });
  it.each(["switch", "reload", "disconnect", "missing input", "death"])("M4 cancels a pending burst on %s without resuming it", (cause) => {
    const w = world({ mode: "ffa" }), a = player(w, -1, { x: 200, y: 900 });
    a.slots = [freshSlot("m4"), freshSlot("mini-eagle"), null];
    run(w, 1, () => hold(a.id, Btn.FIRE));
    if (cause === "disconnect") a.connected = false;
    if (cause === "death") killPlayer(w, a, null, "test");
    const b = cause === "switch" ? Btn.SLOT2 : cause === "reload" ? Btn.RELOAD : 0;
    if (cause === "missing input") run(w, 1);
    else run(w, 1, () => hold(a.id, b));
    a.connected = true;
    run(w, 30, () => hold(a.id, 0));
    expect(a.weaponStats.m4.shots).toBe(1); expect(a.slots[0]!.burstRemaining).toBe(0);
  });
  it.each(["minigun", "saw-launcher"])("%s charges before firing and cancels on holster/disconnect/death", (id) => {
    const w = world({ mode: "ffa" }), a = player(w);
    a.slots = [freshSlot(id), freshSlot("mini-eagle"), null];
    const delay = Math.round(WEAPONS[id].chargeMs! / 1000 * 60);
    run(w, delay - 1, () => hold(a.id, Btn.FIRE)); expect(a.weaponStats[id]).toBeUndefined();
    run(w, 1, () => hold(a.id, Btn.FIRE)); expect(a.weaponStats[id].shots).toBe(1);
    run(w, 1, () => hold(a.id, Btn.SLOT2)); expect(a.slots[0]!.chargeTicks).toBe(0);
    a.active = 0; a.slots[0]!.chargeTicks = 5; a.connected = false; run(w, 1); expect(a.slots[0]!.chargeTicks).toBe(0);
    a.connected = true; a.slots[0]!.chargeTicks = 5; killPlayer(w, a, null, "test"); expect(a.slots[0]!.chargeTicks).toBe(0);
  });
  it("M14 bullet needs travel time and a wall can intercept it", () => {
    for (const blocked of [false, true]) {
      const w = world({ mode: "ffa" }), a = player(w, -1, { x: 200, y: 900 }), b = player(w, -1, { x: 600, y: 900 });
      if (blocked) w.map = { ...w.map, solids: [...w.map.solids, { x: 400, y: 700, w: 8, h: 200 }] };
      a.slots = [freshSlot("m14"), null, null]; run(w, 1, () => hold(a.id, Btn.FIRE));
      expect(b.hp).toBe(100); expect(w.projectiles.some((p) => p.kind === "m14")).toBe(true);
      run(w, 20); expect(b.hp).toBe(blocked ? 100 : 57);
    }
  });
  it("EMP pulse travels, disables flight on impact, and disarms a mine without detonating it", () => {
    const w = world({ mode: "ffa" }), a = player(w, -1, { x: 200, y: 900 }), b = player(w, -1, { x: 400, y: 900 });
    a.slots = [freshSlot("emp-gun"), null, null]; run(w, 1, () => hold(a.id, Btn.FIRE));
    expect(b.empUntil).toBe(0); run(w, 25); expect(b.empUntil).toBeGreaterThan(w.tick);
    a.prevButtons = 0; a.slots[0]!.cooldownUntil = 0;
    w.projectiles.push(projectile(950, "mine", b.id, { x: 300, y: muzzleOf(a).y, vx: 0, vy: 0, stuck: true, armedAt: 999 }));
    run(w, 1, () => hold(a.id, Btn.FIRE)); run(w, 15);
    expect(w.projectiles.some((p) => p.id === 950)).toBe(false);
    expect(w.events.some((e) => e.t === "explode")).toBe(false);
  });
  it("a saw pierces two bodies once each and has one terminal blast", () => {
    const w = spaceWorld(), a = player(w, -1, { x: 100, y: 500 });
    const b = player(w, -1, { x: 300, y: 500 }), c = player(w, -1, { x: 450, y: 500 });
    a.slots = [freshSlot("saw-launcher"), null, null];
    run(w, 30, () => hold(a.id, Btn.FIRE)); run(w, 35);
    expect(b.hp).toBe(35); expect(c.hp).toBe(35);
    expect(w.projectiles[0].hitIds).toEqual([b.id, c.id]);
    run(w, 100);
    expect(w.events.filter((e) => e.t === "explode")).toHaveLength(1); expect(w.projectiles).toHaveLength(0);
  });
  it.each(["phasr", "flamethrower"])("%s refuses manual reload and refills itself once empty", (id) => {
    const w = world({ mode: "ffa" }), a = player(w);
    a.slots = [freshSlot(id), null, null]; const slot = a.slots[0]!; slot.mag = 3; slot.reserve = 0;
    run(w, 1, () => hold(a.id, Btn.RELOAD)); expect(slot.reloadEnd).toBe(0); expect(slot.mag).toBe(3);
    slot.mag = 0; run(w, 1); expect(slot.reloadEnd).toBeGreaterThan(w.tick);
    run(w, Math.ceil(WEAPONS[id].reloadMs / 1000 * 60));
    expect(slot.mag).toBe(WEAPONS[id].mag); expect(slot.reserve).toBe(0);
    run(w, 120); expect(slot.mag).toBe(WEAPONS[id].mag);
  });
  it("grounded crouch reduces a floor blast and impulse obeys team/protection rules", () => {
    const damage = (crouch: boolean) => {
      const w = world({ mode: "ffa" }), p = player(w, -1, { x: 500, y: 900 });
      p.hp = p.maxHp = 200; // Compare uncapped damage; a point-blank frag is now lethal at 100 HP.
      w.projectiles.push(projectile(900, "frag", -1, { x: 500, y: 899, vx: 0, vy: 0, explodeTick: 1 }));
      run(w, 1, () => hold(p.id, crouch ? Btn.CROUCH : 0)); return { hp: p.hp, vy: p.vy };
    };
    const standing = damage(false), ducking = damage(true);
    expect(ducking.hp).toBeGreaterThan(standing.hp); expect(ducking.hp).toBeGreaterThan(0); expect(ducking.vy).toBeLessThan(0);
    const w = world({ mode: "tdm" }), owner = player(w, 0), mate = player(w, 0, { x: 500, y: 900 });
    w.projectiles.push(projectile(900, "frag", owner.id, { x: 500, y: 899, vx: 0, vy: 0, explodeTick: 1 }));
    run(w, 1); expect(mate.hp).toBe(100); expect(mate.vx).toBe(0); expect(mate.vy).toBe(0);
  });
});

describe("shared concealment", () => {
  const map = { ...FLAT, concealment: [{ x: 300, y: 860, w: 200, h: 40 }] };
  it("requires full covered supported crouch and never treats FFA -1 as teammates", () => {
    const viewer = { id: 1, x: 100, y: 900, team: -1 as const };
    const target = { id: 2, x: 400, y: 900, team: -1 as const, crouch: true, onGround: true, alive: true };
    expect(concealed(target, map, 10)).toBe(true); expect(canSeePlayer(viewer, target, map, 10, { teamMode: true })).toBe(false);
    expect(canSeePlayer(viewer, { ...target, x: 305 }, map, 10)).toBe(true);
    expect(canSeePlayer(viewer, { ...target, onGround: false }, map, 10)).toBe(true);
    expect(canSeePlayer(viewer, target, map, 10, { carryingFlag: true })).toBe(true);
    expect(canSeePlayer({ ...viewer, team: 0 }, { ...target, team: 0 }, map, 10, { teamMode: true })).toBe(true);
    expect(canSeePlayer({ ...viewer, x: 350 }, target, map, 10)).toBe(true);
  });
  it("actual firing/throwing/melee reveals for a bounded interval and snapshots agree", () => {
    for (const action of [Btn.FIRE, Btn.THROW, Btn.MELEE]) {
      const w = world({ mode: "ffa" }); w.map = map;
      const p = player(w, -1, { x: 400, y: 900 }), viewer = player(w, -1, { x: 100, y: 900 });
      run(w, 1, () => hold(p.id, Btn.CROUCH)); expect(canSeePlayer(viewer, p, map, w.tick)).toBe(false);
      run(w, 1, () => hold(p.id, Btn.CROUCH | action));
      expect(canSeePlayer(viewer, p, map, w.tick)).toBe(true);
      expect(snapPlayer(w, p).revealUntil).toBe(p.revealUntil);
      run(w, 61, () => hold(p.id, Btn.CROUCH));
      expect(canSeePlayer(viewer, p, map, w.tick)).toBe(false);
    }
  });
});

describe("spawn safety scoring", () => {
  it("prefers nearby solid cover to an exposed longer sniper sightline", () => {
    const w = world({ mode: "ffa" }), p = player(w), enemy = player(w, -1, { x: 1000, y: 900 });
    w.map = { ...FLAT, solids: [...FLAT.solids, { x: 700, y: 700, w: 30, h: 200 }],
      spawns: [{ x: 200, y: 900, team: 0 }, { x: 600, y: 900, team: 1 }] };
    // The existing central wall is at the enemy; use a separate open front to the far spawn.
    w.map.solids = [{ x: 0, y: 900, w: 2000, h: 100 }, { x: 700, y: 830, w: 30, h: 70 }];
    w.map.spawns = [{ x: 1800, y: 900, team: 0 }, { x: 600, y: 900, team: 1 }];
    enemy.slots = [freshSlot("m93ba"), null, null];
    p.alive = false; respawn(w, p); expect(p.x).toBe(600);
  });
  it.each(["gas", "mine", "moving rocket"])("avoids an otherwise preferred spawn threatened by %s", (hazard) => {
    const w = world({ mode: "ffa" }), p = player(w), enemy = player(w, -1, { x: 100, y: 900 });
    w.map = { ...FLAT, solids: [FLAT.solids[0]], spawns: [{ x: 500, y: 900, team: 0 }, { x: 1800, y: 900, team: 1 }] };
    if (hazard === "gas") w.areas.push({ id: 99, owner: enemy.id, x: 1800, y: 878, radius: 135, until: 1000, nextDamageTick: 0 });
    else w.projectiles.push(projectile(99, hazard === "mine" ? "mine" : "smaw", enemy.id,
      hazard === "mine" ? { x: 1800, y: 880, vx: 0, vy: 0, stuck: true, armedAt: 0 } :
        { x: 1450, y: 878, vx: 950, vy: 0, weapon: "smaw" }));
    p.alive = false; respawn(w, p); expect(p.x).toBe(500);
  });
  it("ignores harmless allied frag grenades and respects rock blocking hazardous paths", () => {
    const w = world({ mode: "tdm" }), p = player(w, 0), mate = player(w, 0), enemy = player(w, 1, { x: 100, y: 900 });
    w.map = { ...FLAT, solids: [FLAT.solids[0], { x: 1650, y: 600, w: 30, h: 300 }],
      spawns: [{ x: 500, y: 900, team: 0 }, { x: 1800, y: 900, team: 0 }] };
    w.projectiles.push(projectile(90, "frag", mate.id, { x: 1800, y: 878, vx: 0, vy: 0 }));
    w.projectiles.push(projectile(99, "smaw", enemy.id, { x: 1400, y: 878, vx: 950, vy: 0, weapon: "smaw" }));
    p.alive = false; respawn(w, p); expect(p.x).toBe(1800);
  });
  it("never selects a blocked body when a clear authored spawn exists", () => {
    const w = world({ mode: "ffa" }), p = player(w);
    w.map = { ...FLAT, spawns: [{ x: 100, y: 900, team: 0 }, { x: 1020, y: 900, team: 1 }] };
    p.alive = false; respawn(w, p); expect(p.x).toBe(100);
  });
});

describe("arena training flag practice", () => {
  it("uses real own flags, team-specific pickup and delivery without turning deliveries into a kill limit", () => {
    const w = world({ mode: "training", scoreLimit: 1 }), p = player(w, -1, { x: 100, y: 900 });
    const bot = addPlayer(w, { id: w.nextId++, key: "training-bot", name: "Practice", team: -1, bot: true, color: 0 });
    expect(p.team).toBe(0); expect(bot.team).toBe(1); expect(w.flags).toHaveLength(2);
    bot.x = 100; bot.y = 900; p.x = 300;
    run(w, 1); expect(w.flags[0].state).toBe("home");
    p.x = 100; run(w, 1); expect(w.flags[0].carrier).toBe(p.id);
    p.x = 1900; run(w, 1);
    expect(p.deliveries).toBe(1); expect(w.teamScores[0]).toBe(1);
    expect(w.flags[0]).toMatchObject({ state: "respawning", generation: 1 });
    expect(w.over).toBe(false); expect(p.kills).toBe(0);
    run(w, 1); expect(w.flags[0].state).toBe("home");
  });
  it("keeps calibration range flag-free and resolves lethal damage before a practice delivery", () => {
    const range = world({ mode: "training", map: "test-range" });
    expect(range.flags).toHaveLength(0);
    const w = world({ mode: "training" }), p = player(w, -1, { x: 100, y: 900 });
    run(w, 1); expect(w.flags[0].carrier).toBe(p.id);
    p.x = 1900; p.hp = 1;
    w.projectiles.push(projectile(999, "frag", -1, { x: 1900, y: 880, vx: 0, vy: 0, explodeTick: w.tick + 1 }));
    run(w, 1);
    expect(p.alive).toBe(false); expect(p.deliveries).toBe(0);
    expect(w.flags[0]).toMatchObject({ state: "dropped", generation: 0, carrier: null });
  });
});
