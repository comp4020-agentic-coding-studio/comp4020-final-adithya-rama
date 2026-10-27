// @vitest-environment jsdom
import {describe,it,expect} from "vitest";
import type {Renderer as RendererType} from "../src/client/render.ts";
import {cosmeticPosition,explosionShake} from "../src/client/combat-effects.ts";
import {avatarOf} from "../src/shared/avatar.ts";
import {shieldPanel} from "../src/shared/combat-geometry.ts";
import type {DeathDebris} from "../src/client/death.ts";
// These event-handler tests do not initialize WebGL or pretend to inspect pixels.
Object.defineProperty(HTMLCanvasElement.prototype,"getContext",{value:()=>null,configurable:true});
const {Renderer}=await import("../src/client/render.ts");
function fixture(reducedBlood=false) {
  const state={fx:[] as Array<{kind:string;x1:number;y1:number;x2:number;y2:number}>,debris:[] as DeathDebris[],
    cam:{x:100,y:100},shake:0,reducedShake:false,reducedBlood,map:null,probe:{config:{} as Record<string,unknown>}};
  Object.setPrototypeOf(state,Renderer.prototype);
  return {state,renderer:state as unknown as RendererType};
}
describe("impact feedback remains consistent and local",()=>{
  it("does not shake the camera for an explosion across the arena, and smoothly attenuates nearby blasts",()=>{
    expect(explosionShake(100,100,170,{x:100,y:100})).toBe(9);
    expect(explosionShake(300,100,170,{x:100,y:100})).toBeGreaterThan(0);
    expect(explosionShake(300,100,170,{x:100,y:100})).toBeLessThan(9);
    expect(explosionShake(1000,100,170,{x:100,y:100})).toBe(0);
    const {renderer,state}=fixture();
    renderer.addExplosion(1000,100,170);expect(state.shake).toBe(0);
    renderer.addExplosion(100,100,170);expect(state.shake).toBe(9);
    state.shake=0;state.reducedShake=true;
    renderer.addExplosion(100,100,170);expect(state.shake).toBe(0);
  });
  it("draws EMP as an electrical pulse without a fireball, camera impact or body breakup",()=>{
    const {renderer,state}=fixture();renderer.addEmpPulse(100,100,150);
    expect(state.fx.map(f=>f.kind)).toEqual(["emp"]);expect(state.shake).toBe(0);expect(state.debris).toEqual([]);
  });
  it.each([0,Math.PI/2,Math.PI,-Math.PI/2])("places shield block feedback on the aimed physical plate (%s)",aim=>{
    const {renderer,state}=fixture(),actor={x:100,y:200,aim,crouch:false};
    renderer.addShieldBlock(actor);
    const panel=shieldPanel({x:89,y:156,w:22,h:44},aim);
    expect(state.fx).toEqual([expect.objectContaining({kind:"shield",x1:panel.x,y1:panel.y,x2:aim,y2:panel.length})]);
    expect(state.shake).toBe(0);expect(state.debris).toEqual([]);
  });
  it("shares frag breakup with rockets and honours blood reduction independently of shake",()=>{
    const {renderer,state}=fixture();state.reducedShake=true;
    const actor={id:1,x:100,y:200,vx:0,vy:0,crouch:false,team:0 as const,color:0x3388aa};
    renderer.addExplosion(100,180,150);
    expect(state.debris).toEqual([]);
    renderer.addDeath(actor,"frag",{x:90,y:180});
    expect(state.debris).toHaveLength(19);expect(state.shake).toBe(0);
    const reduced=fixture(true);reduced.renderer.addDeath(actor,"frag",{x:90,y:180});
    expect(reduced.state.debris.map(p=>p.kind)).toEqual(["helmet","vest"]);
    const cut=fixture();cut.renderer.addDeath(actor,"saw-launcher");
    expect(cut.state.debris).toEqual([]);
  });
  it.each(["none","mohawk"])("never invents a helmet fragment for %s headwear",helmet=>{
    const actor={id:1,x:100,y:200,crouch:false,team:0 as const,color:0x3388aa,avatar:avatarOf({helmet})};
    const normal=fixture();normal.renderer.addDeath(actor,"frag",{x:90,y:180});
    expect(normal.state.debris).toHaveLength(18);expect(normal.state.debris.some(p=>p.kind==="helmet")).toBe(false);
    const reduced=fixture(true);reduced.renderer.addDeath(actor,"frag",{x:90,y:180});
    expect(reduced.state.debris.map(p=>p.kind)).toEqual(["vest"]);
  });
  it("uses inertial casing and blood motion in space and adds gravity on terrestrial maps",()=>{
    const initial={x:20,y:30,vx:40,vy:-10};
    expect(cosmeticPosition(initial,1,true)).toEqual({x:60,y:20});
    expect(cosmeticPosition(initial,1,false)).toEqual({x:60,y:140});
  });
});