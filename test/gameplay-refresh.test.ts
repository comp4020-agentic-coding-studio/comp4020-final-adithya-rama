import { describe, expect, it } from "vitest";
import { HEALTH_REGEN_DELAY_TICKS, MAX_THROWABLES, PROTOCOL_VERSION, TICK_RATE } from "../src/shared/constants.ts";
import { defaultSettings, sanitizeSettings } from "../src/shared/settings.ts";
import { addPlayer, applyDamage, canDual, createWorld, dualPartner, freshSlot, snapshot, stepWorld } from "../src/shared/sim.ts";
import { Btn } from "../src/shared/types.ts";
import { THROWABLES, WEAPONS } from "../src/shared/weapons.ts";
import { Bot, BOT_TUNING } from "../src/server/bot.ts";
import { sanitizePrefs } from "../src/server/validation.ts";
import { hold, player, run, world } from "./helpers.ts";

describe("three carried weapons", () => {
  it("normalizes legacy presets and clamps every slot to the allowlist", () => {
    expect(PROTOCOL_VERSION).toBe(2);
    expect(defaultSettings().loadout).toEqual(["mini-eagle", "uzi", null]);
    expect(sanitizeSettings({ loadout: ["magnum", "m4"] }).loadout).toEqual(["magnum", "m4", null]);
    expect(sanitizeSettings({ weapons: ["uzi"], loadout: ["magnum", "m4", "uzi"] }).loadout).toEqual(["uzi", null, "uzi"]);
    expect(sanitizePrefs({ bindings: { Numpad6: -9, Backquote: -2, Digit3: Btn.SLOT3 } }).bindings).toEqual({ Numpad6: -9, Backquote: -2, Digit3: Btn.SLOT3 });
  });

  it("selects 1/2/3, cycles over empty slots, and preserves ammunition", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    p.slots = [freshSlot("mini-eagle"), freshSlot("uzi"), { ...freshSlot("m4"), mag: 7 }];
    for (const [button, index] of [[Btn.SLOT3, 2], [Btn.SLOT1, 0], [Btn.SLOT2, 1], [Btn.SWITCH, 2]] as const) {
      run(w, 1, () => hold(p.id, button));
      expect(p.active).toBe(index);
      run(w, 1);
    }
    p.slots[1] = null;
    run(w, 1, () => hold(p.id, Btn.SWITCH)); expect(p.active).toBe(0);
    run(w, 1); run(w, 1, () => hold(p.id, Btn.SWITCH)); expect(p.active).toBe(2);
    expect(p.slots[2]!.mag).toBe(7);
    expect(snapshot(w, []).players[0].s).toEqual(["mini-eagle", null, "m4"]);
  });

  it("fills the third slot then drops it with its own ammo and returns to a carried slot", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    w.pickups.push({ id: 900, kind: "weapon", item: "magnum", x: 205, y: 900, spawnIndex: -1, respawnTicks: 0, availableAt: 0, expiresAt: 0, slot: { ...freshSlot("magnum"), mag: 3 } });
    run(w, 1, () => hold(p.id, Btn.PICKUP));
    expect(p.active).toBe(2); expect(p.slots[2]!.mag).toBe(3);
    run(w, 1, () => hold(p.id, Btn.DROP));
    expect(p.slots[2]).toBeNull(); expect(p.active).toBe(0);
    expect(w.pickups.find((pk) => pk.item === "magnum")?.slot?.mag).toBe(3);
    expect(p.slots[0]!.mag).toBe(12); expect(p.slots[1]!.mag).toBe(30);
  });

  it("dual wields the selected and compatible partner only; third gun stays carried", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    p.slots = [freshSlot("mini-eagle"), freshSlot("uzi"), freshSlot("magnum")];
    p.active = 2;
    expect(dualPartner(p)).toBe(0);
    run(w, 1, () => hold(p.id, Btn.DUAL | Btn.FIRE, -Math.PI / 2));
    expect(p.slots.map((s) => s!.mag)).toEqual([11, 30, 5]);
    expect(snapshot(w, []).players[0].dualSlot).toBe(0);
    p.slots[2] = freshSlot("minigun");
    expect(canDual(p)).toBe(false);
    run(w, 1); expect(p.dual).toBe(false);
  });

  it("only reloads the dual pair and leaves third-slot ammunition independent", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    p.slots = [freshSlot("mini-eagle"), { ...freshSlot("uzi"), mag: 4 }, { ...freshSlot("magnum"), mag: 2 }];
    p.active = 2; p.dual = true;
    run(w, 1, () => hold(p.id, Btn.RELOAD));
    expect(p.slots[2]!.reloadEnd).toBeGreaterThan(w.tick);
    expect(p.slots[1]!.reloadEnd).toBe(0);
    run(w, 103);
    expect(p.slots[2]!.mag).toBe(6); expect(p.slots[2]!.reserve).toBe(20);
    expect(p.slots[1]!.mag).toBe(4); expect(p.slots[1]!.reserve).toBe(120);
  });

  it("a carried shield does not block unless selected or paired", () => {
    const w = world({ mode: "ffa" }), attacker = player(w, -1, { x: 600, y: 900 }), p = player(w, -1, { x: 200, y: 900 });
    p.slots = [freshSlot("mini-eagle"), freshSlot("uzi"), freshSlot("riot-shield")]; p.dual = true;
    expect(dualPartner(p)).toBe(1);
    expect(applyDamage(w, p, attacker.id, 20, "mini-eagle")).toBe(20);
    p.active = 2;
    expect(applyDamage(w, p, attacker.id, 20, "mini-eagle")).toBe(3);
  });
});

