import { describe, expect, it } from "vitest";
import { cameraFrame, scopesOf, weaponViewWidth } from "../src/client/camera.ts";
import { WEAPONS } from "../src/shared/weapons.ts";
import { sanitizePrefs } from "../src/server/validation.ts";

describe("weapon reach and camera framing",()=>{
  it("shows broader sightlines for precision rifles and rockets than close weapons",()=>{
    for(const long of ["m93ba","smaw"]){
      expect(weaponViewWidth(long,false,0)).toBeGreaterThan(weaponViewWidth("m4",false,0));
      expect(weaponViewWidth(long,false,0)).toBeGreaterThan(weaponViewWidth("spas12",false,0));
    }
  });
  it.each([true,false])("range scope exposes maximum range in every tested aim direction; lookahead %s",lookAhead=>{
    const view={width:1920,height:1080,playableHeight:1080};
    for(const w of Object.values(WEAPONS))for(let degrees=0;degrees<360;degrees+=15){
      const aim=degrees*Math.PI/180,actor={x:5000,y:5000,aim,weapon:w.id};
      const camera=cameraFrame(actor,view,3,lookAhead);
      const hit={x:actor.x+Math.cos(aim)*w.range,y:actor.y+Math.sin(aim)*w.range};
      expect(Math.abs(hit.x-camera.x),`${w.id} ${degrees} horizontal`).toBeLessThan(camera.visibleWidth/2);
      expect(Math.abs(hit.y-camera.y),`${w.id} ${degrees} vertical`).toBeLessThan(camera.visibleWidth*view.playableHeight/view.width/2);
    }
  });
  it("keeps normal phone actors legible and makes distant scope an explicit tradeoff",()=>{
    const near=weaponViewWidth("m93ba",true,0);
    expect(390/near*44).toBeGreaterThan(25);
    expect(390/near*28).toBeGreaterThan(16);
    expect(weaponViewWidth("m93ba",true,3)).toBeGreaterThan(near*2);
  });
  it("bounds persisted scope choices to known weapons and four levels",()=>{
    expect(scopesOf({smaw:3,m93ba:0,ak47:9,constructor:1})).toEqual({smaw:3,m93ba:0});
    expect(sanitizePrefs({scopes:{smaw:3},lowFlash:true,cameraLookAhead:false})).toMatchObject({scopes:{smaw:3},lowFlash:true,cameraLookAhead:false});
    for(const scopes of [{smaw:4},{smaw:.5},{smaw:"2"},{unknown:1}])expect(()=>sanitizePrefs({scopes})).toThrow();
  });
});
