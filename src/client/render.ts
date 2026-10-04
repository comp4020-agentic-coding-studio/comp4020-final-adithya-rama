import { Application, Container, Graphics, Text } from "pixi.js";
import { PLAYER_CROUCH_H, PLAYER_H, PLAYER_W } from "../shared/constants.ts";
import type { MapDefinition, PickupSnap, ProjectileSnap, Team } from "../shared/types.ts";
import { WEAPONS } from "../shared/weapons.ts";

export const TEAM_COLORS = [0xd9552b, 0x2f7fd1] as const;
export const TEAM_NAMES = ["Ember", "Tide"] as const;

export interface RenderPlayer {
  id: number;
  x: number;
  y: number;
  aim: number;
  crouch: boolean;
  alive: boolean;
  jetting: boolean;
  protected: boolean;
  team: Team;
  color: number;
  name: string;
  hp: number;
  maxHp: number;
  weapon: string | null;
  local: boolean;
}

interface Fx {
  kind: "tracer" | "boom" | "spark" | "slash";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;
  born: number;
  ttl: number;
}

const GUN_LENGTH: Record<string, number> = { "mini-eagle": 16, uzi: 20, ak47: 30, spas12: 28 };

export class Renderer {
  readonly app = new Application();
  private world = new Container();
  private backdrop = new Graphics();
  private mapG = new Graphics();
  private pickupG = new Graphics();
  private playerG = new Graphics();
  private projG = new Graphics();
  private fxG = new Graphics();
  private labels = new Map<number, Text>();
  private labelLayer = new Container();
  private fx: Fx[] = [];
  private map: MapDefinition | null = null;
  private scale = 1;
  private cam = { x: 0, y: 0 };
  shake = 0;
  reducedShake = false;

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: parent,
      background: 0x9cc3d5,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    this.app.canvas.setAttribute("aria-label", "Game view");
    parent.appendChild(this.app.canvas);
    this.app.stage.addChild(this.backdrop, this.world);
    this.world.addChild(this.mapG, this.pickupG, this.projG, this.playerG, this.fxG, this.labelLayer);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  setMap(map: MapDefinition): void {
    this.map = map;
    this.app.renderer.background.color = map.theme.sky;
    const g = this.mapG;
    g.clear();
    for (const p of map.platforms) {
      g.rect(p.x, p.y, p.w, p.h).fill(map.theme.platform);
      for (let x = p.x + 6; x < p.x + p.w - 4; x += 18) g.rect(x, p.y + 3, 8, p.h - 6).fill({ color: 0x000000, alpha: 0.18 });
    }
    for (const s of map.solids) {
      g.rect(s.x, s.y, s.w, s.h).fill(map.theme.rock);
      g.rect(s.x, s.y, s.w, Math.min(6, s.h)).fill({ color: 0xffffff, alpha: 0.18 });
    }
    for (const goal of map.goals) {
      g.rect(goal.rect.x, goal.rect.y, goal.rect.w, goal.rect.h).stroke({ width: 2, color: TEAM_COLORS[goal.team], alpha: 0.35 });
    }
  }

