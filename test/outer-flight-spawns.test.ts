import { describe, expect, it } from "vitest";
import { PLAYER_H, PLAYER_W } from "../src/shared/constants.ts";
import { MAPS } from "../src/shared/maps.ts";
import { boxOf, isFallingBelowMap, playerTravelBounds, stepMovement } from "../src/shared/physics.ts";
import { defaultSettings, sanitizeSettings } from "../src/shared/settings.ts";
import { applyDamage, freshSlot, respawn } from "../src/shared/sim.ts";
import { Btn } from "../src/shared/types.ts";
import { FLAT, hold, player, run, world } from "./helpers.ts";

describe("outer flight envelope", () => {
  it.each([["left",-700,500],["right",2700,500],["above",500,-700],["below",-300,1600]] as const)
  ("powered flight remains alive %s of terrain", (_side,x,y) => {
    const w=world({mode:"ffa",unlimitedFuel:true}),p=player(w,-1,{x,y});
    run(w,60,()=>hold(p.id,Btn.JET));
    expect(p.alive).toBe(true); expect(p.hp).toBe(100); expect(p.jetting).toBe(true);
    expect(p.fallExposureTicks).toBe(0);
  });
  it("contains the whole body, allows inward recovery and shares prediction deterministically",()=>{
    const s={...defaultSettings(),unlimitedFuel:true},map={...FLAT,solids:[],platforms:[]};
    const w=world(),a=player(w,-1,{x:-500,y:-500}),b={...a};
    for(let i=0;i<600;i++){stepMovement(a,Btn.LEFT|Btn.JET,map,s);stepMovement(b,Btn.LEFT|Btn.JET,map,s);}
    const bounds=playerTravelBounds(map);
    expect(boxOf(a)).toEqual(boxOf(b));expect(a.x).toBe(bounds.x+PLAYER_W/2);expect(a.y).toBe(bounds.y+PLAYER_H);
    expect(a.vx).toBe(0);expect(a.vy).toBe(0);
    stepMovement(a,Btn.RIGHT,map,s);expect(a.x).toBeGreaterThan(b.x);expect(a.y).toBeGreaterThan(b.y);
  });
  it.each([Btn.LEFT, Btn.RIGHT, Btn.JET, Btn.CROUCH])("bounds every space thrust direction %s without lethal edges", buttons => {
    const map={...FLAT,physics:"space" as const,solids:[],platforms:[]},s=defaultSettings(),w=world();
    const p=player(w,-1,{x:500,y:500});
    for(let i=0;i<1500;i++)stepMovement(p,buttons,map,s);
    const body=boxOf(p),bounds=playerTravelBounds(map);
    expect(body.x).toBeGreaterThanOrEqual(bounds.x);expect(body.x+body.w).toBeLessThanOrEqual(bounds.x+bounds.w);
    expect(body.y).toBeGreaterThanOrEqual(bounds.y);expect(body.y+body.h).toBeLessThanOrEqual(bounds.y+bounds.h);
    if(buttons===Btn.LEFT)expect(body.x).toBe(bounds.x);
    if(buttons===Btn.RIGHT)expect(body.x+body.w).toBe(bounds.x+bounds.w);
    if(buttons===Btn.JET)expect(body.y).toBe(bounds.y);
    if(buttons===Btn.CROUCH){expect(body.y+body.h).toBe(bounds.y+bounds.h);expect(p.onGround).toBe(false);}
  });
  it("uses grace then gradual environmental damage, overriding protection but never granting floor support",()=>{
    const w=world({mode:"ffa",respawnSec:10}),p=player(w,-1,{x:500,y:1500});p.protectUntil=99999;
    run(w,60);expect(p.hp).toBe(100);expect(p.alive).toBe(true);
    run(w,15);expect(p.hp).toBe(95);expect(p.alive).toBe(true);expect(p.onGround).toBe(false);
    expect(p.y).toBe(w.map.height+1000);
    run(w,285);expect(p.alive).toBe(false);expect(p.deaths).toBe(1);
    expect(w.events.find(e=>e.t==="kill")).toMatchObject({killer:null,attacker:null,w:"fall"});
  });
  it("does not award kills, assists or team score for environmental falling",()=>{
    const w=world({mode:"tdm",respawnSec:10}),p=player(w,0,{x:500,y:1500}),enemy=player(w,1);
    applyDamage(w,p,enemy.id,30,"mini-eagle");run(w,270);
    expect(p.alive).toBe(false);expect(enemy.kills).toBe(0);expect(enemy.assists).toBe(0);expect(w.teamScores).toEqual([0,0]);
  });
  it("suppresses regeneration and ignores an empty pack's held jet bit",()=>{
    const w=world({mode:"ffa",respawnSec:10}),p=player(w,-1,{x:500,y:1500});
    Object.assign(p,{hp:50,fuel:0,jetCooldown:999,regenAt:0});
    run(w,75,()=>hold(p.id,Btn.JET));expect(p.jetting).toBe(false);expect(p.hp).toBe(45);
    run(w,135,()=>hold(p.id,Btn.JET));expect(p.alive).toBe(false);
  });
  it("normal fuel exhaustion and intermittent fuel puffs cannot reset falling grace",()=>{
    const w=world({mode:"ffa",respawnSec:10}),p=player(w,-1,{x:-500,y:1800});
    Object.assign(p,{fuel:1,vy:850});
    for(let i=0;i<600&&p.alive;i++)run(w,1,()=>hold(p.id,Btn.JET));
    expect(p.alive).toBe(false);expect(p.fallExposureTicks).toBeGreaterThan(300);
  });
  it("restored thrust pauses exposure; returning to map height resets it",()=>{
    const w=world({mode:"ffa",unlimitedFuel:true}),p=player(w,-1,{x:-200,y:1400});
    Object.assign(p,{fallExposureTicks:74,hp:80,vy:200});
    run(w,1,()=>hold(p.id,Btn.JET));expect(p.hp).toBe(80);expect(p.fallExposureTicks).toBe(74);
    run(w,240,()=>hold(p.id,Btn.JET));expect(p.y).toBeLessThan(w.map.height);expect(p.fallExposureTicks).toBe(0);expect(p.alive).toBe(true);
  });
  it("EMP disables actual lift below the map and starts exposure",()=>{
    const w=world({mode:"ffa",unlimitedFuel:true}),p=player(w,-1,{x:-300,y:1500});p.empUntil=1000;
    run(w,75,()=>hold(p.id,Btn.JET));expect(p.jetting).toBe(false);expect(p.hp).toBe(95);
  });
  it("Lunarcy coasts outside terrain without gravity or fall damage, within finite boundaries",()=>{
    const w=world({mode:"ffa",map:"lunarcy",flight:false,unlimitedFuel:false}),map=MAPS.lunarcy;
    const p=player(w,-1,{x:-500,y:map.height+400});Object.assign(p,{vx:-80,vy:50,fuel:0,empUntil:1000});
    run(w,60);expect(p.x).toBeCloseTo(-580);expect(p.y).toBeCloseTo(map.height+450);
    expect(p.vx).toBe(-80);expect(p.vy).toBe(50);expect(p.hp).toBe(100);
    run(w,1000);expect(p.alive).toBe(true);expect(p.fallExposureTicks).toBe(0);
    const b=playerTravelBounds(map);expect(p.x).toBeGreaterThanOrEqual(b.x+PLAYER_W/2);expect(p.y).toBeLessThanOrEqual(b.y+b.h);
    expect(isFallingBelowMap(p,map)).toBe(false);
  });
  it.each(["left","right","top","bottom"] as const)("returns carried flags at the original %s edge while the pilot survives",side=>{
    const w=world({mode:"flag",unlimitedFuel:true}),p=player(w,0),flag=w.flags[0],generation=flag.generation;
    Object.assign(flag,{state:"carried",carrier:p.id});
    const pos={left:{x:-50,y:400},right:{x:w.map.width+50,y:400},top:{x:500,y:-50},bottom:{x:500,y:w.map.height+100}}[side];
    Object.assign(p,pos,{vx:0,vy:0});run(w,1,()=>hold(p.id,Btn.JET));
    expect(p.alive).toBe(true);expect(p.hp).toBe(100);expect(flag).toMatchObject({state:"home",carrier:null,generation});
    expect(flag.x).toBe(w.map.flagHomes[0].x);
  });
});
function spawnWorld(randomSpawns=true){
  const w=world({mode:"ffa",randomSpawns});
  w.map={...FLAT,solids:[FLAT.solids[0]],platforms:[],spawns:[{x:300,y:900,team:0},{x:1000,y:900,team:0},{x:1700,y:900,team:1}]};
  return w;
}
describe("safe spawn variety",()=>{
  it("defaults on, accepts booleans only and preserves disabled settings",()=>{
    expect(defaultSettings().randomSpawns).toBe(true);expect(sanitizeSettings({randomSpawns:false}).randomSpawns).toBe(false);
    const base={...defaultSettings(),randomSpawns:false};
    expect(sanitizeSettings({randomSpawns:"true"},base).randomSpawns).toBe(false);expect(sanitizeSettings({},base).randomSpawns).toBe(false);
    const legacy={...base};delete(legacy as Partial<typeof legacy>).randomSpawns;expect(sanitizeSettings({},legacy).randomSpawns).toBe(true);
  });
  it("varies equally safe points without immediate repeats and stays deterministic",()=>{
    const sequences=[0,1].map(()=>{const w=spawnWorld(),p=player(w),xs=[p.x];for(let i=0;i<20;i++){respawn(w,p);xs.push(p.x);}return xs;});
    expect(sequences[0]).toEqual(sequences[1]);expect(new Set(sequences[0]).size).toBe(3);
    for(let i=1;i<sequences[0].length;i++)expect(sequences[0][i]).not.toBe(sequences[0][i-1]);
  });
  it("disabled variety repeatedly chooses the clearly safest point",()=>{
    const w=spawnWorld(false),p=player(w),foe=player(w,-1,{x:100,y:900});foe.slots=[freshSlot("mini-eagle"),null,null];
    for(let i=0;i<20;i++){respawn(w,p);expect(p.x).toBe(1700);}
  });
  it.each(["gas","mine","rocket"] as const)("never trades the only safe previous point for a %s hazard",hazard=>{
    const w=spawnWorld(),p=player(w),foe=player(w,-1,{x:100,y:900});
    w.map.spawns=[{x:300,y:900,team:0},{x:1700,y:900,team:1}];p.lastSpawn={x:300,y:900};
    if(hazard==="gas")w.areas.push({id:99,owner:foe.id,x:1700,y:880,radius:140,until:10000,nextDamageTick:0});
    else w.projectiles.push({id:99,owner:foe.id,kind:hazard==="mine"?"mine":"smaw",x:hazard==="mine"?1700:1400,y:880,
      vx:hazard==="mine"?0:950,vy:0,weapon:hazard==="rocket"?"smaw":undefined,stuck:hazard==="mine",armedAt:0,explodeTick:10000});
    for(let i=0;i<20;i++){respawn(w,p);expect(p.x).toBe(300);}
  });
  it("keeps cover rather than forcing a repeated pilot into enemy sight",()=>{
    const w=spawnWorld(),p=player(w),foe=player(w,-1,{x:1000,y:900});
    w.map.solids.push({x:700,y:830,w:30,h:70});w.map.spawns=[{x:600,y:900,team:0},{x:1800,y:900,team:1}];
    foe.slots=[freshSlot("m93ba"),null,null];p.lastSpawn={x:600,y:900};
    for(let i=0;i<10;i++){respawn(w,p);expect(p.x).toBe(600);}
  });
  it("keeps team legality and rejects unsupported or buried alternatives",()=>{
    const w=spawnWorld();w.settings.mode="tdm";
    w.map.spawns.push({x:800,y:500,team:0},{x:1200,y:920,team:0});
    const p=player(w,0),foe=player(w,1);
    for(let i=0;i<10;i++){respawn(w,p);expect([300,1000]).toContain(p.x);expect(p.y).toBe(900);respawn(w,foe);expect(foe.x).toBe(1700);}
  });
  it.each(Object.values(MAPS).filter(map=>map.id!==FLAT.id))("keeps every authored map $id spawn clear and team-legal",map=>{
    const w=world({map:map.id,mode:"tdm",randomSpawns:true});
    for(const team of [0,1] as const){
      const p=player(w,team),legal=map.spawns.filter(sp=>sp.team===team);
      for(let i=0;i<8;i++){
        respawn(w,p);
        expect((legal.length?legal:map.spawns).some(sp=>sp.x===p.x&&sp.y===p.y)).toBe(true);
        const body=boxOf(p);
        expect(map.solids.some(r=>body.x<r.x+r.w&&body.x+body.w>r.x&&body.y<r.y+r.h&&body.y+body.h>r.y+.01)).toBe(false);
      }
    }
  });
  it("retains Training/TestRange human spawn sides",()=>{
    const w=world({mode:"training",map:"test-range"}),p=player(w);
    for(let i=0;i<10;i++){respawn(w,p);expect(w.map.spawns.some(sp=>(sp.team===0||sp.team===-1)&&sp.x===p.x&&sp.y===p.y)).toBe(true);}
  });
});
