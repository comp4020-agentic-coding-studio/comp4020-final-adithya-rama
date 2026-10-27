import { describe, expect, it } from "vitest";
import { Bot } from "../src/server/bot.ts";
import { shieldBox } from "../src/shared/combat-geometry.ts";
import { boxOf } from "../src/shared/physics.ts";
import { canDual, dualPartner, freshSlot, muzzleOf, type Pickup, snapshot, stepWorld } from "../src/shared/sim.ts";
import { Btn } from "../src/shared/types.ts";
import { WEAPONS } from "../src/shared/weapons.ts";
import { hold, player, run, world } from "./helpers.ts";

function duel(weapon = "m93ba") {
  const w = world({ mode: "ffa" });
  const a = player(w, -1, { x: 200, y: 900 }), b = player(w, -1, { x: 400, y: 900 });
  a.slots = [freshSlot(weapon), null, null];
  b.slots = [freshSlot("riot-shield"), freshSlot("machete"), null];
  b.dual = true; b.aim = Math.PI;
  return { w, a, b };
}
function floorItem(id: number, kind: Pickup["kind"], item: string, x = 200, y = 900): Pickup {
  return { id, kind, item, x, y, spawnIndex: id, respawnTicks: 600, availableAt: 0, expiresAt: 0, slot: null };
}