  // How much of the world shows: landscape screens see ~1200 world px across,
  // portrait phones ~760, and zoom widens the view.
  private computeScale(zoom: number): number {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const visibleW = (w >= h ? 1200 : 760) * zoom;
    const visibleH = (w >= h ? 680 : 1300) * zoom;
    return Math.min(w / visibleW, h / visibleH);
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.world.x + x * this.scale, y: this.world.y + y * this.scale };
  }

  addTracer(x1: number, y1: number, x2: number, y2: number, weapon: string, hit: boolean): void {
    const now = performance.now();
    this.fx.push({ kind: "tracer", x1, y1, x2, y2, color: weapon === "spas12" ? 0xffd27a : 0xfff1b8, born: now, ttl: 90 });
    if (hit) this.fx.push({ kind: "spark", x1: x2, y1: y2, x2, y2, color: 0xd32f2f, born: now, ttl: 220 });
  }

  addExplosion(x: number, y: number, r: number): void {
    this.fx.push({ kind: "boom", x1: x, y1: y, x2: r, y2: 0, color: 0xff9a3c, born: performance.now(), ttl: 450 });
    if (!this.reducedShake) this.shake = Math.max(this.shake, 9);
  }

  addSlash(x: number, y: number): void {
    this.fx.push({ kind: "slash", x1: x, y1: y, x2: x, y2: y, color: 0xffffff, born: performance.now(), ttl: 160 });
  }

  frame(
    camera: { x: number; y: number },
    zoom: number,
    players: RenderPlayer[],
    projectiles: ProjectileSnap[],
    pickups: PickupSnap[],
  ): void {
    const map = this.map;
    if (!map) return;
    const now = performance.now();
    const s = this.computeScale(zoom);
    this.scale = s;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const halfW = sw / s / 2;
    const halfH = sh / s / 2;
    const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
    this.cam.x += (clamp(camera.x, halfW, map.width - halfW) - this.cam.x) * 0.25;
    this.cam.y += (clamp(camera.y, halfH, map.height - halfH) - this.cam.y) * 0.25;
    let ox = 0;
    let oy = 0;
    if (this.shake > 0.2) {
      ox = (Math.random() - 0.5) * this.shake;
      oy = (Math.random() - 0.5) * this.shake;
      this.shake *= 0.86;
    }
    this.world.scale.set(s);
    this.world.position.set(sw / 2 - this.cam.x * s + ox, sh / 2 - this.cam.y * s + oy);

    this.drawBackdrop(map, sw, sh);
    this.drawPickups(pickups, now);
    this.drawPlayers(players, now);

    const pg = this.projG;
    pg.clear();
    for (const pr of projectiles) {
      pg.circle(pr.x, pr.y - 4, 5).fill(0x2e3b24);
      pg.circle(pr.x - 1.5, pr.y - 5.5, 1.5).fill({ color: 0xffffff, alpha: 0.5 });
    }

    const fg = this.fxG;
    fg.clear();
    this.fx = this.fx.filter((f) => now - f.born < f.ttl);
    for (const f of this.fx) {
      const t = (now - f.born) / f.ttl;
      if (f.kind === "tracer") {
        fg.moveTo(f.x1, f.y1).lineTo(f.x2, f.y2).stroke({ width: 2, color: f.color, alpha: 1 - t });
      } else if (f.kind === "spark") {
        fg.circle(f.x1, f.y1, 3 + t * 6).fill({ color: f.color, alpha: 0.8 * (1 - t) });
      } else if (f.kind === "boom") {
        const r = f.x2 * (0.35 + 0.65 * Math.sqrt(t));
        fg.circle(f.x1, f.y1, r).fill({ color: 0xffd27a, alpha: 0.45 * (1 - t) });
        fg.circle(f.x1, f.y1, r * 0.55).fill({ color: f.color, alpha: 0.7 * (1 - t) });
      } else {
        fg.arc(f.x1, f.y1, 22, -1, 1).stroke({ width: 3, color: f.color, alpha: 1 - t });
      }
    }
  }

  private drawBackdrop(map: MapDefinition, sw: number, sh: number): void {
    const g = this.backdrop;
    g.clear();
    const base = sh * 0.62 - (this.cam.y - map.height / 2) * this.scale * 0.15;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 420 - this.cam.x * this.scale * 0.2) % (sw + 600)) - 300;
      g.moveTo(x, base + 200)
        .lineTo(x + 260, base - 60 - (i % 3) * 30)
        .lineTo(x + 520, base + 200)
        .fill({ color: 0x000000, alpha: 0.08 });
    }
  }

  private drawPickups(pickups: PickupSnap[], now: number): void {
    const g = this.pickupG;
    g.clear();
    const bob = Math.sin(now / 300) * 3;
    for (const pk of pickups) {
      const y = pk.y - 14 + bob;
      if (pk.k === "weapon" && pk.i) {
        const def = WEAPONS[pk.i];
        const len = GUN_LENGTH[pk.i] ?? 22;
        g.roundRect(pk.x - len / 2 - 4, y - 7, len + 8, 14, 4).fill({ color: 0x000000, alpha: 0.25 });
        g.rect(pk.x - len / 2, y - 3, len, 6).fill(def?.color ?? 0x666666);
        g.rect(pk.x - len / 2 + 3, y + 2, 4, 6).fill(def?.color ?? 0x666666);
      } else if (pk.k === "health") {
        g.roundRect(pk.x - 10, y - 10, 20, 20, 4).fill(0xffffff);
        g.rect(pk.x - 2.5, y - 7, 5, 14).fill(0xd32f2f);
        g.rect(pk.x - 7, y - 2.5, 14, 5).fill(0xd32f2f);
      } else if (pk.k === "ammo") {
        g.roundRect(pk.x - 11, y - 8, 22, 16, 3).fill(0x5b6b2e);
        g.rect(pk.x - 7, y - 4, 3, 8).fill(0xd4b25a);
        g.rect(pk.x - 1.5, y - 4, 3, 8).fill(0xd4b25a);
        g.rect(pk.x + 4, y - 4, 3, 8).fill(0xd4b25a);
      } else {
        g.roundRect(pk.x - 8, y - 11, 16, 22, 4).fill(0x2f7fd1);
        g.rect(pk.x - 4, y - 14, 8, 4).fill(0x1b4f86);
      }
    }
  }

  private drawPlayers(players: RenderPlayer[], now: number): void {
    const g = this.playerG;
    g.clear();
    const seen = new Set<number>();
    for (const p of players) {
      if (!p.alive) continue;
      seen.add(p.id);
      const h = p.crouch ? PLAYER_CROUCH_H : PLAYER_H;
      const top = p.y - h;
      const facing = Math.cos(p.aim) >= 0 ? 1 : -1;
      const body = p.team === -1 ? p.color : TEAM_COLORS[p.team];
      const alpha = p.protected ? 0.45 + 0.35 * Math.sin(now / 80) : 1;
      const hw = PLAYER_W / 2;

      // jetpack and flame
      g.roundRect(p.x - facing * hw - 5, top + 12, 9, h * 0.45, 2).fill({ color: 0x4a4f55, alpha });
      if (p.jetting) {
        const flick = 10 + Math.random() * 10;
        g.moveTo(p.x - facing * hw - 4, top + 12 + h * 0.45)
          .lineTo(p.x - facing * hw + 0.5, top + 12 + h * 0.45 + flick)
          .lineTo(p.x - facing * hw + 5, top + 12 + h * 0.45)
          .fill({ color: 0xffa53c, alpha: 0.9 });
      }
      // legs, body, head
      g.rect(p.x - hw + 3, p.y - h * 0.32, 6, h * 0.32).fill({ color: 0x2b2f33, alpha });
      g.rect(p.x + hw - 9, p.y - h * 0.32, 6, h * 0.32).fill({ color: 0x2b2f33, alpha });
      g.roundRect(p.x - hw, top + 12, PLAYER_W, h * 0.6, 4).fill({ color: body, alpha });
      g.circle(p.x, top + 7, 8).fill({ color: 0xf0c8a0, alpha });
      g.rect(p.x - 9, top - 2, 18, 6).fill({ color: 0x3d4a2c, alpha });
      g.rect(p.x + facing * 2, top + 5, facing * 5, 2).fill({ color: 0x222222, alpha });
      // gun along the aim
      if (p.weapon) {
        const len = GUN_LENGTH[p.weapon] ?? 22;
        const sx = p.x;
        const sy = p.y - h * 0.68;
        g.moveTo(sx, sy)
          .lineTo(sx + Math.cos(p.aim) * len, sy + Math.sin(p.aim) * len)
          .stroke({ width: p.weapon === "mini-eagle" || p.weapon === "uzi" ? 4 : 5, color: WEAPONS[p.weapon]?.color ?? 0x333333, alpha });
      }
      if (p.local) {
        g.moveTo(p.x - 5, top - 16).lineTo(p.x + 5, top - 16).lineTo(p.x, top - 9).fill(0xffffff);
      } else {
        const frac = Math.max(0, p.hp / p.maxHp);
        g.rect(p.x - 16, top - 12, 32, 4).fill({ color: 0x000000, alpha: 0.4 });
        g.rect(p.x - 16, top - 12, 32 * frac, 4).fill(frac > 0.35 ? 0x5cd65c : 0xe04f3c);
      }

      let label = this.labels.get(p.id);
      if (!label) {
        label = new Text({ text: p.name, style: { fontFamily: "system-ui, sans-serif", fontSize: 12, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } });
        label.anchor.set(0.5, 1);
        this.labels.set(p.id, label);
        this.labelLayer.addChild(label);
      }
      if (label.text !== p.name) label.text = p.name;
      label.visible = !p.local;
      label.position.set(p.x, top - 15);
    }
    for (const [id, label] of this.labels) label.visible = label.visible && seen.has(id);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
