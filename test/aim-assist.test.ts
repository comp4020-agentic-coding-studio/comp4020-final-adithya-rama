import {describe,it,expect} from "vitest";
import {assistedAim,visibleAimTargets,type AimTarget} from "../src/client/aim-assist.ts";
import {FLAT,world,player,run,hold} from "./helpers.ts";
import {Btn,type MapDefinition} from "../src/shared/types.ts";
import {PLAYER_H} from "../src/shared/constants.ts";
import {freshSlot,snapshot} from "../src/shared/sim.ts";
import {PF} from "../src/shared/types.ts";
const origin={x:100,y:500},map:MapDefinition={...FLAT,solids:[]};
const target:AimTarget={id:2,x:500,y:522,crouch:false,enemy:true,alive:true,protected:false};
const degrees=(n:number)=>n*Math.PI/180;
const assist=(angle:number,targets=[target],weapon="ak47",enabled=true,m=map)=>assistedAim(angle,origin,weapon,targets,m,enabled);
describe("gentle optional aim assistance",()=>{
  it("uses displayed positions but immediately revokes hidden/dead targets and requires known identities",()=>{
    const w=world({mode:"tdm"}),a=player(w,0),b=player(w,1),ally=player(w,0);
    const before=snapshot(w,[]).players,teams=new Map([...w.players.values()].map(p=>[p.id,p]));
    const current=before.map(p=>p.id===b.id?{...p,x:p.x+50}:p);
    let targets=visibleAimTargets(before,current,teams,a.id,true);
    expect(targets.find(t=>t.id===b.id)?.x).toBe(before.find(p=>p.id===b.id)!.x);
    expect(targets.find(t=>t.id===ally.id)?.enemy).toBe(false);
    expect(visibleAimTargets(before,current.filter(p=>p.id!==b.id),teams,a.id,true).some(t=>t.id===b.id)).toBe(false);
    targets=visibleAimTargets(before,current.map(p=>p.id===b.id?{...p,f:p.f&~PF.ALIVE}:p),teams,a.id,true);
    expect(targets.find(t=>t.id===b.id)?.alive).toBe(false);
    teams.delete(b.id);expect(visibleAimTargets(before,current,teams,a.id,true).some(t=>t.id===b.id)).toBe(false);
  });
  it("nudges a near miss by at most a quarter of the error, without locking",()=>{
    const raw=degrees(5),a=assist(raw);
    expect(a).toBeLessThan(raw);expect(a).toBeGreaterThan(0);
    expect(Math.abs(a-raw)).toBeLessThanOrEqual(degrees(1.5));
    expect(assist(raw)).toBe(a); // No accumulated tracking or frame-rate-dependent correction.
  });
  it("does not pull accurate body or head shots away from the chosen point",()=>{
    expect(assist(0)).toBe(0);expect(assist(degrees(-2))).toBe(degrees(-2));
  });
  it("does nothing when disabled, outside the cone, or with no authorized targets",()=>{
    expect(assist(degrees(5),[target],"ak47",false)).toBe(degrees(5));
    expect(assist(degrees(20))).toBe(degrees(20));
    expect(assist(degrees(5),[])).toBe(degrees(5));
  });
  it.each([{enemy:false},{alive:false},{protected:true},{x:1700}])("ignores ineligible or out-of-range targets %j",patch=>{
    expect(assist(degrees(5),[{...target,...patch}])).toBe(degrees(5));
  });
  it("cannot track through solid terrain, but one-way platforms are not bullet blockers",()=>{
    const wall={x:300,y:400,w:20,h:200};
    expect(assist(degrees(5),[target],"ak47",true,{...map,solids:[wall]})).toBe(degrees(5));
    expect(assist(degrees(5),[target],"ak47",true,{...map,platforms:[wall]})).toBeLessThan(degrees(5));
  });
  it("uses a smaller precision cone and does not redirect rockets or grenade launchers",()=>{
    const far={...target,x:1100};
    const a=assist(degrees(1.8),[far],"m93ba");
    expect(a).toBeLessThan(degrees(1.8));expect(degrees(1.8)-a).toBeLessThanOrEqual(degrees(.5));
    expect(assist(degrees(3),[far],"m93ba")).toBe(degrees(3));
    for(const weapon of ["smaw","rg6","machete","riot-shield","flamethrower"])
      expect(assist(degrees(5),[target],weapon)).toBe(degrees(5));
  });
  it("wraps near the negative/positive pi seam and picks targets independently of list order",()=>{
    const left={...target,x:-300,y:524};
    const raw=-Math.PI+degrees(5),a=assist(raw,[left]);
    expect(Math.abs(a-raw)).toBeLessThan(degrees(1.5));expect(a).not.toBe(raw);
    const second={...target,id:3,y:518};
    expect(assist(degrees(5),[target,second])).toBe(assist(degrees(5),[second,target]));
  });
  it("helps a small sniper near-miss reach the torso through normal authoritative firing",()=>{
    function shot(enabled:boolean) {
      const w=world({mode:"ffa"});w.map={...FLAT,solids:[{x:0,y:900,w:2000,h:100}]};
      const a=player(w,-1,{x:200,y:900}),b=player(w,-1,{x:1200,y:900});
      a.slots=[freshSlot("m93ba"),null,null];
      const raw=degrees(1.85);
      const angle=assistedAim(raw,{x:a.x,y:a.y-PLAYER_H*.68},"m93ba",[{...target,x:b.x,y:b.y}],w.map,enabled);
      run(w,1,()=>hold(a.id,Btn.FIRE,angle));
      return b.hp;
    }
    expect(shot(false)).toBe(100);expect(shot(true)).toBe(0);
  });
});
