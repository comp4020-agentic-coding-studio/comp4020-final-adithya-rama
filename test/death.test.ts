import { describe,expect,it } from "vitest";
import { advanceDebris,appendDebris,DeathCamera,isRocketDeath,MAX_DEATH_DEBRIS,rocketDebris,type DeathDebris } from "../src/client/death.ts";
const victim={id:3,x:40,y:70,vx:0,vy:0,height:44};
const colors={armor:0x3399ff,skin:0xbb8866,helmet:0x788878};
const map={width:1000,height:600,solids:[{x:0,y:200,w:1000,h:400}],platforms:[]};
const part=(patch:Partial<DeathDebris>={}):DeathDebris=>({kind:"helmet",x:50,y:50,vx:0,vy:0,angle:0,spin:5,radius:5,color:0x778877,age:0,ttl:3000,settled:false,...patch});

describe("death camera",()=>{
  it("follows the actual attacker while it moves, ignoring unrelated pilots",()=>{
    const camera=new DeathCamera();camera.died(victim,9);
    expect(camera.resolve(false,[{id:2,x:41,y:70,alive:true},{id:9,x:450,y:110,alive:true}])).toEqual({point:{x:450,y:110},killer:9,following:true});
    expect(camera.resolve(false,[{id:9,x:610,y:160,alive:true}])?.point).toEqual({x:610,y:160});
  });
  it.each([null,3])("holds the death location for environmental or self damage (%s)",attacker=>{
    const camera=new DeathCamera();camera.died(victim,attacker);
    expect(camera.resolve(false,[{id:2,x:900,y:100,alive:true}])).toEqual({point:{x:40,y:70},killer:null,following:false});
  });
  it("honors the server ending a follow even if the killer reappears between snapshots",()=>{
    const camera=new DeathCamera();camera.died(victim,9);camera.resolve(false,[{id:9,x:450,y:110,alive:true}]);
    camera.stopFollowing();expect(camera.resolve(false,[{id:9,x:900,y:100,alive:true}])).toEqual({point:{x:450,y:110},killer:9,following:false});
  });
  it("releases the camera immediately when the local pilot respawns",()=>{
    const camera=new DeathCamera();camera.died(victim,9);
    expect(camera.resolve(true,[{id:9,x:450,y:110,alive:true}])).toBeNull();
    expect(camera.resolve(false,[])).toBeNull();
  });
  it("holds the last killer position if the killer dies and does not follow its next life",()=>{
    const camera=new DeathCamera();camera.died(victim,9);
    camera.resolve(false,[{id:9,x:450,y:110,alive:true}]);
    expect(camera.resolve(false,[{id:9,x:450,y:110,alive:false}])).toEqual({point:{x:450,y:110},killer:9,following:false});
    expect(camera.resolve(false,[{id:9,x:900,y:500,alive:true}])?.point).toEqual({x:450,y:110});
  });
  it("holds a stable view if the killer disconnects or leaves the snapshot",()=>{
    for(const missing of [true,false]) {
      const camera=new DeathCamera();camera.died(victim,9);
      camera.resolve(false,[{id:9,x:450,y:110,alive:true}]);
      expect(camera.resolve(false,missing?[]:[{id:9,x:450,y:110,alive:true,connected:false}])?.following).toBe(false);
      expect(camera.resolve(false,[])?.point).toEqual({x:450,y:110});
    }
  });
});

describe("bounded stylized rocket debris",()=>{
  it("distinguishes rockets from grenades and ordinary gunfire",()=>{
    expect(isRocketDeath("smaw")).toBe(true);
    for(const id of ["frag","rg6","ak47","machete","fall"])expect(isRocketDeath(id)).toBe(false);
  });
  it("creates six recognizable armor/limb pieces and eight small blood particles",()=>{
    const parts=rocketDebris(victim,colors,false);
    expect(parts.filter(p=>p.kind!=="blood")).toHaveLength(6);
    expect(parts.filter(p=>p.kind==="blood")).toHaveLength(8);
    expect(new Set(parts.map(p=>p.kind))).toEqual(new Set(["helmet","vest","arm","boot","blood"]));
    expect(parts.every(p=>Number.isFinite(p.vx)&&p.vy<0&&p.ttl<=2900)).toBe(true);
  });
  it("suppresses rocket breakup when reduced effects are requested",()=>{
    expect(rocketDebris(victim,colors,true)).toEqual([]);
  });
  it("strictly bounds simultaneous effects and expires them after a stalled frame",()=>{
    let parts:DeathDebris[]=[];
    for(let n=0;n<20;n++)parts=appendDebris(parts,rocketDebris({...victim,id:n},colors,false));
    expect(parts).toHaveLength(MAX_DEATH_DEBRIS);
    expect(advanceDebris(parts,10000,map)).toEqual([]);
  });
  it("bounces from the ground without sinking through it",()=>{
    const p=part({y:190,vy:500});advanceDebris([p],50,map);
    expect(p.y+p.radius).toBeLessThanOrEqual(200);expect(p.vy).toBeLessThan(0);
  });
  it("sweeps fast pieces against thin walls rather than tunnelling",()=>{
    const p=part({x:50,y:100,vx:12000});
    advanceDebris([p],20,{...map,solids:[{x:100,y:0,w:4,h:200}]});
    expect(p.x+p.radius).toBeLessThanOrEqual(100);expect(p.vx).toBeLessThan(0);
  });
  it("collides with ceilings",()=>{
    const p=part({x:50,y:80,vy:-800});
    advanceDebris([p],50,{...map,solids:[{x:0,y:20,w:200,h:20}]});
    expect(p.y-p.radius).toBeGreaterThanOrEqual(40);expect(p.vy).toBeGreaterThan(0);
  });
  it("lands on one-way platforms but can fly upward through them",()=>{
    const platformMap={...map,solids:[],platforms:[{x:0,y:100,w:150,h:8}]};
    const down=part({y:90,vy:300}),up=part({y:120,vy:-500});
    advanceDebris([down],50,platformMap);advanceDebris([up],100,platformMap);
    expect(down.y+down.radius).toBeLessThanOrEqual(100);
    expect(up.y).toBeLessThan(100);
  });
  it("settles blood on contact and discards pieces outside the world",()=>{
    const p=part({kind:"blood",y:190,vy:500});
    advanceDebris([p],80,map);expect(p.settled).toBe(true);expect(p.vx).toBe(0);expect(p.vy).toBe(0);
    expect(advanceDebris([part({x:-100})],0,map)).toEqual([]);
  });
});