describe("held keyboard firing", () => {
  it("holds a semiautomatic through empty-magazine reload and resumes at normal cooldown", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    const shotTicks: number[] = [];
    for (let i = 0; i < 360; i++) {
      const before = p.weaponStats["mini-eagle"]?.shots ?? 0;
      stepWorld(w, hold(p.id, Btn.FIRE | Btn.CONTINUOUS_FIRE, -Math.PI / 2));
      if ((p.weaponStats["mini-eagle"]?.shots ?? 0) > before) shotTicks.push(w.tick);
    }
    expect(shotTicks.length).toBeGreaterThan(WEAPONS["mini-eagle"].mag);
    for (let i = 1; i < shotTicks.length; i++) expect(shotTicks[i] - shotTicks[i - 1]).toBeGreaterThanOrEqual(16);
    expect(shotTicks[12] - shotTicks[11]).toBeGreaterThanOrEqual(66);
    expect(p.slots[0]!.reserve).toBe(36);
    expect(w.events.some((e) => e.t === "reload")).toBe(true);
  });
  it("mouse hold still fires a semiautomatic once; modifier alone never fires", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    run(w, 60, () => hold(p.id, Btn.FIRE, -Math.PI / 2));
    expect(p.weaponStats["mini-eagle"].shots).toBe(1);
    run(w, 60, () => hold(p.id, Btn.CONTINUOUS_FIRE, -Math.PI / 2));
    expect(p.weaponStats["mini-eagle"].shots).toBe(1);
  });
});

