import { INTERP_MS, PLAYER_H, TICK_RATE } from "../shared/constants.ts";
import { MAPS } from "../shared/maps.ts";
import { heightOf, type MoveState, stepMovement } from "../shared/physics.ts";
import type { RosterEntry, ServerMessage } from "../shared/protocol.ts";
import { MODE_NAMES, TEAM_MODES } from "../shared/settings.ts";
import { maxHealth } from "../shared/sim.ts";
import { type GameEvent, type InputFrame, type MapDefinition, PF, type PlayerSnap, type RoomSettings, type WorldSnapshot } from "../shared/types.ts";
import { THROWABLES, WEAPONS } from "../shared/weapons.ts";
import { esc } from "./dom.ts";
import { Input } from "./input.ts";
import type { Net } from "./net.ts";
import { type RenderPlayer, Renderer, TEAM_COLORS, TEAM_NAMES } from "./render.ts";
import { TouchControls } from "./touch.ts";

const TICK_MS = 1000 / TICK_RATE;
const INTERP_TICKS = INTERP_MS / TICK_MS;

type MatchStart = Extract<ServerMessage, { t: "match" }>;

export interface GameHooks {
  isHost(): boolean;
  leave(): void;
  endRound(): void;
  reducedShake(): boolean;
}

export class GameSession {
  private renderer = new Renderer();
  private input!: Input;
  private touch: TouchControls | null = null;
  private settings: RoomSettings;
  private map: MapDefinition;
  private you: number | null;
  private roster = new Map<number, RosterEntry>();
  private snaps: WorldSnapshot[] = [];
  private latest: WorldSnapshot | null = null;
  private pred: MoveState | null = null;
  private smooth = { x: 0, y: 0 };
  private pending: InputFrame[] = [];
  private outbox: InputFrame[] = [];
  private seq = 0;
  private acc = 0;
  private localTicks = 0;
  private clockOffset: number | null = null;
  private killfeed: { html: string; at: number }[] = [];
  private touchZoom = false;
  private hud: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private destroyed = false;
  private unsub: () => void;
  private onVisibility = () => {
    if (document.hidden) this.flushNeutral();
  };

  private root: HTMLElement;
  private net: Net;
  private hooks: GameHooks;

  constructor(root: HTMLElement, net: Net, start: MatchStart, hooks: GameHooks) {
    this.root = root;
    this.net = net;
    this.hooks = hooks;
    this.settings = start.settings;
    this.map = MAPS[start.settings.map];
    this.you = start.you;
    for (const r of start.roster) this.roster.set(r.id, r);
    this.hud = document.createElement("div");
    this.hud.className = "hud";
    this.hud.innerHTML = `
      <div class="hud-top">
        <span class="team-score t0" data-el="s0"></span>
        <span class="timer" data-el="timer">--:--</span>
        <span class="team-score t1" data-el="s1"></span>
      </div>
      <div class="hud-bars">
        <div class="bar hp" title="Health"><i data-el="hp"></i><span data-el="hpText"></span></div>
        <div class="bar fuel" title="Jet fuel"><i data-el="fuel"></i></div>
      </div>
      <div class="hud-weapon" data-el="weapon"></div>
      <div class="killfeed" data-el="feed" aria-live="polite"></div>
      <div class="center-msg" data-el="center"></div>
      <div class="scoreboard hidden" data-el="board"></div>
      <div class="menu hidden" data-el="menu"></div>
      <div class="conn-msg hidden" data-el="conn"></div>`;
    for (const el of this.hud.querySelectorAll<HTMLElement>("[data-el]")) this.els[el.dataset.el!] = el;
    this.unsub = this.net.on((m) => this.onMessage(m));
    void this.init();
  }

  private async init(): Promise<void> {
    const stage = document.createElement("div");
    stage.className = "stage";
    this.root.append(stage, this.hud);
    await this.renderer.init(stage);
    if (this.destroyed) {
      this.renderer.destroy();
      return;
    }
    this.renderer.setMap(this.map);
    this.renderer.reducedShake = this.hooks.reducedShake();
    this.input = new Input(this.renderer.canvas, {
      onScoreboard: (show) => this.els.board.classList.toggle("hidden", !show),
      onMenu: () => this.toggleMenu(),
    });
    if (matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) {
      this.touch = new TouchControls(this.root, this.input, {
        scoreboard: () => this.els.board.classList.toggle("hidden"),
        menu: () => this.toggleMenu(),
        zoom: (on) => (this.touchZoom = on),
      });
    }
    document.addEventListener("visibilitychange", this.onVisibility);
    this.renderer.app.ticker.add((t) => this.frame(t.deltaMS));
  }

