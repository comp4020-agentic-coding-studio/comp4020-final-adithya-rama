import { Btn } from "../shared/types.ts";
export const CLIENT_ACTIONS = { ZOOM:-1, SCOREBOARD:-2, MENU:-3, AIM_LEFT:-4, AIM_RIGHT:-5, AIM_UP:-6, AIM_DOWN:-7 } as const;
export const ACTION_LABELS: Record<number,string> = {
  [Btn.LEFT]:"Move left",[Btn.RIGHT]:"Move right",[Btn.JUMP]:"Jump",[Btn.JET]:"Fly",[Btn.CROUCH]:"Crouch / descend",
  [Btn.FIRE]:"Fire",[Btn.RELOAD]:"Reload",[Btn.PICKUP]:"Pick up",[Btn.DROP]:"Drop equipment",[Btn.SWITCH]:"Switch weapon",
  [Btn.SLOT1]:"Weapon slot 1",[Btn.SLOT2]:"Weapon slot 2",[Btn.THROW]:"Throw grenade",[Btn.NEXT_THROWABLE]:"Next grenade",
  [Btn.MELEE]:"Melee",[Btn.DUAL]:"Dual wield",[-1]:"Zoom",[-2]:"Scoreboard",[-3]:"Menu",[-4]:"Aim left",[-5]:"Aim right",[-6]:"Aim up",[-7]:"Aim down",
};
export const DEFAULT_BINDINGS: Record<string,number> = {
  KeyA:Btn.LEFT,KeyD:Btn.RIGHT,KeyW:Btn.JUMP,Space:Btn.JET,KeyS:Btn.CROUCH,KeyR:Btn.RELOAD,KeyE:Btn.PICKUP,KeyX:Btn.DROP,
  KeyQ:Btn.SWITCH,Digit1:Btn.SLOT1,Digit2:Btn.SLOT2,KeyG:Btn.THROW,KeyT:Btn.NEXT_THROWABLE,KeyV:Btn.MELEE,KeyF:Btn.DUAL,
  KeyJ:Btn.FIRE,Enter:Btn.FIRE,KeyZ:-1,Tab:-2,Escape:-3,ArrowLeft:-4,ArrowRight:-5,ArrowUp:-6,ArrowDown:-7,
};
export function bindingsOf(value:unknown):Record<string,number> {
  if(!value || typeof value!=="object") return {...DEFAULT_BINDINGS};
  const valid=Object.entries(value).filter(([key,n])=>/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Enter|Tab|Escape|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|Backspace|BracketLeft|BracketRight|Comma|Period|Slash|Semicolon|Quote|Minus|Equal)$/.test(key)&&typeof n==="number"&&n in ACTION_LABELS);
  return valid.length ? Object.fromEntries(valid) : {...DEFAULT_BINDINGS};
}
export function keyLabel(code:string):string { return code.replace(/^Key/,"").replace(/^Digit/,"").replace("Arrow","").replace("Left"," L").replace("Right"," R"); }
export interface InputCallbacks { onScoreboard(show:boolean):void; onMenu():void }
export class Input {
  private pressed=new Set<string>();
  private touchHeld=0;
  private mouseFire=false;
  private mouseZoom=false;
  private mouse={x:0,y:0,active:false};
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
    on("mousemove",e=>{this.mouse={x:e.clientX,y:e.clientY,active:true};});
    const down=(e:MouseEvent)=>{if(e.button===0)this.mouseFire=true;if(e.button===2)this.mouseZoom=true;};
    const up=(e:MouseEvent)=>{if(e.button===0)this.mouseFire=false;if(e.button===2)this.mouseZoom=false;};
    const context=(e:Event)=>e.preventDefault();
    const visibility=()=>{if(document.hidden)this.clear();};
    canvas.addEventListener("mousedown",down);window.addEventListener("mouseup",up);canvas.addEventListener("contextmenu",context);
    document.addEventListener("visibilitychange",visibility);
    this.teardown.push(()=>{canvas.removeEventListener("mousedown",down);window.removeEventListener("mouseup",up);canvas.removeEventListener("contextmenu",context);document.removeEventListener("visibilitychange",visibility);});
  }
  private key(e:KeyboardEvent,down:boolean):void {
    const t=e.target as HTMLElement|null;
    if(t&&(t.matches("input,select,textarea")||t.isContentEditable)) {if(!down)this.pressed.delete(e.code);return;}
    if(t?.tagName==="BUTTON"&&!this.enabled&&(e.code==="Space"||e.code==="Enter"))return;
    const action=this.bindings[e.code];if(action===undefined)return;
    e.preventDefault();
    if(action===CLIENT_ACTIONS.MENU) {if(down&&!e.repeat)this.cb.onMenu();return;}
    if(action===CLIENT_ACTIONS.SCOREBOARD) {this.cb.onScoreboard(down);return;}
    if(down)this.pressed.add(e.code);else this.pressed.delete(e.code);
    if(action<=-4)this.mouse.active=false;
  }
  get zoom():boolean {return this.enabled&&(this.mouseZoom||[...this.pressed].some(k=>this.bindings[k]===-1));}
  setTouch(bits:number,aim:number|null):void {this.touchHeld=bits;this.touchAim=aim;}
  onClear(listener:()=>void):()=>void {
    this.clearListeners.add(listener);
    return ()=>{this.clearListeners.delete(listener);};
  }
  clear():void {
    this.pressed.clear();this.touchHeld=0;this.touchAim=null;this.mouseFire=false;this.mouseZoom=false;
    for(const listener of this.clearListeners)listener();
    this.cb.onScoreboard(false);
  }
  buttons():number {
    if(!this.enabled)return 0;
    let b=this.touchHeld|(this.mouseFire?Btn.FIRE:0);
    for(const key of this.pressed){const n=this.bindings[key];if(n>0)b|=n;}
    return b;
  }
  updateAim(origin:{x:number;y:number}):number {
    if(!this.enabled)return this.aim;
    let dx=0,dy=0;
    for(const key of this.pressed) {const n=this.bindings[key];if(n===-4)dx--;if(n===-5)dx++;if(n===-6)dy--;if(n===-7)dy++;}
    if(this.touchAim!==null)this.aim=this.touchAim;
    else if(dx||dy)this.aim=Math.atan2(dy,dx);
    else if(this.mouse.active)this.aim=Math.atan2(this.mouse.y-origin.y,this.mouse.x-origin.x);
    return this.aim;
  }
  destroy():void {this.clear();for(const f of this.teardown)f();this.clearListeners.clear();}
}
