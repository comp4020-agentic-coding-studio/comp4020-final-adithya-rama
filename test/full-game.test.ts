import { describe, expect, it } from "vitest";
import { TICK_RATE } from "../src/shared/constants.ts";
import { addPlayer, applyDamage, canDual, computeResult, dropFlags, freshSlot, snapshot, stepWorld } from "../src/shared/sim.ts";
import { sanitizeSettings } from "../src/shared/settings.ts";
import { Btn } from "../src/shared/types.ts";
import { THROWABLES, WEAPONS } from "../src/shared/weapons.ts";
import { hold, player, run, world } from "./helpers.ts";

function flagWorld(scoreLimit = 0) {
  const w = world({ mode: "flag", scoreLimit });
  w.map = { ...w.map,
    flagHomes: [{ team: 0, x: 100, y: 900 }, { team: 1, x: 1900, y: 900 }],
    goals: [{ team: 0, rect: { x: 40, y: 800, w: 110, h: 100 } }, { team: 1, rect: { x: 1850, y: 800, w: 110, h: 100 } }] };
  return w;
}

describe("own-flag delivery", () => {
  it("only teammates collect, protection ends on collection, and kills never add deliveries", () => {
    const w = flagWorld();
    const enemy = player(w, 1, { x: 100, y: 900 });
    run(w, 1);
    expect(w.flags[0].state).toBe("home");
    const owner = player(w, 0, { x: 100, y: 900 });
    owner.protectUntil = 999;
    run(w, 1);
    expect(w.flags[0].carrier).toBe(owner.id);
    expect(owner.protectUntil).toBe(0);
    applyDamage(w, enemy, owner.id, 500, "ak47");
    expect(owner.kills).toBe(1);
    expect(w.teamScores).toEqual([0, 0]);
  });

  it("physical dropped flags remain indefinitely and opponents cannot return them", () => {
    const w = flagWorld();
    const carrier = player(w, 0, { x: 100, y: 900 });
    run(w, 1);
    Object.assign(carrier, { x: 600, y: 400, vx: 0, vy: 0, connected: false });
    dropFlags(w, carrier.id);
    const enemy = player(w, 1, { x: 600, y: 900 });
    run(w, 20 * TICK_RATE);
    expect(w.flags[0]).toMatchObject({ state: "dropped", carrier: null, x: 600, generation: 0 });
    expect(w.flags[0].y).toBeCloseTo(899.8);
    expect(w.flags).toHaveLength(2);
    const friend = player(w, 0, { x: 600, y: 900 });
    run(w, 1);
    expect(w.flags[0].carrier).toBe(friend.id);
    expect(enemy.deliveries).toBe(0);
  });

  it("out-of-bounds returns the same flag without advancing its generation", () => {
    const w = flagWorld();
    Object.assign(w.flags[0], { state: "dropped", x: 2200, y: 300, generation: 7 });
    run(w, 1);
    expect(w.flags[0]).toMatchObject({ state: "home", x: 100, y: 900, generation: 7 });
    expect(w.events.some((e) => e.t === "flag" && e.action === "return")).toBe(true);
  });

  it("a carried flag crossing the playable bounds returns without duplicating", () => {
    const w = flagWorld();
    const carrier = player(w, 0, { x: 100, y: 900 });
    run(w, 1);
    carrier.x = 2050;
    run(w, 1);
    expect(w.flags[0]).toMatchObject({ state: "home", carrier: null, generation: 0 });
    expect(carrier.alive).toBe(true);
    expect(w.flags).toHaveLength(2);
  });

  it("death and disconnect drop immediately; a disconnected body cannot deliver", () => {
    const w = flagWorld();
    const a = player(w, 0, { x: 100, y: 900 });
    run(w, 1);
    a.x = 1900; a.connected = false;
    dropFlags(w, a.id);
    expect(w.flags[0].state).toBe("dropped");
    run(w, 1);
    expect(w.teamScores).toEqual([0, 0]);
    a.connected = true; a.x = 600;
    Object.assign(w.flags[0], { state: "carried", carrier: a.id });
    applyDamage(w, a, null, 1000, "fall");
    expect(w.flags[0]).toMatchObject({ state: "dropped", carrier: null, x: 600 });
  });

  it("resolves every source of damage before delivery", () => {
    const w = flagWorld();
    const carrier = player(w, 0, { x: 1900, y: 900 });
    const defender = player(w, 1, { x: 1700, y: 900 });
    Object.assign(w.flags[0], { state: "carried", carrier: carrier.id });
    carrier.hp = 10;
    run(w, 1, () => hold(defender.id, Btn.FIRE, 0));
    expect(carrier.alive).toBe(false);
    expect(carrier.deliveries).toBe(0);
    expect(w.teamScores).toEqual([0, 0]);
    expect(w.flags[0].state).toBe("dropped");
  });

  it("collecting a flag exposes a protected player to damage in that same tick", () => {
    const w = flagWorld();
    const carrier = player(w, 0, { x: 100, y: 900 });
    const defender = player(w, 1, { x: 300, y: 900 });
    carrier.protectUntil = 999;
    run(w, 1, () => hold(defender.id, Btn.FIRE, Math.PI));
    expect(carrier.hp).toBeLessThan(100);
  });

  it("scores once per generation and makes the next flag available on the next tick", () => {
    const w = flagWorld();
    const a = player(w, 0, { x: 1900, y: 900 });
    Object.assign(w.flags[0], { state: "carried", carrier: a.id });
    run(w, 1);
    expect(w.flags[0]).toMatchObject({ state: "respawning", generation: 1, availableTick: w.tick + 1 });
    expect(w.teamScores).toEqual([1, 0]);
    run(w, 1);
    expect(w.flags[0]).toMatchObject({ state: "home", x: 100, generation: 1 });
    run(w, 10);
    expect(w.teamScores).toEqual([1, 0]);
  });

  it("counts simultaneous deliveries before score-limit and final-tick finishes", () => {
    for (const limit of [0, 1]) {
      const w = flagWorld(limit);
      if (!limit) w.endTick = 1;
      const a = player(w, 0, { x: 1900, y: 900 });
      const b = player(w, 1, { x: 100, y: 900 });
      Object.assign(w.flags[0], { state: "carried", carrier: a.id });
      Object.assign(w.flags[1], { state: "carried", carrier: b.id });
      run(w, 1);
      expect(w.teamScores).toEqual([1, 1]);
      expect(w.over).toBe(true);
      const result = computeResult(w, "simultaneous", w.overReason!, () => null);
      expect(result.draw).toBe(true);
      expect(result.participants.every((p) => p.score === 10 && p.mvp)).toBe(true);
    }
  });

  it("rematches start with two fresh flags and no inherited generation", () => {
    const w = flagWorld();
    w.flags[0].generation = 10;
    expect(flagWorld().flags.map((f) => [f.state, f.generation])).toEqual([["home", 0], ["home", 0]]);
  });
});