describe("quiet-time health recovery", () => {
  it("waits six seconds after damage then restores four discrete HP per second without exceeding max", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    applyDamage(w, p, null, 10, "fall");
    run(w, HEALTH_REGEN_DELAY_TICKS - 1); expect(p.hp).toBe(90);
    run(w, 1); expect(p.hp).toBe(91);
    run(w, TICK_RATE); expect(p.hp).toBe(95);
    run(w, TICK_RATE * 3); expect(p.hp).toBe(p.maxHp);
  });
  it("own fire and new damage restart the full quiet period", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    applyDamage(w, p, null, 20, "fall");
    run(w, 350);
    run(w, 1, () => hold(p.id, Btn.FIRE, -Math.PI / 2));
    run(w, 359); expect(p.hp).toBe(80);
    applyDamage(w, p, null, 1, "fall");
    run(w, 359); expect(p.hp).toBe(79);
    run(w, 1); expect(p.hp).toBe(80);
  });
  it("near enemy fire delays recovery but distant, allied, and wall-hidden fire do not", () => {
    for (const situation of ["near", "distant", "allied", "wall"] as const) {
      const w = world({ mode: "tdm" });
      const p = player(w, 0, { x: situation === "wall" ? 980 : 500, y: 900 });
      const shooter = player(w, situation === "allied" ? 0 : 1, { x: situation === "wall" ? 1100 : 200, y: 900 });
      p.hp = 70; p.regenAt = 1;
      const aim = situation === "wall" ? Math.PI : situation === "distant" ? -Math.PI / 2 : -.12;
      run(w, 1, () => hold(shooter.id, Btn.FIRE, aim));
      expect(shooter.weaponStats["mini-eagle"].shots).toBe(1);
      expect(p.hp, situation).toBe(situation === "near" ? 70 : 71);
      if (situation === "near") expect(p.regenAt).toBe(w.tick + 360);
    }
  });
  it("dead, disconnected, and reserved bodies cannot heal", () => {
    const w = world();
    const dead = player(w), disconnected = player(w), reserved = player(w);
    Object.assign(dead, { hp: 0, alive: false, respawnTick: 99999, regenAt: 0 });
    Object.assign(disconnected, { hp: 50, connected: false, regenAt: 0 });
    Object.assign(reserved, { hp: 50, reserved: true, regenAt: 0 });
    run(w, 120);
    expect([dead.hp, disconnected.hp, reserved.hp]).toEqual([0, 50, 50]);
  });
});

describe("flashbang and throwable availability", () => {
  it("starts with frag, flash and poison smoke; optional extras still fit six", () => {
    const w = world(), p = player(w);
    expect(defaultSettings().throwables).toEqual(["frag", "flash", "gas"]);
    expect(p.throwables).toEqual({ frag: 2, flash: 2, gas: 2 });
    const extras = world({ throwables: Object.keys(THROWABLES) }), q = player(extras);
    expect(Object.values(q.throwables).reduce((a, b) => a + b, 0)).toBe(MAX_THROWABLES);
    expect(Object.keys(q.throwables)).toEqual(Object.keys(THROWABLES));
    const empty = world({ throwables: [] }); expect(player(empty).throwables).toEqual({});
  });
  it("flash is authoritative, nonlethal, distance attenuated, wall attenuated, and expires", () => {
    const w = world({ mode: "ffa" }), owner = player(w, -1, { x: 300, y: 900 });
    const near = player(w, -1, { x: 850, y: 900 }), far = player(w, -1, { x: 650, y: 900 }), hidden = player(w, -1, { x: 1060, y: 900 });
    w.projectiles.push({ id: 990, kind: "flash", owner: owner.id, x: 900, y: 875, vx: 0, vy: 0, explodeTick: 1 });
    run(w, 1);
    expect(near.flashUntil).toBeGreaterThan(far.flashUntil);
    expect(hidden.flashUntil).toBeGreaterThan(w.tick);
    expect(hidden.flashStrength).toBeLessThan(far.flashStrength);
    expect(near.flashUntil - w.tick).toBeLessThanOrEqual(180);
    expect([near.hp, far.hp, hidden.hp]).toEqual([100, 100, 100]);
    expect(w.events.some((e) => e.t === "flashbang")).toBe(true);
    expect(w.events.some((e) => e.t === "flash" && e.id === near.id)).toBe(true);
    expect(snapshot(w, []).players.find((p) => p.id === near.id)!.flash).toBeGreaterThan(0);
    run(w, 180);
    expect(snapshot(w, []).players.find((p) => p.id === near.id)!.flashStrength).toBe(0);
  });
});

