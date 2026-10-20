import {describe,it,expect} from "vitest";
import {OUT_OF_BOUNDS_MARGIN} from "../src/shared/constants.ts";
import {playerTravelBounds} from "../src/shared/physics.ts";
import {freshSlot} from "../src/shared/sim.ts";
import {Btn} from "../src/shared/types.ts";
import {hold,player,run,world} from "./helpers.ts";

describe("combat across the extended flight area",()=>{
  it.each(["m14","smaw","emp-gun"])("%s fired outside terrain travels and damages an exterior pilot",weapon=>{
    const w=world({map:"lunarcy",mode:"ffa"}),a=player(w,-1,{x:-800,y:1000}),b=player(w,-1,{x:-500,y:1000});
    a.slots=[freshSlot(weapon),null,null];
    run(w,1,()=>hold(a.id,Btn.FIRE,0));
    expect(w.projectiles.length).toBe(1);expect(w.projectiles[0].x).toBeLessThan(-OUT_OF_BOUNDS_MARGIN);expect(b.hp).toBe(100);
    run(w,40);
    expect(b.hp).toBeLessThan(100);expect(w.projectiles.length).toBe(0);
    if(weapon==="emp-gun")expect(b.empUntil).toBeGreaterThan(w.tick);
  });
  it.each([["frag",540,140],["gas",100,110]] as const)("%s thrown below the terrain reaches its normal fuse and effect", (kind,x,ticks)=>{
    const w=world({map:"lunarcy",mode:"ffa"}),a=player(w,-1,{x:-900,y:2000}),b=player(w,-1,{x,y:2000});
    a.throwable=kind;a.throwables[kind]=1;
    run(w,1,()=>hold(a.id,Btn.THROW,0));expect(w.projectiles.length).toBe(1);
    run(w,10);expect(w.projectiles.length).toBe(1);expect(w.projectiles[0].y).toBeGreaterThan(w.map.height+OUT_OF_BOUNDS_MARGIN);
    run(w,ticks-11);expect(b.hp).toBeLessThan(100);expect(w.projectiles.length).toBe(0);
    if(kind==="gas"){expect(w.areas.length).toBe(1);run(w,400);expect(w.areas.length).toBe(0);}
  });
  it("an outward rocket is culled beyond the enlarged bound before its ordinary range expires",()=>{
    const w=world({map:"lunarcy",mode:"ffa"}),a=player(w,-1,{x:-980,y:1000});
    a.slots=[freshSlot("smaw"),null,null];
    run(w,1,()=>hold(a.id,Btn.FIRE,Math.PI));expect(w.projectiles.length).toBe(1);
    const first=w.projectiles[0].x;expect(first).toBeLessThan(-OUT_OF_BOUNDS_MARGIN);
    run(w,8);expect(w.projectiles.length).toBe(1);expect(w.projectiles[0].x).toBeLessThan(-1000);
    expect(w.projectiles[0].x).toBeGreaterThan(playerTravelBounds(w.map).x-OUT_OF_BOUNDS_MARGIN);
    run(w,30);expect(w.projectiles.length).toBe(0);
    expect(w.events.filter(e=>e.t==="explode")).toHaveLength(0);
  });
  it.each(["left","right","top","bottom"] as const)("culls projectiles just beyond the extended %s cushion",side=>{
    const w=world({map:"lunarcy",mode:"ffa"}),a=player(w),b=playerTravelBounds(w.map),pad=OUT_OF_BOUNDS_MARGIN+1;
    const pos={left:{x:b.x-pad,y:500},right:{x:b.x+b.w+pad,y:500},top:{x:500,y:b.y-pad},bottom:{x:500,y:b.y+b.h+pad}}[side];
    w.projectiles.push({id:999,kind:"frag",owner:a.id,...pos,vx:0,vy:0,explodeTick:1000});
    run(w,1);expect(w.projectiles).toHaveLength(0);
  });
});
