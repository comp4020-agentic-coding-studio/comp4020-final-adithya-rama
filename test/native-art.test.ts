import {describe,it,expect} from "vitest";
import type {Graphics} from "pixi.js";
import {drawPilot,avatarOf,avatarSvg} from "../src/client/avatar-art.ts";
import {drawWeapon,weaponIcon} from "../src/client/weapon-art.ts";
import {drawConcealment,drawTerrain,drawBackdropLayer} from "../src/client/environment-art.ts";
import {WEAPONS} from "../src/shared/weapons.ts";
import type {MapDefinition} from "../src/shared/types.ts";
import {PLAYER_H,PLAYER_CROUCH_H} from "../src/shared/constants.ts";
import {advanceDebris,type DeathDebris} from "../src/client/death.ts";
import {motorCue} from "../src/client/audio.ts";

type Call={method:string;args:unknown[]};
function graphics(){
  const calls:Call[]=[];
  const g=new Proxy({}, {get:(_,method)=> (...args:unknown[])=>{calls.push({method:String(method),args});return g;}}) as Graphics;
  return {g,calls};
}
const map:MapDefinition={id:"fixture",name:"Fixture",width:500,height:300,theme:{sky:0xabcabc,rock:0x778899,platform:0x99bbbb,accent:0xddccaa},biome:"jungle",solids:[{x:0,y:200,w:500,h:100}],platforms:[],spawns:[],pickups:[],navNodes:[],flagHomes:[],goals:[],concealment:[{x:80,y:152,w:120,h:48}]};

describe("native combat presentation",()=>{
  it("keeps crouched body components above planted feet without a long vest protruding through the floor",()=>{
    for(const h of [PLAYER_H,PLAYER_CROUCH_H]) {
      const {g,calls}=graphics();
      drawPilot(g,{x:100,y:200,h,color:0x889966,avatar:avatarOf(null),aim:0,walk:0,airborne:false,jetting:false,alpha:1,recoil:0,weapon:null,otherWeapon:null,now:0,hit:false});
      for(const c of calls) {
        if(c.method==="roundRect")expect(Number(c.args[1])+Number(c.args[3])).toBeLessThanOrEqual(200);
        if(c.method==="ellipse")expect(Number(c.args[1])+Number(c.args[3])).toBeLessThanOrEqual(200);
      }
    }
  });
  it("draws every weapon at cardinal/diagonal angles with independent charge/reload state and finite geometry",()=>{
    const icons=new Set<string>();
    for(const id of Object.keys(WEAPONS)) {
      icons.add(weaponIcon(id));
      for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI/4]) {
        const {g,calls}=graphics();
        drawWeapon(g,id,100,150,angle,.9,1,{charge:.7,reload:.5,now:500});
        drawPilot(g,{x:100,y:200,h:PLAYER_CROUCH_H,color:0x889966,avatar:avatarOf(null),aim:angle,walk:0,airborne:false,jetting:false,alpha:1,recoil:0,weapon:id,otherWeapon:"mini-eagle",now:500,hit:false,charge:.7,reload:.5,otherCharge:0,otherReload:.2});
        const numbers=calls.flatMap(c=>c.args.flat(2)).filter(a=>typeof a==="number");
        expect(numbers.length).toBeGreaterThan(10);
        expect(numbers.every(Number.isFinite)).toBe(true);
      }
    }
    expect(icons.size).toBe(Object.keys(WEAPONS).length);
  });
  it("keeps invalid cosmetic input out of the profile SVG",()=>{
    const svg=avatarSvg(avatarOf({helmet:'<script>',face:'<img>',emblem:'onload'}),NaN);
    expect(svg).not.toContain("<script");expect(svg).not.toContain("<img");expect(svg).not.toContain("NaN");
  });
  it("renders authored foreground foliage only in terrestrial environments",()=>{
    const ground=graphics();drawConcealment(ground.g,map);
    expect(ground.calls.some(c=>c.method==="fill"&&typeof c.args[0]==="number")).toBe(true);
    const space=graphics();drawConcealment(space.g,{...map,physics:"space",biome:"space"});
    expect(space.calls.filter(c=>c.method!=="clear")).toHaveLength(0);
    for(const biome of ["space","industrial","snow","desert","cavern"] as const) {
      const {g,calls}=graphics();drawTerrain(g,{...map,biome,backgrounds:[{x:60,y:60,w:150,h:90}]});drawBackdropLayer(g,{...map,biome},1920,1080,0);
      expect(calls.flatMap(c=>c.args.flat(2)).filter(a=>typeof a==="number").every(Number.isFinite)).toBe(true);
    }
  });
  it("uses drifting debris in space and falling debris on terrestrial maps",()=>{
    const part:DeathDebris={kind:"helmet",x:200,y:60,vx:25,vy:0,angle:0,spin:1,radius:5,color:0x889977,age:0,ttl:1000,settled:false};
    const space=advanceDebris([{...part}],100,{...map,physics:"space"})[0];
    const ground=advanceDebris([{...part}],100,map)[0];
    expect(space.y).toBe(60);expect(space.x).toBeCloseTo(202.5);expect(space.vy).toBe(0);expect(ground.y).toBeGreaterThan(60);
  });
  it("does not schedule charge or jet feedback for dead actors or nonmotor weapons",()=>{
    const listener={x:0,y:0};
    expect(motorCue({id:1,x:0,y:24,alive:false,jetting:true,weapon:"minigun",charge:1},listener)).toMatchObject({charge:0,jet:false});
    expect(motorCue({id:1,x:0,y:24,weapon:"mini-eagle",charge:1},listener).charge).toBe(0);
    expect(motorCue({id:1,x:0,y:24,weapon:"minigun",charge:2},listener)).toMatchObject({charge:1,gain:1});
    expect(motorCue({id:1,x:1800,y:24,weapon:"saw-launcher",charge:1},listener).gain).toBe(0);
  });
});