describe("practice bot perception and difficulty", () => {
  function scenario(difficulty: "easy" | "normal" | "hard") {
    const w = world({ mode: "ffa" }), me = player(w, -1, { x: 200, y: 900 }), target = player(w, -1, { x: 550, y: 900 });
    me.bot = true; me.slots[0] = freshSlot("uzi");
    return { w, me, target, bot: new Bot(me.id, difficulty) };
  }
  it("defaults to easy and three levels have distinct reaction, aim, and sustained pressure", () => {
    expect(defaultSettings().botDifficulty).toBe("easy");
    const evidence = (["easy", "normal", "hard"] as const).map((difficulty) => {
      const { w, bot } = scenario(difficulty);
      let first = -1, firing = 0;
      for (let tick = 0; tick < 600; tick++) {
        w.tick = tick;
        const input = bot.think(w);
        if (input.b & Btn.FIRE) { if (first < 0) first = tick; firing++; }
      }
      return { first, firing };
    });
    expect(evidence.map((e) => e.first)).toEqual([60, 42, 24]);
    expect(evidence[0].firing).toBeLessThan(evidence[1].firing);
    expect(evidence[1].firing).toBeLessThan(evidence[2].firing);
  });
  it("limits turning and retains aim error throughout a burst instead of averaging it away", () => {
    const { w, target, bot } = scenario("easy");
    target.x = 100;
    let previous = 0;
    for (let tick = 0; tick < 180; tick++) {
      w.tick = tick; const f = bot.think(w);
      const delta = Math.atan2(Math.sin(f.aim - previous), Math.cos(f.aim - previous));
      expect(Math.abs(delta)).toBeLessThanOrEqual(BOT_TUNING.easy.turn / 60 + 1e-10);
      previous = f.aim;
    }
    target.x = 550;
    for (let tick = 180; tick < 420; tick++) { w.tick = tick; previous = bot.think(w).aim; }
    expect(Math.abs(previous)).toBeGreaterThan(.15);
  });
  it("forgets occluded targets and must react again after seeing them", () => {
    const { w, me, target, bot } = scenario("easy");
    for (let tick = 0; tick <= 60; tick++) { w.tick = tick; bot.think(w); }
    me.x = 900; target.x = 1200; w.tick++;
    const hiddenA = bot.think(w);
    target.y = 760; w.tick++;
    const hiddenB = bot.think(w);
    expect(hiddenA.b & Btn.FIRE).toBe(0); expect(hiddenB.b & Btn.FIRE).toBe(0);
    expect(hiddenB.aim).toBe(hiddenA.aim);
    me.x = 200; target.x = 550; target.y = 900;
    const start = ++w.tick;
    for (let tick = start; tick < start + 60; tick++) { w.tick = tick; expect(bot.think(w).b & Btn.FIRE).toBe(0); }
    w.tick = start + 60; expect(bot.think(w).b & Btn.FIRE).toBeTruthy();
  });
  it("flash stops bot fire and reintroduces reaction time once sight returns", () => {
    const { w, me, bot } = scenario("hard");
    for (let tick = 0; tick <= 24; tick++) { w.tick = tick; bot.think(w); }
    me.flashUntil = 100;
    for (let tick = 25; tick < 100; tick++) { w.tick = tick; expect(bot.think(w).b & Btn.FIRE).toBe(0); }
    for (let tick = 100; tick < 124; tick++) { w.tick = tick; expect(bot.think(w).b & Btn.FIRE).toBe(0); }
    w.tick = 124; expect(bot.think(w).b & Btn.FIRE).toBeTruthy();
  });
});


describe("bot navigation on the revised arenas", () => {
  it.each(["cryptworks", "crosscurrent", "skyshaft", "outpost-yard"])(
    "%s lets both teams deliver their own flag with and without flight", (map) => {
      for (const flight of [true, false]) for (const team of [0, 1] as const) {
        const w = createWorld(sanitizeSettings({ ...defaultSettings(), map, mode: "flag", flight, mapPickups: false }), 42);
        const p = addPlayer(w, { id: w.nextId++, key: "navigator", name: "Navigator", team, color: 0, bot: true });
        const bot = new Bot(p.id, "easy");
        for (let i = 0; i < 3000 && !p.deliveries; i++) stepWorld(w, new Map([[p.id, bot.think(w)]]));
        expect(p.deliveries, map + ", team " + team + ", flight " + flight + ", stopped " + p.x + "," + p.y).toBe(1);
      }
    },
  );
});
