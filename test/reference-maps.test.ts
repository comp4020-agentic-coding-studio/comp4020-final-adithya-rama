import { describe,it,expect } from "vitest";
import { Bot } from "../src/server/bot.ts";
import { REFERENCE_MAPS, REFERENCE_MAP_IDS } from "../src/shared/reference-maps.ts";
import { boxOf, overlaps, pointInSolid } from "../src/shared/physics.ts";
import { defaultSettings,sanitizeSettings } from "../src/shared/settings.ts";
import { createWorld,stepWorld } from "../src/shared/sim.ts";
import { Btn } from "../src/shared/types.ts";
import { hold,player } from "./helpers.ts";

describe("reference map topology and navigation",()=>{
  it.each(REFERENCE_MAP_IDS)("%s keeps finite bounded collision, clear navigation and no universal basement",id=>{
    const map=REFERENCE_MAPS[id];
    expect(map.solids.length).toBeLessThanOrEqual(400);
    expect(map.solids.every(r=>[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0)).toBe(true);
    expect(map.solids.some(r=>r.w>map.width*.95&&r.y>map.height*.7)).toBe(false);
    expect(map.navNodes.length).toBeGreaterThan(20);
    for(const n of map.navNodes)expect(map.solids.some(s=>overlaps({x:n.x-11,y:n.y-44,w:22,h:44},s)),id+" embedded node "+JSON.stringify(n)).toBe(false);
    for(const b of map.concealment??[]){
      expect(map.solids.some(s=>overlaps(b,s)),id+" bush intersects a wall").toBe(false);
      expect(map.solids.some(s=>s.y===b.y+b.h&&b.x+b.w/2>=s.x&&b.x+b.w/2<=s.x+s.w)).toBe(true);
    }
  });
  it("preserves the reference's recognizable open rooms, hollow islands and central passages",()=>{
    for(const [id,points]of Object.entries({
      outpost:[[1000,890],[410,300],[2870,650]],
      "high-tower":[[300,740],[2100,740],[1200,1100]],
      "ice-box":[[490,360],[2650,360],[1850,900]],
      pyramid:[[1780,740],[1800,1240],[1800,1480]],
      lunarcy:[[1440,810],[2610,720],[860,1270]],
      catacombs:[[1530,940],[770,650],[2300,650],[1750,1100]],
    }))for(const [x,y]of points)expect(pointInSolid(REFERENCE_MAPS[id],x,y),id+" intended passage "+x+","+y).toBe(false);
  });
  for(const id of REFERENCE_MAP_IDS)for(const flight of id==="lunarcy"?[false]:[false,true]){
    it(id+" bots deliver both flags with flight="+flight,()=>{
      for(const team of [0,1]as const){
        const w=createWorld(sanitizeSettings({...defaultSettings(),map:id,mode:"flag",flight,gravity:2,moveSpeed:.5,mapPickups:false,bots:0,timeLimitSec:600}),42);
        const p=player(w,team,w.map.spawns.find(s=>s.team===team)!);
        const bot=new Bot(p.id,"normal");
        for(let i=0;i<7000&&p.deliveries===0;i++)stepWorld(w,new Map([[p.id,bot.think(w)]]));
        expect(p.deliveries,id+" team "+team+" stopped at "+p.x+","+p.y+" route "+JSON.stringify((bot as unknown as {route:unknown}).route)).toBeGreaterThan(0);
        expect(w.map.solids.some(s=>overlaps(boxOf(p),s))).toBe(false);
      }
    });
  }
  it.each(REFERENCE_MAP_IDS)("%s bots can reach its highest weapon pickup using normal limited fuel",id=>{
    const map=REFERENCE_MAPS[id];
    const target=map.pickups.filter(p=>p.kind==="weapon").sort((a,b)=>a.y-b.y)[0];
    const w=createWorld(sanitizeSettings({...defaultSettings(),map:id,mode:"flag",flight:true,unlimitedFuel:false,mapPickups:false,bots:0,timeLimitSec:600}),42);
    const p=player(w,0,w.map.spawns.find(s=>s.team===0)!);
    // Place this fixture's objective at the actual item anchor to measure
    // physical arrival through the same contact radius as a map pickup.
    Object.assign(w.flags[0],{x:target.x,y:target.y});
    const bot=new Bot(p.id,"normal");
    for(let tick=0;tick<3600&&w.flags[0].carrier!==p.id;tick++)stepWorld(w,new Map([[p.id,bot.think(w)]]));
    expect(w.flags[0].carrier,id+" highest pickup "+target.x+","+target.y+" was unreachable from "+p.x+","+p.y).toBe(p.id);
    expect(w.map.solids.some(s=>overlaps(boxOf(p),s))).toBe(false);
  });
  it("bots cannot track a distant crouched opponent through supported foliage",()=>{
    const w=createWorld(sanitizeSettings({...defaultSettings(),map:"high-tower",mode:"tdm",mapPickups:false}));
    const bush=w.map.concealment![0],target=player(w,0,{x:bush.x+bush.w/2,y:bush.y+bush.h});
    const me=player(w,1,{x:target.x+300,y:target.y});target.crouch=true;target.onGround=true;w.tick=200;
    const bot=new Bot(me.id,"hard");
    const visible=()=> (bot as unknown as {pickTarget:(world:typeof w,p:typeof me)=>unknown}).pickTarget(w,me);
    expect(visible()).toBe(null);
    target.revealUntil=260;expect(visible()).toBe(target);
    target.revealUntil=0;target.crouch=false;expect(visible()).toBe(target);
  });
  it("Catacombs includes a genuine crouch passage that cannot be stood through",()=>{
    const w=createWorld(sanitizeSettings({...defaultSettings(),map:"catacombs",mode:"training",flight:false,mapPickups:false}));
    const p=player(w,-1,{x:600,y:940});
    for(let i=0;i<30;i++)stepWorld(w,hold(p.id,Btn.RIGHT));
    expect(p.x).toBeLessThan(630);
    for(let i=0;i<150;i++)stepWorld(w,hold(p.id,Btn.RIGHT|Btn.CROUCH));
    expect(p.x).toBeGreaterThan(800);
    expect(w.map.solids.some(s=>overlaps(boxOf(p),s))).toBe(false);
  });
});
