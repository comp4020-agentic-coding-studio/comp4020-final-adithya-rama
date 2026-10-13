import {normalizeTouchLayout,normalizedTouchCenter,touchCenter,TOUCH_LAYOUT_KEYS,TOUCH_LAYOUT_OPACITY,TOUCH_LAYOUT_SCALE} from "../shared/touch-layout.ts";
import type {TouchBounds,TouchLayout,TouchLayoutKey,TouchPoint} from "../shared/touch-layout.ts";
export type {TouchLayout} from "../shared/touch-layout.ts";
const ACTIONS=TOUCH_LAYOUT_KEYS.filter(key=>!["move","aim","score","menu"].includes(key));
export interface PositionedControl {key:TouchLayoutKey;center:TouchPoint;width:number;height:number}
export function defaultTouchControls(bounds:TouchBounds,scale:number):PositionedControl[] {
  const gap=6,buttonH=Math.max(44,42*scale),metaW=Math.max(56,60*scale);
  const stick=Math.min(130*scale,(bounds.width-metaW-gap*4)/2,bounds.height*.24);
  const bottom=bounds.top+bounds.height;
  const controls:PositionedControl[]=[
    {key:"move",center:{x:bounds.left+stick/2,y:bottom-stick/2},width:stick,height:stick},
    {key:"aim",center:{x:bounds.left+bounds.width-stick/2,y:bottom-stick/2},width:stick,height:stick},
    {key:"score",center:{x:bounds.left+bounds.width/2,y:bottom-buttonH*1.5-gap},width:metaW,height:buttonH},
    {key:"menu",center:{x:bounds.left+bounds.width/2,y:bottom-buttonH/2},width:metaW,height:buttonH},
  ];
  const columns=Math.max(3,Math.min(5,Math.floor((bounds.width+gap)/(64*scale+gap))));
  const gridWidth=Math.min(bounds.width,columns*76*scale+(columns-1)*gap),buttonW=(gridWidth-(columns-1)*gap)/columns;
  const rows=Math.ceil(ACTIONS.length/columns),gridBottom=bottom-Math.max(stick,buttonH*2+gap)-gap*2;
  const gridTop=gridBottom-rows*buttonH-(rows-1)*gap;
  for(const [index,key] of ACTIONS.entries())controls.push({key,center:{x:bounds.left+(bounds.width-gridWidth)/2+buttonW/2+(index%columns)*(buttonW+gap),y:gridTop+buttonH/2+Math.floor(index/columns)*(buttonH+gap)},width:buttonW,height:buttonH});
  return controls;
}

export function touchLayoutConflicts(controls:PositionedControl[]):Set<TouchLayoutKey> {
  const conflicts=new Set<TouchLayoutKey>();
  for(let a=0;a<controls.length;a++)for(let b=a+1;b<controls.length;b++){
    const first=controls[a],second=controls[b];
    const w=Math.min(first.center.x+first.width/2,second.center.x+second.width/2)-Math.max(first.center.x-first.width/2,second.center.x-second.width/2);
    const h=Math.min(first.center.y+first.height/2,second.center.y+second.height/2)-Math.max(first.center.y-first.height/2,second.center.y-second.height/2);
    if(w>2&&h>2){conflicts.add(first.key);conflicts.add(second.key);}
  }
  return conflicts;
}

