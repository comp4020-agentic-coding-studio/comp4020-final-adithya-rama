import { describe, expect, it } from "vitest";
import { nameplateIdentity, nameplateText, placeNameplates, type NamedActor } from "../src/client/nameplates.ts";
const actor=(team:NamedActor["team"],changes:Partial<NamedActor>={}):NamedActor=>({team,local:false,alive:true,...changes});

describe("viewer-relative player identification",()=>{
  it("shows either team's allies green and opponents red",()=>{
    for(const team of [0,1] as const){
      expect(nameplateIdentity(actor(team),{team})).toMatchObject({marker:"ALLY",color:0x8ff0ac,friendly:true,visible:true});
      expect(nameplateIdentity(actor(team===0?1:0),{team})).toMatchObject({marker:"ENEMY",color:0xff8b91,friendly:false});
    }
  });
  it("never treats two unteamed FFA fighters as allies",()=>{
    expect(nameplateIdentity(actor(-1),{team:-1}).marker).toBe("ENEMY");
    expect(nameplateIdentity(actor(-1,{local:true}),{team:-1}).marker).toBe("YOU");
  });
  it("uses stable team names for a spectator without inventing allegiance",()=>{
    expect(nameplateIdentity(actor(0)).marker).toBe("EMBER");
    expect(nameplateIdentity(actor(1)).marker).toBe("TIDE");
    expect(nameplateIdentity(actor(-1)).marker).toBe("PLAYER");
  });
  it("hides concealed enemies and dead actors but keeps authorized allies identifiable",()=>{
    expect(nameplateIdentity(actor(1,{concealed:true}),{team:0}).visible).toBe(false);
    expect(nameplateIdentity(actor(0,{concealed:true}),{team:0}).visible).toBe(true);
    expect(nameplateIdentity(actor(0,{local:true,alive:false}),{team:0}).visible).toBe(false);
  });
  it("keeps readable text markers and bounds long names without splitting unicode",()=>{
    expect(nameplateText("ALLY","Pilot")).toBe("ALLY · Pilot");
    expect(nameplateText("ENEMY","🚀".repeat(20))).toBe("ENEMY · "+"🚀".repeat(17)+"…");
  });
  it("separates a tight group at phone far zoom and keeps names inside the view",()=>{
    const plates=placeNameplates([120,165,195].map((x,id)=>({id,x,y:350,width:185,height:27})),{width:390,top:230,bottom:540});
    expect(plates).toHaveLength(3);
    for(const p of plates){
      expect(p.y).toBeLessThanOrEqual(350);
      expect(p.x-p.width/2).toBeGreaterThanOrEqual(4);
      expect(p.x+p.width/2).toBeLessThanOrEqual(386);
      for(const q of plates.filter(q=>q.id!==p.id))expect(Math.abs(p.y-q.y)).toBeGreaterThan(27);
    }
  });
  it("can move crowded labels below actors when there is no space above",()=>{
    const plates=placeNameplates([0,1].map(id=>({id,x:195,y:260,width:180,height:27})),{width:390,top:230,bottom:540});
    expect(plates).toHaveLength(2);
    expect(plates[1].y).toBeGreaterThan(plates[0].y);
  });
});
