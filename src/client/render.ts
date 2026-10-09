import { Application, Container, Graphics, Text } from "pixi.js";
import { PLAYER_CROUCH_H, PLAYER_H } from "../shared/constants.ts";
import type { AreaSnap, FlagState, MapDefinition, PickupSnap, ProjectileSnap, Team } from "../shared/types.ts";
import { avatarOf, drawThrowable, drawWeapon, drawPilot, weaponLength, type Avatar } from "./art.ts";
import { drawBackdropLayer, drawScenery, drawTerrain } from "./environment-art.ts";


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
  vx?:number;
  vy?:number;
}

interface Fx {
  kind: "tracer" | "boom" | "spark" | "slash" | "muzzle" | "case" | "smoke" | "blood" | "stain" | "regen" | "flash";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;
  born: number;
  ttl: number;
}

interface ActorVisual {x:number;y:number;hp:number;alive:boolean;walk:number;at:number;hitUntil:number;recoilUntil:number;regenUntil:number}

export class Renderer {
  readonly app = new Application();
  private world = new Container();
  private staticWorld=new Container();
  private softwareStaticCache=false;
  private backdrop = new Container();
  private backdropLayers=[new Graphics(),new Graphics()];
  private backdropSky=new Graphics();
  private backdropSize="";
  private actors=new Map<number,ActorVisual>();
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
    this.softwareStaticCache=software&&(!probeEnabled||probeParams.get("renderCache")!=="0");
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
        antialiasRequested:antialias,softwareFallback:software,staticTextureCaching:this.softwareStaticCache,resolution:this.app.renderer.resolution,canvasWidth:this.app.canvas.width,canvasHeight:this.app.canvas.height,
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
    this.backdrop.addChild(this.backdropSky,...this.backdropLayers);
    this.app.stage.addChild(this.backdrop, this.world);
    this.staticWorld.addChild(this.mapG,this.decor);
    this.world.addChild(this.staticWorld, this.areaG, this.pickupG, this.flagG, this.projG, this.playerG, this.fxG, this.labelLayer);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  setMap(map: MapDefinition, showObjectives = false): void {
    this.map = map;
    if(this.softwareStaticCache)this.staticWorld.cacheAsTexture(false);
    this.app.renderer.background.color = map.theme.sky;
    const g = this.mapG;
    g.clear();

    for (const child of this.decor.removeChildren()) child.destroy();

    const label=(text:string,x:number,y:number,color:number,size=16) => {
      const t=new Text({text,style:{fontFamily:"system-ui",fontSize:size,fontWeight:"bold",fill:color,stroke:{color:0x172132,width:3}}});
      t.anchor.set(.5); t.position.set(x,y); this.decor.addChild(t);
    };
    this.backdropSize="";
    drawTerrain(g,map);
    const scenery=new Graphics();
    drawScenery(scenery,map);
    this.decor.addChild(scenery);
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
    // Rasterize the complete static illustration once on software backends.
    // Dynamic actors, pickups, flags and effects stay live in separate layers.
    if(this.softwareStaticCache)this.staticWorld.cacheAsTexture({resolution:1,antialias:false});
  }