  private onMessage(m: ServerMessage): void {
    if (m.t === "snap") this.onSnap(m);
    else if (m.t === "roster") {
      this.roster.clear();
      for (const r of m.roster) this.roster.set(r.id, r);
    }
  }

  private onSnap(s: WorldSnapshot): void {
    const now = performance.now();
    const sample = s.tick - now / TICK_MS;
    if (this.clockOffset === null || Math.abs(sample - this.clockOffset) > 30) this.clockOffset = sample;
    else this.clockOffset += (sample - this.clockOffset) * 0.05;

    this.snaps.push(s);
    if (this.snaps.length > 30) this.snaps.shift();
    this.latest = s;
    for (const e of s.events) this.onEvent(e);

    const me = this.you === null ? undefined : s.players.find((p) => p.id === this.you);
    this.pending = this.pending.filter((f) => f.seq > s.ack);
    if (me && me.f & PF.ALIVE) {
      const before = this.pred ? { x: this.pred.x + this.smooth.x, y: this.pred.y + this.smooth.y } : null;
      const p: MoveState = {
        x: me.x,
        y: me.y,
        vx: me.vx,
        vy: me.vy,
        crouch: (me.f & PF.CROUCH) !== 0,
        onGround: (me.f & PF.GROUND) !== 0,
        jetting: (me.f & PF.JETTING) !== 0,
        fuel: me.fuel,
        jetCooldown: me.jc,
        dropTicks: me.dt,
      };
      for (const f of this.pending) stepMovement(p, f.b, this.map, this.settings);
      this.pred = p;
      if (before) {
        const dx = before.x - p.x;
        const dy = before.y - p.y;
        this.smooth = Math.hypot(dx, dy) < 120 ? { x: dx, y: dy } : { x: 0, y: 0 };
      }
    } else {
      this.pred = null;
      this.smooth = { x: 0, y: 0 };
    }
    this.updateHud(s, me);
  }

  private nameOf(id: number | null): string {
    if (id === null) return "";
    const r = this.roster.get(id);
    return r ? esc(r.name) : "?";
  }

  private onEvent(e: GameEvent): void {
    const r = this.renderer;
    switch (e.t) {
      case "shot":
        r.addTracer(e.x1, e.y1, e.x2, e.y2, e.w, e.hit);
        break;
      case "explode":
        r.addExplosion(e.x, e.y, e.r);
        break;
      case "melee":
        r.addSlash(e.x, e.y);
        break;
      case "kill": {
        const how = WEAPONS[e.w]?.name ?? THROWABLES[e.w]?.name ?? (e.w === "fall" ? "the void" : e.w);
        const html =
          e.killer === null
            ? `<b>${this.nameOf(e.victim)}</b> died <span>(${esc(how)})</span>`
            : `<b>${this.nameOf(e.killer)}</b> <span>${esc(how)}</span> <b>${this.nameOf(e.victim)}</b>`;
        this.killfeed.push({ html, at: performance.now() });
        if (this.killfeed.length > 5) this.killfeed.shift();
        break;
      }
      case "hurt":
        if (e.id === this.you && !this.hooks.reducedShake()) r.shake = Math.max(r.shake, 4);
        break;
      default:
        break;
    }
  }

  private flushNeutral(): void {
    const f: InputFrame = { seq: ++this.seq, b: 0, aim: this.input?.aim ?? 0 };
    this.pending.push(f);
    this.net.send({ t: "input", frames: [f] });
    this.input?.clear();
  }

  private renderTick(): number {
    return performance.now() / TICK_MS + (this.clockOffset ?? 0) - INTERP_TICKS;
  }

  private localTick(): void {
    const b = this.input.buttons();
    const f: InputFrame = { seq: ++this.seq, b, aim: this.input.aim, view: Math.floor(this.renderTick()) };
    this.outbox.push(f);
    this.pending.push(f);
    if (this.pending.length > 240) this.pending.shift();
    if (this.pred) stepMovement(this.pred, b, this.map, this.settings);
    if (++this.localTicks % 2 === 0) {
      this.net.send({ t: "input", frames: this.outbox });
      this.outbox = [];
    }
  }

