import { describe, expect, it } from "vitest";
import { DEFAULT_FRAGS, SPAWN_PROTECT_TICKS, TICK_RATE } from "../src/shared/constants.ts";
import { applyDamage, computeResult, createWorld, freshSlot, stepWorld } from "../src/shared/sim.ts";
import { Btn, type InputFrame } from "../src/shared/types.ts";
import { WEAPONS } from "../src/shared/weapons.ts";
import { hold, player, run, world } from "./helpers.ts";

const aimAt = (from: { x: number }, to: { x: number }) => (to.x > from.x ? 0 : Math.PI);

describe("weapons", () => {
  it("each implemented weapon behaves distinctly", () => {
    const ids = Object.keys(WEAPONS);
    expect(ids.length).toBe(23);
    const sig = (id: string) => {
      const d = WEAPONS[id];
      return `${d.damage}/${d.pellets}/${d.cooldownMs}/${d.auto}/${d.mag}/${d.range}`;
    };
    expect(new Set(ids.map(sig)).size).toBe(ids.length);
  });

  it("a hitscan shot damages an enemy in the open", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    const b = player(w, -1, { x: 500, y: 900 });
    a.slots[0] = freshSlot("mini-eagle");
    run(w, 1, () => hold(a.id, Btn.FIRE, aimAt(a, b)));
    expect(b.hp).toBe(100 - WEAPONS["mini-eagle"].damage);
    expect(a.slots[0]!.mag).toBe(WEAPONS["mini-eagle"].mag - 1);
  });

  it("walls stop bullets", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 900, y: 900 });
    const b = player(w, -1, { x: 1200, y: 900 });
    a.slots[0] = freshSlot("ak47");
    run(w, 30, () => hold(a.id, Btn.FIRE, 0));
    expect(b.hp).toBe(100);
  });

  it("semi-automatic weapons need a fresh press; automatics keep firing", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    a.slots[0] = freshSlot("mini-eagle");
    run(w, 60, () => hold(a.id, Btn.FIRE, Math.PI / 2 + 0.5));
    expect(a.slots[0]!.mag).toBe(WEAPONS["mini-eagle"].mag - 1);
    const u = player(w, -1, { x: 300, y: 900 });
    u.slots[0] = freshSlot("uzi");
    u.active = 0;
    run(w, 30, () => hold(u.id, Btn.FIRE, -Math.PI / 2));
    // 70 ms cooldown: about seven rounds in half a second
    expect(u.slots[0]!.mag).toBeLessThanOrEqual(WEAPONS.uzi.mag - 6);
  });

  it("an empty magazine reloads automatically from reserve, and reload takes time", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    a.slots[0] = { ...freshSlot("spas12"), mag: 1 };
    run(w, 1, () => hold(a.id, Btn.FIRE, -Math.PI / 2));
    expect(a.slots[0]!.mag).toBe(0);
    expect(a.slots[0]!.reloadEnd).toBeGreaterThan(0);
    run(w, Math.ceil((WEAPONS.spas12.reloadMs / 1000) * TICK_RATE) + 2);
    expect(a.slots[0]!.mag).toBe(WEAPONS.spas12.mag);
    expect(a.slots[0]!.reserve).toBe(WEAPONS.spas12.reserve - WEAPONS.spas12.mag);
  });

  it("switching weapons cancels a reload in progress", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    a.slots = [{ ...freshSlot("ak47"), mag: 3 }, freshSlot("uzi")];
    let t = 0;
    run(w, 3, () => hold(a.id, t++ === 0 ? Btn.RELOAD : 0));
    expect(a.slots[0]!.reloadEnd).toBeGreaterThan(0);
    run(w, 2, () => hold(a.id, Btn.SWITCH));
    expect(a.active).toBe(1);
    expect(a.slots[0]!.reloadEnd).toBe(0);
    expect(a.slots[0]!.mag).toBe(3);
  });

  it("shotgun fires several pellets per shot", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    a.slots[0] = freshSlot("spas12");
    w.events = [];
    run(w, 1, () => hold(a.id, Btn.FIRE, 0));
    expect(w.events.filter((e) => e.t === "shot").length).toBe(WEAPONS.spas12.pellets);
  });

  it("spawn protection blocks damage until it expires or the player attacks", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    const b = player(w, -1, { x: 500, y: 900 });
    b.protectUntil = w.tick + SPAWN_PROTECT_TICKS;
    expect(applyDamage(w, b, a.id, 30, "ak47")).toBe(0);
    b.slots[0] = freshSlot("mini-eagle");
    run(w, 1, () => hold(b.id, Btn.FIRE, Math.PI / 2 + 0.3));
    expect(b.protectUntil).toBe(0);
    expect(applyDamage(w, b, a.id, 30, "ak47")).toBe(30);
  });
});

