import { describe, expect, it } from "vitest";
import { applyDamage, freshSlot, respawn } from "../src/shared/sim.ts";
import { Btn } from "../src/shared/types.ts";
import { hold, player, run, world } from "./helpers.ts";

describe("headshot-focused dedicated sniper and universal poison hazard",()=>{
  it.each([.5,1,2] as const)("sniper respects the room damage multiplier %s",damage=>{
    const w=world({mode:"ffa",damage}),a=player(w,-1,{x:200,y:900}),b=player(w,-1,{x:500,y:900});
    a.slots=[freshSlot("m93ba"),null,null];
    run(w,1,()=>hold(a.id,Btn.FIRE));
    expect(b.hp).toBe(Math.max(0,100-60*damage));
    expect(a.slots[0]!.mag).toBe(4);
    expect(a.kills).toBe(damage>=2?1:0);
  });
  it.each([false,true])("poison damages owner, ally and enemy with friendly fire %s",friendlyFire=>{
    const w=world({mode:"tdm",friendlyFire});
    const owner=player(w,0,{x:300,y:900}),ally=player(w,0,{x:340,y:900}),enemy=player(w,1,{x:380,y:900});
    w.projectiles.push({id:99,kind:"gas",owner:owner.id,x:340,y:878,vx:0,vy:0,explodeTick:1});
    run(w,1);
    for(const p of [owner,ally,enemy])expect(p.hp).toBe(94);
    run(w,24);
    for(const p of [owner,ally,enemy])expect(p.hp).toBe(82);
    expect(applyDamage(w,ally,owner.id,10,"mini-eagle")).toBe(friendlyFire?10:0);
  });
  it("self/team poison deaths grant no kills; enemy poison death does",()=>{
    const w=world({mode:"tdm",friendlyFire:false});
    const owner=player(w,0,{x:300,y:900}),ally=player(w,0,{x:340,y:900}),enemy=player(w,1,{x:380,y:900});
    for(const p of [owner,ally,enemy])p.hp=5;
    w.areas.push({id:99,owner:owner.id,x:340,y:878,radius:135,until:100,nextDamageTick:0});
    run(w,1);
    for(const p of [owner,ally,enemy]){expect(p.alive).toBe(false);expect(p.deaths).toBe(1);}
    expect(owner.kills).toBe(1);expect(w.teamScores).toEqual([1,0]);
  });
  it("protection, solid cover, leaving and expiration still stop poison damage",()=>{
    const w=world({mode:"tdm"}),owner=player(w,0,{x:900,y:900}),covered=player(w,0,{x:1060,y:900});
    owner.protectUntil=20;
    w.areas.push({id:99,owner:owner.id,x:950,y:878,radius:135,until:30,nextDamageTick:0});
    run(w,25);expect(owner.hp).toBe(94);expect(covered.hp).toBe(100);
    owner.x=600;run(w,40);expect(owner.hp).toBe(94);expect(w.areas).toHaveLength(0);
  });
  it.each(["cloud","grenade"] as const)("spawn safety avoids a teammate's poison %s",kind=>{
    const w=world({mode:"tdm",randomSpawns:false});
    w.map={...w.map,platforms:[],solids:[{x:0,y:900,w:2000,h:100}],
      spawns:[{x:300,y:900,team:0},{x:1700,y:900,team:0}]};
    const owner=player(w,0,{x:900,y:900}),p=player(w,0);
    if(kind==="cloud")w.areas.push({id:99,owner:owner.id,x:300,y:878,radius:135,until:100,nextDamageTick:0});
    else w.projectiles.push({id:99,owner:owner.id,kind:"gas",x:300,y:878,vx:0,vy:0,explodeTick:60});
    for(let i=0;i<5;i++){respawn(w,p);expect(p.x).toBe(1700);}
  });
});
