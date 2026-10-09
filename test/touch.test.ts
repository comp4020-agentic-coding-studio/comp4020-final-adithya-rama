import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { Input } from "../src/client/input.ts";
import { TouchControls } from "../src/client/touch.ts";
import { Btn } from "../src/shared/types.ts";

describe("touch input cleanup", () => {
  let dom: JSDOM;
  let input: Input;
  let touch: TouchControls;
  let root: HTMLDivElement;
  let zoom: ReturnType<typeof vi.fn<(on: boolean) => void>>;
  let captures: Map<HTMLElement, Set<number>>;

  function pointer(selector: string, type: string, id: number): void {
    const target = root.querySelector<HTMLElement>(selector)!;
    const event = new dom.window.MouseEvent(type, { bubbles: true, clientX: 90, clientY: 50 });
    Object.defineProperty(event, "pointerId", { value: id });
    target.dispatchEvent(event);
  }

  beforeEach(() => {
    dom = new JSDOM("<!doctype html><body></body>", { pretendToBeVisual: true });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    root = document.createElement("div");
    const canvas = document.createElement("div");
    document.body.append(root);
    root.append(canvas);
    zoom = vi.fn<(on: boolean) => void>();
    input = new Input(canvas, { onScoreboard() {}, onMenu() {} });
    touch = new TouchControls(root, input, { scoreboard() {}, menu() {}, zoom });
    captures = new Map();
    for (const element of root.querySelectorAll<HTMLElement>(".stick,[data-b]")) {
      captures.set(element, new Set());
      element.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, toJSON() {} });
      element.setPointerCapture = (id) => { captures.get(element)!.add(id); };
      element.hasPointerCapture = (id) => captures.get(element)!.has(id);
      element.releasePointerCapture = (id) => {
        captures.get(element)!.delete(id);
        const event = new dom.window.Event("lostpointercapture");
        Object.defineProperty(event, "pointerId", { value: id });
        element.dispatchEvent(event);
      };
    }
  });

  afterEach(() => {
    touch.destroy();
    input.destroy();
    dom.window.close();
    vi.unstubAllGlobals();
  });

  it("blur releases held movement so a new aim touch cannot resurrect it", () => {
    pointer(".stick.left", "pointerdown", 1);
    expect(input.buttons()).toBe(Btn.RIGHT);
    window.dispatchEvent(new dom.window.Event("blur"));
    expect(input.buttons()).toBe(0);
    expect([...captures.values()].every((set) => set.size === 0)).toBe(true);
    pointer(".stick.right", "pointerdown", 2);
    expect(input.buttons()).toBe((Btn.FIRE | Btn.CONTINUOUS_FIRE));
  });

  it("menu-style input clearing resets grenade buttons, sticks and latched zoom", () => {
    pointer(`[data-b="${Btn.THROW}"]`, "pointerdown", 1);
    pointer(".stick.right", "pointerdown", 2);
    root.querySelector<HTMLButtonElement>("[data-zoom]")!.click();
    expect(input.buttons()).toBe(Btn.THROW | (Btn.FIRE | Btn.CONTINUOUS_FIRE));
    expect(zoom).toHaveBeenLastCalledWith(true);
    input.clear();
    expect(input.buttons()).toBe(0);
    expect(zoom).toHaveBeenLastCalledWith(false);
    expect(root.querySelector("[data-zoom]")!.classList.contains("on")).toBe(false);
    expect([...captures.values()].every((set) => set.size === 0)).toBe(true);
    pointer(".stick.left", "pointerdown", 3);
    expect(input.buttons()).toBe(Btn.RIGHT);
  });

  it("losing one stick's capture clears that stick while preserving the other", () => {
    pointer(".stick.left", "pointerdown", 1);
    pointer(".stick.right", "pointerdown", 2);
    expect(input.buttons()).toBe(Btn.RIGHT | (Btn.FIRE | Btn.CONTINUOUS_FIRE));
    root.querySelector<HTMLElement>(".stick.left")!.releasePointerCapture(1);
    expect(input.buttons()).toBe((Btn.FIRE | Btn.CONTINUOUS_FIRE));
    root.querySelector<HTMLElement>(".stick.right")!.releasePointerCapture(2);
    expect(input.buttons()).toBe(0);
  });

  it("hiding the document clears every touch source", () => {
    pointer(".stick.left", "pointerdown", 1);
    pointer(`[data-b="${Btn.RELOAD}"]`, "pointerdown", 2);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new dom.window.Event("visibilitychange"));
    expect(input.buttons()).toBe(0);
    pointer(".stick.right", "pointerdown", 3);
    expect(input.buttons()).toBe((Btn.FIRE | Btn.CONTINUOUS_FIRE));
  });

  it("retains short action taps until a simulation sample, then releases them", () => {
    for(const bit of [Btn.SLOT1,Btn.SLOT2,Btn.SLOT3,Btn.RELOAD,Btn.THROW,Btn.NEXT_THROWABLE,Btn.SWITCH,Btn.DUAL,Btn.PICKUP,Btn.DROP,Btn.MELEE,Btn.JUMP]) {
      pointer(`[data-b="${bit}"]`,"pointerdown",1);
      pointer(`[data-b="${bit}"]`,"pointerup",1);
      // Render-time aim reads must not consume an action before the fixed tick.
      input.updateAim({x:0,y:0});
      expect(input.sampleButtons()).toBe(bit);
      expect(input.sampleButtons()).toBe(0);
    }
  });

  it("destroy unsubscribes the control reset listener", () => {
    touch.destroy();
    zoom.mockClear();
    input.clear();
    expect(zoom).not.toHaveBeenCalled();
    expect(root.querySelector(".touch")).toBeNull();
  });
});