describe("grenades", () => {
  it("frag damage falls off with distance and walls block it", () => {
    const w = world({ mode: "ffa" });
    const thrower = player(w, -1, { x: 150, y: 900 });
    const near = player(w, -1, { x: 700, y: 900 });
    const far = player(w, -1, { x: 790, y: 900 });
    const hidden = player(w, -1, { x: 1060, y: 900 });
    w.projectiles.push({ id: 999, kind: "frag", owner: thrower.id, x: 680, y: 900, vx: 0, vy: 0, explodeTick: w.tick + 1 });
    w.projectiles.push({ id: 998, kind: "frag", owner: thrower.id, x: 990, y: 900, vx: 0, vy: 0, explodeTick: w.tick + 1 });
    run(w, 2);
    expect(100 - near.hp).toBeGreaterThan(100 - far.hp);
    expect(far.hp).toBeLessThan(100);
    expect(hidden.hp).toBe(100);
  });

  it("players start with two frags, and throwing spends one", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    expect(a.throwables.frag).toBe(DEFAULT_FRAGS);
    run(w, 1, () => hold(a.id, Btn.THROW, -1));
    expect(a.throwables.frag).toBe(DEFAULT_FRAGS - 1);
    expect(w.projectiles.length).toBe(1);
    run(w, 4 * TICK_RATE);
    expect(w.projectiles.length).toBe(0);
  });
});

describe("kills, scoring and results", () => {
  it("team deathmatch: enemy kills score, friendly fire is off by default, suicides don't score", () => {
    const w = world({ mode: "tdm" });
    const a = player(w, 0, { x: 200, y: 900 });
    const mate = player(w, 0, { x: 400, y: 900 });
    const foe = player(w, 1, { x: 600, y: 900 });
    expect(applyDamage(w, mate, a.id, 500, "ak47")).toBe(0);
    applyDamage(w, foe, a.id, 500, "ak47");
    expect(w.teamScores).toEqual([1, 0]);
    expect(a.kills).toBe(1);
    applyDamage(w, a, a.id, 500, "frag");
    expect(w.teamScores).toEqual([1, 0]);
    expect(a.kills).toBe(1);
    expect(a.deaths).toBe(1);
  });

  it("friendly kills never add team score, even with friendly fire on", () => {
    const w = world({ mode: "tdm", friendlyFire: true });
    const a = player(w, 0, { x: 200, y: 900 });
    const mate = player(w, 0, { x: 400, y: 900 });
    applyDamage(w, mate, a.id, 500, "ak47");
    expect(mate.alive).toBe(false);
    expect(w.teamScores).toEqual([0, 0]);
    expect(a.kills).toBe(0);
  });

  it("an assist needs 20% of max health in the 8 seconds before the kill", () => {
    const w = world({ mode: "ffa" });
    const helper = player(w, -1, { x: 200, y: 900 });
    const late = player(w, -1, { x: 300, y: 900 });
    const killer = player(w, -1, { x: 400, y: 900 });
    const victim = player(w, -1, { x: 600, y: 900 });
    applyDamage(w, victim, late.id, 30, "uzi");
    run(w, 9 * TICK_RATE);
    applyDamage(w, victim, helper.id, 20, "uzi");
    applyDamage(w, victim, killer.id, 500, "ak47");
    expect(killer.kills).toBe(1);
    expect(helper.assists).toBe(1);
    expect(late.assists).toBe(0);
  });

  it("respawns after the delay with a fresh loadout and protection", () => {
    const w = world({ mode: "ffa", respawnSec: 3 });
    const a = player(w, -1, { x: 200, y: 900 });
    const b = player(w, -1, { x: 600, y: 900 });
    applyDamage(w, b, a.id, 500, "ak47");
    run(w, 3 * TICK_RATE - 1);
    expect(b.alive).toBe(false);
    run(w, 2);
    expect(b.alive).toBe(true);
    expect(b.hp).toBe(100);
    expect(b.slots[0]?.weapon).toBe("mini-eagle");
    expect(b.protectUntil).toBeGreaterThan(w.tick);
  });

  it("disconnected players don't respawn and their inputs are ignored", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    a.connected = false;
    run(w, 30, () => hold(a.id, Btn.RIGHT));
    expect(a.x).toBe(200);
  });

  it("the round ends at the time limit or the score limit", () => {
    const w = world({ mode: "tdm", durationMin: 2, scoreLimit: 2 });
    const a = player(w, 0, { x: 200, y: 900 });
    const b = player(w, 1, { x: 600, y: 900 });
    applyDamage(w, b, a.id, 500, "ak47");
    run(w, 1);
    expect(w.over).toBe(false);
    run(w, 3 * TICK_RATE + 5);
    b.protectUntil = 0;
    applyDamage(w, b, a.id, 500, "ak47");
    run(w, 1);
    expect(w.over).toBe(true);
    expect(w.overReason).toBe("limit");
    const t = world({ mode: "ffa", durationMin: 2 });
    run(t, 2 * 60 * TICK_RATE);
    expect(t.over).toBe(true);
    expect(t.overReason).toBe("time");
  });

  it("results: equal team scores draw, MVP uses contribution then fewer deaths", () => {
    const w = world({ mode: "tdm" });
    const a = player(w, 0);
    const b = player(w, 1);
    const c = player(w, 1);
    Object.assign(a, { kills: 2, assists: 0, deaths: 3 });
    Object.assign(b, { kills: 2, assists: 0, deaths: 1 });
    Object.assign(c, { kills: 0, assists: 1, deaths: 0 });
    w.teamScores = [2, 2];
    const r = computeResult(w, "m1", "time", (p) => p.key);
    expect(r.draw).toBe(true);
    expect(r.winnerTeam).toBeNull();
    expect(r.participants.find((p) => p.key === b.key)!.mvp).toBe(true);
    expect(r.participants.find((p) => p.key === a.key)!.mvp).toBe(false);
    expect(r.participants.find((p) => p.key === a.key)!.score).toBe(4);
    expect(r.scoringNote).toContain("2 × kills + assists");
  });

  it("results: tied MVPs with equal deaths share the award; abandoned matches award nothing", () => {
    const w = world({ mode: "ffa" });
    const a = player(w);
    const b = player(w);
    Object.assign(a, { kills: 3, deaths: 1 });
    Object.assign(b, { kills: 3, deaths: 1 });
    const r = computeResult(w, "m2", "time", (p) => p.key);
    expect(r.participants.filter((p) => p.mvp).length).toBe(2);
    expect(r.draw).toBe(true);
    const ab = computeResult(w, "m3", "abandoned", (p) => p.key);
    expect(ab.participants.some((p) => p.mvp)).toBe(false);
    expect(ab.winnerKeys).toEqual([]);
  });
});