// Owns only presentation. TouchControls owns gameplay input and clears it before
// opening this editor; capture listeners ensure a drag cannot also fire a weapon.
export class TouchLayoutEditor {
  private value:TouchLayout=normalizeTouchLayout(undefined);
  private editing=false;
  private saved:TouchLayout|null=null;
  private toolbar:HTMLElement|null=null;
  private drag:{id:number;key:TouchLayoutKey;el:HTMLElement;dx:number;dy:number}|null=null;
  private onSave:((value:TouchLayout)=>void)|null=null;
  private onDone:(()=>void)|null=null;
  private resize:ResizeObserver;
  private positions=new Map<TouchLayoutKey,PositionedControl>();
  private probe:HTMLElement;
  private root:HTMLElement;
  constructor(root:HTMLElement){
    this.root=root;
    root.classList.add("custom-touch-layout");
    this.probe=document.createElement("i");this.probe.className="touch-safe-area";this.probe.setAttribute("aria-hidden","true");root.append(this.probe);
    this.resize=new ResizeObserver(()=>this.apply());this.resize.observe(root);
    root.addEventListener("pointerdown",this.down,true);root.addEventListener("pointermove",this.move,true);
    root.addEventListener("pointerup",this.up,true);root.addEventListener("pointercancel",this.up,true);root.addEventListener("lostpointercapture",this.up,true);
    root.addEventListener("click",this.blockClick,true);window.addEventListener("blur",this.blur);window.addEventListener("keydown",this.key,true);document.addEventListener("visibilitychange",this.visibility);
    this.apply();
  }
  get active():boolean{return this.editing;}
  set(value:unknown):void {this.value=normalizeTouchLayout(value);this.apply();}
  reset():void {this.value=normalizeTouchLayout(undefined);this.apply();this.syncSliders();}
  private bounds():TouchBounds {
    const rect=this.root.getBoundingClientRect(),style=getComputedStyle(this.probe);
    const left=8+(parseFloat(style.paddingLeft)||0),right=8+(parseFloat(style.paddingRight)||0),top=8+(parseFloat(style.paddingTop)||0),bottom=8+(parseFloat(style.paddingBottom)||0);
    return {left,top,width:Math.max(1,rect.width-left-right),height:Math.max(1,rect.height-top-bottom)};
  }
  private apply():void {
    const bounds=this.bounds();if(bounds.width<100||bounds.height<100)return;this.positions.clear();
    const defaults=defaultTouchControls(bounds,this.value.scale);
    let controls=defaults.map(item=>({...item,center:touchCenter(this.value.positions[item.key]??normalizedTouchCenter(item.center,bounds),bounds,item)}));
    const conflicts=touchLayoutConflicts(controls);
    // A narrow or rotated screen may make saved centers collide. Use a reachable
    // responsive arrangement until there is room again, without erasing the save.
    const adapted=!this.editing&&conflicts.size>0;
    if(adapted)controls=defaults;
    this.root.dataset.layoutAdapted=String(adapted);
    for(const item of controls){
      const {center}=item;this.positions.set(item.key,item);
      const el=this.root.querySelector<HTMLElement>(`[data-control="${item.key}"]`);if(!el)continue;
      el.classList.toggle("layout-conflict",this.editing&&conflicts.has(item.key));
      Object.assign(el.style,{left:`${center.x-item.width/2}px`,top:`${center.y-item.height/2}px`,width:`${item.width}px`,height:`${item.height}px`,opacity:String(this.value.opacity)});
    }
    if(this.toolbar){
      this.toolbar.querySelector<HTMLButtonElement>("[data-layout-save]")!.disabled=conflicts.size>0;
      this.toolbar.querySelector<HTMLElement>("[data-layout-status]")!.textContent=conflicts.size?"Outlined controls overlap. Move them apart to save.":"All controls stay inside the screen.";
    }
    // Keep a continuous upper play area. Freely positioned upper controls do not
    // collapse the camera; only the bottom control cluster reserves screen space.
    const bottomControls=[...this.positions.values()].filter(item=>item.center.y>bounds.top+bounds.height*.55);
    this.root.dataset.playableBottom=String(bottomControls.length?Math.max(bounds.height*.42,Math.min(...bottomControls.map(item=>item.center.y-item.height/2))-12):bounds.top+bounds.height);
  }
  edit(onSave:(value:TouchLayout)=>void,onDone:()=>void):void {
    if(this.editing)return;
    this.saved=normalizeTouchLayout(this.value);this.onSave=onSave;this.onDone=onDone;this.editing=true;this.root.classList.add("layout-editing");
    const toolbar=document.createElement("section");toolbar.className="touch-layout-editor";toolbar.setAttribute("role","dialog");toolbar.setAttribute("aria-label","Arrange touch controls");
    toolbar.innerHTML=`<strong>Arrange your controls</strong><p>Drag any button or stick. Changes save to your pilot.</p><div class="touch-layout-sliders"><label>Size <input data-layout-size type="range" min="${TOUCH_LAYOUT_SCALE.min}" max="${TOUCH_LAYOUT_SCALE.max}" step=".05"><output></output></label><label>Opacity <input data-layout-opacity type="range" min="${TOUCH_LAYOUT_OPACITY.min}" max="${TOUCH_LAYOUT_OPACITY.max}" step=".05"><output></output></label></div><div class="touch-layout-actions"><button data-layout-reset>Reset</button><button data-layout-cancel>Cancel</button><button data-layout-save>Save layout</button></div><small data-layout-status aria-live="polite">All controls stay inside the screen.</small>`;
    this.toolbar=toolbar;this.root.append(toolbar);this.syncSliders();
    for(const [selector,key] of [["[data-layout-size]","scale"],["[data-layout-opacity]","opacity"]] as const){
      toolbar.querySelector<HTMLInputElement>(selector)!.addEventListener("input",e=>{this.value[key]=Number((e.target as HTMLInputElement).value);this.apply();this.syncSliders();});
    }
    toolbar.querySelector("[data-layout-reset]")!.addEventListener("click",()=>this.reset());
    toolbar.querySelector("[data-layout-save]")!.addEventListener("click",()=>this.finish(true));
    toolbar.querySelector("[data-layout-cancel]")!.addEventListener("click",()=>this.finish(false));
    this.apply();
    toolbar.querySelector<HTMLButtonElement>("[data-layout-save]")!.focus();
  }
  private syncSliders():void {
    if(!this.toolbar)return;
    for(const [selector,key] of [["[data-layout-size]","scale"],["[data-layout-opacity]","opacity"]] as const){const slider=this.toolbar.querySelector<HTMLInputElement>(selector)!;slider.value=String(this.value[key]);slider.nextElementSibling!.textContent=Math.round(this.value[key]*100)+"%";}
  }
  private down=(event:PointerEvent):void=>{
    if(!this.editing)return;
    const el=(event.target as HTMLElement).closest<HTMLElement>("[data-control]");if(!el)return;
    event.preventDefault();event.stopImmediatePropagation();if(this.drag)return;
    const key=el.dataset.control as TouchLayoutKey,item=this.positions.get(key);if(!item)return;
    const rect=this.root.getBoundingClientRect();this.drag={id:event.pointerId,key,el,dx:event.clientX-rect.left-item.center.x,dy:event.clientY-rect.top-item.center.y};
    el.setPointerCapture(event.pointerId);el.classList.add("layout-dragging");
  };
  private move=(event:PointerEvent):void=>{
    if(!this.editing||!this.drag||event.pointerId!==this.drag.id)return;
    event.preventDefault();event.stopImmediatePropagation();
    const rect=this.root.getBoundingClientRect(),bounds=this.bounds(),item=this.positions.get(this.drag.key)!;
    const point=touchCenter(normalizedTouchCenter({x:event.clientX-rect.left-this.drag.dx,y:event.clientY-rect.top-this.drag.dy},bounds),bounds,item);
    this.value.positions[this.drag.key]=normalizedTouchCenter(point,bounds);this.apply();
  };
  private up=(event:PointerEvent):void=>{if(!this.editing||!this.drag||event.pointerId!==this.drag.id)return;event.preventDefault();event.stopImmediatePropagation();this.release();};
  private release():void {const drag=this.drag;this.drag=null;if(!drag)return;drag.el.classList.remove("layout-dragging");if(drag.el.hasPointerCapture(drag.id))drag.el.releasePointerCapture(drag.id);}
  private blockClick=(event:MouseEvent):void=>{if(this.editing&&(event.target as HTMLElement).closest("[data-control]")){event.preventDefault();event.stopImmediatePropagation();}};
  private key=(event:KeyboardEvent):void=>{
    if(!this.editing)return;
    if(event.code==="Escape"){event.preventDefault();event.stopImmediatePropagation();this.finish(false);return;}
    if(event.code==="Tab"&&this.toolbar){
      const items=[...this.toolbar.querySelectorAll<HTMLElement>("button:not(:disabled),input")],first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  };
  private blur=():void=>{this.release();};
  private visibility=():void=>{if(document.hidden)this.release();};
  finish(save:boolean):void {
    if(!this.editing)return;
    this.release();const onSave=this.onSave,onDone=this.onDone;
    if(!save&&this.saved)this.value=this.saved;
    this.editing=false;this.saved=null;this.onSave=null;this.onDone=null;this.toolbar?.remove();this.toolbar=null;this.root.classList.remove("layout-editing");this.apply();
    try {if(save)onSave?.(normalizeTouchLayout(this.value));} finally {onDone?.();}
  }
  destroy():void {
    this.onDone=null;this.onSave=null;this.finish(false);this.resize.disconnect();
    this.root.removeEventListener("pointerdown",this.down,true);this.root.removeEventListener("pointermove",this.move,true);this.root.removeEventListener("pointerup",this.up,true);this.root.removeEventListener("pointercancel",this.up,true);this.root.removeEventListener("lostpointercapture",this.up,true);this.root.removeEventListener("click",this.blockClick,true);
    window.removeEventListener("blur",this.blur);window.removeEventListener("keydown",this.key,true);document.removeEventListener("visibilitychange",this.visibility);this.probe.remove();
  }
}
