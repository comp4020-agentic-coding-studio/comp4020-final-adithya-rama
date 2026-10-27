import {describe,it,expect} from "vitest";
import type {Graphics} from "pixi.js";
import {drawFlame,drawSaw,flameLobes,MAX_SAW_TRACKS,MAX_SAW_TRAIL,SawTrails} from "../src/client/combat-effects.ts";
import {explosionDebris,advanceDebris} from "../src/client/death.ts";
import type {ProjectileSnap} from "../src/shared/types.ts";
function graphics(){
  const calls:Array<{method:string;args:unknown[]}>=[];
  const g=new Proxy({}, {get:(_,method)=> (...args:unknown[])=>{calls.push({method:String(method),args});return g;}}) as Graphics;
  return {g,calls};
}
const saw=(patch:Partial<ProjectileSnap>={}):ProjectileSnap=>({id:1,k:"saw-launcher",x:100,y:200,vx:780,vy:0,armed:false,...patch});

describe("flamethrower presentation",()=>{
  it("keeps every flame lobe between the muzzle and authoritative impact at every direction",()=>{
    for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5])for(const reach of [2,30,190]) {
      const c=Math.cos(angle),s=Math.sin(angle);
      for(const p of flameLobes(20,30,20+c*reach,30+s*reach,.4)) {
        const along=(p.x-20)*c+(p.y-30)*s;
        expect(along-p.radius).toBeGreaterThanOrEqual(-.001);
        expect(along+p.radius).toBeLessThanOrEqual(reach+.001);
      }
    }
    expect(flameLobes(2,3,2,3,.5)).toEqual([]);
  });
  it("animates a widening turbulent plume with dimmer low-flash highlights",()=>{
    const first=flameLobes(0,0,190,0,0),later=flameLobes(0,0,190,0,.7);
    expect(first.at(-1)!.radius).toBeGreaterThan(first[0].radius);
    expect(later.map(p=>p.y)).not.toEqual(first.map(p=>p.y));
    const full=graphics(),reduced=graphics();
    drawFlame(full.g,0,0,190,0,.1,false);drawFlame(reduced.g,0,0,190,0,.1,true);
    const fills=(calls:typeof full.calls)=>calls.filter(c=>c.method==="fill").map(c=>c.args[0] as {color:number;alpha:number});
    expect(fills(reduced.calls)[0].alpha).toBeLessThan(fills(full.calls)[0].alpha);
    expect(fills(reduced.calls).map(f=>f.color)).not.toEqual(fills(full.calls).map(f=>f.color));
  });
});

describe("saw presentation follows authoritative motion",()=>{
  it("emits one impact on a velocity reflection, clears the old trail, and does not retrigger on repeated snapshots",()=>{
    const trails=new SawTrails();
    trails.update([saw()],0);trails.update([saw({x:140})],50);
    expect(trails.tracks.get(1)!.points).toHaveLength(1);
    expect(trails.update([saw({x:160,vx:-780})],100)).toEqual([{x:160,y:200}]);
    expect(trails.tracks.get(1)!.points).toHaveLength(0);
    expect(trails.update([saw({x:160,vx:-780})],110)).toEqual([]);
    trails.update([saw({x:120,vx:-780})],150);
    expect(trails.tracks.get(1)!.points).toEqual([{x:160,y:200}]);
  });
  it("bounds trails and drops invisible or expired projectiles rather than revealing their path",()=>{
    const trails=new SawTrails();
    for(let n=0;n<20;n++)trails.update([saw({x:100+n*10})],n*20);
    expect(trails.tracks.get(1)!.points).toHaveLength(MAX_SAW_TRAIL);
    trails.update([saw({x:400,vx:-780})],1000);
    expect(trails.tracks.get(1)!.points).toHaveLength(0);
    trails.update(Array.from({length:100},(_,i)=>saw({id:i})),1020);
    expect(trails.tracks.size).toBe(MAX_SAW_TRACKS);
    trails.update([],1040);expect(trails.tracks.size).toBe(0);
  });
  it("renders rotating teeth rather than a stationary disc and finite geometry in every flight direction",()=>{
    for(const [vx,vy]of [[780,0],[-780,0],[0,780],[0,-780],[550,-550]]) {
      const a=graphics(),b=graphics();drawSaw(a.g,saw({vx,vy}),10,[],false);drawSaw(b.g,saw({vx,vy}),80,[],true);
      expect(a.calls.find(c=>c.method==="poly")!.args).not.toEqual(b.calls.find(c=>c.method==="poly")!.args);
      expect(a.calls.flatMap(c=>c.args.flat(2)).filter(n=>typeof n==="number").every(Number.isFinite)).toBe(true);
    }
  });
});

describe("directional explosive breakup",()=>{
  const victim={id:1,x:200,y:200,vx:0,vy:0,height:44},colors={armor:0x335566,skin:0xccaa88,helmet:0x778899};
  it("throws fragments away from the blast and retains momentum from a flying victim",()=>{
    const left=explosionDebris(victim,colors,false,{x:100,y:180}),right=explosionDebris(victim,colors,false,{x:300,y:180});
    expect(left.every(p=>p.vx>0)).toBe(true);expect(right.every(p=>p.vx<0)).toBe(true);
    const moving=explosionDebris({...victim,vx:200},colors,false,{x:100,y:180});
    expect(moving[0].vx-left[0].vx).toBeCloseTo(50);
  });
  it("spreads limbs up and down immediately, and retains exterior-flight deaths beyond the terrain rectangle",()=>{
    const parts=explosionDebris(victim,colors,false);
    expect(parts.some(p=>p.vy>0)).toBe(true);expect(parts.some(p=>p.vy<0)).toBe(true);
    const outside=explosionDebris({...victim,x:-120},colors,false);
    expect(advanceDebris(outside,10,{width:1000,height:600,solids:[],platforms:[]})).not.toHaveLength(0);
  });
});