describe("pickups", () => {
  it("picking up a weapon fills an empty slot, otherwise swaps the active weapon onto the floor", () => {
    const w = createWorld({ ...world().settings, mode: "ffa", mapPickups: false }, 3);
    const a = player(w, -1, { x: 200, y: 900 });
    a.slots = [freshSlot("mini-eagle"), null];
    w.pickups.push({ id: 500, kind: "weapon", item: "ak47", x: 205, y: 900, spawnIndex: -1, respawnTicks: 0, availableAt: 0, expiresAt: 0, slot: null });
    const press = (b: number): Map<number, InputFrame> => hold(a.id, b);
    stepWorld(w, press(Btn.PICKUP));
    expect(a.slots[1]?.weapon).toBe("ak47");
    expect(a.active).toBe(1);
    w.pickups.push({ id: 501, kind: "weapon", item: "spas12", x: 205, y: 900, spawnIndex: -1, respawnTicks: 0, availableAt: 0, expiresAt: 0, slot: null });
    stepWorld(w, press(0));
    stepWorld(w, press(Btn.PICKUP));
    expect(a.slots[1]?.weapon).toBe("spas12");
    expect(w.pickups.some((p) => p.item === "ak47")).toBe(true);
  });

  it("dropping puts the weapon on the ground with its ammo", () => {
    const w = world({ mode: "ffa" });
    const a = player(w, -1, { x: 200, y: 900 });
    a.slots = [{ ...freshSlot("uzi"), mag: 7 }, null];
    run(w, 1, () => hold(a.id, Btn.DROP));
    expect(a.slots[0]).toBeNull();
    const dropped = w.pickups.find((p) => p.item === "uzi");
    expect(dropped?.slot?.mag).toBe(7);
    expect(dropped?.y).toBe(900);
  });
});
