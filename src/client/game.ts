import { INTERP_MS, PLAYER_H, TICK_RATE } from "../shared/constants.ts";
import { MAPS } from "../shared/maps.ts";
import { heightOf, type MoveState, stepMovement } from "../shared/physics.ts";
import type { RosterEntry, ServerMessage } from "../shared/protocol.ts";
import { MODE_NAMES, TEAM_MODES } from "../shared/settings.ts";
import { maxHealth } from "../shared/sim.ts";
import { Btn, type GameEvent, type InputFrame, type MapDefinition, PF, type PlayerSnap, type RoomSettings, type WorldSnapshot } from "../shared/types.ts";
import { THROWABLES, WEAPONS } from "../shared/weapons.ts";
import { esc } from "./dom.ts";
import { GameAudio } from "./audio.ts";
import { avatarOf, weaponIcon } from "./art.ts";
import { bindingsOf, keyLabel, Input } from "./input.ts";
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
  prefs(): Record<string,unknown>;
  savePrefs(patch:Record<string,unknown>):Promise<void>;
  editRules():void;
}

export class GameSession {
  private renderer = new Renderer();
  private audio = new GameAudio();
  private spectatorIndex = 0;
  private chat: {name:string;text:string}[] = [];
  private unlockAudio = () => { void this.audio.unlock().catch(()=>{}); };
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
  private previousHp:number|null=null;
  private healingUntil=0;
  private bindings:Record<string,number>;
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
    this.bindings=bindingsOf(hooks.prefs().bindings);
    this.settings = start.settings;
    this.audio.muted=hooks.prefs().muted===true;
    this.audio.volume=Number(hooks.prefs().volume ?? .35);
    window.addEventListener("pointerdown",this.unlockAudio);
    window.addEventListener("keydown",this.unlockAudio);
    this.map = MAPS[start.settings.map];
    this.you = start.you;
    for (const r of start.roster) this.roster.set(r.id, r);
    this.hud = document.createElement("div");
    this.hud.className = "hud";
    this.hud.innerHTML = `
      <div class="flash-overlay" data-el="flash" hidden></div>
      <div class="hud-top">
        <span class="team-score t0" data-el="s0"></span>
        <span class="timer" data-el="timer">--:--</span>
        <span class="team-score t1" data-el="s1"></span>
      </div>
      <div class="objective" data-el="objective"></div>
      <div class="spectator-controls" data-el="spectate" hidden><button data-follow="-1" aria-label="Follow previous pilot">←</button><span data-el="following"></span><button data-follow="1" aria-label="Follow next pilot">→</button></div>
      <div class="hud-bars">
        <div class="vital-label"><b>HEALTH</b><span data-el="regen"></span></div><div class="bar hp" title="Health"><i data-el="hp"></i><span data-el="hpText"></span></div>
        <div class="vital-label"><b>JET FUEL</b><span data-el="fuelText"></span></div><div class="bar fuel" title="Jet fuel"><i data-el="fuel"></i></div>
      </div>
      <div class="hud-weapon" data-el="weapon"></div>
      <div class="killfeed" data-el="feed" aria-live="polite"></div>
      <div class="center-msg" data-el="center"></div>
      <div class="scoreboard hidden" data-el="board"></div>
      <div class="menu hidden" data-el="menu"></div>
      <div class="conn-msg hidden" data-el="conn"></div>
      <button class="desktop-menu" data-el="menuButton">Menu / Esc</button>`;
    for (const el of this.hud.querySelectorAll<HTMLElement>("[data-el]")) this.els[el.dataset.el!] = el;
    this.els.menuButton.addEventListener("click",()=>this.toggleMenu());
    for(const b of this.hud.querySelectorAll<HTMLButtonElement>("[data-follow]")) b.addEventListener("click",()=>{this.spectatorIndex+=Number(b.dataset.follow);});
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
    this.renderer.setMap(this.map,this.settings.mode==="flag");
    this.renderer.reducedShake = this.hooks.reducedShake();
    this.input = new Input(this.renderer.canvas, {
      onScoreboard: (show) => { this.els.board.classList.toggle("hidden", !show); if(show)this.renderBoard(); },
      onMenu: () => this.toggleMenu(),
    },this.bindings);
    if (matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) {
      this.touch = new TouchControls(this.root, this.input, {
        scoreboard: () => { this.els.board.classList.toggle("hidden"); this.renderBoard(); },
        menu: () => this.toggleMenu(),
        zoom: (on) => (this.touchZoom = on),
      });
    }
    document.addEventListener("visibilitychange", this.onVisibility);
    this.renderer.app.ticker.add((t) => this.frame(t.deltaMS));
  }

  private onMessage(m: ServerMessage): void {
    if (m.t === "snap") this.onSnap(m);
    else if(m.t==="chat" && this.hooks.prefs().chatMuted!==true) {
      this.chat.push({name:m.name,text:m.text});if(this.chat.length>40)this.chat.shift();this.renderChat();
    }
    else if (m.t === "roster") {
      this.roster.clear();
      for (const r of m.roster) this.roster.set(r.id, r);
    }
  }

  private onSnap(s: WorldSnapshot): void {
    const now = performance.now();
    if(!this.latest)this.seq=Math.max(this.seq,s.ack);
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
      for (let i=0;i<this.pending.length;i++) { const f=this.pending[i]; stepMovement(p, me.emp>i ? f.b & ~Btn.JET : f.b, this.map, this.settings); }
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

  private keyFor(action:number):string {
    const code=Object.entries(this.bindings).find(([,bit])=>bit===action)?.[0];
    return code?esc(keyLabel(code)):"Unbound";
  }

  private nameOf(id: number | null): string {
    if (id === null) return "";
    const r = this.roster.get(id);
    return r ? esc(r.name) : "?";
  }

  private onEvent(e: GameEvent): void {
    const r = this.renderer;
    this.audio.event(e,this.you);
    switch (e.t) {
      case "shot":
        r.addTracer(e.x1, e.y1, e.x2, e.y2, e.w, e.hit);
        break;
      case "flashbang":
        r.addFlashbang(e.x,e.y,e.r);
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
      case "flag": {
        const text=e.action==="delivery"?`${TEAM_NAMES[e.owner]} delivered a flag!`:e.action==="pickup"?`${this.nameOf(e.by)} carries the ${TEAM_NAMES[e.owner]} flag`:e.action==="drop"?`${TEAM_NAMES[e.owner]} flag dropped — teammates can recover it`:`${TEAM_NAMES[e.owner]} flag returned home`;
        this.killfeed.push({html:`<b>${text}</b>`,at:performance.now()});if(this.killfeed.length>5)this.killfeed.shift();
        break;
      }
      case "wave": this.killfeed.push({html:`<b>Wave ${e.wave}</b> — hold your ground`,at:performance.now()});break;
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
    if(this.you===null)return;
    this.input.enabled=this.els.menu.classList.contains("hidden")&&!document.querySelector("dialog[open]");
    let b = this.input.sampleButtons();
    const me=this.latest?.players.find(p=>p.id===this.you);
    if(me && me.emp>0)b &= ~Btn.JET;
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
        maxHp:s.maxHp ?? maxHp,
        dual:s.dual,
        otherWeapon:s.dualSlot===null?null:s.s[s.dualSlot],
        vx:s.vx,vy:s.vy,
        emp:s.emp,
        avatar:avatarOf(r?.avatar),
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

    if(this.you===null) {
      const followable=players.filter(p=>p.alive);
      if(followable.length) { const index=((this.spectatorIndex%followable.length)+followable.length)%followable.length;const p=followable[index];camera={x:p.x,y:p.y-PLAYER_H/2};this.els.following.textContent=`Following ${p.name}`; }
      this.els.spectate.hidden=false;
    }
    const local = players.find((p) => p.local);
    const origin = local
      ? this.renderer.worldToScreen(local.x, local.y - heightOf(local) * 0.68)
      : { x: innerWidth / 2, y: innerHeight / 2 };
    const aim = this.input.updateAim(origin);
    if (local) local.aim = aim;

    const weaponZoom = latestMe ? (WEAPONS[latestMe.s[latestMe.a] ?? ""]?.zoom ?? 1) : 1;
    const zoom = weaponZoom * (this.input.zoom || this.touchZoom ? 1.35 : 1);
    this.renderer.frame(camera, zoom, players, this.latest.projectiles, this.latest.pickups, this.settings.mode==="flag"?this.latest.flags:[],this.latest.areas);

    if(this.pred) {
      const fuel=Math.round(this.pred.fuel/(100*this.settings.fuelCapacity)*100);
      this.els.fuel.style.width=fuel+"%";
      this.els.fuelText.textContent=this.settings.unlimitedFuel?"∞":fuel+"%";
    }
    if(performance.now()>this.healingUntil)this.els.regen.textContent="";
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
    if(this.settings.mode==="flag") {
      const mine=this.roster.get(this.you ?? -1)?.team;
      this.els.objective.innerHTML=s.flags.map(f=>`<span class="flag-status team-${f.owner}">${TEAM_NAMES[f.owner]}: ${f.state==="carried"?esc(this.roster.get(f.carrier!)?.name ?? "carried"):f.state==="respawning"?"new flag arriving":f.state==="dropped"?"recover dropped flag":"flag at home"}</span>`).join("")+`<small>${mine===0||mine===1?`Take your own flag to the ${TEAM_NAMES[mine===0?1:0]} goal.`:"Teams carry their own flag to the opposing goal."}</small>`;
    } else if(s.survival) this.els.objective.innerHTML=`<b>Wave ${s.survival.wave} · ${s.survival.remaining} enemies left</b><small>${s.survival.toSpawn} reinforcements · ${s.survival.cleared} waves cleared</small>`;
    else this.els.objective.textContent="";
    if (me) {
      const maxHp = me.maxHp ?? maxHealth(this.settings);
      this.els.hp.style.width = `${Math.max(0, (me.hp / maxHp) * 100)}%`;
      this.els.hpText.textContent = me.hp+" / "+maxHp;
      if(this.previousHp!==null&&this.previousHp>0&&me.hp>this.previousHp&&me.hp-this.previousHp<=2) {
        this.healingUntil=performance.now()+600;this.els.regen.textContent="+ Recovering";
      }
      if(this.previousHp!==null&&me.hp<this.previousHp){this.healingUntil=0;this.els.regen.textContent="";}
      this.previousHp=me.hp;
      this.els.flash.hidden=me.flash<=0;
      this.els.flash.style.opacity=String(Math.min(.92,me.flashStrength)*Math.min(1,me.flash/45));
      const slot = (i: 0 | 1 | 2) => {
        const w=me.s[i], state=me.slots[i], def=w?WEAPONS[w]:null;
        const active=me.a===i, offhand=me.dual&&me.dualSlot===i;
        const reload=state?Math.max(0,state.reloadEnd-s.tick):0;
        const key=Object.entries(this.bindings).find(([,bit])=>bit===[Btn.SLOT1,Btn.SLOT2,Btn.SLOT3][i])?.[0];
        const ammo=!state?"Pick up a weapon":def?.category==="equipment"?(w==="riot-shield"?"Frontal protection":"Close combat"):reload>0?"Reloading "+(reload/TICK_RATE).toFixed(1)+"s":state.mag+" / "+(this.settings.unlimitedAmmo?"∞":state.reserve);
        return `<div class="weapon-card slot ${active?"selected on":offhand?"offhand on":""} ${w?"":"empty"}" data-slot="${i}" aria-label="Slot ${i+1}: ${esc(def?.name??"Empty")}${active?", selected":offhand?", dual offhand":""}"><div class="weapon-card-top"><kbd>${key?esc(keyLabel(key)):"—"}</kbd><span>${active?"SELECTED":offhand?"DUAL":"SLOT "+(i+1)}</span></div><div class="weapon-thumbnail">${w?weaponIcon(w):'<span>＋</span>'}</div><b class="weapon-name">${esc(def?.name??"Empty slot")}</b><span class="ammo ${reload?"reloading":""}">${ammo}</span>${reload&&def?'<i class="reload-progress" style="--reload:'+Math.max(0,Math.min(1,1-reload/(def.reloadMs*TICK_RATE/1000)))+'"></i>':""}</div>`;
      };
      const nade=me.throwable;
      const grenades=this.settings.throwables.filter(id=>(me.throwables[id]??0)>0||id===nade).map(id=>`<span class="grenade-chip ${id===nade?"selected":""}" data-grenade="${esc(id)}"><span class="grenade-dot ${esc(id)}"></span>${esc(id==="frag"?"Frag":id==="flash"?"Flash":id==="gas"?"Poison":id==="emp"?"EMP":"Mine")} <b>${me.throwables[id]??0}</b></span>`).join("");
      this.els.weapon.innerHTML=`<div class="loadout-heading"><span>YOUR LOADOUT</span><small>${this.keyFor(Btn.SWITCH)} cycle · ${this.keyFor(Btn.DUAL)} dual</small></div><div id="weapon-slots" class="weapon-slots">${slot(0)}${slot(1)}${slot(2)}</div><div class="nades"><div class="grenade-list">${grenades||'<span>No grenades</span>'}</div><small><kbd>${this.keyFor(Btn.THROW)}</kbd> throw ${esc(THROWABLES[nade]?.name??nade)} · <kbd>${this.keyFor(Btn.NEXT_THROWABLE)}</kbd> change</small></div>${me.emp>0?`<div class="emp-status">Jetpack disabled · ${Math.ceil(me.emp/TICK_RATE)}s</div>`:""}${me.flash>0?`<div class="flash-status">Flash impaired · ${Math.ceil(me.flash/TICK_RATE)}s</div>`:""}`;
      const alive = (me.f & PF.ALIVE) !== 0;
      this.els.center.textContent = alive ? "" : s.endTick <= s.tick ? "" : this.settings.mode==="survival" ? "Waiting for the next wave…" : `Respawning in ${Math.ceil(me.rs / TICK_RATE)}…`;
    } else {
      this.els.center.textContent = "Spectating";
    }
    this.boardSnap = s;
    if (!this.els.board.classList.contains("hidden")) this.renderBoard(s);
  }

  private boardSnap: WorldSnapshot | null = null;

  private renderBoard(s: WorldSnapshot | null = this.boardSnap): void {
    if (!s) return;
    const team = TEAM_MODES.includes(this.settings.mode);
    const rows = [...s.players]
      .sort((a, b) => (b.deliveries-a.deliveries)*10+(b.k-a.k)*2+b.as-a.as || a.d-b.d)
      .map((p) => {
        const r = this.roster.get(p.id);
        const color = r && r.team !== -1 ? TEAM_COLORS[r.team] : (r?.color ?? 0x888888);
        const dot = `<i class="dot" style="background:#${color.toString(16).padStart(6, "0")}"></i>`;
        const conn = p.f & PF.CONNECTED ? "" : " <small>(away)</small>";
        return `<tr class="${p.id === this.you ? "me" : ""}"><td>${dot}${esc(r?.name ?? "?")}${conn}</td>${team ? `<td>${r && r.team !== -1 ? TEAM_NAMES[r.team] : ""}</td>` : ""}<td>${p.k}</td><td>${p.d}</td><td>${p.as}</td><td>${p.deliveries}</td><td>${2*p.k+p.as+(this.settings.mode==="flag"?10*p.deliveries:0)}</td></tr>`;
      })
      .join("");
    this.els.board.innerHTML = `<h2>${esc(MODE_NAMES[this.settings.mode])}${team ? ` — ${TEAM_NAMES[0]} ${s.ts[0]} : ${s.ts[1]} ${TEAM_NAMES[1]}` : ""}</h2>
      <table><thead><tr><th>Player</th>${team ? "<th>Team</th>" : ""}<th>K</th><th>D</th><th>A</th><th>Flags</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  private toggleMenu(): void {
    const menu = this.els.menu;
    if (!menu.classList.contains("hidden")) {
      menu.classList.add("hidden");
      this.input.enabled=true;
      return;
    }
    this.input.clear();
    menu.innerHTML = `
      <h2>Field menu</h2>
      <p class="muted">The match keeps running while this is open.</p>
      <div class="menu-actions">
        <button data-act="resume" class="primary">Resume</button>
        ${this.hooks.isHost() ? `<button data-act="rules">Next-round rules</button><button data-act="end">End round now</button>` : ""}
        <button data-act="leave" class="danger">Leave room</button>
      </div>
      <div class="checks"><label class="check"><input data-audio type="checkbox" ${this.audio.muted?"":"checked"}> Sound</label><label class="check"><input data-shake type="checkbox" ${this.hooks.reducedShake()?"checked":""}> Reduce shake</label><label class="check"><input data-chat-mute type="checkbox" ${this.hooks.prefs().chatMuted===true?"checked":""}> Mute chat</label></div>
      <label>Sound volume <input data-volume type="range" min="0" max="1" step=".05" value="${this.audio.volume}"></label>
      <section class="room-chat"><h3>Room chat</h3><ol data-chat-log class="chat-log" aria-live="polite"></ol><form data-chat-form class="row"><label class="grow"><span class="sr">Message</span><input name="message" maxlength="240" placeholder="Message your room" autocomplete="off"></label><button>Send</button></form></section>
      <details><summary>Default controls</summary>
        <ul class="controls">
          <li><b>A / D</b> move, <b>W</b> jump, <b>Space</b> jetpack, <b>S</b> crouch or drop through a platform</li>
          <li><b>Mouse</b> aim, <b>left click</b> fire, <b>right click</b> zoom; or hold <b>Num 2 / 4 / 6 / 8</b> to aim and fire. <b>Arrow keys</b> aim without firing. Combine two directions for diagonals</li>
          <li><b>1 / 2 / 3</b> pick slot, <b>Tab / Q</b> cycle, <b>F</b> dual, <b>R</b> reload, <b>E</b> pick up, <b>X</b> drop</li>
          <li>Health recovers gradually after 6 seconds out of combat.</li><li><b>G</b> throw grenade, <b>T</b> next grenade type, <b>V</b> melee</li>
          <li><b>B / backquote</b> scoreboard, <b>Esc</b> this menu</li>
        </ul>
      </details>`;
    menu.classList.remove("hidden");
    this.input.enabled=false;
    menu.querySelector<HTMLInputElement>("[data-audio]")!.addEventListener("change",e=>{this.audio.muted=!(e.target as HTMLInputElement).checked;void this.hooks.savePrefs({muted:this.audio.muted});this.unlockAudio();});
    menu.querySelector<HTMLInputElement>("[data-volume]")!.addEventListener("change",e=>{this.audio.volume=Number((e.target as HTMLInputElement).value);void this.hooks.savePrefs({volume:this.audio.volume});});
    menu.querySelector<HTMLInputElement>("[data-shake]")!.addEventListener("change",e=>{this.renderer.reducedShake=(e.target as HTMLInputElement).checked;void this.hooks.savePrefs({reducedShake:this.renderer.reducedShake});});
    menu.querySelector<HTMLInputElement>("[data-chat-mute]")!.addEventListener("change",e=>{void this.hooks.savePrefs({chatMuted:(e.target as HTMLInputElement).checked});});
    menu.querySelector<HTMLFormElement>("[data-chat-form]")!.addEventListener("submit",e=>{e.preventDefault();const el=menu.querySelector<HTMLInputElement>('input[name="message"]')!;if(el.value.trim())this.net.send({t:"chat",text:el.value.trim()});el.value="";});
    this.renderChat();
    menu.querySelector('[data-act="resume"]')!.addEventListener("click", () => menu.classList.add("hidden"));
    menu.querySelector('[data-act="rules"]')?.addEventListener("click",()=>this.hooks.editRules());
    menu.querySelector('[data-act="end"]')?.addEventListener("click", () => {
      menu.classList.add("hidden");
      this.hooks.endRound();
    });
    menu.querySelector('[data-act="leave"]')!.addEventListener("click", () => this.hooks.leave());
  }

  private renderChat():void {
    const log=this.els.menu.querySelector("[data-chat-log]");if(!log)return;
    log.innerHTML=this.hooks.prefs().chatMuted===true?"<li>Chat muted</li>":this.chat.map(m=>`<li><b>${esc(m.name)}</b> ${esc(m.text)}</li>`).join("")||"<li class=\"muted\">No messages yet.</li>";log.scrollTop=log.scrollHeight;
  }

  setConnection(text: string | null): void {
    this.els.conn.textContent = text ?? "";
    this.els.conn.classList.toggle("hidden", !text);
  }

  destroy(): void {
    this.destroyed = true;
    this.unsub();
    window.removeEventListener("pointerdown",this.unlockAudio);
    window.removeEventListener("keydown",this.unlockAudio);
    this.audio.destroy();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.input?.destroy();
    this.touch?.destroy();
    if (this.renderer.app.renderer) this.renderer.destroy();
    this.root.innerHTML = "";
  }
}
