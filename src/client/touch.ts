import { Btn } from "../shared/types.ts";
import type { Input } from "./input.ts";

const DEAD = 0.25;
const FIRE_AT = 0.55;

interface Stick {
  el: HTMLElement;
  knob: HTMLElement;
  id: number | null;
  cx: number;
  cy: number;
  dx: number;
  dy: number;
}

// Mini Militia-style twin sticks: the left stick runs, flies (up) and crouches
// (down); the right stick aims and fires when pushed past FIRE_AT.
export class TouchControls {
  private left: Stick;
  private right: Stick;
  private buttons = 0;
  private buttonPointers = new Map<number, { el: HTMLButtonElement; bit: number }>();
  private zoomed = false;
  private zoomButton: HTMLButtonElement;
  private unsubscribeClear: () => void;
  readonly root: HTMLElement;
  private input: Input;
  private actions: { scoreboard(): void; menu(): void; zoom(on: boolean): void };

  constructor(parent: HTMLElement, input: Input, actions: { scoreboard(): void; menu(): void; zoom(on: boolean): void }) {
    this.input = input;
    this.actions = actions;
    this.root = document.createElement("div");
    this.root.className = "touch";
    this.root.setAttribute("aria-label","Touch game controls");
    this.root.innerHTML = `
      <div class="stick left"><div class="knob"></div></div>
      <div class="stick right"><div class="knob"></div></div>
      <div class="tbtns">
        <button data-b="${Btn.JUMP}">Jump</button>
        <button data-b="${Btn.RELOAD}">Reload</button>
        <button data-b="${Btn.SWITCH}">Swap</button>
        <button data-b="${Btn.DUAL}">Dual</button>
        <button data-b="${Btn.SLOT1}">Slot 1</button>
        <button data-b="${Btn.SLOT2}">Slot 2</button>
        <button data-b="${Btn.THROW}">Throw</button>
        <button data-b="${Btn.NEXT_THROWABLE}">Type</button>
        <button data-b="${Btn.MELEE}">Melee</button>
        <button data-b="${Btn.PICKUP}">Pick up</button>
        <button data-b="${Btn.DROP}">Drop</button>
        <button data-zoom>Zoom</button>
      </div>
      <div class="tmeta">
        <button data-score>Score</button>
        <button data-menu>Menu</button>
      </div>`;
    parent.appendChild(this.root);
    this.root.querySelector(".stick.left")?.setAttribute("aria-label","Move left or right; push up to fly; down to crouch");
    this.root.querySelector(".stick.right")?.setAttribute("aria-label","Aim; push outward to fire");
    const mk = (sel: string): Stick => {
      const el = this.root.querySelector<HTMLElement>(sel)!;
      return { el, knob: el.querySelector<HTMLElement>(".knob")!, id: null, cx: 0, cy: 0, dx: 0, dy: 0 };
    };
    this.left = mk(".stick.left");
    this.right = mk(".stick.right");
    for (const s of [this.left, this.right]) this.bindStick(s);

    for (const b of this.root.querySelectorAll<HTMLButtonElement>("[data-b]")) {
      const bit = Number(b.dataset.b);
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        this.buttonPointers.set(e.pointerId, { el: b, bit });
        this.buttons |= bit;
        this.push();
      });
      const release = (e: PointerEvent) => {
        this.buttonPointers.delete(e.pointerId);
        this.buttons = [...this.buttonPointers.values()].reduce((mask, pointer) => mask | pointer.bit, 0);
        this.push();
      };
      b.addEventListener("pointerup", release);
      b.addEventListener("pointercancel", release);
      b.addEventListener("lostpointercapture", release);
    }
    const zoom = this.root.querySelector<HTMLButtonElement>("[data-zoom]")!;
    this.zoomButton = zoom;
    zoom.addEventListener("click", () => {
      this.zoomed = !this.zoomed;
      zoom.classList.toggle("on", this.zoomed);
      this.actions.zoom(this.zoomed);
    });
    this.root.querySelector("[data-score]")!.addEventListener("click", () => this.actions.scoreboard());
    this.root.querySelector("[data-menu]")!.addEventListener("click", () => this.actions.menu());
    this.unsubscribeClear = this.input.onClear(() => this.reset());
  }

  private bindStick(s: Stick): void {
    s.el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      s.el.setPointerCapture(e.pointerId);
      const r = s.el.getBoundingClientRect();
      s.id = e.pointerId;
      s.cx = r.left + r.width / 2;
      s.cy = r.top + r.height / 2;
      this.move(s, e);
    });
    s.el.addEventListener("pointermove", (e) => {
      if (s.id === e.pointerId) this.move(s, e);
    });
    const end = (e: PointerEvent) => {
      if (s.id !== e.pointerId) return;
      s.id = null;
      s.dx = 0;
      s.dy = 0;
      s.knob.style.transform = "";
      this.push();
    };
    s.el.addEventListener("pointerup", end);
    s.el.addEventListener("pointercancel", end);
    s.el.addEventListener("lostpointercapture", end);
  }

  private move(s: Stick, e: PointerEvent): void {
    const radius = s.el.getBoundingClientRect().width / 2;
    let dx = (e.clientX - s.cx) / radius;
    let dy = (e.clientY - s.cy) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    s.dx = dx;
    s.dy = dy;
    s.knob.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`;
    this.push();
  }

  private push(): void {
    let bits = this.buttons;
    const l = this.left;
    if (l.dx < -DEAD) bits |= Btn.LEFT;
    if (l.dx > DEAD) bits |= Btn.RIGHT;
    if (l.dy < -0.45) bits |= Btn.JET;
    if (l.dy > 0.6) bits |= Btn.CROUCH;
    const r = this.right;
    const rLen = Math.hypot(r.dx, r.dy);
    let aim: number | null = null;
    if (r.id !== null && rLen > DEAD) {
      aim = Math.atan2(r.dy, r.dx);
      if (rLen > FIRE_AT) bits |= Btn.FIRE;
    }
    this.input.setTouch(bits, aim);
  }

  private reset(): void {
    // Input.clear() also runs on blur, hidden documents and opening the menu.
    // Clear the control sources, not just their last mask, or the next touch
    // would bring an old movement/fire/button state back.
    const captures: { el: HTMLElement; id: number }[] = [];
    for (const stick of [this.left, this.right]) {
      if (stick.id !== null) captures.push({ el: stick.el, id: stick.id });
      stick.id = null;
      stick.dx = 0;
      stick.dy = 0;
      stick.knob.style.transform = "";
    }
    for (const [id, pointer] of this.buttonPointers) captures.push({ el: pointer.el, id });
    this.buttonPointers.clear();
    this.buttons = 0;
    this.zoomed = false;
    this.zoomButton.classList.remove("on");
    this.actions.zoom(false);
    this.push();
    for (const { el, id } of captures) {
      if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
    }
  }

  destroy(): void {
    this.unsubscribeClear();
    this.reset();
    this.root.remove();
  }
}