describe("physical shields and one-hit machetes", () => {
  it.each(["m93ba", "mini-eagle", "phasr", "emp-gun"])("%s stops at the front panel without damage or EMP effects", (weapon) => {
    const { w, a, b } = duel(weapon);
    const behind = player(w, -1, { x: 600, y: 900 });
    run(w, 1, () => hold(a.id, Btn.FIRE));
    expect(b.hp).toBe(100); expect(b.empUntil).toBe(0); expect(behind.hp).toBe(100);
    const shot = w.events.find((e) => e.t === "shot");
    expect(shot).toMatchObject({ t: "shot", hit: false, x2: weapon === "emp-gun" ? a.x + 32 : shieldBox(boxOf(b), b.aim).x });
    if (weapon === "emp-gun") run(w, 25);
    expect(w.events.some((e) => e.t === "shield" && e.id === b.id)).toBe(true);
  });

  it("an exposed crown above the finite plate still allows a lethal headshot", () => {
    const { w, a, b } = duel();
    const muzzle = muzzleOf(a), head = { x: b.x, y: b.y - 43 };
    run(w, 1, () => hold(a.id, Btn.FIRE, Math.atan2(head.y - muzzle.y, head.x - muzzle.x)));
    expect(b.alive).toBe(false); expect(a.kills).toBe(1);
    expect(w.events.some((e) => e.t === "shield")).toBe(false);
  });

  it("a rear path bypasses the panel but a chest sniper hit needs a followup", () => {
    const { w, a, b } = duel();
    b.aim = 0;
    run(w, 1, () => hold(a.id, Btn.FIRE));
    expect(b.hp).toBe(40); expect(b.alive).toBe(true);
    expect(w.events.some((e) => e.t === "shield")).toBe(false);
  });

  it("an upward shield intercepts the overhead head path", () => {
    const { w, a, b } = duel();
    a.x = b.x; a.y = 750; b.aim = -Math.PI / 2;
    run(w, 1, () => hold(a.id, Btn.FIRE, Math.PI / 2));
    expect(b.hp).toBe(100); expect(w.events.some(e => e.t === "shield")).toBe(true);
  });

  it("uses the historical panel pose together with the historical body for lag compensation", () => {
    const { w, a, b } = duel();
    run(w, 1);
    b.aim = 0;
    stepWorld(w, new Map([[a.id, { seq: 1, b: Btn.FIRE, aim: 0, view: 1 }]]));
    expect(b.hp).toBe(100);
    expect(w.events.some((e) => e.t === "shield" && e.id === b.id)).toBe(true);
  });

  it("rockets and close grenade blasts kill through a raised shield; flames bypass it", () => {
    const rocket = duel("smaw");
    run(rocket.w, 15, () => hold(rocket.a.id, Btn.FIRE));
    expect(rocket.b.alive).toBe(false);
    const grenade = duel();
    grenade.w.projectiles.push({ id: 99, kind: "frag", owner: grenade.a.id, x: grenade.b.x, y: grenade.b.y - 20, vx: 0, vy: 0, explodeTick: 1 });
    run(grenade.w, 1); expect(grenade.b.alive).toBe(false);
    const flame = duel("flamethrower"); flame.a.x = 300;
    run(flame.w, 1, () => hold(flame.a.id, Btn.FIRE));
    expect(flame.b.hp).toBeLessThan(100);
  });

  it("a saw disc reflects off the physical panel without cutting its holder", () => {
    const { w, a, b } = duel("saw-launcher");
    run(w, 48, () => hold(a.id, Btn.FIRE));
    expect(b.hp).toBe(100); expect(w.projectiles).toHaveLength(1);
    expect(w.projectiles[0].vx).toBeLessThan(0);
    expect(w.events.some((e) => e.t === "shield")).toBe(true);
  });

  it("pairs shield only with the carried machete and preserves independent small-gun pairs", () => {
    const w = world({ loadout: ["riot-shield", "mini-eagle", "machete"] }), p = player(w);
    expect(p.dual).toBe(true); expect(dualPartner(p)).toBe(2);
    p.active = 1; expect(canDual(p)).toBe(false);
    p.slots[2] = freshSlot("uzi"); expect(dualPartner(p)).toBe(2);
    p.active = 0; expect(canDual(p)).toBe(false);
  });

  it.each([Btn.SLOT3, Btn.SWITCH])("selecting a gun drops shield without losing the third slot or ammunition (%s)", (button) => {
    const w = world({ loadout: ["machete", "riot-shield", "mini-eagle"] }), p = player(w, -1, { x: 200, y: 900 });
    p.slots[2]!.mag = 4; p.active = 1; p.dual = true;
    run(w, 1, () => hold(p.id, button));
    expect(p.active).toBe(2); expect(p.slots[1]).toBeNull(); expect(p.slots[0]?.weapon).toBe("machete");
    expect(p.slots[2]!.mag).toBe(4);
    expect(w.pickups.filter((pk) => pk.item === "riot-shield")).toHaveLength(1);
    expect(p.dual).toBe(false);
  });

  it("picking up a firearm also drops shield, while picking shield automatically pairs an existing machete", () => {
    const w = world({ loadout: ["machete", null, null] }), p = player(w, -1, { x: 200, y: 900 });
    w.pickups.push(floorItem(90, "weapon", "riot-shield"));
    run(w, 1, () => hold(p.id, Btn.PICKUP));
    expect(p.slots[p.active]?.weapon).toBe("riot-shield"); expect(p.dual).toBe(true); expect(dualPartner(p)).toBe(0);
    w.pickups.push(floorItem(91, "weapon", "uzi"));
    run(w, 1); run(w, 1, () => hold(p.id, Btn.PICKUP));
    expect(p.slots[p.active]?.weapon).toBe("uzi"); expect(p.slots[1]).toBeNull();
    expect(p.slots[0]?.weapon).toBe("machete"); expect(p.dual).toBe(false);
  });

  it("does not consume already-carried equipment and can select another useful nearby pickup", () => {
    const w = world({ loadout: ["riot-shield", "machete", "mini-eagle"] }), p = player(w, -1, { x: 200, y: 900 });
    const duplicate = floorItem(90, "weapon", "machete");
    w.pickups.push(duplicate);
    run(w, 1, () => hold(p.id, Btn.PICKUP));
    expect(duplicate.availableAt).toBe(0);
    expect(w.events.some((e) => e.t === "pickup")).toBe(false);
    expect(p.slots.map((slot) => slot?.weapon)).toEqual(["riot-shield", "machete", "mini-eagle"]);
    w.pickups.push(floorItem(91, "weapon", "uzi", 220));
    run(w, 1); run(w, 1, () => hold(p.id, Btn.PICKUP));
    expect(p.slots[p.active]?.weapon).toBe("uzi");
    expect(duplicate.availableAt).toBe(0);
  });

  it("machete is one hit at doubled health and low damage, but team safety and spawn protection still apply", () => {
    const w = world({ mode: "tdm", health: 2, damage: .5, loadout: ["machete", "riot-shield", null] });
    const a = player(w, 0, { x: 200, y: 900 }), enemy = player(w, 1, { x: 245, y: 900 });
    const teammate = player(w, 0, { x: 250, y: 900 }), protectedEnemy = player(w, 1, { x: 255, y: 900 });
    protectedEnemy.protectUntil = 100;
    run(w, 1, () => hold(a.id, Btn.FIRE));
    expect(enemy.alive).toBe(false); expect(a.kills).toBe(1);
    expect(teammate.hp).toBe(200); expect(protectedEnemy.hp).toBe(200);
    expect(w.events.find((e) => e.t === "kill")).toMatchObject({ killer: a.id, attacker: a.id, victim: enemy.id, w: "machete" });
  });

  it("ordinary unarmed melee retains normal damage", () => {
    const { w, a, b } = duel();
    run(w, 1, () => hold(a.id, Btn.MELEE));
    expect(b.hp).toBe(100);
    a.x = 360; run(w, 36); run(w, 1, () => hold(a.id, Btn.MELEE));
    expect(b.hp).toBe(60);
  });
});

