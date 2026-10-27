import { describe, expect, it } from "vitest";
import { rayRect } from "../src/shared/physics.ts";
import { rayShield, shieldBox, shieldPanel } from "../src/shared/combat-geometry.ts";
import { freshSlot, stepWorld, type Player, type Projectile, type World } from "../src/shared/sim.ts";
import { SAW_RADIUS } from "../src/shared/constants.ts";
import { Btn, type Rect, type RoomSettings } from "../src/shared/types.ts";
import { player, run, world } from "./helpers.ts";

function arena(settings: Partial<RoomSettings> = {}, solids: Rect[] = []): World {
  const w = world({ mode: "ffa", ...settings });
  w.map = { ...w.map, physics: "space", solids, platforms: [] };
  return w;
}
function shield(p: Player, angle: number): void {
  p.slots = [freshSlot("riot-shield"), freshSlot("machete"), null];
  p.active = 0; p.dual = true; p.aim = angle;
}
function duel(angle: number, defended = true) {
  const w = arena(), b = player(w, -1, { x: 700, y: 522 });
  const a = player(w, -1, { x: 700 + Math.cos(angle) * 300, y: 500 + Math.sin(angle) * 300 + 44 * .68 });
  a.slots = [freshSlot("m93ba"), null, null];
  shield(b, defended ? angle : angle + Math.PI);
  return { w, a, b, aim: angle + Math.PI };
}
function shot(w: World, a: Player, aim: number, view?: number): void {
  stepWorld(w, new Map([[a.id, { seq: w.tick + 1, b: Btn.FIRE, aim, ...(view === undefined ? {} : { view }) }]]));
}
function projectile(w: World, kind: string, patch: Partial<Projectile> = {}): Projectile {
  const p: Projectile = { id: w.nextId++, kind, owner: -1, x: 650, y: 502, vx: 0, vy: 0, explodeTick: w.tick + 1, ...patch };
  w.projectiles.push(p); return p;
}
function saw(w: World, patch: Partial<Projectile> = {}): Projectile {
  return projectile(w, "saw-launcher", { weapon: "saw-launcher", x: 485, y: 500, vx: 1200, vy: 0, radius: SAW_RADIUS,
    traveled: 0, bounces: 0, explodeTick: w.tick + 600, ...patch });
}

const ANGLES = [0, Math.PI / 4, Math.PI / 2, Math.PI * .75, Math.PI, -Math.PI * .75, -Math.PI / 2, -Math.PI / 4];
describe("shield coverage follows continuous aim", () => {
  it.each(ANGLES)("intercepts an incoming sniper at angle %s", (angle) => {
    const { w, a, b, aim } = duel(angle); shot(w, a, aim);
    expect(b.hp).toBe(100);
    expect(w.events.some(e => e.t === "shield" && e.id === b.id)).toBe(true);
  });
  it.each(ANGLES)("the same attack remains dangerous with the shield pointing away (%s)", (angle) => {
    const { w, a, b, aim } = duel(angle, false); shot(w, a, aim);
    expect(b.hp).toBeLessThan(100);
    expect(w.events.some(e => e.t === "shield" && e.id === b.id)).toBe(false);
  });
  it("does not mistake the empty corners of a rotated panel's bounds for armor", () => {
    const body = { x: 500, y: 500, w: 22, h: 44 }, panel = shieldPanel(body, Math.PI / 4);
    const c = Math.cos(panel.angle), s = Math.sin(panel.angle), offset = panel.depth / 2 + 2;
    const x = panel.x + c * offset + s * 50, y = panel.y + s * offset - c * 50;
    expect(rayRect(x, y, -s, c, shieldBox(body, panel.angle))).toBeLessThan(Infinity);
    expect(rayShield(x, y, -s, c, panel)).toBe(Infinity);
  });
  it("rewinds the upward shield along with the body, rather than using today's facing", () => {
    const { w, a, b, aim } = duel(-Math.PI / 2);
    run(w, 1); const historicalTick = w.tick; b.aim = 0;
    shot(w, a, aim, historicalTick);
    expect(b.hp).toBe(100);
    expect(w.events.some(e => e.t === "shield" && e.id === b.id)).toBe(true);
  });
  it("does not retroactively add a newly raised upward shield to historical shots", () => {
    const { w, a, b, aim } = duel(-Math.PI / 2, false);
    run(w, 1); const historicalTick = w.tick; b.aim = -Math.PI / 2;
    shot(w, a, aim, historicalTick);
    expect(b.alive).toBe(false);
  });
});