  // How much of the world shows: landscape screens see ~1050 world px across,
  // portrait phones ~620, and zoom widens the view.
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
    const visibleW = (w >= h ? 1050 : 620) * zoom;
    // Portrait play is width-limited; reserving controls must not make pilots
    // smaller. In landscape, also fit the available vertical play area.
    return w<h ? w/visibleW : Math.min(w/visibleW,playableHeight/(590*zoom));
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.world.x + x * this.scale, y: this.world.y + y * this.scale };
  }

  addTracer(x1:number,y1:number,x2:number,y2:number,weapon:string,hit:boolean):void {
    const now=performance.now(),a=Math.atan2(y2-y1,x2-x1),len=weaponLength(weapon)*.9;
    const mx=x1+Math.cos(a)*len,my=y1+Math.sin(a)*len;
    const color=weapon==="phasr"?0xb0f3de:weapon==="flamethrower"?0xffa647:weapon==="emp-gun"?0xbadfff:0xffedb0;
    this.fx.push({kind:"tracer",x1:mx,y1:my,x2,y2,color,born:now,ttl:85});
    this.fx.push({kind:"muzzle",x1:mx,y1:my,x2:a,y2:0,color,born:now,ttl:85});
    this.fx.push({kind:"smoke",x1:mx,y1:my,x2:Math.cos(a)*14,y2:-23,color:0xd0d5bd,born:now,ttl:420});
    if(!["phasr","emp-gun","flamethrower","machete","riot-shield"].includes(weapon))
      this.fx.push({kind:"case",x1,y1,x2:-Math.cos(a)*30,y2:-42,color:0xe6c46f,born:now,ttl:480});
    for(const actor of this.actors.values())if(Math.hypot(actor.x-x1,actor.y-28-y1)<42)actor.recoilUntil=now+100;
    if(hit)this.fx.push({kind:"spark",x1:x2,y1:y2,x2:0,y2:0,color:0xffdb94,born:now,ttl:190});
  }

  addFlashbang(x:number,y:number,r:number):void {
    this.fx.push({kind:"flash",x1:x,y1:y,x2:r,y2:0,color:0xfff7dd,born:performance.now(),ttl:370});
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
      if(["frag","flash","gas","emp","mine"].includes(pr.k)) drawThrowable(pg,pr.k,pr.x,pr.y,1,pr.armed);
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
    this.fx = this.fx.filter((f) => now - f.born < f.ttl).slice(-180);
    for (const f of this.fx) {
      const t = (now - f.born) / f.ttl;
      if(f.kind==="tracer") {
        fg.moveTo(f.x1,f.y1).lineTo(f.x2,f.y2).stroke({width:5,color:f.color,alpha:.16*(1-t)});
        fg.moveTo(f.x1,f.y1).lineTo(f.x2,f.y2).stroke({width:1.7,color:f.color,alpha:1-t});
      } else if(f.kind==="muzzle") {
        const a=f.x2,c=Math.cos(a),ss=Math.sin(a),pts=[0,-4,8,-3,15,-8,11,0,20,2,8,5,2,3];
        fg.poly(pts.map((v,i)=>i%2?v*c+pts[i-1]*ss+f.y1:v*c-pts[i+1]*ss+f.x1)).fill({color:f.color,alpha:1-t});
      } else if(f.kind==="case"||f.kind==="blood") {
        const dt=t*f.ttl/1000,x=f.x1+f.x2*dt,y=f.y1+f.y2*dt+120*dt*dt;
        if(f.kind==="case")fg.poly([x-2,y,x+2,y-1,x+3,y+2,x-1,y+3]).fill({color:f.color,alpha:1-t});
        else fg.ellipse(x,y,2.8*(1-t),1.9*(1-t)).fill({color:f.color,alpha:.85*(1-t)});
      } else if(f.kind==="stain") {
        fg.ellipse(f.x1,f.y1,5,1.8).fill({color:f.color,alpha:.45*(1-t)});
      } else if(f.kind==="smoke") {
        fg.circle(f.x1+f.x2*t,f.y1+f.y2*t,2+t*7).fill({color:f.color,alpha:.35*(1-t)});
      } else if(f.kind==="regen") {
        const y=f.y1-20*t,a=.65*(1-t);
        fg.rect(f.x1-1.4,y-4,2.8,8).fill({color:f.color,alpha:a});
        fg.rect(f.x1-4,y-1.4,8,2.8).fill({color:f.color,alpha:a});
      } else if(f.kind==="spark") {
        for(let i=0;i<5;i++){const a=i*1.4,rr=3+12*t;fg.moveTo(f.x1+Math.cos(a)*rr,f.y1+Math.sin(a)*rr).lineTo(f.x1+Math.cos(a)*(rr+5),f.y1+Math.sin(a)*(rr+5)).stroke({width:2,color:f.color,alpha:1-t});}
      } else if(f.kind==="boom"||f.kind==="flash") {
        const rr=f.x2*(.25+.75*Math.sqrt(t)),flash=f.kind==="flash";
        fg.circle(f.x1,f.y1,rr).stroke({width:flash?4:3,color:flash?0xfff9df:0xffd17d,alpha:.8*(1-t)});
        for(let i=0;i<7;i++){
          const a=i*6.283/7,dist=rr*.45;
          fg.circle(f.x1+Math.cos(a)*dist,f.y1+Math.sin(a)*dist,rr*(.36-t*.12)).fill({color:flash?0xfff4d0:i%2?0xf0a256:0xb78457,alpha:(flash?.3:.5)*(1-t)});
        }
        fg.circle(f.x1,f.y1,rr*.28).fill({color:0xffefaa,alpha:.7*(1-t)});
      } else fg.arc(f.x1,f.y1,22,-1,1).stroke({width:3,color:f.color,alpha:1-t});
    }
    if(this.probe) {this.probe.drawCpuMs.push(performance.now()-drawStarted);if(this.probe.drawCpuMs.length>1200)this.probe.drawCpuMs.shift();}
  }

  private drawBackdrop(map:MapDefinition,sw:number,sh:number):void {
    const key=map.id+":"+sw+":"+sh;
    if(this.backdropSize!==key) {
      this.backdropSize=key;
      if(this.softwareStaticCache)this.backdrop.cacheAsTexture(false);
      this.backdropSky.clear();
      if(this.softwareStaticCache)this.backdropSky.rect(-500,-180,sw+1800,sh+480).fill(map.theme.sky);
      this.backdropLayers.forEach((g,i)=>{
        g.position.set(0,0);
        drawBackdropLayer(g,map,sw+800,sh+180,i);
      });
      // Preserve every illustrated layer, but composite the software backdrop
      // once and move it as a unit. Hardware retains independent parallax.
      if(this.softwareStaticCache) {
        this.backdrop.blendMode="none";
        this.backdrop.cacheAsTexture({resolution:Math.min(1,this.app.renderer.resolution),antialias:false});
      }
    }
    if(this.softwareStaticCache) {
      this.backdrop.position.set(-(this.cam.x*this.scale*.075)%350-100,-(this.cam.y-map.height*.5)*this.scale*.055-30);
    } else this.backdropLayers.forEach((g,i)=>{
      g.x=-(this.cam.x*this.scale*(.055+i*.045))%350-100;
      g.y=-(this.cam.y-map.height*.5)*this.scale*(.045+i*.025)-30;
    });
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
      if(!p.alive) {
        const last=this.actors.get(p.id);
        if(last) {
          for(let i=0;i<7;i++)this.fx.push({kind:"blood",x1:p.x,y1:p.y-24,x2:(i-3)*19,y2:-35-i*5,color:0xa14f3b,born:now,ttl:650});
          const floor=this.map?.solids.filter(r=>r.y>=p.y-2&&r.y<p.y+100&&p.x>=r.x&&p.x<=r.x+r.w).sort((a,b)=>a.y-b.y)[0];
          if(floor)this.fx.push({kind:"stain",x1:p.x,y1:floor.y+2,x2:0,y2:0,color:0x7f4635,born:now,ttl:7000});
        }
        this.actors.delete(p.id);continue;
      }
      seen.add(p.id);
      const h = p.crouch ? PLAYER_CROUCH_H : PLAYER_H;
      const top = p.y - h;
      const facing = Math.cos(p.aim) >= 0 ? 1 : -1;
      const body = p.team === -1 ? p.color : TEAM_COLORS[p.team];
      const alpha = p.protected ? 0.45 + 0.35 * Math.sin(now / 80) : 1;
      let state=this.actors.get(p.id);
      if(!state) {state={x:p.x,y:p.y,hp:p.hp,alive:true,walk:0,at:now,hitUntil:0,recoilUntil:0,regenUntil:0};this.actors.set(p.id,state);}
      const delta=p.x-state.x;
      if(Math.abs(delta)<35)state.walk+=Math.abs(delta)*.17;
      if(p.hp<state.hp) {
        state.hitUntil=now+130;
        for(let i=0;i<5;i++)this.fx.push({kind:"blood",x1:p.x,y1:top+22,x2:(i-2)*24,y2:-30-i*7,color:0xa14f3b,born:now,ttl:600});
        const floor=this.map?.solids.filter(r=>r.y>=p.y-2&&r.y<p.y+100&&p.x>=r.x&&p.x<=r.x+r.w).sort((a,b)=>a.y-b.y)[0];
        if(floor)this.fx.push({kind:"stain",x1:p.x,y1:floor.y+2,x2:0,y2:0,color:0x7f4635,born:now,ttl:7000});
      } else if(p.hp>state.hp&&p.hp-state.hp<20&&now>state.regenUntil) {
        state.regenUntil=now+450;
        this.fx.push({kind:"regen",x1:p.x+17,y1:top+20,x2:0,y2:0,color:0x9fd6a8,born:now,ttl:650});
      }
      const moving=Math.abs(p.vx??delta)>1,airborne=p.jetting||Math.abs(p.vy??p.y-state.y)>2;
      g.ellipse(p.x,p.y+2,15,3).fill({color:0x24382c,alpha:airborne?.1:.22});
      drawPilot(g,{x:p.x,y:p.y,h,color:body,avatar:avatarOf(p.avatar),aim:p.aim,walk:moving?Math.sin(state.walk):0,
        airborne,jetting:p.jetting,alpha,recoil:Math.max(0,(state.recoilUntil-now)/100),weapon:p.weapon,
        otherWeapon:p.dual?p.otherWeapon:null,now,hit:state.hitUntil>now});
      state.x=p.x;state.y=p.y;state.hp=p.hp;state.at=now;
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
        label = new Text({ text: p.name, style: { fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight:"600", fill: 0xfff4d6, stroke: { color: 0x000000, width: 3 } } });
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