describe("grenade collection and distinct stacks", () => {
  it("auto-collects actual grenade types into the two free default spaces without a pickup key", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    expect(p.throwables).toEqual({ frag: 2, flash: 1, gas: 1 });
    w.pickups.push(floorItem(90, "throwable", "flash"), floorItem(91, "throwable", "gas"), floorItem(92, "throwable", "frag"));
    run(w, 1);
    expect(p.throwables).toEqual({ frag: 2, flash: 2, gas: 2 });
    expect(w.pickups.find((pk) => pk.id === 92)!.availableAt).toBe(0);
    expect(w.events.filter((e) => e.t === "pickup").map((e) => e.item)).toEqual(["flash", "gas"]);
    expect(snapshot(w, []).players[0].throwables).toEqual(p.throwables);
  });

  it("cycles to flash then gas and throws their actual effects, automatically skipping exhausted stacks", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    run(w, 1, () => hold(p.id, Btn.NEXT_THROWABLE));
    expect(p.throwable).toBe("flash");
    run(w, 1, () => hold(p.id, Btn.THROW, -Math.PI / 2));
    expect(w.projectiles[0].kind).toBe("flash"); expect(p.throwables.flash).toBe(0); expect(p.throwable).toBe("gas");
    run(w, 24); run(w, 1, () => hold(p.id, Btn.THROW, -Math.PI / 2));
    expect(w.projectiles.some((pr) => pr.kind === "gas")).toBe(true);
    expect(p.throwables.gas).toBe(0); expect(p.throwables.frag).toBe(2); expect(p.throwable).toBe("frag");
  });

  it("cannot collect grenades through a solid divider", () => {
    const w = world(), p = player(w, -1, { x: 200, y: 900 });
    w.map = { ...w.map, solids: [...w.map.solids, { x: 215, y: 840, w: 3, h: 60 }] };
    w.pickups.push(floorItem(90, "throwable", "flash", 230));
    run(w, 1);
    expect(p.throwables.flash).toBe(1); expect(w.pickups[0].availableAt).toBe(0);
  });
});

