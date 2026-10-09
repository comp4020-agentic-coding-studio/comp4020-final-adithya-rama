import type { Graphics } from "pixi.js";
import { WEAPONS } from "../shared/weapons.ts";
export interface Avatar { helmet: "pilot" | "visor" | "cap" | "mohawk"; face: "light" | "medium" | "dark" | "robot"; emblem: "star" | "bolt" | "skull" }
export const DEFAULT_AVATAR: Avatar = { helmet: "pilot", face: "medium", emblem: "bolt" };
export function avatarOf(value: unknown): Avatar {
  const a = (value && typeof value === "object" ? value : {}) as Partial<Avatar>;
  return { helmet: ["pilot","visor","cap","mohawk"].includes(a.helmet ?? "") ? a.helmet! : "pilot", face: ["light","medium","dark","robot"].includes(a.face ?? "") ? a.face! : "medium", emblem: ["star","bolt","skull"].includes(a.emblem ?? "") ? a.emblem! : "bolt" };
}
export const SKIN = { light: 0xf3ceac, medium: 0xbc8159, dark: 0x744d3c, robot: 0xb8d7df };
type Shape = { x: number; y: number; w: number; h: number; c: number };
const SHAPES: Record<string, Shape[]> = {};
const block = (x: number, y: number, w: number, h: number, c: number): Shape => ({ x,y,w,h,c });
const dark = 0x252f37, steel = 0xa4b9c0, wood = 0xa5673d;
for (const [id, length, width, color] of [
  ["mini-eagle",19,6,steel],["golden-eagle",22,6,0xf7ca53],["magnum",25,7,0xd0d2cb],
  ["uzi",21,9,0x60786c],["tec9",25,6,0x455c66],["mp5",30,7,0x78979d],
  ["ak47",36,7,wood],["m4",37,6,0x5b727c],["tavor-x95",30,10,0xa0ad75],["xm8",35,9,0xdfa157],
  ["m14",43,6,wood],["m93ba",49,7,0xabb2a1],["spas12",35,8,0x48565d],["aa20",33,10,0x80878a],
  ["minigun",40,12,0x8d979d],["smaw",43,13,0x5d804f],["rg6",31,11,0xb6a078],
  ["saw-launcher",31,12,0xd6a759],["flamethrower",36,8,0xd9784c],["phasr",37,9,0x6ecfd7],["emp-gun",33,12,0x8fa8ff],
] as [string,number,number,number][]) {
  SHAPES[id] = [block(0,-width/2,length,width,color),block(4,width/2,5,8,dark),block(length-3,-2,7,4,dark)];
  if (length > 26) SHAPES[id].push(block(-7,-3,9,9,wood), block(15,3,5,8,dark));
  if (["m14","m93ba","m4","xm8"].includes(id)) SHAPES[id].push(block(12,-9,14,4,dark),block(15,-5,3,3,steel));
  if (id === "magnum") SHAPES[id].push(block(8,-6,8,10,dark));
  if (id === "tec9") SHAPES[id].push(block(18,-2,2,2,steel),block(22,-2,2,2,steel));
  if (id === "aa20" || id === "rg6") SHAPES[id].push(block(11,3,13,10,dark));
  if (id === "minigun") SHAPES[id].push(block(15,-4,25,2,steel),block(15,2,25,2,steel));
  if (id === "smaw") SHAPES[id].push(block(-4,-9,5,18,dark),block(34,-9,6,18,dark));
  if (["phasr","emp-gun"].includes(id)) SHAPES[id].push(block(13,-3,10,5,id==="phasr"?0xd4ffef:0xf0cbff),block(32,-8,3,16,steel));
  if (id === "flamethrower") SHAPES[id].push(block(1,-13,9,9,0xed7940),block(36,-2,7,4,0xffd16c));
  if (id === "saw-launcher") SHAPES[id].push(block(23,-9,5,18,steel),block(18,-4,15,7,steel));
}
SHAPES.machete = [block(0,-2,9,5,wood),block(9,-3,27,6,0xc7e3e7),block(7,-5,3,10,dark)];
SHAPES["riot-shield"] = [block(-2,-19,7,39,0x517992),block(-1,-13,5,12,0xbbe9ee),block(0,3,3,10,0xd3c380)];
export function drawWeapon(g: Graphics, id: string, x: number, y: number, aim = 0, scale = 1, alpha = 1): void {
  const c=Math.cos(aim)*scale, s=Math.sin(aim)*scale, flip=Math.cos(aim)>=0?1:-1;
  for (const p of SHAPES[id] ?? SHAPES["mini-eagle"]) {
    const points = [[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w,p.y+p.h],[p.x,p.y+p.h]].flatMap(([a,b])=>[x+a*c-b*s*flip,y+a*s+b*c*flip]);
    g.poly(points).fill({color:p.c,alpha}).stroke({color:0x21302c,width:1.2*scale,alpha});
  }
}
export function weaponLength(id:string):number {return Math.max(...(SHAPES[id]??SHAPES["mini-eagle"]).map(s=>s.x+s.w));}
export function weaponIcon(id: string): string {
  const shapes=(SHAPES[id] ?? SHAPES["mini-eagle"]).map(p=>'<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" fill="#'+p.c.toString(16).padStart(6,"0")+'"/>').join("");
  return '<svg class="weapon-icon" aria-hidden="true" viewBox="-9 -22 65 46">'+shapes+'</svg>';
}
export const THROW_COLORS: Record<string,number> = { frag:0xa0bc73,flash:0xe6dfc2,gas:0xb2ed62,emp:0x81d7ff,mine:0xf4a76d };
export function drawThrowable(g: Graphics, id: string, x:number, y:number, size=1, armed=false): void {
  const c=THROW_COLORS[id] ?? 0xffffaa;
  if(id==="mine") { g.ellipse(x,y,9*size,4*size).fill(0x414952); g.circle(x,y-3*size,3*size).fill(armed?0xff554d:c); }
  else { g.roundRect(x-5*size,y-7*size,10*size,14*size,3*size).fill(c).stroke({width:1.5*size,color:0x26362c}); g.rect(x-3*size,y-10*size,6*size,4*size).fill(0x39434c); g.rect(x-2*size,y-5*size,4*size,9*size).fill({color:0xffffff,alpha:.3}); if(id==="flash")g.rect(x-5*size,y-2*size,10*size,3*size).fill(0xbd7240); else if(id==="frag")for(let i=-4;i<=4;i+=4)g.moveTo(x-4*size,y+i*size).lineTo(x+4*size,y+i*size).stroke({width:size,color:0x587342}); }
}
export function avatarSvg(a: Avatar, color:number): string {
  a=avatarOf(a);
  const skin="#"+SKIN[a.face].toString(16).padStart(6,"0");
  const body="#"+(Number.isFinite(color)?Math.round(color)&0xffffff:0x3c8de0).toString(16).padStart(6,"0");
  const helmet=a.helmet==="mohawk"
    ? '<path d="M39 26L43 8L51 15L58 3L64 13L70 8L75 29" fill="#e0a849"/>'
    : '<path d="M34 30V25Q35 11 54 11H59Q78 12 79 28V32Z" fill="'+(a.helmet==="cap"?"#89966b":"#788878")+'"/><path d="M40 20Q55 12 70 20" fill="none" stroke="#bdc8b4" stroke-width="3"/><path d="M32 28H80V34H32Z" fill="#43564a"/>'+
      (a.helmet==="cap"?'<path d="M66 29H89V34H67" fill="#66784f"/>':'<rect x="30" y="31" width="11" height="15" rx="4" fill="#4c6054"/><circle cx="35" cy="37" r="2.5" fill="#b9c7ad" stroke="none"/>');
  const emblem=a.emblem==="bolt"
    ? '<path d="M59 58L48 71H55L52 81L66 65H59L63 58Z" fill="#ffe8af" stroke="none"/>'
    : a.emblem==="star"
      ? '<path d="M57 59L60 66L68 67L62 72L64 80L57 76L50 80L52 72L46 67L54 66Z" fill="#ffe8af" stroke="none"/>'
      : '<path d="M49 65Q49 58 57 58Q65 58 65 65V70L62 73V78H52V73L49 70Z" fill="#eae8d3" stroke="none"/><path d="M51 66h4v4h-4zm8 0h4v4h-4zm-4 7h4v3h-4" fill="#354d41" stroke="none"/>';
  return '<svg role="img" aria-label="Your customized armored pilot" viewBox="0 0 120 130">'+
    '<ellipse cx="60" cy="120" rx="39" ry="6" fill="#102b3340"/>'+
    '<g stroke="#21322e" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">'+
    '<path d="M42 89L40 110M69 90L76 108" fill="none" stroke-width="16"/><path d="M42 89L40 110M69 90L76 108" fill="none" stroke="#566858" stroke-width="10"/>'+
    '<path d="M32 106H47L51 113V117H29V112Z" fill="#34433a"/><path d="M69 104H82L89 111V115H66V110Z" fill="#34433a"/><path d="M32 113H47M70 111H85" stroke="#98a690" stroke-width="2"/>'+
    '<path d="M22 86L18 101L24 98L27 116L33 98L32 86" fill="#f08b38" stroke="none"/><path d="M25 87L25 105L30 89" fill="#ffed9b" stroke="none"/>'+
    '<rect x="18" y="45" width="16" height="39" rx="6" fill="#687d73"/><rect x="28" y="44" width="13" height="42" rx="5" fill="#7d9386"/><path d="M22 51V76M32 49V77" stroke="#b1c4ab" stroke-width="3"/><path d="M19 82H36V89H20Z" fill="#33493f"/>'+
    '<rect x="35" y="45" width="47" height="51" rx="12" fill="'+body+'"/><path d="M36 52L47 46H66L80 53L76 88H40Z" fill="#536453" fill-opacity=".6"/>'+
    '<path d="M41 52L47 85M73 52L68 85" fill="none" stroke="#c5c6a3" stroke-width="4"/>'+
    '<path d="M35 52Q35 45 42 45L47 52L43 59H35ZM70 49Q80 44 84 53L85 59H75Z" fill="'+body+'"/>'+
    '<rect x="33" y="88" width="50" height="10" rx="3" fill="#394b3d"/><rect x="39" y="79" width="13" height="15" rx="2" fill="#9aa084"/><rect x="65" y="79" width="12" height="15" rx="2" fill="#9aa084"/><path d="M41 84H50M67 84H75" stroke="#c1c5a4" stroke-width="2"/><rect x="55" y="90" width="8" height="6" rx="1" fill="#c9c6a0"/>'+
    emblem+
    '<rect x="49" y="38" width="16" height="12" rx="4" fill="'+skin+'"/><ellipse cx="57" cy="32" rx="21" ry="20" fill="'+skin+'"/><path d="M77 33L82 37L76 41" fill="'+skin+'"/><circle cx="37" cy="37" r="5" fill="'+skin+'"/>'+
    (a.face==="robot"?'<path d="M44 38V45H66M49 41H59M49 45H59" fill="none" stroke="#607f79" stroke-width="2"/>':'<path d="M62 44Q68 46 73 42" fill="none" stroke="#684f40" stroke-width="1.7"/>')+
    helmet+
    '<rect x="56" y="32" width="21" height="8" rx="3" fill="'+(a.helmet==="visor"||a.face==="robot"?"#b7e7e1":"#253b35")+'"/><path d="M59 34H69" stroke="#daece0" stroke-width="1.7"/>'+
    '<path d="M73 64L82 73L96 68" fill="none" stroke-width="13"/><path d="M73 64L82 73L96 68" fill="none" stroke="'+skin+'" stroke-width="8"/><circle cx="95" cy="68" r="6" fill="#455b4b"/>'+
    '<path d="M88 59H111V67H99L98 75H91L92 67H86Z" fill="#a4b9c0"/><path d="M107 61H116V66H107Z" fill="#34433a"/><path d="M91 62H104" stroke="#d9e3d4" stroke-width="2"/>'+
    '</g></svg>';
}
export function weaponName(id:string):string { return WEAPONS[id]?.name ?? id; }

