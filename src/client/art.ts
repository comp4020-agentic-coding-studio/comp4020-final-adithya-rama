import type { Graphics } from "pixi.js";
import { shieldBox } from "../shared/combat-geometry.ts";
import { WEAPONS } from "../shared/weapons.ts";
export interface Avatar { helmet: "pilot" | "visor" | "cap" | "mohawk"; face: "light" | "medium" | "dark" | "robot"; emblem: "star" | "bolt" | "skull" }
export const DEFAULT_AVATAR: Avatar = { helmet: "pilot", face: "medium", emblem: "bolt" };
export function avatarOf(value: unknown): Avatar {
  const a = (value && typeof value === "object" ? value : {}) as Partial<Avatar>;
  return { helmet: ["pilot","visor","cap","mohawk"].includes(a.helmet ?? "") ? a.helmet! : "pilot", face: ["light","medium","dark","robot"].includes(a.face ?? "") ? a.face! : "medium", emblem: ["star","bolt","skull"].includes(a.emblem ?? "") ? a.emblem! : "bolt" };
}
export const SKIN = { light: 0xf3ceac, medium: 0xbc8159, dark: 0x744d3c, robot: 0xb8d7df };
// Authored, shared silhouettes: the HUD and the held weapon use these exact
// outlines. Coordinates are grip-relative; distinctive stocks, feed systems and
// barrel assemblies remain legible in a small silhouette, not only by colour.
type Shape = { points:number[]; color:number; outline?:boolean };
const poly=(color:number,...points:number[]):Shape=>({points,color});
const rect=(x:number,y:number,w:number,h:number,color:number):Shape=>poly(color,x,y,x+w,y,x+w,y+h,x,y+h);
const disc=(x:number,y:number,rx:number,ry:number,color:number,n=14):Shape=>poly(color,...Array.from({length:n},(_,i)=>[x+Math.cos(i*2*Math.PI/n)*rx,y+Math.sin(i*2*Math.PI/n)*ry]).flat());
const detail=(color:number,...points:number[]):Shape=>({points,color,outline:false});
const ink=0x1e2829, dark=0x344247, steel=0x9cafb3, light=0xd4dfdc, wood=0xa66a36, tan=0xb5a06d;
const SHAPES:Record<string,Shape[]>={
  "mini-eagle":[
    poly(dark,1,0,10,1,6,16,-1,15),poly(steel,-2,-7,20,-7,24,-3,24,1,0,1,-3,-2),
    rect(20,-5,7,4,dark),rect(2,-5,8,2,light),rect(0,-10,3,3,ink),rect(18,-10,3,3,ink),
    poly(ink,10,3,15,3,14,8,8,8),detail(0x829292,2,4,6,4,4,12,1,12)],
  "golden-eagle":[
    poly(0x694b2c,1,0,12,0,8,17,-1,15),poly(0xd3a12d,-3,-8,24,-8,28,-3,28,2,0,2,-3,-2),
    rect(25,-5,18,5,ink),rect(41,-6,3,7,dark),detail(0xffe09a,-1,-7,22,-7,24,-4,0,-4),rect(3,-10,4,2,ink),
    poly(ink,12,3,18,3,16,9,10,9),disc(4,6,2,2,0xe4bc5c)],
  "magnum":[
    poly(wood,-2,1,9,2,6,9,7,16,1,18,-5,14,-3,6),
    poly(steel,-4,-5,2,-9,11,-9,15,-5,29,-5,32,-2,32,2,13,3,9,7,0,5),
    disc(7,-2,7,6,dark),rect(3,-6,2,8,0x75868b),rect(8,-6,2,8,0x75868b),
    rect(16,-8,17,4,steel),rect(29,-10,3,3,ink),rect(30,-4,7,4,ink),
    poly(ink,-4,-6,-8,-9,-6,-12,-1,-7),poly(ink,10,4,16,4,14,10,8,10)],
  "uzi":[
    poly(dark,-11,-3,-17,-3,-17,4,-9,5,-2,0),rect(-8,-7,27,12,0x536458),
    rect(18,-4,11,5,ink),poly(dark,0,3,8,3,7,19,1,19),rect(11,3,7,8,dark),
    rect(-3,-12,18,4,ink),rect(2,-14,5,3,steel),rect(-6,-5,15,2,0x98a28b),
    rect(14,-6,2,4,ink),rect(20,-3,3,3,steel)],
  "tec9":[
    poly(dark,-3,-3,15,-3,17,4,7,7,5,14,-2,14),rect(8,5,7,18,ink),
    rect(3,-8,29,7,0x64737a),rect(31,-7,7,5,ink),rect(-3,-9,5,5,dark),
    ...[16,22,28].map(x=>disc(x,-4.5,1.6,1.5,ink,8)),rect(1,-5,8,2,steel),
    poly(ink,8,6,14,6,14,11,6,11)],
  "mp5":[
    poly(dark,-18,-7,-8,-7,-4,-3,1,-3,1,2,-11,2,-13,8,-19,8),
    poly(0x4e646e,-2,-7,24,-7,26,-3,22,3,0,3),
    poly(ink,1,2,7,3,5,14,-1,13),poly(steel,11,3,17,3,19,15,16,19,11,15),
    rect(20,-5,10,7,ink),rect(30,-3,10,3,steel),rect(33,-8,3,5,ink),
    rect(4,-10,12,3,ink),detail(0x9daeb5,0,-5,18,-5,18,-3,0,-3)],
  "ak47":[
    poly(wood,-22,-7,-13,-7,-5,-3,2,-3,2,2,-10,4,-15,9,-22,9),
    poly(dark,-3,-6,24,-6,27,-1,24,4,-1,4),
    poly(wood,0,3,7,4,4,15,-2,13),poly(dark,12,4,20,4,22,13,27,20,21,24,15,19,12,11),
    poly(wood,23,-5,35,-5,38,-2,35,3,24,3),
    rect(33,-2,18,3,steel),rect(41,-8,3,6,ink),rect(49,-4,6,6,ink),
    detail(0x9babad,1,-5,22,-5,22,-3,1,-3),rect(7,-9,9,3,dark),
    detail(0x68787a,16,6,18,6,20,14,23,20,21,21,18,15)],
  "m4":[
    poly(dark,-21,-7,-10,-7,-10,-3,-2,-3,-2,2,-12,3,-15,8,-21,8),
    poly(0x677e83,-3,-7,22,-7,26,-3,23,3,-1,3),
    poly(ink,1,3,7,3,4,15,-2,13),poly(steel,12,3,20,3,17,17,10,16),
    rect(22,-6,17,8,dark),...Array.from({length:4},(_,i)=>rect(25+i*3,-5,1,6,0x91a2a0)),
    rect(39,-3,15,3,steel),rect(48,-9,3,6,ink),rect(52,-4,7,5,ink),
    poly(ink,2,-7,4,-14,18,-14,21,-7),poly(0xb2c4c3,7,-9,8,-12,15,-12,17,-9)],
  "tavor-x95":[
    poly(0x9c9f6c,-18,-10,11,-10,17,-7,25,-7,29,-3,26,4,14,5,8,12,1,12,-2,4,-17,4),
    poly(ink,-12,4,-5,4,-4,19,-11,19),rect(-20,-9,3,15,dark),
    poly(dark,3,1,10,1,8,8,4,8),rect(23,-4,14,4,ink),
    rect(-1,-14,15,3,dark),rect(3,-18,9,5,ink),detail(0xd3d3a1,-13,-7,8,-7,11,-4,-13,-4),
    rect(16,-4,2,6,dark),rect(20,-4,2,6,dark)],
  "xm8":[
    poly(0xc8893b,-21,-6,-12,-8,-5,-3,0,-3,0,3,-12,4,-17,10,-21,8),
    poly(0xd69d50,-4,-8,20,-9,34,-4,38,1,31,6,16,5,9,10,1,8,-1,3),
    poly(dark,0,3,6,5,4,17,-2,15),poly(steel,12,5,19,5,17,20,11,20),
    poly(ink,0,-8,4,-16,20,-16,25,-8),rect(7,-14,11,4,0x97ccca),
    rect(34,-2,15,4,ink),detail(0xf6c576,22,-5,31,-2,30,1,21,-1),
    disc(6,-1,2.3,2.3,ink)],
  "m14":[
    poly(wood,-23,-3,-13,-4,-5,-1,9,-1,12,3,25,2,37,3,36,7,10,7,3,4,-9,8,-20,11,-24,9),
    rect(4,-6,23,5,dark),rect(26,-3,27,3,steel),rect(48,-8,3,5,ink),rect(53,-4,5,4,ink),
    poly(dark,12,7,19,7,18,15,12,15),rect(7,-9,3,3,steel),rect(24,-9,3,3,steel),
    rect(4,-14,27,5,ink),disc(4,-11.5,3,4,ink),disc(31,-11.5,4,4,ink),
    detail(0xd59650,-18,1,-12,-1,-3,2,-12,4)],
  "m93ba":[
    poly(0xbac3ad,-22,-5,-13,-6,-4,-2,5,0,8,5,1,6,-8,4,-13,11,-23,11),
    poly(0x9aaa95,-2,-7,28,-7,36,-3,35,3,10,4,5,8,-1,6),
    rect(27,-4,36,3,dark),rect(58,-5,10,5,ink),rect(10,4,8,10,dark),
    rect(7,-10,3,4,steel),rect(26,-10,3,4,steel),rect(1,-16,35,6,ink),
    disc(2,-13,4,5,dark),disc(36,-13,5,5,dark),disc(38,-13,2,3,0x86c6c7),
    poly(dark,29,2,33,3,39,19,36,19,30,8),poly(dark,30,4,27,18,24,18,27,4),
    rect(5,-5,13,2,light),disc(21,-1,2,2,steel)],
  "spas12":[
    poly(ink,-22,-11,-6,-11,0,-5,-3,-2,-10,-7,-22,-7),rect(-24,-12,4,18,dark),
    poly(0x5e6b6c,-4,-7,20,-7,23,-2,20,4,-1,4),poly(ink,0,3,7,4,4,16,-3,14),
    rect(18,-5,31,3,steel),rect(18,0,27,4,dark),rect(49,-6,7,5,ink),
    rect(20,-3,17,9,dark),...[23,27,31,35].map(x=>rect(x,-2,1,7,steel)),
    rect(2,-5,10,2,light),rect(45,-9,3,4,dark)],
  "aa20":[
    poly(0x6f797c,-19,-7,-10,-6,-5,-2,0,-2,1,3,-10,5,-17,11,-21,8),
    poly(0x929c9e,-3,-9,25,-9,31,-5,29,4,0,4),poly(ink,0,3,6,4,3,16,-3,14),
    disc(15,10,10,10,ink),disc(15,10,6.5,6.5,0x687a7c),disc(15,10,2,2,steel),
    rect(27,-5,18,6,dark),rect(44,-6,8,7,ink),rect(4,-12,19,3,dark),
    detail(light,2,-7,24,-7,25,-5,2,-5)],
  "minigun":[
    poly(dark,-14,-6,-5,-6,0,-1,0,5,-10,7,-16,4),rect(-3,-10,20,19,0x758384),
    poly(ink,0,8,7,8,5,21,-2,20),rect(8,-19,20,4,ink),rect(8,-17,4,9,ink),rect(24,-17,4,9,ink),
    rect(16,-9,39,4,steel),rect(16,-2,43,4,steel),rect(16,5,39,4,steel),
    rect(25,-11,5,22,dark),rect(48,-11,5,22,dark),rect(56,-9,6,18,ink),
    rect(18,-7,26,1,light),rect(18,0,29,1,light),rect(18,7,26,1,light),
    poly(0xc2a56c,5,9,15,9,16,19,10,27,3,25,8,17),disc(3,-1,4,5,steel)],
  "smaw":[
    rect(-23,-8,71,14,0x71895b),rect(-25,-11,6,20,dark),rect(44,-10,7,18,dark),
    poly(ink,1,5,9,5,7,18,0,16),poly(dark,24,6,30,6,29,16,23,15),
    rect(-8,-7,5,12,0xc4b478),rect(33,-7,5,12,0xc4b478),rect(7,-17,18,5,ink),rect(11,-12,3,4,steel),
    rect(47,-6,7,10,0x9caf78),detail(0xa9bd83,-19,-6,41,-6,41,-3,-19,-3)],
  "rg6":[
    poly(tan,-21,-5,-11,-5,-3,-1,0,1,-3,5,-14,4,-18,10,-23,8),
    poly(dark,-2,-8,13,-8,17,-2,15,7,2,8,-2,4),poly(ink,0,7,7,7,5,20,-2,18),
    disc(22,0,13,13,0x727c72),disc(22,0,9,9,tan),
    ...Array.from({length:6},(_,i)=>disc(22+Math.cos(i*Math.PI/3)*6,Math.sin(i*Math.PI/3)*6,2.4,2.4,dark,8)),
    rect(33,-5,17,8,dark),rect(49,-6,6,10,ink),rect(0,-14,25,4,dark),rect(15,-11,4,3,steel)],
  "saw-launcher":[
    poly(0xdba348,-15,-7,9,-7,14,-3,11,7,0,9,-9,4,-15,4),poly(ink,-3,7,4,7,1,20,-5,17),
    poly(dark,8,-7,25,-11,37,-5,39,3,29,9,11,7),
    poly(steel,...Array.from({length:32},(_,i)=>{const a=i*Math.PI/16,r=i%2?10:15;return[29+Math.cos(a)*r,-4+Math.sin(a)*r]}).flat()),
    disc(29,-4,8,8,0x7f969b),disc(29,-4,3,3,ink),
    rect(8,7,25,4,0xdba348),rect(-11,-4,15,2,0xffdc7d),disc(4,0,2,2,dark)],
  "flamethrower":[
    poly(dark,-17,-4,-5,-4,0,0,-3,5,-15,6,-20,3),rect(-4,-7,22,12,0xaa6841),
    poly(ink,0,4,7,4,4,17,-2,15),rect(15,-4,25,6,dark),rect(37,-7,12,12,0xd09a50),
    rect(46,-5,7,8,ink),rect(1,-18,23,10,0xe9d371),disc(1,-13,3,5,0xd6bb53),disc(24,-13,3,5,0xd6bb53),rect(9,-21,5,3,dark),
    poly(0xc9a45e,-8,5,-5,16,6,20,14,16,16,4,13,4,11,13,6,16,-2,13,-4,5),
    rect(50,5,5,3,0xe7bd61),detail(0xffd078,50,4,54,-2,56,4,54,7)],
  "phasr":[
    poly(0x83945e,-20,-10,-9,-11,1,-18,5,-14,15,-11,33,-10,42,-5,35,-2,44,1,35,5,21,6,15,11,-3,13,-7,5,-19,7),
    poly(dark,-8,3,-1,3,-3,16,-9,16),poly(dark,0,2,9,2,7,9,1,9),
    poly(0xb2ba82,-15,-8,-6,-8,-3,-11,2,-12,1,-6,-6,-3,-15,-3),
    poly(dark,3,-8,30,-8,36,-5,29,-2,5,-2,1,-5),
    ...[7,12,17,22,27].map(x=>rect(x,-7,2,4,0xb7c899)),
    poly(0xa6b878,10,6,22,6,30,4,26,9,17,12,9,12),
    rect(34,-4,11,3,dark),detail(0xd4e1b6,-15,-7,-9,-7,-6,-9,-3,-10,-5,-6,-10,-4,-15,-4)],
  "emp-gun":[
    poly(0x748bab,-15,-5,-4,-5,3,0,0,7,-11,6,-17,2),
    poly(0x99aec5,-1,-10,22,-10,27,-5,24,8,4,10,-2,4),poly(dark,0,7,7,8,4,21,-3,18),
    disc(15,-1,8,8,0x466586),disc(15,-1,4,4,0xbf9fff),
    rect(25,-4,16,6,steel),...[28,33,38].map(x=>rect(x,-9,2.5,17,0xbca7e8)),
    poly(dark,40,-12,47,-9,49,-5,44,-5,43,-9),poly(dark,40,11,47,8,49,4,44,4,43,8),
    rect(1,-13,16,3,dark),detail(0xd2deec,3,-7,11,-7,8,-4,3,-4)],
  "machete":[
    poly(wood,-5,-3,10,-3,12,1,9,4,-5,4),rect(9,-6,3,13,dark),
    poly(steel,12,-3,36,-5,48,-12,46,-1,41,6,14,5),detail(0xebf5ed,13,3,41,4,45,-1,47,-9,38,-3,14,0),
    ...[-2,2,6].map(x=>rect(x,-2,1,5,0xdca464))],
  "riot-shield":[
    poly(0x56798d,-9,-23,6,-26,14,-20,14,19,7,25,-7,23,-11,16),
    poly(0x9cc7ce,-6,-17,9,-18,9,-7,-6,-6),rect(-8,-2,20,3,dark),
    poly(0x859ba2,-7,5,10,5,10,17,5,21,-7,19),rect(-4,8,12,2,0xd9c681),
    disc(-7,-20,1.3,1.3,light),disc(10,-20,1.3,1.3,light),disc(10,20,1.3,1.3,light)],
};
export function drawWeapon(g:Graphics,id:string,x:number,y:number,aim=0,scale=1,alpha=1):void {
  const c=Math.cos(aim)*scale,s=Math.sin(aim)*scale,flip=Math.cos(aim)>=0?1:-1;
  for(const p of SHAPES[id]??SHAPES["mini-eagle"]) {
    const points:number[]=[];
    for(let i=0;i<p.points.length;i+=2){const a=p.points[i],b=p.points[i+1];points.push(x+a*c-b*s*flip,y+a*s+b*c*flip);}
    g.poly(points).fill({color:p.color,alpha});
    if(p.outline!==false)g.stroke({color:ink,width:Math.max(.7,scale),alpha,join:"round"});
  }
}
export function weaponLength(id:string):number {
  return Math.max(...(SHAPES[id]??SHAPES["mini-eagle"]).flatMap(p=>p.points.filter((_,i)=>i%2===0)));
}
export function weaponIcon(id:string):string {
  const ps=SHAPES[id]??SHAPES["mini-eagle"];
  const xs=ps.flatMap(p=>p.points.filter((_,i)=>i%2===0)),ys=ps.flatMap(p=>p.points.filter((_,i)=>i%2===1));
  const left=Math.min(...xs)-3,top=Math.min(...ys)-3,w=Math.max(...xs)-left+3,h=Math.max(...ys)-top+3;
  // Fit the actual outline to its card: a sidearm remains readable on a phone.
  const shapes=ps.map(p=>'<polygon points="'+p.points.join(" ")+'" fill="#'+p.color.toString(16).padStart(6,"0")+'"'+(p.outline!==false?' stroke="#1e2829" stroke-width="1" stroke-linejoin="round"':'')+'/>').join("");
  return '<svg class="weapon-icon" aria-hidden="true" viewBox="'+left+' '+top+' '+w+' '+h+'">'+shapes+'</svg>';
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
  const held=(id:string,xx:number,yy:number)=>{
    if(id!=="riot-shield"){drawWeapon(g,id,xx,yy,aim,.9,alpha);return;}
    const panel=shieldBox({x:x-11,y:top,w:22,h},p.aim);
    // Panel stays vertical and exactly follows the physical bullet barrier;
    // aim never rotates it over the otherwise exposed head.
    g.roundRect(panel.x,panel.y,panel.w,panel.h,2).fill({color:0x56798d,alpha}).stroke({color:ink,width:1.2,alpha});
    g.rect(panel.x+1,panel.y+3,panel.w-2,Math.min(8,panel.h*.25)).fill({color:0xa4d0d4,alpha});
    g.rect(panel.x+1,panel.y+panel.h*.57,panel.w-2,3).fill({color:0xd9c681,alpha});
  };
  if(p.weapon)held(p.weapon,gx,gy);
  if(p.otherWeapon){arm(gy+9);held(p.otherWeapon,gx-f*4,gy+9);}
}