describe("sniper head and body balance", () => {
  it("deals 60 to the body and needs a second shot at default health", () => {
    const w = arena(), a = player(w, -1, { x: 200, y: 522 }), b = player(w, -1, { x: 500, y: 522 });
    a.slots = [freshSlot("m93ba"), null, null]; shot(w, a, 0);
    expect(b.hp).toBe(40); expect(b.alive).toBe(true);
    run(w, 75); shot(w, a, 0);
    expect(b.alive).toBe(false); expect(a.kills).toBe(1);
  });
  it.each([{ health: 1 as const, damage: 1 as const, remaining: 0 },
    { health: 2 as const, damage: 1 as const, remaining: 80 },
    { health: 1 as const, damage: .5 as const, remaining: 40 }])("headshots respect room multipliers (%j)", ({health, damage, remaining}) => {
    const w = arena({ health, damage }), a = player(w, -1, { x: 200, y: 482 + 44 * .68 }), b = player(w, -1, { x: 500, y: 522 });
    a.slots = [freshSlot("m93ba"), null, null]; shot(w, a, 0);
    expect(b.hp).toBe(remaining);
  });
});

describe("explosions use impact, distance, cover and team rules", () => {
  it.each([0, Math.PI, Math.PI / 2, -Math.PI / 2])("a direct rocket defeats a shield without double damage (%s)", angle => {
    const w = arena({ health: 2 }), target = player(w, -1, {x:700,y:522}); shield(target,angle);
    projectile(w,"smaw",{weapon:"smaw", x:600,y:500,vx:6000,explodeTick:600}); run(w,1);
    expect(target.hp).toBe(40);
    expect(w.events.filter(e => e.t === "explode")).toHaveLength(1);
    expect(w.projectiles).toHaveLength(0);
  });
  it("a direct rocket kills a crouched shield user at standard health", () => {
    const w = world({mode:"ffa"}), target = player(w,-1,{x:700,y:900}); shield(target,Math.PI);
    projectile(w,"smaw",{weapon:"smaw",x:600,y:885,vx:6000,explodeTick:600});
    stepWorld(w,new Map([[target.id,{seq:1,b:Btn.CROUCH,aim:Math.PI}]]));
    expect(target.alive).toBe(false);
  });
  it("a point-blank frag is lethal, while several nearby victims independently receive falloff", () => {
    const w=arena({health:2});
    const core=player(w,-1,{x:650,y:522}), near=player(w,-1,{x:690,y:522}), far=player(w,-1,{x:760,y:522}), outside=player(w,-1,{x:810,y:522});
    projectile(w,"frag"); run(w,1);
    expect(core.hp).toBeCloseTo(30,5);
    expect(near.hp).toBeGreaterThan(core.hp); expect(far.hp).toBeGreaterThan(near.hp);
    expect(far.hp).toBeLessThan(200); expect(outside.hp).toBe(200);
  });
  it("facing the blast attenuates every covered sample to 35%, while facing away does not", () => {
    const damage=(angle:number) => {
      const w=arena({health:2}), p=player(w,-1,{x:700,y:522}); shield(p,angle);
      projectile(w,"frag"); run(w,1); return 200-p.hp;
    };
    const exposed=damage(0), covered=damage(Math.PI);
    expect(exposed).toBeGreaterThan(100); expect(covered).toBeGreaterThan(0);
    expect(covered/exposed).toBeCloseTo(.35,5);
  });
  it("solid cover blocks a blast, while an exposed upper body takes partial damage", () => {
    const damage=(solids:Rect[]) => {
      const w=arena({health:2},solids), p=player(w,-1,{x:700,y:522}); projectile(w,"frag");run(w,1);return 200-p.hp;
    };
    expect(damage([{x:670,y:450,w:8,h:100}])).toBe(0);
    const open=damage([]), partial=damage([{x:670,y:499,w:8,h:60}]);
    expect(partial).toBeGreaterThan(0); expect(partial).toBeLessThan(open);
  });
  it("a rocket striking stone splashes nearby exposed bodies by distance and shield facing", () => {
    const scenario=(covered:boolean) => {
      const w=arena({health:2},[{x:650,y:400,w:10,h:200}]);
      const near=player(w,-1,{x:620,y:480}),far=player(w,-1,{x:540,y:480}),behind=player(w,-1,{x:690,y:480});
      if(covered)shield(near,Math.atan2(40,30));
      projectile(w,"smaw",{weapon:"smaw",x:550,y:500,vx:6000,explodeTick:600});run(w,1);
      expect(w.events.filter(e=>e.t==="explode")).toHaveLength(1);expect(w.projectiles).toHaveLength(0);
      expect(behind.hp).toBe(200);return {near:near.hp,far:far.hp};
    };
    const open=scenario(false),covered=scenario(true);
    expect(open.near).toBeLessThan(open.far);expect(open.far).toBeLessThan(200);
    expect(covered.near).toBeGreaterThan(open.near);expect(covered.near).toBeLessThan(200);
  });
  it("grounded crouch reduces close blast damage without granting invulnerability", () => {
    const damage=(crouch:boolean) => {
      const w=world({mode:"ffa",health:2}), p=player(w,-1,{x:700,y:900});
      projectile(w,"frag",{x:700,y:886});
      stepWorld(w,new Map([[p.id,{seq:1,b:crouch?Btn.CROUCH:0,aim:0}]])); return 200-p.hp;
    };
    expect(damage(true)/damage(false)).toBeCloseTo(.65,5);
  });
  it.each([false,true])("self harm and enemy splash preserve friendly fire=%s", friendlyFire => {
    const w=arena({mode:"tdm",health:2,friendlyFire});
    const owner=player(w,0,{x:690,y:522}), ally=player(w,0,{x:700,y:522}), enemy=player(w,1,{x:720,y:522}), protectedEnemy=player(w,1,{x:680,y:522});
    protectedEnemy.protectUntil=100;
    projectile(w,"frag",{owner:owner.id});run(w,1);
    expect(owner.hp).toBeLessThan(200);expect(enemy.hp).toBeLessThan(200);expect(protectedEnemy.hp).toBe(200);
    expect(protectedEnemy.vx).toBe(0);expect(protectedEnemy.vy).toBe(0);
    if(friendlyFire)expect(ally.hp).toBeLessThan(200);
    else {expect(ally.hp).toBe(200);expect(ally.vx).toBe(0);expect(ally.vy).toBe(0);}
  });
});