export interface PilotPose {x:number;y:number;h:number;color:number;avatar:Avatar;aim:number;walk:number;airborne:boolean;jetting:boolean;alpha:number;recoil:number;weapon:string|null;otherWeapon:string|null;now:number;hit:boolean}
export function drawPilot(g:Graphics,p:PilotPose):void {
  const {x,y,h,alpha,avatar}=p,top=y-h,f=Math.cos(p.aim)>=0?1:-1,ink=0x21322e,skin=SKIN[avatar.face];
  const leg=h*.27,hip=y-leg,step=p.airborne?3:p.walk*4.7;
  const color=p.hit?0xffddd0:p.color;
  const shape=(xx:number,yy:number,w:number,hh:number,c:number,rad=3)=>g.roundRect(xx,yy,w,hh,rad).fill({color:c,alpha}).stroke({color:ink,width:1.6,alpha});
  // Boots and articulated legs are separate so running and flight read at scale.
  for(const side of [-1,1]) {
    const foot=x+side*6+step*side,fy=y-(p.airborne?(side===f?3:7):Math.max(0,step*side*.6));
    g.moveTo(x+side*5,hip).lineTo(foot,fy-4).stroke({width:9,color:ink,alpha});
    g.moveTo(x+side*5,hip).lineTo(foot,fy-4).stroke({width:6,color:0x566858,alpha});
    shape(foot-5+(f<0?-2:0),fy-6,12,6,0x34433a,2);
    g.moveTo(foot-4,fy-1).lineTo(foot+5,fy-1).stroke({width:1,color:0x98a690,alpha});
  }
  // Twin-cylinder pack, nozzle and hot inner exhaust.
  const packX=x-f*13;
  shape(packX-5,top+17,10,h*.44,0x687d73,3);
  g.moveTo(packX-3,top+21).lineTo(packX-3,top+h*.65).stroke({width:2,color:0xa1b6a4,alpha});
  shape(packX-4,top+h*.72,8,4,0x33493f,1);
  if(p.jetting) {
    const jet=12+Math.sin(p.now/29)*4;
    g.poly([packX-4,top+h*.76,packX-6,top+h*.76+9,packX,top+h*.76+jet+8,packX+6,top+h*.76+6,packX+4,top+h*.76]).fill({color:0xf08b38,alpha:.85});
    g.poly([packX-3,top+h*.76,packX,top+h*.76+jet,packX+3,top+h*.76]).fill({color:0xffed9b,alpha});
    g.circle(packX,top+h*.76+jet+13,3).fill({color:0xd7d9bd,alpha:.38});
  }
  // Broad shoulder plate, layered vest, belt and hip pouches.
  shape(x-11,top+17,22,h*.5,color,6);
  g.poly([x-10,top+20,x-4,top+16,x+5,top+17,x+11,top+22,x+8,top+h*.66,x-8,top+h*.65]).fill({color:0x536453,alpha:.45}).stroke({color:ink,width:1.3,alpha});
  g.moveTo(x-7,top+20).lineTo(x-3,top+h*.62).moveTo(x+7,top+20).lineTo(x+3,top+h*.62).stroke({width:2,color:0xc5c6a3,alpha:.7*alpha});
  shape(x-12,hip-5,24,6,0x394b3d,2);
  shape(x-9,hip-10,6,7,0x9aa084,1);shape(x+3,hip-10,6,7,0x9aa084,1);
  if(avatar.emblem==="star")g.star(x,top+26,5,4,1.8).fill({color:0xffe8af,alpha});
  else if(avatar.emblem==="bolt")g.poly([x+3,top+21,x-3,top+27,x,top+27,x-1,top+31,x+5,top+24,x+1,top+24]).fill({color:0xffe8af,alpha});
  else {g.circle(x,top+25,3).fill({color:0xeae8d3,alpha});g.rect(x-2,top+26,4,3).fill({color:0xeae8d3,alpha});}
  // Neck, face, nose and ear; helmet leaves the jaw visible.
  shape(x-4,top+12,8,8,skin,2);
  g.ellipse(x,top+8,10,10).fill({color:skin,alpha}).stroke({width:1.7,color:ink,alpha});
  g.circle(x+f*9,top+9,2.5).fill({color:skin,alpha});
  g.circle(x-f*8,top+10,2.8).fill({color:0xc9996e,alpha}).stroke({width:1,color:ink,alpha});
  g.moveTo(x+f*2,top+15).lineTo(x+f*7,top+14).stroke({color:0x684f40,width:1.1,alpha});
  if(avatar.helmet==="mohawk") {
    g.poly([x-7,top+1,x-4,top-10,x,top-6,x+3,top-12,x+7,top+2]).fill({color:0xe0a849,alpha}).stroke({width:1.5,color:ink,alpha});
  } else {
    const helmet=avatar.helmet==="cap"?0x89966b:0x788878;
    g.roundRect(x-11,top-3,22,12,5).fill({color:helmet,alpha}).stroke({width:1.8,color:ink,alpha});
    g.moveTo(x-7,top).quadraticCurveTo(x,top-4,x+7,top).stroke({width:2,color:0xbdc8b4,alpha});
    g.roundRect(x-12,top+5,24,4,2).fill({color:0x43564a,alpha}).stroke({width:1,color:ink,alpha});
    if(avatar.helmet==="cap")g.moveTo(x+f*5,top+6).lineTo(x+f*16,top+6).stroke({width:4,color:0x66784f,alpha});
    else {shape(x-f*12,top+7,6,7,0x4c6054,2);g.circle(x-f*9,top+10,1.3).fill({color:0xb9c7ad,alpha});}
  }
  const eyeX=f>0?x+1:x-10;
  g.roundRect(eyeX,top+8,9,4,1.5).fill({color:avatar.helmet==="visor"?0xb7e7e1:0x253b35,alpha});
  g.moveTo(eyeX+1,top+9).lineTo(eyeX+6,top+9).stroke({width:1,color:0xdaece0,alpha:.85*alpha});
  // Aim pose, gloved trigger hand, outlined distinct weapon silhouette.
  const aim=p.aim-f*p.recoil*.025,gx=x-Math.cos(aim)*p.recoil*3,gy=top+h*.43;
  const arm=(yy:number)=>{const hx=gx+Math.cos(aim)*13,hy=yy+Math.sin(aim)*13;
    g.moveTo(x-f*4,top+h*.46).lineTo(x+f*4,yy+5).lineTo(hx,hy).stroke({width:8,color:ink,alpha,cap:"round"});
    g.moveTo(x-f*4,top+h*.46).lineTo(x+f*4,yy+5).lineTo(hx,hy).stroke({width:5.2,color:skin,alpha,cap:"round"});
    g.circle(hx,hy,3.5).fill({color:0x455b4b,alpha}).stroke({width:1,color:ink,alpha});};
  arm(gy);
  if(p.weapon)drawWeapon(g,p.weapon,gx,gy,aim,.9,alpha);
  if(p.otherWeapon){arm(gy+9);drawWeapon(g,p.otherWeapon,gx-f*4,gy+9,aim,.9,alpha);}
}