describe("complete arsenal", () => {
  const guns = Object.values(WEAPONS).filter((d) => d.category !== "equipment");
  it("contains all twenty-one firearms and both equipment items", () => {
    expect(guns).toHaveLength(21);
    expect(Object.keys(THROWABLES)).toEqual(["frag", "gas", "emp", "mine"]);
  });

  it.each(guns.map((d) => d.id))("%s fires, spends its own ammunition and damages an enemy", (id) => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    const b = player(w, -1, { x: 350, y: 900 });
    a.slots = [freshSlot(id), null];
    run(w, 1, () => hold(a.id, Btn.FIRE));
    expect(a.slots[0]!.mag).toBe(WEAPONS[id].mag - 1);
    run(w, 150);
    expect(b.hp).toBeLessThan(100);
    expect(a.weaponStats[id].shots).toBe(1);
    expect(a.weaponStats[id].damage).toBeGreaterThan(0);
  });

  it("beam passes through multiple targets but stops at solid cover", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    const b = player(w, -1, { x: 400, y: 900 });
    const c = player(w, -1, { x: 600, y: 900 });
    const behindWall = player(w, -1, { x: 1100, y: 900 });
    a.slots = [freshSlot("phasr"), null];
    run(w, 1, () => hold(a.id, Btn.FIRE));
    expect(b.hp).toBe(82);
    expect(c.hp).toBe(82);
    expect(behindWall.hp).toBe(100);
  });

  it("beam and ordinary hitscan use bounded server history, while explosions use current positions", () => {
    for (const weapon of ["phasr", "mini-eagle"]) {
      const w = world({ mode: "ffa" });
      const a = player(w, -1, { x: 200, y: 900 });
      const b = player(w, -1, { x: 400, y: 900 });
      a.slots = [freshSlot(weapon), null];
      run(w, 1);
      const view = w.tick;
      b.y = 500;
      stepWorld(w, new Map([[a.id, { seq: 1, b: Btn.FIRE, aim: 0, view }]]));
      expect(b.hp).toBeLessThan(100);
      expect(a.weaponStats[weapon].hits).toBe(1);
    }
  });

  it("old client view ticks cannot rewind beyond the 150ms history window", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    const b = player(w, -1, { x: 400, y: 900 });
    a.slots = [freshSlot("phasr"), null];
    run(w, 1);
    b.y = 500;
    run(w, 12);
    stepWorld(w, new Map([[a.id, { seq: 1, b: Btn.FIRE, aim: 0, view: 1 }]]));
    expect(b.hp).toBe(100);
  });

  it("high-speed projectiles cannot tunnel through a thin solid wall", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    const b = player(w, -1, { x: 1090, y: 850 });
    w.projectiles.push({ id: 100, kind: "smaw", weapon: "smaw", owner: a.id,
      x: 970, y: 825, vx: 10000, vy: 0, explodeTick: 600 });
    run(w, 1);
    expect(w.projectiles).toHaveLength(0);
    expect(b.hp).toBe(100);
    expect(w.events.some((e) => e.t === "explode" && e.x <= 1000)).toBe(true);
  });

  it("a launched saw ricochets, while RG6 bounces until its fuse expires", () => {
    const w = world({ mode: "ffa" });
    w.projectiles.push({ id: 100, kind: "saw-launcher", weapon: "saw-launcher", owner: -1,
      x: 990, y: 825, vx: 1000, vy: 0, explodeTick: 600 });
    w.projectiles.push({ id: 101, kind: "rg6", weapon: "rg6", owner: -1,
      x: 990, y: 800, vx: 1000, vy: 0, explodeTick: 20 });
    run(w, 1);
    expect(w.projectiles.every((p) => p.vx < 0)).toBe(true);
    run(w, 20);
    expect(w.projectiles.some((p) => p.kind === "rg6")).toBe(false);
    expect(w.events.some((e) => e.t === "explode")).toBe(true);
  });

  it("dual slots have independent firing cooldowns and reload state", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    a.slots = [{ ...freshSlot("mini-eagle"), mag: 1 }, freshSlot("uzi")];
    run(w, 1, () => hold(a.id, Btn.DUAL | Btn.FIRE, -Math.PI / 2));
    expect(a.dual).toBe(true);
    expect(a.slots[0]!.reloadEnd).toBeGreaterThan(w.tick);
    expect(a.slots[1]!.mag).toBe(29);
    run(w, 25, () => hold(a.id, Btn.FIRE, -Math.PI / 2));
    expect(a.slots[1]!.mag).toBeLessThan(25);
    expect(a.slots[0]!.mag).toBe(0);
    run(w, 60);
    expect(a.slots[0]!.mag).toBe(12);
  });

  it("switching never resets a weapon's firing cooldown and heavy weapons cannot dual wield", () => {
    const w = world({ mode: "ffa" });
    const a = player(w);
    a.slots = [freshSlot("mini-eagle"), freshSlot("uzi")];
    stepWorld(w, hold(a.id, Btn.FIRE, -Math.PI / 2));
    stepWorld(w, hold(a.id, Btn.SLOT2));
    stepWorld(w, hold(a.id, Btn.SLOT1 | Btn.FIRE, -Math.PI / 2));
    expect(a.slots[0]!.mag).toBe(11);
    a.slots[1] = freshSlot("smaw");
    expect(canDual(a)).toBe(false);
    run(w, 1, () => hold(a.id, Btn.DUAL));
    expect(a.dual).toBe(false);
  });

  it("shield blocks frontal direct fire, but leaves the back and blast exposed", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    const b = player(w, -1, { x: 400, y: 900 });
    b.slots = [freshSlot("riot-shield"), freshSlot("mini-eagle")];
    b.dual = true; b.aim = Math.PI;
    expect(applyDamage(w, b, a.id, 20, "ak47")).toBeCloseTo(3);
    b.aim = 0;
    expect(applyDamage(w, b, a.id, 20, "ak47")).toBe(20);
    b.aim = Math.PI;
    expect(applyDamage(w, b, a.id, 20, "frag")).toBe(20);
  });

  it("machete attacks use no ammunition and solid walls block melee", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    const b = player(w, -1, { x: 245, y: 900 });
    a.slots = [freshSlot("machete"), null];
    run(w, 1, () => hold(a.id, Btn.FIRE));
    expect(b.hp).toBe(30);
    expect(a.slots[0]!.mag).toBe(0);
    a.x = 980; b.x = 1060; b.hp = 100;
    run(w, 60);
    run(w, 1, () => hold(a.id, Btn.MELEE));
    expect(b.hp).toBe(100);
  });
});

