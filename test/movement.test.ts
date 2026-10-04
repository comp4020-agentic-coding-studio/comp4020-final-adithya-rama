import { describe, expect, it } from "vitest";
import { FUEL_DRAIN, TICK_RATE } from "../src/shared/constants.ts";
import { MAPS } from "../src/shared/maps.ts";
import { type MoveState, stepMovement } from "../src/shared/physics.ts";
import { defaultSettings } from "../src/shared/settings.ts";
import { Btn } from "../src/shared/types.ts";
import { FLAT, hold, player, run, world } from "./helpers.ts";

const at = (x: number, y: number): MoveState => ({
  x,
  y,
  vx: 0,
  vy: 0,
  crouch: false,
  onGround: false,
  jetting: false,
  fuel: 100,
  jetCooldown: 0,
  dropTicks: 0,
});

describe("movement", () => {
  const s = { ...defaultSettings(), map: FLAT.id };

  it("falls under gravity and lands on solid ground", () => {
    const p = at(150, 500);
    for (let i = 0; i < 120; i++) stepMovement(p, 0, FLAT, s);
    expect(p.y).toBe(900);
    expect(p.onGround).toBe(true);
    expect(p.vy).toBe(0);
  });

  it("stops at walls instead of passing through", () => {
    const p = at(960, 900);
    for (let i = 0; i < 120; i++) stepMovement(p, Btn.RIGHT, FLAT, s);
    expect(p.x).toBeLessThanOrEqual(1000 - 11);
  });

  it("jetpack lifts the player and drains fuel; fuel regenerates on the ground", () => {
    const p = at(150, 900);
    stepMovement(p, 0, FLAT, s);
    for (let i = 0; i < 60; i++) stepMovement(p, Btn.JET, FLAT, s);
    expect(p.y).toBeLessThan(800);
    expect(p.fuel).toBeCloseTo(100 - FUEL_DRAIN, 0);
    for (let i = 0; i < 6 * TICK_RATE; i++) stepMovement(p, 0, FLAT, s);
    expect(p.onGround).toBe(true);
    expect(p.fuel).toBe(100);
  });

  it("can't fly once the tank is empty, and can't fly when flight is off", () => {
    const p = at(150, 900);
    p.fuel = 0;
    p.jetCooldown = 999;
    for (let i = 0; i < 30; i++) stepMovement(p, Btn.JET, FLAT, s);
    expect(p.y).toBe(900);
    const q = at(150, 900);
    for (let i = 0; i < 30; i++) stepMovement(q, Btn.JET, FLAT, { ...s, flight: false });
    expect(q.y).toBe(900);
  });

  it("lands on a one-way platform from above, rises through it from below, and drops through with crouch", () => {
    const p = at(400, 700);
    for (let i = 0; i < 60; i++) stepMovement(p, 0, FLAT, s);
    expect(p.y).toBe(800);
    for (let i = 0; i < 30; i++) stepMovement(p, Btn.CROUCH, FLAT, s);
    for (let i = 0; i < 60; i++) stepMovement(p, 0, FLAT, s);
    expect(p.y).toBe(900);
    for (let i = 0; i < 40; i++) stepMovement(p, Btn.JET, FLAT, s);
    expect(p.y).toBeLessThan(800);
  });

  it("crouches on solid ground and moves slower while crouched", () => {
    const p = at(150, 900);
    stepMovement(p, 0, FLAT, s);
    for (let i = 0; i < 30; i++) stepMovement(p, Btn.CROUCH | Btn.RIGHT, FLAT, s);
    expect(p.crouch).toBe(true);
    const crouchSpeed = p.vx;
    const q = at(150, 900);
    for (let i = 0; i < 30; i++) stepMovement(q, Btn.RIGHT, FLAT, s);
    expect(crouchSpeed).toBeLessThan(q.vx);
  });

  it("is deterministic, so client prediction replays to the same place", () => {
    const script = [Btn.RIGHT, Btn.RIGHT | Btn.JET, Btn.JET, Btn.LEFT, Btn.JUMP, 0, Btn.CROUCH];
    const a = at(150, 900);
    const b = at(150, 900);
    for (let i = 0; i < 300; i++) {
      stepMovement(a, script[i % script.length], FLAT, s);
      stepMovement(b, script[i % script.length], FLAT, s);
    }
    expect(a).toEqual(b);
  });

  it("dies on leaving the bottom of the world", () => {
    const w = world({ mode: "ffa" });
    const p = player(w, -1, { x: 500, y: 2000 });
    run(w, 1);
    expect(p.alive).toBe(false);
    expect(p.deaths).toBe(1);
  });

  it("every map's spawns stand on ground", () => {
    for (const map of Object.values(MAPS)) {
      if (map.id === FLAT.id) continue;
      for (const sp of map.spawns) {
        const p = at(sp.x, sp.y - 1);
        for (let i = 0; i < 10; i++) stepMovement(p, 0, map, { ...s, map: map.id });
        expect(p.onGround, `${map.id} spawn at ${sp.x},${sp.y}`).toBe(true);
        expect(p.y).toBe(sp.y);
      }
    }
  });

  it("server input is one frame per tick, whatever the client sends", () => {
    const w = world({ mode: "ffa" });
    const p = player(w, -1, { x: 150, y: 900 });
    run(w, 60, () => hold(p.id, Btn.RIGHT));
    expect(p.x - 150).toBeLessThan(240);
  });
});
