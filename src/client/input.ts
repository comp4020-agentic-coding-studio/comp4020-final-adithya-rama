import { Btn } from "../shared/types.ts";

export const DEFAULT_BINDINGS: Record<string, number> = {
  KeyA: Btn.LEFT,
  KeyD: Btn.RIGHT,
  KeyW: Btn.JUMP,
  Space: Btn.JET,
  KeyS: Btn.CROUCH,
  KeyR: Btn.RELOAD,
  KeyE: Btn.PICKUP,
  KeyX: Btn.DROP,
  KeyQ: Btn.SWITCH,
  Digit1: Btn.SLOT1,
  Digit2: Btn.SLOT2,
  KeyG: Btn.THROW,
  KeyT: Btn.NEXT_THROWABLE,
  KeyV: Btn.MELEE,
  KeyF: Btn.DUAL,
  KeyJ: Btn.FIRE,
  Enter: Btn.FIRE,
};

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export interface InputCallbacks {
  onScoreboard(show: boolean): void;
  onMenu(): void;
}

// Collects held buttons and an aim angle from keyboard, mouse and touch.
// Aim is in world space; the game supplies the local player's screen position.
export class Input {
  private held = 0;
  private touchHeld = 0;
  private mouse = { x: 0, y: 0, active: false };
  private arrows = new Set<string>();
  private touchAim: number | null = null;
  zoom = false;
  aim = 0;
  private bindings: Record<string, number>;
  private teardown: (() => void)[] = [];
  private cb: InputCallbacks;

  constructor(canvas: HTMLElement, cb: InputCallbacks, bindings: Record<string, number> = DEFAULT_BINDINGS) {
    this.cb = cb;
    this.bindings = bindings;
    const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      window.addEventListener(t, f, opts);
      this.teardown.push(() => window.removeEventListener(t, f));
    };
    on("keydown", (e) => this.key(e, true));
    on("keyup", (e) => this.key(e, false));
    on("blur", () => this.clear());
    on("mousemove", (e) => {
      this.mouse = { x: e.clientX, y: e.clientY, active: true };
    });
    const down = (e: MouseEvent) => {
      if (e.button === 0) this.held |= Btn.FIRE;
      if (e.button === 2) this.zoom = true;
    };
    const up = (e: MouseEvent) => {
      if (e.button === 0) this.held &= ~Btn.FIRE;
      if (e.button === 2) this.zoom = false;
    };
    const ctx = (e: Event) => e.preventDefault();
    canvas.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("contextmenu", ctx);
    document.addEventListener("visibilitychange", () => document.hidden && this.clear());
    this.teardown.push(() => {
      canvas.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      canvas.removeEventListener("contextmenu", ctx);
    });
  }

  private key(e: KeyboardEvent, down: boolean): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
    if (e.code === "Tab") {
      e.preventDefault();
      this.cb.onScoreboard(down);
      return;
    }
    if (e.code === "Escape" && down) {
      this.cb.onMenu();
      return;
    }
    if (e.code in ARROWS) {
      e.preventDefault();
      if (down) this.arrows.add(e.code);
      else this.arrows.delete(e.code);
      this.mouse.active = false;
      return;
    }
    const bit = this.bindings[e.code];
    if (bit === undefined) return;
    e.preventDefault();
    if (down) this.held |= bit;
    else this.held &= ~bit;
  }

  setTouch(bits: number, aim: number | null): void {
    this.touchHeld = bits;
    this.touchAim = aim;
  }

  clear(): void {
    this.held = 0;
    this.touchHeld = 0;
    this.arrows.clear();
    this.zoom = false;
    this.cb.onScoreboard(false);
  }

  buttons(): number {
    return this.held | this.touchHeld;
  }

  // origin: the local player's on-screen position, for mouse aiming
  updateAim(origin: { x: number; y: number }): number {
    if (this.touchAim !== null) {
      this.aim = this.touchAim;
    } else if (this.arrows.size > 0) {
      let dx = 0;
      let dy = 0;
      for (const k of this.arrows) {
        dx += ARROWS[k][0];
        dy += ARROWS[k][1];
      }
      if (dx !== 0 || dy !== 0) this.aim = Math.atan2(dy, dx);
    } else if (this.mouse.active) {
      this.aim = Math.atan2(this.mouse.y - origin.y, this.mouse.x - origin.x);
    }
    return this.aim;
  }

  destroy(): void {
    for (const f of this.teardown) f();
  }
}
