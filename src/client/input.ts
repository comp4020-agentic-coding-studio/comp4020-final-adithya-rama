import { Btn } from "../shared/types.ts";
export const CLIENT_ACTIONS = { ZOOM:-1, SCOREBOARD:-2, MENU:-3, AIM_LEFT:-4, AIM_RIGHT:-5, AIM_UP:-6, AIM_DOWN:-7, FIRE_LEFT:-8, FIRE_RIGHT:-9, FIRE_UP:-10, FIRE_DOWN:-11 } as const;
export const ACTION_LABELS: Record<number,string> = {
  [Btn.LEFT]:"Move left",[Btn.RIGHT]:"Move right",[Btn.JUMP]:"Jump",[Btn.JET]:"Fly",[Btn.CROUCH]:"Crouch / descend",
  [Btn.FIRE]:"Fire",[Btn.RELOAD]:"Reload",[Btn.PICKUP]:"Pick up",[Btn.DROP]:"Drop equipment",[Btn.SWITCH]:"Cycle weapons",
  [Btn.SLOT1]:"Weapon slot 1",[Btn.SLOT2]:"Weapon slot 2",[Btn.SLOT3]:"Weapon slot 3",[Btn.THROW]:"Throw grenade",[Btn.NEXT_THROWABLE]:"Next grenade",
  [Btn.MELEE]:"Melee",[Btn.DUAL]:"Dual wield",[-1]:"Zoom",[-2]:"Scoreboard",[-3]:"Menu",[-4]:"Aim left",[-5]:"Aim right",[-6]:"Aim up",[-7]:"Aim down",[-8]:"Aim + fire left",[-9]:"Aim + fire right",[-10]:"Aim + fire up",[-11]:"Aim + fire down",
};
export const DEFAULT_BINDINGS: Record<string,number> = {
  KeyA:Btn.LEFT,KeyD:Btn.RIGHT,KeyW:Btn.JUMP,Space:Btn.JET,KeyS:Btn.CROUCH,KeyR:Btn.RELOAD,KeyE:Btn.PICKUP,KeyX:Btn.DROP,
  Tab:Btn.SWITCH,KeyQ:Btn.SWITCH,Digit1:Btn.SLOT1,Digit2:Btn.SLOT2,Digit3:Btn.SLOT3,KeyG:Btn.THROW,KeyT:Btn.NEXT_THROWABLE,KeyV:Btn.MELEE,KeyF:Btn.DUAL,
  KeyJ:Btn.FIRE,Enter:Btn.FIRE,KeyZ:-1,KeyB:-2,Backquote:-2,Escape:-3,
  Numpad4:-8,Numpad6:-9,Numpad8:-10,Numpad2:-11,ArrowLeft:-4,ArrowRight:-5,ArrowUp:-6,ArrowDown:-7,
};
const LEGACY_BINDINGS:Record<string,number> = Object.fromEntries(Object.entries(DEFAULT_BINDINGS).filter(([key])=>!["Digit3","KeyB","Backquote","Numpad2","Numpad4","Numpad6","Numpad8"].includes(key)));
LEGACY_BINDINGS.Tab=CLIENT_ACTIONS.SCOREBOARD;
export const BINDABLE_CODE=/^(Key[A-Z]|Digit[0-9]|Numpad[2468]|Arrow(Left|Right|Up|Down)|Space|Enter|Tab|Escape|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|Backspace|Backquote|BracketLeft|BracketRight|Comma|Period|Slash|Semicolon|Quote|Minus|Equal)$/;
export function bindingsOf(value:unknown):Record<string,number> {
  if(!value || typeof value!=="object") return {...DEFAULT_BINDINGS};
  const valid=Object.entries(value).filter(([key,n])=>BINDABLE_CODE.test(key)&&typeof n==="number"&&Object.hasOwn(ACTION_LABELS,n));
  if(!valid.length)return {...DEFAULT_BINDINGS};
  // Upgrade untouched old defaults only. A pilot's deliberate key choices win.
  if(valid.length===Object.keys(LEGACY_BINDINGS).length&&valid.every(([key,n])=>LEGACY_BINDINGS[key]===n))return {...DEFAULT_BINDINGS};
  return Object.fromEntries(valid);
}
export function keyLabel(code:string):string {
  if(code==="Backquote")return "\u0060";
  if(code.startsWith("Numpad"))return "Num "+code.slice(6);
  return code.replace(/^Key/,"").replace(/^Digit/,"").replace("Arrow","").replace("Left"," L").replace("Right"," R");
}
export interface InputCallbacks { onScoreboard(show:boolean):void; onMenu():void }
export class Input {
  private pressed=new Set<string>();
  private touchHeld=0;
  private tapBits=0;
  private mouseFire=false;
  private mouseZoom=false;
  private mouse={x:0,y:0,active:false};
  private aimSource:"mouse"|"keyboard"|"movement"|"touch"="movement";
  private touchAim:number|null=null;
  private teardown:(()=>void)[]=[];
  private clearListeners=new Set<()=>void>();
  private bindings:Record<string,number>;
  private cb:InputCallbacks;
  enabled=true;
  aim=0;
  constructor(canvas:HTMLElement,cb:InputCallbacks,bindings:Record<string,number>=DEFAULT_BINDINGS) {
    this.cb=cb;this.bindings=bindings;
    const on=<K extends keyof WindowEventMap>(type:K,fn:(e:WindowEventMap[K])=>void)=>{
      window.addEventListener(type,fn);this.teardown.push(()=>window.removeEventListener(type,fn));
    };
    on("keydown",e=>this.key(e,true));on("keyup",e=>this.key(e,false));on("blur",()=>this.clear());
    on("mousemove",e=>{
      if(!this.enabled)return;
      if(!this.mouse.active||e.clientX!==this.mouse.x||e.clientY!==this.mouse.y)this.aimSource="mouse";
      this.mouse={x:e.clientX,y:e.clientY,active:true};
    });
    const down=(e:MouseEvent)=>{
      if(!this.enabled)return;
      this.mouse={x:e.clientX,y:e.clientY,active:true};this.aimSource="mouse";
      if(e.button===0)this.mouseFire=true;if(e.button===2)this.mouseZoom=true;
    };
    const up=(e:MouseEvent)=>{if(e.button===0)this.mouseFire=false;if(e.button===2)this.mouseZoom=false;};
    const context=(e:Event)=>e.preventDefault();
    const visibility=()=>{if(document.hidden)this.clear();};
    canvas.addEventListener("mousedown",down);window.addEventListener("mouseup",up);canvas.addEventListener("contextmenu",context);
    document.addEventListener("visibilitychange",visibility);
    this.teardown.push(()=>{canvas.removeEventListener("mousedown",down);window.removeEventListener("mouseup",up);canvas.removeEventListener("contextmenu",context);document.removeEventListener("visibilitychange",visibility);});
  }
  private key(e:KeyboardEvent,down:boolean):void {
    if(document.querySelector("dialog[open]")){if(!down)this.pressed.delete(e.code);return;}
    const t=e.target as HTMLElement|null;
    if(t&&(t.matches?.("input,select,textarea")||t.isContentEditable)) {if(!down)this.pressed.delete(e.code);return;}
    if(t?.tagName==="BUTTON"&&!this.enabled&&(e.code==="Space"||e.code==="Enter"))return;
    const action=this.bindings[e.code];if(action===undefined)return;
    if(action===CLIENT_ACTIONS.MENU) {e.preventDefault();if(down&&!e.repeat)this.cb.onMenu();return;}
    if(!this.enabled){if(!down)this.pressed.delete(e.code);return;}
    e.preventDefault();
    if(action===CLIENT_ACTIONS.SCOREBOARD) {this.cb.onScoreboard(down);return;}
    if(down)this.pressed.add(e.code);else this.pressed.delete(e.code);
    if(down&&!e.repeat&&action>0&&action!==Btn.LEFT&&action!==Btn.RIGHT&&action!==Btn.JET&&action!==Btn.CROUCH&&action!==Btn.FIRE)this.tapBits|=action;
    if(down&&action<=-4)this.aimSource="keyboard";
    if(down&&!e.repeat&&(action===Btn.LEFT||action===Btn.RIGHT)&&!this.mouseFire) {
      const vector=this.keyboardAim();
      if(!vector.x&&!vector.y)this.aimSource="movement";
    }
  }
  private keyboardAim():{x:number;y:number} {
    const actions=new Set([...this.pressed].map(key=>this.bindings[key]));
    return {x:Number(actions.has(-5)||actions.has(-9))-Number(actions.has(-4)||actions.has(-8)),y:Number(actions.has(-7)||actions.has(-11))-Number(actions.has(-6)||actions.has(-10))};
  }
  get zoom():boolean {return this.enabled&&(this.mouseZoom||[...this.pressed].some(k=>this.bindings[k]===-1));}
  setTouch(bits:number,aim:number|null):void {this.touchHeld=bits;this.touchAim=aim;if(aim!==null)this.aimSource="touch";else if(bits&(Btn.LEFT|Btn.RIGHT))this.aimSource="movement";}
  tapTouch(bit:number):void {if(this.enabled)this.tapBits|=bit;}
  clearTouch():void {this.touchHeld=0;this.touchAim=null;this.tapBits=0;}
  sampleButtons():number {const buttons=this.buttons();this.tapBits=0;return buttons;}
  onClear(listener:()=>void):()=>void {this.clearListeners.add(listener);return ()=>{this.clearListeners.delete(listener);};}
  clear():void {
    this.pressed.clear();this.clearTouch();this.mouseFire=false;this.mouseZoom=false;this.mouse.active=false;
    this.aimSource="movement";
    for(const listener of this.clearListeners)listener();
    this.cb.onScoreboard(false);
  }
  buttons():number {
    if(!this.enabled)return 0;
    let b=this.touchHeld|this.tapBits|(this.mouseFire?Btn.FIRE:0);
    for(const key of this.pressed){const n=this.bindings[key];if(n>0)b|=n;}
    const {x,y}=this.keyboardAim();
    if((x||y)&&[...this.pressed].some(key=>this.bindings[key]<=-8))b|=Btn.FIRE|Btn.CONTINUOUS_FIRE;
    return b;
  }
  updateAim(origin:{x:number;y:number}):number {
    if(!this.enabled)return this.aim;
    const {x,y}=this.keyboardAim();
    if(this.touchAim!==null)this.aim=this.touchAim;
    else if(x||y)this.aim=Math.atan2(y,x);
    else if(this.aimSource==="mouse"&&this.mouse.active)this.aim=Math.atan2(this.mouse.y-origin.y,this.mouse.x-origin.x);
    else {
      const buttons=this.buttons();
      if(Boolean(buttons&Btn.LEFT)!==Boolean(buttons&Btn.RIGHT)&&buttons&(Btn.LEFT|Btn.RIGHT))this.aim=buttons&Btn.LEFT?Math.PI:0;
    }
    return this.aim;
  }
  destroy():void {this.clear();for(const f of this.teardown)f();this.clearListeners.clear();}
}
