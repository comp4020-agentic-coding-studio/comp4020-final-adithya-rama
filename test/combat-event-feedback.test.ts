import { describe, expect, it, vi } from "vitest";
import { GameAudio } from "../src/client/audio.ts";
import { freshSlot } from "../src/shared/sim.ts";
import { Btn, type GameEvent } from "../src/shared/types.ts";
import { hold, player, run, world } from "./helpers.ts";

type Shot=Extract<GameEvent,{t:"shot"}>;
function soundRecorder(){
  const audio=new GameAudio(),play=vi.fn(()=>true),tone=vi.fn(),noise=vi.fn();
  // Exercise actual event dispatch without requiring a hardware audio device.
  Object.assign(audio,{play,tone,noise});
  return {audio,play,tone,noise};
}
function gunEvents(weapons:[string,string|null,string|null],dual=false):Shot[]{
  const w=world({mode:"ffa"}),p=player(w);p.slots=weapons.map(id=>id?freshSlot(id):null) as typeof p.slots;p.dual=dual;
  run(w,1,()=>hold(p.id,Btn.FIRE));return w.events.filter((e):e is Shot=>e.t==="shot");
}

describe("authoritative discharges reach audio independently",()=>{
  it("plays both simultaneous Uzis while retaining one sound per shotgun discharge",()=>{
    const dual=gunEvents(["uzi","uzi",null],true),shotgun=gunEvents(["spas12",null,null]);
    expect(dual).toHaveLength(2);expect(new Set(dual.map(e=>e.discharge)).size).toBe(2);
    expect(shotgun).toHaveLength(7);expect(new Set(shotgun.map(e=>e.discharge)).size).toBe(1);
    const {audio,play}=soundRecorder();
    for(const e of dual)audio.event(e,e.by);
    expect(play).toHaveBeenCalledTimes(2);
    for(const e of shotgun)audio.event(e,e.by);
    expect(play).toHaveBeenCalledTimes(3);
  });
  it("does not mute a later discharge that arrives in the same network batch",()=>{
    const shot=gunEvents(["uzi",null,null])[0],{audio,play}=soundRecorder();
    audio.event(shot,shot.by);audio.event({...shot,discharge:shot.discharge!+3},shot.by);
    audio.event(shot,shot.by); // repeated pellet/event stays quiet
    expect(play).toHaveBeenCalledTimes(2);
  });
  it("keeps old events compatible and respects the sound mute setting",()=>{
    const {discharge:_,...legacy}=gunEvents(["uzi",null,null])[0],{audio,play}=soundRecorder();
    audio.event(legacy,legacy.by);audio.event(legacy,legacy.by);expect(play).toHaveBeenCalledTimes(1);
    audio.muted=true;audio.event({...legacy,discharge:9999},legacy.by);expect(play).toHaveBeenCalledTimes(1);
  });
});

describe("electrical detonation is distinct from physical blast",()=>{
  it.each(["emp","frag"])("%s sends the correct presentation kind and kill cause",kind=>{
    const w=world({mode:"ffa"}),victim=player(w,-1,{x:500,y:900});victim.hp=5;
    w.projectiles.push({id:99,owner:-1,kind,x:500,y:878,vx:0,vy:0,explodeTick:1});run(w,1);
    expect(w.events.find(e=>e.t==="explode")).toMatchObject({effect:kind==="emp"?"emp":"blast"});
    const death=w.events.find(e=>e.t==="kill");expect(death).toBeDefined();
    if(death?.t!=="kill")throw Error("expected death");
    if(kind==="emp"){expect(death.blast).toBeUndefined();expect(w.events.some(e=>e.t==="emp"&&e.id===victim.id)).toBe(true);}
    else expect(death.blast).toEqual({x:500,y:expect.any(Number)});
  });
  it("uses a brief electrical cue instead of the physical explosion's bass rumble",()=>{
    const emp=soundRecorder(),blast=soundRecorder();
    emp.audio.event({t:"explode",x:0,y:0,r:180,effect:"emp"},null);
    blast.audio.event({t:"explode",x:0,y:0,r:180},null); // old events still physical
    expect(emp.tone.mock.calls.length).toBeGreaterThan(0);
    expect(emp.tone.mock.calls.every(call=>call[0]>100)).toBe(true);
    expect(blast.tone.mock.calls.some(call=>call[0]<100)).toBe(true);
    expect(emp.noise.mock.calls[0][0]).toBeLessThan(blast.noise.mock.calls[0][0]);
  });
});