import { Application, Container, Graphics, Text } from "pixi.js";
import { PLAYER_CROUCH_H, PLAYER_H, PLAYER_W } from "../shared/constants.ts";
import type { AreaSnap, FlagState, MapDefinition, PickupSnap, ProjectileSnap, Team } from "../shared/types.ts";
import { avatarOf, drawThrowable, drawWeapon, SKIN, type Avatar } from "./art.ts";
import { WEAPONS } from "../shared/weapons.ts";


interface RenderProbe {
  frames:number;
  lastFrameAt:number;
  frameIntervals:number[];
  drawCpuMs:number[];
  submitCpuMs:number[];
  config:Record<string,unknown>;
}
const probeParams=new URLSearchParams(location.search);
const probeEnabled=probeParams.get("renderProbe")==="1";
const probeWindow=window as Window & { __jetRenderProbe?:RenderProbe };
const probeAA=probeEnabled&&probeParams.has("renderAA")?probeParams.get("renderAA")!=="0":null;
const probeResolution=probeEnabled&&probeParams.has("renderResolution")?Math.max(.5,Math.min(2,Number(probeParams.get("renderResolution"))||1)):null;
// Software WebGL can spend tens of milliseconds filling a high-DPI canvas.
// Keep normal GPU quality; only a positively identified software backend gets
// a 720p pixel budget. HUD/buttons are HTML, so their text stays full resolution.
let softwareBackend:boolean|undefined;
function usesSoftwareWebGL():boolean {
  if(softwareBackend!==undefined)return softwareBackend;
  softwareBackend=false;
  const canvas=document.createElement("canvas");
  const gl=canvas.getContext("webgl2")??canvas.getContext("webgl");
  if(gl) {
    const ext=gl.getExtension("WEBGL_debug_renderer_info");
    const name=String(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
    softwareBackend=/swiftshader|llvmpipe|softpipe|software/i.test(name);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return softwareBackend;
}
function backingResolution(width:number,height:number,software:boolean):number {
  if(probeResolution!==null)return probeResolution;
  return software?Math.min(1,Math.sqrt(1280*720/Math.max(1,width*height))):Math.min(window.devicePixelRatio||1,2);
}

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
  dual: boolean;
  otherWeapon: string | null;
  emp: number;
  avatar?: Avatar;
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
  private flagG = new Graphics();
  private areaG = new Graphics();
  private decor = new Container();
  private labels = new Map<number, Text>();
  private labelLayer = new Container();
  private fx: Fx[] = [];
  private map: MapDefinition | null = null;
  private scale = 1;
  private cam = { x: 0, y: 0 };
  shake = 0;
  reducedShake = false;
  private probe:RenderProbe|null=null;
  private resizeQuality:(()=>void)|null=null;

  async init(parent: HTMLElement): Promise<void> {
    const software=usesSoftwareWebGL();
    const antialias=probeAA??!software;
    await this.app.init({
      resizeTo: parent,
      background: 0x9cc3d5,
      antialias,
      autoDensity: true,
      resolution: backingResolution(parent.clientWidth,parent.clientHeight,software),
    });
    this.resizeQuality=()=>{
      const resolution=backingResolution(parent.clientWidth,parent.clientHeight,software);
      if(this.app.renderer.resolution!==resolution)this.app.renderer.resolution=resolution;
    };
    window.addEventListener("resize",this.resizeQuality);
    if(probeEnabled) {
      const gl=(this.app.renderer as unknown as {gl?:WebGL2RenderingContext}).gl;
      const ext=gl?.getExtension("WEBGL_debug_renderer_info");
      this.probe={frames:0,lastFrameAt:0,frameIntervals:[],drawCpuMs:[],submitCpuMs:[],config:{
        antialiasRequested:antialias,softwareFallback:software,resolution:this.app.renderer.resolution,canvasWidth:this.app.canvas.width,canvasHeight:this.app.canvas.height,
        graphics:gl?{antialias:gl.getContextAttributes()?.antialias,vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}:null,
      }};
      probeWindow.__jetRenderProbe=this.probe;
      let started=0;
      const samples=this.probe;
      this.app.renderer.runners.prerender.add({prerender:()=>{started=performance.now();}});
      this.app.renderer.runners.postrender.add({postrender:()=>{
        const now=performance.now();
        samples.frames++;
        if(samples.lastFrameAt)samples.frameIntervals.push(now-samples.lastFrameAt);
        samples.lastFrameAt=now;samples.submitCpuMs.push(now-started);
        if(samples.frameIntervals.length>1200)samples.frameIntervals.shift();
        if(samples.submitCpuMs.length>1200)samples.submitCpuMs.shift();
      }});
    }
    this.app.canvas.setAttribute("aria-label", "Game view");
    parent.appendChild(this.app.canvas);
    this.app.stage.addChild(this.backdrop, this.world);
    this.world.addChild(this.mapG, this.decor, this.areaG, this.pickupG, this.flagG, this.projG, this.playerG, this.fxG, this.labelLayer);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  setMap(map: MapDefinition, showObjectives = false): void {
    this.map = map;
    this.app.renderer.background.color = map.theme.sky;
    const g = this.mapG;
    g.clear();

    for (const child of this.decor.removeChildren()) child.destroy();
    const crypt=map.id==="cryptworks";
    const label=(text:string,x:number,y:number,color:number,size=16) => {
      const t=new Text({text,style:{fontFamily:"system-ui",fontSize:size,fontWeight:"bold",fill:color,stroke:{color:0x172132,width:3}}});
      t.anchor.set(.5); t.position.set(x,y); this.decor.addChild(t);
    };
    // Authored decoration is visual only: all colliders remain shared map data.
    for (const s of map.solids) {
      g.roundRect(s.x,s.y,s.w,s.h,Math.min(5,s.h/4)).fill(map.theme.rock);
      g.rect(s.x,s.y,s.w,Math.min(7,s.h)).fill(map.theme.platform);
      g.rect(s.x,s.y+s.h-5,s.w,5).fill({color:0x102033,alpha:.35});
      if(s.h>35 && s.w>60) {
        for(let y=s.y+22;y<s.y+s.h-8;y+=32) {
          g.moveTo(s.x+4,y).lineTo(s.x+s.w-4,y).stroke({width:1,color:0x101b2b,alpha:.25});
          for(let x=s.x+20+((y-s.y)%64?20:0);x<s.x+s.w-6;x+=58)
            g.moveTo(x,y-20).lineTo(x,y).stroke({width:2,color:0x142334,alpha:.3});
        }
      }
      if(s.y>50&&s.w>180) {
        if(crypt) {
          for(let x=s.x+45;x<s.x+s.w-25;x+=125) {
            g.roundRect(x,s.y+14,30,Math.min(36,s.h-19),9).fill({color:0x0b1728,alpha:.55});
            g.circle(x+15,s.y+24,4).fill({color:map.theme.accent,alpha:.6});
          }
        } else {
          g.rect(s.x+10,s.y+9,Math.min(55,s.w-20),8).fill({color:map.theme.accent,alpha:.45});
        }
      }
    }
    for (const p of map.platforms) {
      g.roundRect(p.x,p.y,p.w,p.h,3).fill(map.theme.platform);
      g.rect(p.x,p.y,p.w,3).fill({color:0xe6f5e0,alpha:.7});
      for(let x=p.x+10;x<p.x+p.w-5;x+=24) g.rect(x,p.y+5,9,3).fill({color:0x122636,alpha:.4});
      // Dashed ends identify surfaces that can be dropped through.
      g.moveTo(p.x+5,p.y+20).lineTo(p.x+10,p.y+24).lineTo(p.x+15,p.y+20).stroke({width:2,color:map.theme.accent,alpha:.55});
    }
    for(const goal of showObjectives ? map.goals : []) {
      const r=goal.rect,c=TEAM_COLORS[goal.team];
      g.roundRect(r.x,r.y,r.w,r.h,12).fill({color:c,alpha:.1}).stroke({width:4,color:c,alpha:.8});
      g.rect(r.x-5,r.y+r.h-8,r.w+10,8).fill(c);
      g.moveTo(r.x+r.w/2-15,r.y+60).lineTo(r.x+r.w/2,r.y+78).lineTo(r.x+r.w/2+15,r.y+60).stroke({width:5,color:c,alpha:.85});
      label(TEAM_NAMES[goal.team]+" GOAL",r.x+r.w/2,r.y-18,c,13);
    }
    for(const home of showObjectives ? map.flagHomes : []) {
      g.roundRect(home.x-24,home.y-8,48,8,3).fill(TEAM_COLORS[home.team]);
      label(TEAM_NAMES[home.team]+" FLAG",home.x,home.y+18,TEAM_COLORS[home.team],11);
    }
    label(map.name.toUpperCase(),map.width/2,100,map.theme.accent,32);
  }

  // How much of the world shows: landscape screens see ~1200 world px across,
  // portrait phones ~760, and zoom widens the view.
  private playableHeight(): number {
    const controls=this.canvas.closest(".game")?.querySelector<HTMLElement>(".touch .tbtns");
    if(!controls)return this.app.screen.height;
    // Position the camera above the actual responsive action bank. The canvas
    // still fills the screen, so backdrop and terrain continue behind controls.
    const top=controls.getBoundingClientRect().top-this.canvas.getBoundingClientRect().top;
    return Math.max(140,Math.min(this.app.screen.height,top-20));
  }

  private computeScale(zoom: number, playableHeight: number): number {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const visibleW = (w >= h ? 1200 : 760) * zoom;
    // Portrait play is width-limited; reserving controls must not make pilots
    // smaller. In landscape, also fit the available vertical play area.
    return w<h ? w/visibleW : Math.min(w/visibleW,playableHeight/(680*zoom));
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.world.x + x * this.scale, y: this.world.y + y * this.scale };
  }

  addTracer(x1: number, y1: number, x2: number, y2: number, weapon: string, hit: boolean): void {
    const now = performance.now();
    this.fx.push({ kind: "tracer", x1, y1, x2, y2, color: weapon === "phasr" ? 0x89ffeb : weapon === "flamethrower" ? 0xff8844 : weapon === "emp-gun" ? 0x8ecaff : weapon === "spas12" ? 0xffd27a : 0xfff1b8, born: now, ttl: 90 });
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
    flags: FlagState[] = [],
    areas: AreaSnap[] = [],
  ): void {
    const map = this.map;
    if (!map) return;
    const drawStarted=this.probe?performance.now():0;
    const now = performance.now();
    const playableHeight=this.playableHeight();
    const s = this.computeScale(zoom,playableHeight);
    this.scale = s;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const halfW = sw / s / 2;
    const halfH = playableHeight / s / 2;
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
    this.world.position.set(sw / 2 - this.cam.x * s + ox, playableHeight / 2 - this.cam.y * s + oy);

    this.drawBackdrop(map, sw, sh);
    this.drawPickups(pickups, now);
    this.drawPlayers(players, now);
    this.drawFlags(flags,players,now);
    this.drawAreas(areas,now);

    const pg = this.projG;
    pg.clear();
    for (const pr of projectiles) {
      if(["frag","gas","emp","mine"].includes(pr.k)) drawThrowable(pg,pr.k,pr.x,pr.y,1,pr.armed);
      else if(pr.k==="saw-launcher" || pr.k==="saw") {
        pg.star(pr.x,pr.y,10,12,7,now/70).fill(0xd6e4e6).stroke({width:2,color:0x5f7583});
        pg.circle(pr.x,pr.y,3).fill(0xedb963);
      } else if(pr.k==="emp-gun") {
        pg.circle(pr.x,pr.y,14).fill({color:0x81ccff,alpha:.18}).stroke({width:2,color:0xa9e8ff});
        pg.circle(pr.x,pr.y,5).fill(0xd0f7ff);
      } else {
        const a=Math.atan2(pr.vy,pr.vx);
        pg.moveTo(pr.x-Math.cos(a)*21,pr.y-Math.sin(a)*21).lineTo(pr.x,pr.y).stroke({width:5,color:0xffb45d,alpha:.8});
        pg.circle(pr.x,pr.y,5).fill(pr.k==="rg6"?0x9db579:0xe0dddd);
      }
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
    if(this.probe) {this.probe.drawCpuMs.push(performance.now()-drawStarted);if(this.probe.drawCpuMs.length>1200)this.probe.drawCpuMs.shift();}
  }

  private drawBackdrop(map: MapDefinition, sw: number, sh: number): void {
    const g = this.backdrop;
    g.clear();
    if(map.id==="cryptworks") {
      for(let i=0;i<12;i++) {
        const x=((i*170-this.cam.x*this.scale*.13)%(sw+240))-120;
        g.roundRect(x,sh*.16,105,sh*.65,50).fill({color:0x081425,alpha:.36});
        g.rect(x+10,sh*.16+80,85,sh*.58).fill({color:0x0a192c,alpha:.35});
        g.circle(x+54,sh*.37,4).fill({color:0x67dfcf,alpha:.35});
      }
      for(let i=0;i<20;i++)g.circle((i*137+Math.sin(i)*90)%sw,(i*73)%sh,1+(i%2)).fill({color:0x8db8bc,alpha:.18});
      return;
    }
    if(map.id==="skyshaft") {
      for(let i=0;i<9;i++) {
        const x=((i*190-this.cam.x*this.scale*.12)%(sw+220))-100;
        g.rect(x,0,24,sh).fill({color:0x081828,alpha:.18});
        g.moveTo(x,0).lineTo(x+170,sh).stroke({width:9,color:0x081828,alpha:.13});
      }
      for(let i=0;i<30;i++)g.circle((i*163)%sw,(i*83)%sh,1).fill({color:0xbde0ec,alpha:.4});
    }
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
        g.ellipse(pk.x,y+7,23,6).fill({color:0x091525,alpha:.25});
        drawWeapon(g,pk.i,pk.x-12,y,0,.85);
      } else if(pk.k==="throwable") {
        drawThrowable(g,pk.i ?? "frag",pk.x,y);
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
      const avatar=avatarOf(p.avatar);
      g.circle(p.x, top + 7, 8).fill({ color: SKIN[avatar.face], alpha });
      if(avatar.helmet==="mohawk") g.poly([p.x-4,top,p.x-3,top-9,p.x+1,top-5,p.x+5,top-10,p.x+7,top+1]).fill({color:0xf5aa48,alpha});
      else {
        g.roundRect(p.x-9,top-2,18,6,2).fill({color:avatar.helmet==="cap"?0x78916c:0x344957,alpha});
        if(avatar.helmet==="cap") g.rect(p.x+facing*5,top+1,facing*9,3).fill(0x78916c);
      }
      g.rect(p.x+facing*2,top+5,facing*(avatar.helmet==="visor"?7:5),avatar.helmet==="visor"?5:2).fill({color:avatar.helmet==="visor"?0x98e7ed:0x222222,alpha});
      if(avatar.emblem==="star") g.star(p.x,top+24,5,4,2).fill(0xffe0a0);
      else if(avatar.emblem==="bolt") g.poly([p.x+2,top+18,p.x-3,top+25,p.x,top+25,p.x-1,top+29,p.x+4,top+22,p.x+1,top+22]).fill(0xffe0a0);
      else { g.circle(p.x,top+23,3).fill(0xeae8d3); g.rect(p.x-2,top+25,4,3).fill(0xeae8d3); }
      // gun along the aim
      if(p.weapon) drawWeapon(g,p.weapon,p.x,p.y-h*.68,p.aim,1,alpha);
      if(p.dual && p.otherWeapon) drawWeapon(g,p.otherWeapon,p.x-3,p.y-h*.46,p.aim,1,alpha);
      if(p.emp>0) {
        g.circle(p.x,top+h/2,28).stroke({width:2,color:0x82ddff,alpha:.4+.25*Math.sin(now/65)});
        g.poly([p.x-19,top+9,p.x-24,top+21,p.x-17,top+19,p.x-22,top+31]).stroke({width:2,color:0xbcf0ff});
      }
      if(p.protected) g.ellipse(p.x,top+h/2,22,h*.67).stroke({width:2,color:0xdaf6ff,alpha:.45});
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


  private drawFlags(flags: FlagState[], players:RenderPlayer[], now:number):void {
    const g=this.flagG; g.clear();
    for(const f of flags) {
      if(f.state==="respawning") continue;
      const carrier=players.find(p=>p.id===f.carrier);
      const x=carrier?carrier.x-18:f.x, y=carrier?carrier.y-45:f.y;
      const c=TEAM_COLORS[f.owner], wave=Math.sin(now/170)*3;
      if(!carrier) g.ellipse(x,y+2,24,6).fill({color:c,alpha:.28});
      g.moveTo(x,y).lineTo(x,y-47).stroke({width:3,color:0xebe5ce});
      g.poly([x,y-47,x+29,y-43+wave,x+23,y-27+wave,x,y-30]).fill(c).stroke({width:1,color:0xffffff,alpha:.65});
      g.star(x+12,y-38+wave*.5,5,5,2).fill(0xfff2ca);
      if(f.state==="dropped") g.circle(x,y-23,32).stroke({width:2,color:c,alpha:.25+.2*Math.sin(now/200)});
    }
  }
  private drawAreas(areas:AreaSnap[],now:number):void {
    const g=this.areaG;g.clear();
    for(const a of areas) {
      g.circle(a.x,a.y,a.r).fill({color:0xb6e44c,alpha:.13}).stroke({width:2,color:0xc3ef67,alpha:.35});
      for(let i=0;i<8;i++) {
        const angle=i*2.4+now/2400, distance=(.3+(i%3)*.18)*a.r;
        g.circle(a.x+Math.cos(angle)*distance,a.y+Math.sin(angle)*distance,a.r*(.17+(i%2)*.07)).fill({color:i%2?0x9ed43f:0xd8fa84,alpha:.13});
      }
    }
  }

  destroy(): void {
    if(this.resizeQuality)window.removeEventListener("resize",this.resizeQuality);
    if(probeWindow.__jetRenderProbe===this.probe)delete probeWindow.__jetRenderProbe;
    this.app.destroy(true, { children: true });
  }
}