describe("authored weapon range", () => {
  it.each(["smaw", "rg6", "saw-launcher"])("%s emits an authoritative launch event for its sound and muzzle feedback", (weapon) => {
    const { w, a } = duel(weapon);
    run(w, Math.max(1, Math.round((WEAPONS[weapon].chargeMs ?? 0) / 1000 * 60)), () => hold(a.id, Btn.FIRE, -Math.PI / 2));
    expect(w.events.find((e) => e.t === "shot" && e.w === weapon)).toMatchObject({ by: a.id, hit: false });
    expect(w.projectiles.some((pr) => pr.weapon === weapon)).toBe(true);
  });
  function openShot(distance: number, head = false) {
    const { w, a, b } = duel();
    w.map = { ...w.map, width: 4000, solids: [{ x: 0, y: 900, w: 4000, h: 100 }], platforms: [] };
    a.x = 100; b.x = a.x + distance; b.slots = [freshSlot("mini-eagle"), null, null];
    const m = muzzleOf(a);
    run(w, 1, () => hold(a.id, Btn.FIRE, head ? Math.atan2(b.y - 39 - m.y, b.x - m.x) : 0));
    return { w, a, b };
  }
  it("Classic PC retains full chest damage through maximum range and stops beyond it", () => {
    expect(openShot(300).b.hp).toBe(40);
    const distant = openShot(WEAPONS.m93ba.range - 20);
    expect(distant.b.hp).toBe(40);
    expect(openShot(WEAPONS.m93ba.range + 30).b.hp).toBe(100);
  });
  it("an exposed headshot remains proportional to configured health", () => {
    const { w, a, b } = duel();
    b.hp = b.maxHp = 200; b.slots = [freshSlot("mini-eagle"), null, null];
    const m = muzzleOf(a);
    run(w, 1, () => hold(a.id, Btn.FIRE, Math.atan2(b.y - 39 - m.y, b.x - m.x)));
    expect(b.hp).toBe(80); expect(b.alive).toBe(true);
  });
  it("weapon projectiles stop at remaining traveled range even with unusually high velocity", () => {
    const w = world(), owner = player(w, -1, { x: 100, y: 900 });
    w.projectiles.push({ id: 99, kind: "smaw", weapon: "smaw", owner: owner.id, x: 500, y: 500,
      vx: 50000, vy: 0, traveled: WEAPONS.smaw.range - 10, explodeTick: 100 });
    run(w, 1);
    expect(w.projectiles).toHaveLength(0);
    expect(w.events.find((e) => e.t === "explode")).toMatchObject({ x: 510, y: 500 });
  });
});

describe("bot inventory selection", () => {
  it("selects the loaded third gun directly across an empty intermediate slot", () => {
    const w = world({ mode: "ffa" }), p = player(w, -1, { x: 200, y: 900 });
    player(w, -1, { x: 500, y: 900 });
    p.slots = [{ ...freshSlot("mini-eagle"), mag: 0, reserve: 0 }, { ...freshSlot("uzi"), mag: 0, reserve: 0 }, freshSlot("magnum")];
    const bot = new Bot(p.id, "hard"), frame = bot.think(w);
    expect(frame.b & Btn.SLOT3).toBe(Btn.SLOT3); expect(frame.b & Btn.SWITCH).toBe(0);
    stepWorld(w, new Map([[p.id, frame]]));
    expect(p.active).toBe(2);
    run(w, 35, () => new Map([[p.id, bot.think(w)]]));
    expect(p.weaponStats.magnum.shots).toBeGreaterThan(0);
  });
  it("switches from equipment to a ranged gun for a distant target", () => {
    const w = world({ mode: "ffa", loadout: ["riot-shield", "machete", "mini-eagle"] }), p = player(w, -1, { x: 200, y: 900 });
    player(w, -1, { x: 500, y: 900 });
    const bot = new Bot(p.id, "hard");
    stepWorld(w, new Map([[p.id, bot.think(w)]]));
    expect(p.active).toBe(2); expect(p.slots[0]).toBeNull(); expect(p.slots[1]?.weapon).toBe("machete");
  });
  it("keeps its shield and uses its paired blade when the target is already close", () => {
    const w = world({ mode: "ffa", loadout: ["riot-shield", "machete", "mini-eagle"] }), p = player(w, -1, { x: 200, y: 900 });
    const target = player(w, -1, { x: 240, y: 900 }), bot = new Bot(p.id, "hard");
    run(w, 32, () => new Map([[p.id, bot.think(w)]]));
    expect(target.alive).toBe(false); expect(p.slots[0]?.weapon).toBe("riot-shield"); expect(p.active).toBe(0);
  });
});