describe("throwable effects", () => {
  it("gas remains visible and damages repeatedly before expiring", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    const b = player(w, -1, { x: 700, y: 900 });
    w.projectiles.push({ id: 99, kind: "gas", owner: a.id, x: 680, y: 890, vx: 0, vy: 0, explodeTick: 1 });
    run(w, 1);
    expect(w.areas).toHaveLength(1);
    const first = b.hp;
    run(w, 24);
    expect(b.hp).toBeLessThan(first);
    expect(snapshot(w, []).areas[0].k).toBe("gas");
    run(w, 360);
    expect(w.areas).toHaveLength(0);
  });

  it("EMP suppresses flight temporarily and does not affect protected teammates", () => {
    const w = world({ mode: "tdm" });
    const a = player(w, 0, { x: 200, y: 900 });
    const b = player(w, 1, { x: 400, y: 900 });
    const mate = player(w, 0, { x: 420, y: 900 });
    a.slots = [freshSlot("emp-gun"), null];
    run(w, 1, () => hold(a.id, Btn.FIRE));
    expect(b.empUntil).toBeGreaterThan(w.tick);
    run(w, 30, () => hold(b.id, Btn.JET));
    expect(b.jetting).toBe(false);
    run(w, 150);
    run(w, 1, () => hold(b.id, Btn.JET));
    expect(b.jetting).toBe(true);
    w.projectiles.push({ id: 99, kind: "emp", owner: a.id, x: 420, y: 880, vx: 0, vy: 0, explodeTick: w.tick + 1 });
    run(w, 1);
    expect(mate.empUntil).toBe(0);
  });

  it("mines attach to terrain, arm after landing, then trigger only for enemies", () => {
    const w = world({ mode: "tdm" });
    const a = player(w, 0, { x: 200, y: 900 });
    const b = player(w, 1, { x: 730, y: 900 });
    w.projectiles.push({ id: 99, kind: "mine", owner: a.id, x: 700, y: 899, vx: 0, vy: 100, explodeTick: 10000 });
    run(w, 1);
    expect(w.projectiles[0].stuck).toBe(true);
    expect(b.hp).toBe(100);
    run(w, 52);
    expect(b.hp).toBe(100);
    run(w, 4);
    expect(w.projectiles).toHaveLength(0);
    expect(b.hp).toBeLessThan(100);
  });

  it("throwable pickups, cycling, throwing and ammo packs respect the six-item cap", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    a.throwables = { frag: 0, gas: 5 };
    w.pickups.push({ id: 99, kind: "ammo", item: null, x: 200, y: 900, spawnIndex: -1,
      respawnTicks: 0, availableAt: 0, expiresAt: 0, slot: null });
    run(w, 1);
    expect(a.throwables.frag).toBe(1);
    expect(Object.values(a.throwables).reduce((x, y) => x + y, 0)).toBe(6);
    run(w, 1, () => hold(a.id, Btn.NEXT_THROWABLE | Btn.THROW, -1));
    expect(a.throwable).toBe("gas");
    expect(a.throwables.gas).toBe(4);
    expect(w.projectiles[0].kind).toBe("gas");
  });
});

