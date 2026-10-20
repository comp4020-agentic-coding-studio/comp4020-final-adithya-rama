import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { ProfileWrites, type ProfilePatch } from "../src/client/profile-writes.ts";
import { includeAuthorizedKiller } from "../src/client/camera-actors.ts";
import { DeathCamera } from "../src/client/death.ts";
import { syncRuleFields } from "../src/client/rule-controls.ts";
import { snapshotForViewer } from "../src/server/visibility.ts";
import { sanitizePrefs } from "../src/server/validation.ts";
import { sanitizeSettings } from "../src/shared/settings.ts";
import { snapshot } from "../src/shared/sim.ts";
import { PF } from "../src/shared/types.ts";
import type { Profile } from "../src/shared/protocol.ts";
import { player, world } from "./helpers.ts";

const pilot = (): Profile => ({id:"pilot",name:"Pilot",color:123,prefs:{scopes:{uzi:0},muted:false},matches:0,wins:0,kills:0,deaths:0,mvps:0});
function deferred<T>() {
  let resolve!: (value:T) => void, reject!: (reason:Error) => void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}

describe("serialized profile edits",()=>{
  it("preserves scope edits when a profile form saves before the scope response arrives",async()=>{
    let server=pilot(),current=pilot();
    const requests:ProfilePatch[]=[],gate=deferred<void>();
    const writes=new ProfileWrites(async patch=>{
      requests.push(patch);
      if(requests.length===1)await gate.promise;
      server={...server,...patch,prefs:patch.prefs?sanitizePrefs(patch.prefs,server.prefs):server.prefs};
      return structuredClone(server);
    },p=>{current=p;});
    writes.receive(current);
    const scopes={uzi:3};
    const first=writes.write({prefs:{scopes}});
    scopes.uzi=1; // Editing the source object later must not alter the queued save.
    const second=writes.write({name:"New pilot",color:456,prefs:{muted:true,volume:.3}});
    await Promise.resolve();
    expect(requests).toHaveLength(1);
    writes.receive(pilot()); // Reconnect welcome was read before either response.
    gate.resolve();
    await Promise.all([first,second]);
    expect(server.prefs).toMatchObject({scopes:{uzi:3},muted:true,volume:.3});
    expect(requests[1].prefs).not.toHaveProperty("scopes");
    writes.receive({...pilot(),matches:1}); // An older welcome can arrive even after HTTP.
    expect(current).toMatchObject({name:"New pilot",color:456,matches:1,prefs:{scopes:{uzi:3},muted:true,volume:.3}});
  });
  it("rejects failed saves without poisoning later writes or remembering unsaved values",async()=>{
    let calls=0,current=pilot();
    const writes=new ProfileWrites(async patch=>{
      if(++calls===1)throw new Error("offline");
      return {...pilot(),prefs:sanitizePrefs(patch.prefs,pilot().prefs)};
    },p=>{current=p;});
    const failed=writes.write({prefs:{muted:true}});
    const later=writes.write({prefs:{volume:.4}});
    await expect(failed).rejects.toThrow("offline");
    await later;
    expect(current.prefs).toMatchObject({muted:false,volume:.4});
    writes.receive({...pilot(),id:"different"});
    expect(current.prefs).not.toHaveProperty("volume");
  });
});

