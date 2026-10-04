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
  readonly root: HTMLElement;
  private input: Input;
  private actions: { scoreboard(): void; menu(): void; zoom(on: boolean): void };

  constructor(parent: HTMLElement, input: Input, actions: { scoreboard(): void; menu(): void; zoom(on: boolean): void }) {
    this.input = input;
    this.actions = actions;
    this.root = document.createElement("div");
    this.root.className = "touch";
    this.root.innerHTML = `
      <div class="stick left"><div class="knob"></div></div>
      <div class="stick right"><div class="knob"></div></div>
      <div class="tbtns">
        <button data-b="${Btn.JUMP}">Jump</button>
        <button data-b="${Btn.RELOAD}">Reload</button>
        <button data-b="${Btn.SWITCH}">Swap</button>
        <button data-b="${Btn.THROW}">Nade</button>
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
        this.buttons |= bit;
        this.push();
      });
      const release = () => {
        this.buttons &= ~bit;
        this.push();
      };
      b.addEventListener("pointerup", release);
      b.addEventListener("pointercancel", release);
      b.addEventListener("pointerleave", release);
    }
    const zoom = this.root.querySelector<HTMLButtonElement>("[data-zoom]")!;
    let zoomed = false;
    zoom.addEventListener("click", () => {
      zoomed = !zoomed;
      zoom.classList.toggle("on", zoomed);
      this.actions.zoom(zoomed);
    });
    this.root.querySelector("[data-score]")!.addEventListener("click", () => this.actions.scoreboard());
    this.root.querySelector("[data-menu]")!.addEventListener("click", () => this.actions.menu());
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

  destroy(): void {
    this.root.remove();
  }
}
