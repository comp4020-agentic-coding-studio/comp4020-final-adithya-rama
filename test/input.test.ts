import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { JSDOM } from "jsdom";
import { ACTION_LABELS, bindingsOf, CLIENT_ACTIONS, DEFAULT_BINDINGS, Input } from "../src/client/input.ts";
import { Btn } from "../src/shared/types.ts";
describe("desktop aiming and weapon controls",()=>{
  let dom:JSDOM, input:Input, canvas:HTMLElement;
  const score=vi.fn<(show:boolean)=>void>(),menu=vi.fn<()=>void>();
  const key=(code:string,down=true,keyValue=code,target:EventTarget=window)=>{
    const event=new dom.window.KeyboardEvent(down?"keydown":"keyup",{code,key:keyValue,bubbles:true,cancelable:true});
    target.dispatchEvent(event);return event;
  };
  beforeEach(()=>{
    dom=new JSDOM("<!doctype html><body><div id='canvas'></div><input id='chat'></body>",{pretendToBeVisual:true});
    vi.stubGlobal("window",dom.window);vi.stubGlobal("document",dom.window.document);
    canvas=document.getElementById("canvas")!;score.mockClear();menu.mockClear();
    input=new Input(canvas,{onScoreboard:score,onMenu:menu});
  });
  afterEach(()=>{input.destroy();dom.window.close();vi.unstubAllGlobals();});
  it.each([["Numpad2","ArrowDown",Math.PI/2],["Numpad4","ArrowLeft",Math.PI],["Numpad6","ArrowRight",0],["Numpad8","ArrowUp",-Math.PI/2]])("aims and holds fire with %s, including NumLock off",(code,alternate,angle)=>{
    key(code,true,"End");
    expect(input.updateAim({x:0,y:0})).toBeCloseTo(angle);
    expect(input.buttons()).toBe(Btn.FIRE|Btn.CONTINUOUS_FIRE);
    key(code,false);expect(input.buttons()).toBe(0);
    key(alternate);expect(input.updateAim({x:0,y:0})).toBeCloseTo(angle);expect(input.buttons()).toBe(0);
  });
  it("combines diagonal directions without counting duplicate aliases twice",()=>{
    key("Numpad8");key("ArrowUp");key("Numpad6");
    expect(input.updateAim({x:0,y:0})).toBeCloseTo(-Math.PI/4);
    key("Numpad4");expect(input.updateAim({x:0,y:0})).toBeCloseTo(-Math.PI/2);
    key("Numpad2");expect(input.buttons()).toBe(0);
  });
  it("faces horizontal movement and never reuses a stale mouse aim",()=>{
    window.dispatchEvent(new dom.window.MouseEvent("mousemove",{clientX:100,clientY:100}));
    expect(input.updateAim({x:0,y:0})).toBeCloseTo(Math.PI/4);
    key("KeyA");expect(input.updateAim({x:0,y:0})).toBeCloseTo(Math.PI);key("KeyA",false);
    expect(input.updateAim({x:0,y:0})).toBeCloseTo(Math.PI);
    key("Numpad8");expect(input.updateAim({x:0,y:0})).toBeCloseTo(-Math.PI/2);key("Numpad8",false);
    expect(input.updateAim({x:0,y:0})).toBeCloseTo(-Math.PI/2);
    window.dispatchEvent(new dom.window.MouseEvent("mousemove",{clientX:110,clientY:0}));
    expect(input.updateAim({x:0,y:0})).toBeCloseTo(0);
  });
  it("keeps intentional mouse aim while firing and gives mouse only ordinary fire intent",()=>{
    canvas.dispatchEvent(new dom.window.MouseEvent("mousedown",{button:0,clientX:0,clientY:-100}));
    key("KeyD");expect(input.updateAim({x:0,y:0})).toBeCloseTo(-Math.PI/2);
    expect(input.buttons()).toBe(Btn.RIGHT|Btn.FIRE);
    window.dispatchEvent(new dom.window.MouseEvent("mouseup",{button:0}));
    key("KeyD",false);key("KeyA");expect(input.updateAim({x:0,y:0})).toBeCloseTo(Math.PI);
  });
  it("selects three direct slots, cycles with Tab, and shows scores with B",()=>{
    for(const [code,bit] of [["Digit1",Btn.SLOT1],["Digit2",Btn.SLOT2],["Digit3",Btn.SLOT3],["Tab",Btn.SWITCH]] as const){
      expect(key(code).defaultPrevented).toBe(true);expect(input.sampleButtons()).toBe(bit);key(code,false);
    }
    key("KeyB");expect(score).toHaveBeenLastCalledWith(true);expect(input.buttons()).toBe(0);
    key("KeyB",false);expect(score).toHaveBeenLastCalledWith(false);
  });
  it("allows Tab navigation while menus are open and ignores typed chat controls",()=>{
    input.enabled=false;expect(key("Tab").defaultPrevented).toBe(false);expect(input.buttons()).toBe(0);
    key("Escape");expect(menu).toHaveBeenCalledOnce();
    input.enabled=true;key("KeyA",true,"a",document.getElementById("chat")!);expect(input.buttons()).toBe(0);
  });
  it("keeps browser focus controls in an open modal and ignores movement autorepeat as a new aim choice",()=>{
    key("KeyA");window.dispatchEvent(new dom.window.MouseEvent("mousemove",{clientX:0,clientY:-100}));
    document.body.dispatchEvent(new dom.window.KeyboardEvent("keydown",{code:"KeyA",repeat:true,bubbles:true}));
    expect(input.updateAim({x:0,y:0})).toBeCloseTo(-Math.PI/2);
    const modal=document.createElement("dialog");modal.setAttribute("open","");document.body.append(modal);
    expect(key("Tab").defaultPrevented).toBe(false);expect(key("Escape").defaultPrevented).toBe(false);expect(menu).not.toHaveBeenCalled();
  });
  it("clears held keyboard aim/fire on blur and hidden documents",()=>{
    key("Numpad8");key("KeyA");window.dispatchEvent(new dom.window.Event("blur"));
    expect(input.buttons()).toBe(0);
    key("Numpad6");Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new dom.window.Event("visibilitychange"));
    expect(input.buttons()).toBe(0);
  });
  it("migrates untouched legacy defaults but preserves deliberate remaps",()=>{
    const old={...DEFAULT_BINDINGS};
    for(const k of ["Digit3","KeyB","Backquote","Numpad2","Numpad4","Numpad6","Numpad8"])delete old[k];
    old.Tab=CLIENT_ACTIONS.SCOREBOARD;
    expect(bindingsOf(old)).toEqual(DEFAULT_BINDINGS);
    old.KeyL=old.KeyD;delete old.KeyD;
    expect(bindingsOf(old)).toEqual(old);
    expect(bindingsOf({Numpad4:-8,Backquote:-2,Digit3:Btn.SLOT3,constructor:32})).toEqual({Numpad4:-8,Backquote:-2,Digit3:Btn.SLOT3});
    expect(ACTION_LABELS[Btn.CONTINUOUS_FIRE]).toBeUndefined();
  });
});