  private interpolated(): Map<number, PlayerSnap> {
    const out = new Map<number, PlayerSnap>();
    if (this.snaps.length === 0) return out;
    const rt = this.renderTick();
    let a = this.snaps[0];
    let b = this.snaps[0];
    for (let i = 0; i < this.snaps.length; i++) {
      if (this.snaps[i].tick <= rt) a = this.snaps[i];
      if (this.snaps[i].tick >= rt) {
        b = this.snaps[i];
        break;
      }
      b = this.snaps[i];
    }
    const span = b.tick - a.tick;
    const t = span > 0 ? Math.min(1, Math.max(0, (rt - a.tick) / span)) : 0;
    const prev = new Map(a.players.map((p) => [p.id, p]));
    for (const pb of b.players) {
      const pa = prev.get(pb.id);
      if (!pa || !(pa.f & PF.ALIVE) || !(pb.f & PF.ALIVE)) {
        out.set(pb.id, t < 0.5 && pa ? pa : pb);
        continue;
      }
      const da = Math.atan2(Math.sin(pb.aim - pa.aim), Math.cos(pb.aim - pa.aim));
      out.set(pb.id, { ...pb, x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, aim: pa.aim + da * t });
    }
    return out;
  }

  private frame(deltaMS: number): void {
    if (!this.latest) return;
    this.acc += Math.min(deltaMS, 250);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      this.localTick();
    }
    this.smooth.x *= 0.85;
    this.smooth.y *= 0.85;

    const others = this.interpolated();
    const latestMe = this.you === null ? undefined : this.latest.players.find((p) => p.id === this.you);
    const players: RenderPlayer[] = [];
    let camera = { x: this.map.width / 2, y: this.map.height / 2 };
    const maxHp = maxHealth(this.settings);
    for (const [id, s] of others) {
      const r = this.roster.get(id);
      const local = id === this.you;
      const base: RenderPlayer = {
        id,
        x: s.x,
        y: s.y,
        aim: s.aim,
        crouch: (s.f & PF.CROUCH) !== 0,
        alive: (s.f & PF.ALIVE) !== 0,
        jetting: (s.f & PF.JETTING) !== 0,
        protected: (s.f & PF.PROTECTED) !== 0,
        team: r?.team ?? -1,
        color: r?.color ?? 0x888888,
        name: r?.name ?? "?",
        hp: s.hp,
        maxHp,
        weapon: s.s[s.a],
        local,
      };
      if (local && this.pred && latestMe) {
        base.x = this.pred.x + this.smooth.x;
        base.y = this.pred.y + this.smooth.y;
        base.crouch = this.pred.crouch;
        base.jetting = this.pred.jetting;
        base.alive = true;
        base.weapon = latestMe.s[latestMe.a];
        base.protected = (latestMe.f & PF.PROTECTED) !== 0;
      }
      if (local) camera = { x: base.x, y: base.y - PLAYER_H / 2 };
      players.push(base);
    }

    const local = players.find((p) => p.local);
    const origin = local
      ? this.renderer.worldToScreen(local.x, local.y - heightOf(local) * 0.68)
      : { x: innerWidth / 2, y: innerHeight / 2 };
    const aim = this.input.updateAim(origin);
    if (local) local.aim = aim;

    const weaponZoom = latestMe ? (WEAPONS[latestMe.s[latestMe.a] ?? ""]?.zoom ?? 1) : 1;
    const zoom = weaponZoom * (this.input.zoom || this.touchZoom ? 1.35 : 1);
    this.renderer.frame(camera, zoom, players, this.latest.projectiles, this.latest.pickups);

