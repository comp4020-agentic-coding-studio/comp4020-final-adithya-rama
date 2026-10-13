import {describe,it,expect} from "vitest";
import {playArea} from "../src/client/play-area.ts";
import {cameraFrame,weaponViewWidth} from "../src/client/camera.ts";
describe("portrait camera clear band",()=>{
 it("keeps desktop framing unchanged when no top HUD band is reserved",()=>{expect(playArea(1080,1080)).toEqual({top:0,height:1080});});
 it("reserves actual portrait loadout height as well as the lower controls",()=>{expect(playArea(844,538,282)).toEqual({top:294,height:244});expect(playArea(844,478,305)).toEqual({top:317,height:161});});
 it("keeps the airborne body inside that band for all four scopes and cardinal aim angles",()=>{
  const area=playArea(844,538,282),viewport={width:390,height:844,playableHeight:area.height};
  for(const level of [0,1,2,3] as const)for(const aim of [0,Math.PI/2,Math.PI,-Math.PI/2]){
   const pilot={x:1600,y:800,aim,weapon:"smaw"},camera=cameraFrame(pilot,viewport,level),scale=390/camera.visibleWidth;
   const center=area.top+area.height/2+(pilot.y-camera.y)*scale,halfBody=22*scale;
   expect(center-halfBody).toBeGreaterThan(area.top);expect(center+halfBody).toBeLessThan(area.top+area.height);
  }
  expect(weaponViewWidth("smaw",true,0)).toBe(680);
 });
 it("keeps finite positive geometry for unusual small windows",()=>{expect(playArea(50,20,900)).toEqual({top:0,height:20});expect(playArea(844,NaN)).toEqual({top:0,height:844});});
});
