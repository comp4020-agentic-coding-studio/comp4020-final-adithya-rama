import type { Graphics } from "pixi.js";
import { avatarOf, type Avatar } from "../shared/avatar.ts";

export const HAIR = {black:0x252a32,brown:0x604333,blond:0xc8a15c,auburn:0x975441,silver:0xb9c2cc,violet:0x766092};
export const SKIN = {light:0xe9bb98,medium:0xb98260,dark:0x78533f,robot:0xa8bdc4};
export const AVATAR_PORTRAIT_VIEWBOX="25 0 65 58";
const INK=0x233039;
export function shade(color:number,amount:number):number {
  const channel=(n:number)=>Math.max(0,Math.min(255,n+amount));
  return channel(color>>16)*65536+channel((color>>8)&255)*256+channel(color&255);
}
type Cmd={op:string;n:number[]};
type Shape={d:string;commands:Cmd[];fill:number|null;stroke:number|null;width:number;opacity:number;group?:string};
const cache=new Map<string,Shape[]>();
function shape(d:string,fill:number|null,stroke:number|null=INK,width=1.1,opacity=1,group?:string):Shape {
  const commands=[...d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)].map(m=>({op:m[1],n:(m[2].match(/-?\d*\.?\d+/g)??[]).map(Number)}));
  return {d,commands,fill,stroke,width,opacity,group};
}
/** Original three-quarter portrait. One path catalogue serves SVG and live Pixi. */
export function headShapes(raw:Avatar,color:number):Shape[] {
  const a=avatarOf(raw),key=JSON.stringify([a,color]);const cached=cache.get(key);if(cached)return cached;
  const skin=SKIN[a.face],hair=HAIR[a.hairColor],hairDark=shade(hair,-23),hairLight=shade(hair,28),shadow=shade(skin,-27),light=shade(skin,18);
  const browColor=a.hairColor==="black"?0x25272a:a.hairColor==="blond"?0x766047:a.hairColor==="silver"?0x656a71:a.hairColor==="violet"?0x483e50:shade(hair,-27);
  const list:Shape[]=[];
  const p=(d:string,fill:number|null,stroke:number|null=INK,width=1.1,opacity=1,group?:string)=>list.push(shape(d,fill,stroke,width,opacity,group));
  // Long hair is behind the neck and shoulder rather than pasted onto the face.
  if(a.hair==="bob"||a.hair==="waves")p("M-17 -15Q-26 -6 -21 23Q-11 28 -6 21L-7 4L15 -4L19 20Q24 21 23 12L20 -16Z",hairDark);
  if(a.hair==="ponytail"){
    p("M-14 -14Q-23 -22 -28 -12Q-33 -1 -24 10Q-20 17 -24 25Q-12 22 -14 10Q-20 -4 -15 -12Z",hairDark);
    p("M-23 -13Q-29 -2 -22 8Q-18 16 -21 20",null,hairLight,.9);
    p("M-20 -14L-15 -12L-17 -7L-22 -9Z",0xb4a57b,null);
  }
  if(a.hair==="braids"||a.hair==="locs"){
    for(let i=0;i<(a.hair==="locs"?6:2);i++){
      const x=a.hair==="locs"?-20+i*6:i===0?-18:17,shift=i%2*3;
      p(`M${x} -7Q${x-3} 3 ${x} 10Q${x+3} 18 ${x-1} ${27-shift}`,null,hairDark,a.hair==="locs"?5:6);
      for(let y=0;y<22-shift;y+=5)p(`M${x-2} ${y}L${x+2} ${y+3}`,null,hairLight,.7);
      p(`M${x-3} ${22-shift}L${x+2} ${22-shift}`,null,0xb9a36d,2);
    }
  }
  if(a.hair==="high-bun"){
    p("M-13 -21Q-21 -38 -5 -38Q9 -37 4 -25Z",hairDark);
    p("M-12 -33Q-5 -37 0 -29M-16 -28Q-10 -31 -4 -25",null,hairLight,1);
    p("M-13 -23L3 -25",null,0xc6ae70,2);
  }
  // Neck, jaw and skin planes with a narrower female jaw; hitbox is unchanged.
  p("M-8 14L8 15L9 27Q1 31 -8 25Z",shadow);
  p(a.body==="female"?"M-15 -12Q-12 -22 1 -22Q18 -21 18 -9L17 0L22 6L17 9Q17 19 6 23Q-5 21 -12 13L-16 3Z":"M-16 -13Q-11 -23 3 -22Q19 -22 19 -8L18 1L23 6L18 9L16 19L7 24L-5 22L-13 13L-17 2Z",skin);
  p("M-15 -10Q-12 -18 -6 -19L-5 6L0 16L9 22L4 23L-5 20L-13 12Z",shadow,null);
  p("M0 -17Q10 -20 15 -12L13 -7L1 -8Z",light,null);
  p("M3 7L14 5L15 11L8 14L1 12Z",light,null,.9,.42);
  p("M-15 -1Q-22 -5 -21 5Q-20 12 -14 10L-11 4Z",skin);
  p("M-17 1Q-20 1 -18 7L-15 5",null,shadow,1.2);
  // Nose and mouth are fine contours, not large cartoon blocks.
  p("M14 -2L13 7L17 8M3 15Q8 17 13 14",null,shade(skin,-53),.8);
  p("M5 18L11 18",null,light,.8);
  // The two eye sockets sit in the same perspective plane.
  p("M-3 -1Q2 -4 7 -1Q3 2 -2 1Z",0xf0eee4,INK,.7,1,"eyes");
  p("M11 -2Q14 -4 17 -2L16 1Q13 2 11 -2Z",0xf0eee4,INK,.6,1,"eyes");
  p("M2 -2Q5 -2 5 0Q5 3 2 2Q0 0 2 -2Z",0x465a52,null,0,1,"eyes");
  p("M13 -3Q16 -3 16 -1Q16 1 14 1Z",0x465a52,null,0,1,"eyes");
  p("M3 -1L3 1M14 -2L14 0",null,0x17242a,1,1,"eyes");
  p("M2 -1L2 -.5M13 -2L13 -1.5",null,0xffffff,.7,1,"eyes");
  if(a.face==="robot"){
    p("M-11 -9L-7 -5L-7 11L-1 16M1 20L10 20M1 18L10 18",null,0x4d6d77,.8);
    p("M-3 -1L7 -1M12 -2L17 -2",null,0x97e7e0,1.1,1,"eyes");
  }
  // Tapered brows use a muted natural tint, including dyed and silver hair.
  const brows:Record<Avatar["eyebrows"],string>={
    natural:"M-4 -6Q1 -8 8 -5L7 -4Q1 -6 -4 -5ZM11 -6Q14 -8 18 -6L18 -5Q14 -6 11 -5Z",
    arched:"M-4 -6Q0 -11 8 -6L7 -5Q1 -8 -3 -5ZM11 -6Q15 -10 18 -6L17 -5Q15 -7 12 -5Z",
    bold:"M-4 -7Q2 -9 8 -6L7 -3Q2 -6 -4 -4ZM11 -7Q15 -9 18 -6L18 -4L11 -4Z",
    angled:"M-4 -8L8 -5L7 -3L-4 -6ZM11 -5L18 -8L18 -6L12 -3Z",
    none:"",
  };
  if(brows[a.eyebrows])p(brows[a.eyebrows],browColor,null);
  if(a.facialHair==="moustache"){
    p("M8 10Q5 8 2 12L-1 13Q2 15 7 12Q12 15 17 11L14 11Q12 8 8 10Z",hairDark,null);
    p("M3 12L6 11M10 11L13 12",null,hairLight,.55);
  }else if(a.facialHair==="beard"){
    p("M-12 8L-7 13L0 16L6 14L12 15L17 11L16 21L7 28L-3 24L-11 17Z",hairDark);
    p("M-6 17L-3 22M0 19L2 24M5 18L6 25M11 18L10 23",null,hairLight,.65);
  }else if(a.facialHair==="goatee"){
    p("M3 18Q8 21 14 17L12 24L6 26L3 23Z",hairDark,null);
    p("M6 21L7 24M10 21L10 24",null,hairLight,.65);
  }
  // Hand-authored hair silhouette and strand directions, not colour swaps.
  const hairPaths:Record<Avatar["hair"],string>={
    cropped:"M-16 0L-18 -9Q-18 -24 0 -25Q14 -25 19 -17L17 -11L11 -14L8 -10L3 -13L-3 -10L-9 -13L-12 -4L-13 2Z",
    bob:"M-18 12Q-24 4 -20 -15Q-16 -29 3 -27Q22 -26 22 -12L20 13L15 19L13 10L15 -13Q6 -9 -5 -12L-12 -6L-12 15Z",
    ponytail:"M-16 2Q-24 -17 -8 -24Q12 -30 20 -16L17 -10Q5 -14 -8 -10L-12 3Z",
    braids:"M-17 0L-19 -13Q-14 -28 3 -25Q17 -26 20 -13L16 -9Q5 -15 -8 -8L-12 2Z",
    curly:"M-17 1Q-25 -2 -22 -9Q-28 -17 -18 -20Q-19 -29 -9 -27Q-3 -35 4 -28Q15 -32 19 -23Q29 -20 22 -12Q21 -7 15 -10Q9 -5 5 -11Q-1 -5 -8 -11L-12 2Z",
    bald:"",
    "side-part":"M-16 1Q-24 -16 -10 -24Q4 -31 20 -19L22 -13Q9 -7 -5 -14L-12 -6L-12 2Z",
    undercut:"M-17 -3L-18 -14Q-8 -19 -5 -24Q13 -30 22 -17L19 -11Q5 -12 -6 -16L-12 -8L-12 1Z",
    waves:"M-19 17Q-27 8 -23 -2Q-29 -15 -17 -22Q-9 -33 5 -26Q25 -27 22 -9Q28 2 20 10L18 21L11 20L13 13Q19 7 13 0L16 -13Q5 -8 -7 -13Q-19 -5 -12 5L-11 18Z",
    "high-bun":"M-16 1Q-23 -9 -17 -20Q-4 -29 11 -22Q20 -19 20 -12L17 -8Q4 -14 -8 -9L-12 3Z",
    afro:"M-17 6Q-29 6 -28 -5Q-36 -13 -27 -20Q-30 -29 -18 -31Q-12 -41 -1 -34Q10 -40 17 -31Q30 -33 30 -21Q40 -14 29 -5Q29 6 17 6L16 -8Q2 -15 -12 -7L-12 5Z",
    locs:"M-17 -2Q-26 -9 -20 -20Q-8 -32 5 -25Q22 -29 22 -16L19 -4L14 -2L12 -14L7 -4L2 -5L0 -16L-7 -3L-11 -5L-13 -15L-13 2Z",
  };
  if(hairPaths[a.hair])p(hairPaths[a.hair],hair);
  const strands:Partial<Record<Avatar["hair"],string>>={
    cropped:"M-12 -16L-8 -19M-4 -18L-1 -22M5 -18L8 -21M12 -16L14 -18",
    bob:"M-17 9Q-20 -10 -12 -18M-12 -17Q1 -24 15 -18M-7 -16Q2 -13 11 -16M19 -9L18 10",
    ponytail:"M-16 -12Q-7 -24 12 -18M-13 -8Q-4 -17 15 -13",
    braids:"M-14 -13Q-6 -21 3 -22M-10 -10Q-1 -18 10 -20M-2 -12L14 -17",
    curly:"M-18 -15Q-19 -21 -13 -21M-8 -23Q-4 -28 0 -23M7 -24Q13 -27 15 -20M-12 -13Q-9 -18 -5 -13M4 -14Q9 -20 13 -14",
    "side-part":"M-14 -14Q-4 -24 7 -23M-10 -12Q1 -17 15 -18M-4 -14Q0 -22 -2 -25",
    undercut:"M-11 -13Q1 -20 16 -18M-6 -19Q3 -26 14 -22M-16 -5L-15 -10",
    waves:"M-18 13Q-23 6 -18 -2Q-22 -15 -10 -20M-7 -22Q6 -26 16 -19M-7 -18Q4 -14 13 -17M18 -5Q23 3 17 9",
    "high-bun":"M-17 -13Q-7 -26 9 -20M-13 -8Q-4 -16 14 -14",
    afro:"M-22 -21Q-24 -27 -18 -27M-10 -28Q-8 -34 -3 -28M9 -29Q16 -31 17 -24M23 -20Q30 -19 25 -13M-25 -11Q-28 -7 -23 -4M-13 -16Q-9 -21 -5 -16M3 -19Q7 -24 11 -18",
    locs:"M-17 -8L-18 -18M-9 -9L-10 -22M2 -12L1 -22M15 -9L16 -20",
  };
  if(strands[a.hair])p(strands[a.hair]!,null,hairLight,.85,.85);
  // Eyewear fits the two sockets and the bridge; it does not replace the face.
  if(a.glasses==="round"){
    p("M-8 -2Q-8 -8 -2 -7Q5 -8 5 -2Q5 5 -2 5Q-8 5 -8 -2ZM10 -2Q10 -7 15 -7Q21 -7 21 -2Q21 4 15 4Q10 4 10 -2Z",0x8fbbc0,0x435054,.9,.78);
    p("M5 -2Q8 -4 10 -2M-8 -3L-14 -5",null,0x435054,1.1);
    p("M-5 -4L0 -5M13 -4L17 -4",null,0xe4f2e9,.8,.8);
  }else if(a.glasses==="aviator"){
    p("M-8 -6Q-1 -8 6 -5L4 2Q0 8 -5 3ZM10 -5Q15 -8 21 -5L20 2Q14 7 12 2Z",0x33484e,0xb49e6e,1);
    p("M6 -4L10 -4M-7 -3L-14 -5M-5 -4L2 -4M13 -4L18 -4",null,0xcfbd8a,.8);
  }else if(a.glasses==="goggles"){
    p("M-16 -5L20 -6L22 -1L20 7L-7 7L-12 3Z",0x26373e,INK,1);
    p("M-8 -3Q4 -6 19 -3L17 4L-6 4Z",0x7fa4a6,null);
    p("M-5 -2L4 -3M8 -3L14 -3",null,0xc9e5db,1.5);
    p("M-15 -3L-10 -3M-15 0L-10 0",null,0x7a8a85,.7);
  }
  // Helmets use overlapping plates, stitched beret seams and a real peak.
  if(a.helmet==="pilot"||a.helmet==="visor"){
    const shell=a.helmet==="pilot"?0x697b70:0x4d697b;
    p("M-21 -4L-22 -13Q-20 -28 -3 -29Q16 -31 22 -16L22 -6L14 -8L12 -14L-10 -13L-14 -2Z",shell);
    p("M-17 -15Q-12 -26 2 -25Q13 -25 17 -17L9 -19L-8 -18Z",shade(shell,24),null);
    p("M-19 -7L-12 -10M-8 -25L-8 -17M14 -23L12 -16",null,shade(shell,-23),1.3);
    p("M-21 -6Q-16 -10 -12 -4L-12 8L-17 12L-22 7Z",0x344b51);
    p("M-18 -3L-18 5M-15 0L-15 6",null,0x91a79c,1.2);
    p("M-15 10L-7 20L4 22",null,0x41534c,1.7);
    if(a.helmet==="visor")p("M-10 -11L21 -10L24 -1L18 10L8 8L9 -4L-8 -4Z",0x7fa8b5,0x38545e,.9,.56);
  }else if(a.helmet==="cap"){
    p("M-20 -8Q-21 -27 -3 -26Q13 -26 17 -12L24 -10L25 -6L3 -6L-10 -8Z",0x667866);
    p("M-16 -14Q-5 -24 6 -20M-3 -24L-2 -10",null,0x93a18b,1.1);
    p("M4 -10L24 -10L29 -7L24 -4L4 -6Z",0x455a54);
  }else if(a.helmet==="beret"){
    p("M-21 -9Q-25 -22 -10 -27Q4 -32 20 -19L18 -10L-11 -7Z",shade(color,-48));
    p("M-18 -18Q-9 -28 7 -23",null,shade(color,-12),1.2);
    p("M-18 -8L17 -12L17 -8L-17 -4Z",0x2a3d40);
    p("M10 -20L15 -18L14 -13L9 -14Z",0xd3bd80,null);
  }else if(a.helmet==="mohawk"){
    p("M-6 -18L-10 -29L-4 -26L-2 -36L4 -30L8 -37L10 -27L17 -25L14 -18Z",hairDark);
    p("M-3 -25L-1 -31M5 -26L7 -32M10 -23L12 -26",null,hairLight,1);
  }
  cache.set(key,list);if(cache.size>128)cache.delete(cache.keys().next().value!);return list;
}
export function headSvg(a:Avatar,color:number):string {
  const hex=(n:number)=>"#"+(n&0xffffff).toString(16).padStart(6,"0");
  return headShapes(a,color).map(s=>`<path${s.group?` class="avatar-${s.group}"`:""} d="${s.d}" fill="${s.fill===null?"none":hex(s.fill)}" stroke="${s.stroke===null?"none":hex(s.stroke)}" stroke-width="${s.width}" opacity="${s.opacity}"/>`).join("");
}
export function drawHead(g:Graphics,a:Avatar,color:number,x:number,y:number,scale:number,facing:number,alpha:number):void {
  for(const s of headShapes(a,color)){
    for(const c of s.commands){const n=c.n,tx=(i:number)=>x+n[i]*scale*facing,ty=(i:number)=>y+n[i]*scale;
      if(c.op==="M")g.moveTo(tx(0),ty(1));else if(c.op==="L")g.lineTo(tx(0),ty(1));
      else if(c.op==="Q")g.quadraticCurveTo(tx(0),ty(1),tx(2),ty(3));
      else if(c.op==="C")g.bezierCurveTo(tx(0),ty(1),tx(2),ty(3),tx(4),ty(5));
      else if(c.op==="Z")g.closePath();
    }
    if(s.fill!==null)g.fill({color:s.fill,alpha:alpha*s.opacity});
    if(s.stroke!==null)g.stroke({color:s.stroke,width:Math.max(.35,s.width*scale),alpha:alpha*s.opacity,cap:"round",join:"round"});
  }
}