describe("authoritative death-camera handoff",()=>{
  it.each(["missing","older-dead"] as const)("follows a newly disclosed concealed killer despite an %s interpolation entry",oldState=>{
    const w=world();w.tick=100;w.map={...w.map,concealment:[{x:300,y:850,w:400,h:50}]};
    const victim=player(w,-1,{x:100,y:900}),killer=player(w,-1,{x:400,y:900});
    killer.crouch=true;killer.onGround=true;killer.revealUntil=0;
    const before=snapshotForViewer(w,snapshot(w,[]),victim.id,null,0);
    expect(before.players.some(p=>p.id===killer.id)).toBe(false);
    victim.alive=false;victim.hp=0;
    const current=snapshotForViewer(w,snapshot(w,[]),victim.id,killer.id,1);
    const actors=new Map(before.players.map(p=>[p.id,p]));
    if(oldState==="older-dead")actors.set(killer.id,{...current.players.find(p=>p.id===killer.id)!,f:0,x:20});
    includeAuthorizedKiller(actors,current,victim.id);
    const camera=new DeathCamera();camera.died(victim,killer.id);
    const resolve=()=>camera.resolve(false,[...actors.values()].map(p=>({id:p.id,x:p.x,y:p.y,alive:!!(p.f&PF.ALIVE),connected:!!(current.players.find(q=>q.id===p.id)?.f!&PF.CONNECTED)})));
    expect(resolve()).toMatchObject({following:true,killer:killer.id,point:{x:400,y:900}});
    camera.stopFollowing(); // Explicit server revocation remains final.
    expect(resolve()?.following).toBe(false);
  });
  it("adds no actor without a live server grant and preserves available interpolation",()=>{
    const w=world(),victim=player(w),killer=player(w);
    victim.alive=false;
    const latest={...snapshot(w,[]),following:killer.id};
    const k=latest.players.find(p=>p.id===killer.id)!;
    const actors=new Map([[k.id,{...k,x:321}]]);
    includeAuthorizedKiller(actors,latest,victim.id);
    expect(actors.get(k.id)?.x).toBe(321);
    for(const following of [null,999]){
      const empty=new Map();includeAuthorizedKiller(empty,{...latest,following},victim.id);expect(empty.size).toBe(0);
    }
    killer.connected=false;
    const empty=new Map();includeAuthorizedKiller(empty,{...snapshot(w,[]),following:killer.id},victim.id);expect(empty.size).toBe(0);
  });
});

describe("next-round settings reconciliation",()=>{
  const controls=()=>{
    const dom=new JSDOM('<div><select data-setting="mode"><option>training</option><option>flag</option><option>survival</option></select><select data-setting="map"></select><select data-setting="gravity"></select><select data-setting="capacity"></select><select data-setting="bots"></select><input type="checkbox" data-setting="flight"><input type="checkbox" data-setting="unlimitedFuel"><input type="checkbox" data-setting="randomSpawns"><select data-setting="fuelCapacity"><option>1</option></select></div>');
    return {dom,root:dom.window.document.querySelector("div")!};
  };
  it("reconciles random-spawn choices from authoritative settings and restored legacy presets",()=>{
    const {dom,root}=controls();
    const field=root.querySelector<HTMLInputElement>('[data-setting="randomSpawns"]')!;
    syncRuleFields(root,sanitizeSettings({randomSpawns:false}));expect(field.checked).toBe(false);
    syncRuleFields(root,sanitizeSettings({randomSpawns:true}));expect(field.checked).toBe(true);
    syncRuleFields(root,sanitizeSettings({}));expect(field.checked).toBe(true);
    dom.window.close();
  });
  it("shows the server-selected arena after Test Range changes to flag mode, and restores range choice for training",()=>{
    const {dom,root}=controls();
    const training=sanitizeSettings({mode:"training",map:"test-range"});
    syncRuleFields(root,training);
    const map=root.querySelector<HTMLSelectElement>('[data-setting="map"]')!;
    expect(map.value).toBe("test-range");
    const flag=sanitizeSettings({mode:"flag"},training);
    syncRuleFields(root,flag);
    expect(map.value).toBe(flag.map);expect(map.value).toBe("outpost-yard");
    expect([...map.options].some(o=>o.value==="test-range")).toBe(false);
    expect(root.querySelector<HTMLSelectElement>('[data-setting="mode"]')!.value).toBe("flag");
    syncRuleFields(root,sanitizeSettings({mode:"training"},flag));
    expect([...map.options].some(o=>o.value==="test-range")).toBe(true);
    dom.window.close();
  });
  it("shows forced zero gravity even when the retained multiplier is two, then restores it on earth",()=>{
    const {dom,root}=controls();
    const terrestrial=sanitizeSettings({map:"outpost-yard",gravity:2,flight:false});
    const space=sanitizeSettings({map:"lunarcy"},terrestrial);
    syncRuleFields(root,space);
    const gravity=root.querySelector<HTMLSelectElement>('[data-setting="gravity"]')!;
    const flight=root.querySelector<HTMLInputElement>('[data-setting="flight"]')!;
    expect(gravity.value).toBe("1");expect(gravity.selectedOptions[0].textContent).toContain("Zero gravity");expect(gravity.disabled).toBe(true);
    expect(flight.checked).toBe(true);expect(flight.disabled).toBe(true);
    syncRuleFields(root,sanitizeSettings({map:"outpost-yard"},space));
    expect(gravity.value).toBe("2");expect(gravity.disabled).toBe(false);expect(flight.disabled).toBe(false);
    dom.window.close();
  });
});