describe("survival and replicated state", () => {
  it("caps survival at four humans and spawns no more than eight living enemies", () => {
    expect(sanitizeSettings({ mode: "survival", capacity: 8, bots: 7 })).toMatchObject({ capacity: 4, bots: 0 });
    const w = world({ mode: "survival" });
    const human = player(w);
    run(w, 1);
    expect(human.team).toBe(0);
    expect(w.survival?.wave).toBe(1);
    w.survival!.toSpawn = 30;
    run(w, 1200);
    const bots = [...w.players.values()].filter((p) => p.bot);
    expect(bots).toHaveLength(8);
    expect(bots.every((p) => p.team === 1 && p.alive)).toBe(true);
  });

  it("dead humans wait for the next wave; clearing a wave revives them and escalates the next one", () => {
    const w = world({ mode: "survival" });
    const a = player(w);
    const b = player(w);
    run(w, 400);
    a.protectUntil = 0;
    applyDamage(w, a, null, 1000, "fall");
    run(w, 200);
    expect(a.alive).toBe(false);
    for (const bot of w.players.values()) if (bot.bot) {
      bot.protectUntil = 0; applyDamage(w, bot, b.id, 1000, "ak47");
    }
    run(w, 1);
    expect(w.survival?.cleared).toBe(1);
    run(w, 180);
    expect(a.alive).toBe(true);
    expect(w.survival?.wave).toBe(2);
    expect([...w.players.values()].filter((p) => p.bot && p.alive)[0].maxHp).toBeGreaterThan(100);
  });

  it("a full squad wipe ends survival as defeat and MVP excludes enemy bots", () => {
    const w = world({ mode: "survival" });
    const a = player(w);
    run(w, 1);
    a.protectUntil = 0;
    const enemy = [...w.players.values()].find((p) => p.bot)!;
    applyDamage(w, a, enemy.id, 1000, "ak47");
    run(w, 1);
    expect(w.overReason).toBe("defeat");
    const result = computeResult(w, "wipe", "defeat", () => null);
    expect(result.winnerKeys).toEqual([]);
    expect(result.participants.filter((p) => p.bot).some((p) => p.mvp)).toBe(false);
  });

  it("disconnection reservations preserve survival grace without treating hidden bodies as deaths", () => {
    const w = world({ mode: "survival" });
    const a = player(w);
    const b = player(w);
    run(w, 1);
    a.protectUntil = 0;
    applyDamage(w, a, null, 1000, "fall");
    Object.assign(b, { alive: false, connected: false, reserved: true, hp: 70 });
    run(w, 1);
    expect(w.over).toBe(false);
    b.reserved = false;
    run(w, 1);
    expect(w.overReason).toBe("defeat");

    const disconnected = world({ mode: "survival" });
    const only = player(disconnected);
    run(disconnected, 1);
    Object.assign(only, { connected: false, reserved: true, alive: false, hp: 0 });
    run(disconnected, 600);
    expect(disconnected.over).toBe(false);
  });

  it("snapshots carry both slots, grenade selection, effects, flags and survival without aliases", () => {
    const w = flagWorld();
    const a = player(w);
    a.empUntil = 99;
    const snap = snapshot(w, []);
    expect(snap.players[0].slots).toHaveLength(2);
    expect(snap.players[0].throwable).toBe("frag");
    expect(snap.players[0].emp).toBe(99);
    expect(snap.flags).toHaveLength(2);
    snap.players[0].slots[0]!.mag = 0;
    snap.flags[0].generation = 100;
    expect(a.slots[0]!.mag).toBe(12);
    expect(w.flags[0].generation).toBe(0);
  });

  it("shared simulation remains deterministic under identical seeds and inputs", () => {
    const a = world({ mode: "ffa" }), b = world({ mode: "ffa" });
    for (const w of [a, b]) {
      addPlayer(w, { id: 20, key: "same", name: "Same", team: -1, color: 0, bot: false });
      const p = w.players.get(20)!; p.slots = [freshSlot("rg6"), freshSlot("phasr")];
      run(w, 180, (tick) => hold(20, Btn.RIGHT | (tick % 60 === 0 ? Btn.FIRE | Btn.THROW : 0), -.4));
    }
    expect(snapshot(a, [])).toEqual(snapshot(b, []));
  });

  it("flag rooms cannot choose maps without objectives and mode changes clamp capacity", () => {
    expect(sanitizeSettings({ map: "test-range", mode: "flag" }).map).toBe("outpost-yard");
    const training = sanitizeSettings({ mode: "training" });
    expect(training.capacity).toBe(1);
    expect(sanitizeSettings({ mode: "tdm" }, training).capacity).toBe(2);
  });

  it("rejects prototype keys and keeps loadouts inside the weapon allowlist", () => {
    const settings = sanitizeSettings({ weapons: ["constructor", "smaw"], loadout: ["mini-eagle", "uzi"] });
    expect(settings.weapons).toEqual(["smaw"]);
    expect(settings.loadout).toEqual(["smaw", null]);
  });
});