    if (this.pred) this.els.fuel.style.width = `${(this.pred.fuel / (100 * this.settings.fuelCapacity)) * 100}%`;
    const now = performance.now();
    const feed = this.killfeed.filter((k) => now - k.at < 6000);
    const feedHtml = feed.map((k) => `<div>${k.html}</div>`).join("");
    if (this.els.feed.innerHTML !== feedHtml) this.els.feed.innerHTML = feedHtml;
  }

  private updateHud(s: WorldSnapshot, me: PlayerSnap | undefined): void {
    const remaining = Math.max(0, Math.ceil((s.endTick - s.tick) / TICK_RATE));
    this.els.timer.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
    const team = TEAM_MODES.includes(this.settings.mode);
    if (team) {
      this.els.s0.textContent = `${TEAM_NAMES[0]} ${s.ts[0]}`;
      this.els.s1.textContent = `${s.ts[1]} ${TEAM_NAMES[1]}`;
    } else {
      const best = [...s.players].sort((a, b) => b.k - a.k)[0];
      this.els.s0.textContent = MODE_NAMES[this.settings.mode];
      this.els.s1.textContent = best ? `Lead: ${this.roster.get(best.id)?.name ?? "?"} ${best.k}` : "";
    }
    if (me) {
      const maxHp = maxHealth(this.settings);
      this.els.hp.style.width = `${Math.max(0, (me.hp / maxHp) * 100)}%`;
      this.els.hpText.textContent = String(me.hp);
      const slot = (i: 0 | 1) => {
        const w = me.s[i];
        return `<div class="slot ${me.a === i ? "on" : ""}"><small>${i + 1}</small> ${w ? esc(WEAPONS[w]?.name ?? w) : "—"}</div>`;
      };
      const ammo = me.s[me.a] ? (me.rl > 0 ? "Reloading…" : `${me.mag} / ${this.settings.unlimitedAmmo ? "∞" : me.res}`) : "Melee only";
      this.els.weapon.innerHTML = `${slot(0)}${slot(1)}<div class="ammo">${ammo}</div><div class="nades">Grenades ${me.g}</div>`;
      const alive = (me.f & PF.ALIVE) !== 0;
      this.els.center.textContent = alive ? "" : s.endTick <= s.tick ? "" : `Respawning in ${Math.ceil(me.rs / TICK_RATE)}…`;
    } else {
      this.els.center.textContent = "Spectating";
    }
    if (!this.els.board.classList.contains("hidden")) this.renderBoard(s);
    else this.boardSnap = s;
  }

  private boardSnap: WorldSnapshot | null = null;

  private renderBoard(s: WorldSnapshot | null = this.boardSnap): void {
    if (!s) return;
    const team = TEAM_MODES.includes(this.settings.mode);
    const rows = [...s.players]
      .sort((a, b) => b.k - a.k || a.d - b.d)
      .map((p) => {
        const r = this.roster.get(p.id);
        const color = r && r.team !== -1 ? TEAM_COLORS[r.team] : (r?.color ?? 0x888888);
        const dot = `<i class="dot" style="background:#${color.toString(16).padStart(6, "0")}"></i>`;
        const conn = p.f & PF.CONNECTED ? "" : " <small>(away)</small>";
        return `<tr class="${p.id === this.you ? "me" : ""}"><td>${dot}${esc(r?.name ?? "?")}${conn}</td>${team ? `<td>${r && r.team !== -1 ? TEAM_NAMES[r.team] : ""}</td>` : ""}<td>${p.k}</td><td>${p.d}</td><td>${p.as}</td></tr>`;
      })
      .join("");
    this.els.board.innerHTML = `<h2>${esc(MODE_NAMES[this.settings.mode])}${team ? ` — ${TEAM_NAMES[0]} ${s.ts[0]} : ${s.ts[1]} ${TEAM_NAMES[1]}` : ""}</h2>
      <table><thead><tr><th>Player</th>${team ? "<th>Team</th>" : ""}<th>K</th><th>D</th><th>A</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  private toggleMenu(): void {
    const menu = this.els.menu;
    if (!menu.classList.contains("hidden")) {
      menu.classList.add("hidden");
      return;
    }
    this.input.clear();
    menu.innerHTML = `
      <h2>Paused menu</h2>
      <p class="muted">The match keeps running while this is open.</p>
      <div class="menu-actions">
        <button data-act="resume" class="primary">Resume</button>
        ${this.hooks.isHost() ? `<button data-act="end">End round now</button>` : ""}
        <button data-act="leave" class="danger">Leave room</button>
      </div>
      <details><summary>Controls</summary>
        <ul class="controls">
          <li><b>A / D</b> move, <b>W</b> jump, <b>Space</b> jetpack, <b>S</b> crouch or drop through a platform</li>
          <li><b>Mouse</b> aim, <b>left click</b> fire, <b>right click</b> zoom; or <b>arrow keys</b> aim and <b>J / Enter</b> fire</li>
          <li><b>1 / 2</b> pick slot, <b>Q</b> swap, <b>R</b> reload, <b>E</b> pick up, <b>X</b> drop</li>
          <li><b>G</b> throw grenade, <b>T</b> next grenade type, <b>V</b> melee</li>
          <li><b>Tab</b> scoreboard, <b>Esc</b> this menu</li>
        </ul>
      </details>`;
    menu.classList.remove("hidden");
    menu.querySelector('[data-act="resume"]')!.addEventListener("click", () => menu.classList.add("hidden"));
    menu.querySelector('[data-act="end"]')?.addEventListener("click", () => {
      menu.classList.add("hidden");
      this.hooks.endRound();
    });
    menu.querySelector('[data-act="leave"]')!.addEventListener("click", () => this.hooks.leave());
  }

  setConnection(text: string | null): void {
    this.els.conn.textContent = text ?? "";
    this.els.conn.classList.toggle("hidden", !text);
  }

  destroy(): void {
    this.destroyed = true;
    this.unsub();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.input?.destroy();
    this.touch?.destroy();
    if (this.renderer.app.renderer) this.renderer.destroy();
    this.root.innerHTML = "";
  }
}
