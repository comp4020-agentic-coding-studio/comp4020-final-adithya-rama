import {describe,it,expect} from "vitest";
import {advanceDebris,appendDebris,explosionDebris,isExplosiveDeath,MAX_DEATH_DEBRIS,visibleDeathDebris,type DeathDebris} from "../src/client/death.ts";
import {stepWorld,type Projectile} from "../src/shared/sim.ts";
import {player,world} from "./helpers.ts";
const colors={armor:0x335566,skin:0xccaa88,helmet:0x778899};
function blastScenario(kind:string,hp=100,distance=0) {
  const w=world({mode:"ffa"});
  w.map={...w.map,physics:"space",solids:[],platforms:[]};
  const owner=player(w,-1,{x:200,y:522}),victim=player(w,-1,{x:650+distance,y:522});victim.hp=hp;
  const projectile:Projectile={id:w.nextId++,kind,owner:owner.id,x:650,y:500,vx:0,vy:0,explodeTick:1,
    ...(["smaw","rg6","saw-launcher"].includes(kind)?{weapon:kind}:{}),
    ...(kind==="mine"?{armedAt:0,stuck:true,explodeTick:600}:{}),
  };
  w.projectiles.push(projectile);stepWorld(w,new Map());
  const kill=w.events.find(e=>e.t==="kill"&&e.victim===victim.id);
  return {w,victim,kill};
}

describe("consistent explosive death presentation",()=>{
  it("a standard-health point-blank frag kill carries the blast needed for full breakup",()=>{
    const {victim,kill}=blastScenario("frag");
    expect(victim.alive).toBe(false);expect(kill?.t).toBe("kill");
    if(kill?.t!=="kill")throw Error("No grenade kill");
    expect(kill.blast).toEqual({x:650,y:500});expect(isExplosiveDeath(kill.w,kill.blast)).toBe(true);
    const pieces=explosionDebris({...victim,height:44},colors,false,kill.blast);
    expect(pieces.filter(p=>p.kind!=="blood")).toHaveLength(9);
    expect(new Set(pieces.map(p=>p.kind))).toEqual(new Set(["head","helmet","vest","arm","leg","boot","blood"]));
  });
  it.each(["smaw","frag","rg6","mine","saw-launcher"])("routes %s lethal physical blasts through the same anatomy and blood preferences",kind=>{
    const {victim,kill}=blastScenario(kind,30);
    expect(victim.alive).toBe(false);
    if(kill?.t!=="kill")throw Error("Missing "+kind+" kill");
    expect(isExplosiveDeath(kill.w,kill.blast)).toBe(true);
    const normal=visibleDeathDebris(explosionDebris({...victim,height:44},colors,false,kill.blast),false);
    const reduced=visibleDeathDebris(normal,true);
    expect(normal).toHaveLength(19);
    expect(reduced.map(p=>p.kind)).toEqual(["helmet","vest"]);
    expect(visibleDeathDebris(reduced,true)).toEqual(reduced);
  });
  it("a nonlethal frag burst produces an explosion and damage but no breakup trigger",()=>{
    const {w,victim,kill}=blastScenario("frag",100,130);
    expect(w.events.some(e=>e.t==="explode")).toBe(true);
    expect(victim.hp).toBeGreaterThan(0);expect(victim.hp).toBeLessThan(100);expect(kill).toBeUndefined();
  });
  it("a direct saw cut stays distinct from the same weapon's terminal blast",()=>{
    const w=world({mode:"ffa"});w.map={...w.map,physics:"space",solids:[],platforms:[]};
    const owner=player(w,-1,{x:200,y:522}),victim=player(w,-1,{x:500,y:522});victim.hp=30;
    w.projectiles.push({id:w.nextId++,kind:"saw-launcher",weapon:"saw-launcher",owner:owner.id,x:450,y:500,vx:4000,vy:0,explodeTick:600});
    stepWorld(w,new Map());const kill=w.events.find(e=>e.t==="kill"&&e.victim===victim.id);
    if(kill?.t!=="kill")throw Error("Missing direct saw kill");
    expect(kill.blast).toBeUndefined();expect(isExplosiveDeath(kill.w,kill.blast)).toBe(false);
  });
  it("EMP can be lethal at low health without physical dismemberment",()=>{
    const {victim,kill}=blastScenario("emp",5);
    expect(victim.alive).toBe(false);
    if(kill?.t!=="kill")throw Error("Missing EMP kill");
    expect(kill.blast).toBeUndefined();expect(isExplosiveDeath(kill.w,kill.blast)).toBe(false);
    expect(isExplosiveDeath("emp",{x:650,y:500})).toBe(false);
    for(const cause of ["gas","flamethrower","emp-gun","phasr"])expect(isExplosiveDeath(cause,{x:1,y:2})).toBe(false);
  });
  it("mixed mass-casualty blasts obey the same global budget, directional impulse and expiry",()=>{
    let pieces:DeathDebris[]=[];
    for(let i=0;i<16;i++) {
      const {victim,kill}=blastScenario(["frag","rg6","mine","smaw"][i%4],30,20);
      if(kill?.t!=="kill")throw Error("Missing mixed blast kill");
      const added=explosionDebris({...victim,height:44},colors,false,kill.blast);
      expect(added.every(p=>p.vx>0)).toBe(true);
      pieces=appendDebris(pieces,added);
    }
    expect(pieces).toHaveLength(MAX_DEATH_DEBRIS);
    expect(advanceDebris(pieces,10000,{width:2000,height:1000,solids:[],platforms:[]})).toEqual([]);
  });
});