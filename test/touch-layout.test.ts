import {describe,it,expect} from "vitest";
import {normalizeTouchLayout,normalizedTouchCenter,touchCenter,TOUCH_LAYOUT_KEYS} from "../src/shared/touch-layout.ts";
import {defaultTouchControls,touchLayoutConflicts} from "../src/client/touch-layout.ts";
describe("portable touch layouts",()=>{
  it("accepts only finite normalized centers and known control keys",()=>{
    expect(normalizeTouchLayout({scale:99,opacity:-1,positions:{move:{x:-10,y:20},slot3:{x:.4,y:.6},aim:{x:NaN,y:.8},unknown:{x:0,y:0}}})).toEqual({scale:1.35,opacity:.35,positions:{move:{x:0,y:1},slot3:{x:.4,y:.6}}});
    expect(normalizeTouchLayout({scale:NaN,opacity:Infinity})).toEqual({scale:1,opacity:.9,positions:{}});
  });
  it.each([[390,844],[844,390],[320,568],[1920,1080]])("keeps all18 controls reachable and separate at %s by %s across size settings",(width,height)=>{
    const bounds={left:12,top:24,width:width-24,height:height-48};
    for(const scale of [.75,1,1.35]){
      const controls=defaultTouchControls(bounds,scale);
      expect(controls.map(control=>control.key).sort()).toEqual([...TOUCH_LAYOUT_KEYS].sort());expect(touchLayoutConflicts(controls).size).toBe(0);
      for(const control of controls){expect(control.width).toBeGreaterThanOrEqual(44);expect(control.height).toBeGreaterThanOrEqual(44);expect(control.center.x-control.width/2).toBeGreaterThanOrEqual(bounds.left-.001);expect(control.center.x+control.width/2).toBeLessThanOrEqual(bounds.left+bounds.width+.001);expect(control.center.y-control.height/2).toBeGreaterThanOrEqual(bounds.top-.001);expect(control.center.y+control.height/2).toBeLessThanOrEqual(bounds.top+bounds.height+.001);}
    }
  });
  it("clamps each dragged control by its full size, including safe-area insets",()=>{
    const bounds={left:20,top:30,width:350,height:720},size={width:100,height:80};
    expect(touchCenter({x:0,y:1},bounds,size)).toEqual({x:70,y:710});
    const point={x:235,y:460};expect(touchCenter(normalizedTouchCenter(point,bounds),bounds,size)).toEqual(point);
  });
  it("detects overlapping buttons before saving an inaccessible arrangement",()=>{
    const controls=defaultTouchControls({left:8,top:8,width:374,height:828},1);controls[1].center={...controls[0].center};
    expect(touchLayoutConflicts(controls)).toEqual(new Set(["move","aim"]));
  });
});
