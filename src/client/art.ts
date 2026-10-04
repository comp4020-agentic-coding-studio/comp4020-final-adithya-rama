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
  const c=Math.cos(aim)*scale, s=Math.sin(aim)*scale;
  for (const p of SHAPES[id] ?? SHAPES["mini-eagle"]) {
    const points = [[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w,p.y+p.h],[p.x,p.y+p.h]].flatMap(([a,b])=>[x+a*c-b*s,y+a*s+b*c]);
    g.poly(points).fill({color:p.c,alpha});
  }
}
export function weaponIcon(id: string): string {
  const shapes=(SHAPES[id] ?? SHAPES["mini-eagle"]).map(p=>'<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" fill="#'+p.c.toString(16).padStart(6,"0")+'"/>').join("");
  return '<svg class="weapon-icon" aria-hidden="true" viewBox="-9 -22 65 46">'+shapes+'</svg>';
}
export const THROW_COLORS: Record<string,number> = { frag:0xa0bc73,gas:0xb2ed62,emp:0x81d7ff,mine:0xf4a76d };
export function drawThrowable(g: Graphics, id: string, x:number, y:number, size=1, armed=false): void {
  const c=THROW_COLORS[id] ?? 0xffffaa;
  if(id==="mine") { g.ellipse(x,y,9*size,4*size).fill(0x414952); g.circle(x,y-3*size,3*size).fill(armed?0xff554d:c); }
  else { g.roundRect(x-5*size,y-7*size,10*size,14*size,3*size).fill(c); g.rect(x-3*size,y-10*size,6*size,4*size).fill(0x39434c); g.rect(x-2*size,y-5*size,4*size,9*size).fill({color:0xffffff,alpha:.3}); }
}
export function avatarSvg(a: Avatar, color:number): string {
  const skin=SKIN[a.face].toString(16).padStart(6,"0"); const body=color.toString(16).padStart(6,"0");
  const head=a.helmet==="mohawk"?'<path d="M49 21L47 5L54 10L58 2L64 22" fill="#f2a541"/>':a.helmet==="cap"?'<path d="M37 28Q37 10 56 12Q74 14 74 28H84V33H36" fill="#789571"/>':'<path d="M34 30Q34 7 57 9Q80 11 79 33H34" fill="#42596a"/>';
  const eyes=a.helmet==="visor"?'<rect x="43" y="28" width="35" height="12" rx="4" fill="#97e5ef"/>':'<rect x="59" y="31" width="9" height="4" rx="1" fill="#24303e"/>';
  const emblem=a.emblem==="bolt"?"ϟ":a.emblem==="skull"?"●":"★";
  return '<svg role="img" aria-label="Your customized pilot" viewBox="0 0 120 130"><ellipse cx="59" cy="119" rx="38" ry="7" fill="#0003"/><rect x="23" y="49" width="16" height="42" rx="6" fill="#8495a2"/><path d="M31 92L26 112L32 107L36 122L42 94" fill="#ffb753"/><rect x="41" y="87" width="14" height="28" rx="4" fill="#243442"/><rect x="64" y="87" width="14" height="28" rx="4" fill="#243442"/><rect x="35" y="46" width="48" height="51" rx="11" fill="#'+body+'"/><circle cx="57" cy="32" r="20" fill="#'+skin+'"/>'+head+eyes+'<text x="60" y="76" fill="#fff4cb" text-anchor="middle" font-size="24">'+emblem+'</text><path d="M74 66L91 71" stroke="#'+skin+'" stroke-width="11" stroke-linecap="round"/><path d="M86 65H113V73H86" fill="#354451"/></svg>';
}
export function weaponName(id:string):string { return WEAPONS[id]?.name ?? id; }