describe("saw swept contacts and rebound danger", () => {
  it("reflects a wall normal, preserves tangent velocity and spends the remaining tick moving", () => {
    const w=arena({},[{x:500,y:0,w:1,h:1000}]), p=saw(w,{vx:600,vy:300});run(w,1);
    expect(p.vx).toBe(-600);expect(p.vy).toBe(300);expect(p.x).toBeCloseTo(485,0);expect(p.y).toBeCloseTo(505,1);
    expect(p.bounces).toBe(1);expect(Math.hypot(p.vx,p.vy)).toBeCloseTo(Math.hypot(600,300),8);
  });
  it("reflects off a ceiling with its radius rather than passing through it", () => {
    const w=arena({},[{x:0,y:400,w:1000,h:1}]),p=saw(w,{x:490,y:420,vx:300,vy:-600});run(w,1);
    expect(p.vx).toBe(300);expect(p.vy).toBe(600);expect(p.y).toBeGreaterThan(411);expect(p.bounces).toBe(1);
  });
  it("handles a simultaneous corner normal without gaining energy or getting stuck", () => {
    const w=arena({},[{x:500,y:500,w:100,h:100}]),p=saw(w,{x:480,y:480,vx:1200,vy:1200});run(w,1);
    expect(p.vx).toBeCloseTo(-1200,8);expect(p.vy).toBeCloseTo(-1200,8);
    expect(p.x).toBeLessThan(490);expect(p.y).toBeLessThan(490);expect(p.bounces).toBe(1);
  });
  it("can hit an actor behind the launch point in the same tick as a wall bounce", () => {
    const w=arena({},[{x:500,y:0,w:1,h:1000}]),target=player(w,-1,{x:460,y:522});
    const p=saw(w,{vx:2400});run(w,1);
    expect(target.hp).toBe(35);expect(p.hitIds).toContain(target.id);expect(p.bounces).toBe(1);
  });
  it("a returning blade can hit its owner after bouncing", () => {
    const w=arena({},[{x:500,y:0,w:1,h:1000}]),owner=player(w,-1,{x:450,y:522});
    const p=saw(w,{owner:owner.id});run(w,3);
    expect(owner.hp).toBe(35);expect(p.hitIds).toContain(owner.id);
  });
  it("pierces several people once each and does not repeat a hit during overlap", () => {
    const w=arena({health:2}), a=player(w,-1,{x:300,y:522}),b=player(w,-1,{x:350,y:522});
    const p=saw(w,{x:270,vx:600});run(w,10);
    expect(a.hp).toBe(135);expect(b.hp).toBe(135);expect(p.hitIds).toEqual([a.id,b.id]);
  });
  it("an angled shield redirects a disc along its surface normal", () => {
    const w=arena(),target=player(w,-1,{x:500,y:522});shield(target,Math.PI/4);
    const p=saw(w,{x:550,y:518.5,vx:-2400});run(w,1);
    expect(target.hp).toBe(100);expect(p.bounces).toBe(1);
    expect(Math.abs(p.vx)).toBeLessThan(.001);expect(p.vy).toBeCloseTo(2400,6);
    expect(w.events.some(e=>e.t==="shield"&&e.id===target.id)).toBe(true);
  });
  it.each([{y:469,hp:35},{y:467,hp:100}])("uses the blade radius at a grazing body path (%j)", ({y,hp}) => {
    const w=arena(),target=player(w,-1,{x:500,y:522});saw(w,{x:400,y,vx:6000});run(w,1);
    expect(target.hp).toBe(hp);
  });
  it("a narrow corridor terminates after four bounces with one explosion", () => {
    const w=arena({},[{x:500,y:0,w:1,h:1000},{x:530,y:0,w:1,h:1000}]);
    saw(w,{x:515,vx:10000});run(w,1);
    expect(w.projectiles).toHaveLength(0);expect(w.events.filter(e=>e.t==="explode")).toHaveLength(1);
  });
  it("expiry produces one terminal explosion and no retained projectile", () => {
    const w=arena();saw(w,{explodeTick:1});run(w,2);
    expect(w.projectiles).toHaveLength(0);expect(w.events.filter(e=>e.t==="explode")).toHaveLength(1);
  });
});
it("immune blast contacts do not postpone regeneration just because a shield is held", () => {
  const w=arena({mode:"tdm",health:2,friendlyFire:false});
  const owner=player(w,0,{x:610,y:522}), ally=player(w,0,{x:700,y:522}), protectedEnemy=player(w,1,{x:710,y:522});
  shield(ally,Math.PI); shield(protectedEnemy,Math.PI); protectedEnemy.protectUntil=100;
  ally.regenAt=200; protectedEnemy.regenAt=200;
  projectile(w,"frag",{owner:owner.id}); run(w,1);
  expect(ally.regenAt).toBe(200); expect(protectedEnemy.regenAt).toBe(200);
  expect(w.events.filter(e=>e.t==="shield")).toHaveLength(0);
});
