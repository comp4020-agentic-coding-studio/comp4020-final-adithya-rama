import type { Graphics } from "pixi.js";
import { shieldBox } from "../shared/combat-geometry.ts";
import { WEAPONS } from "../shared/weapons.ts";
import { drawWeapon } from "./weapon-art.ts";
import { avatarOf, type Avatar } from "../shared/avatar.ts";
export { avatarOf, DEFAULT_AVATAR, type Avatar } from "../shared/avatar.ts";
export const HAIR = {black:0x22252e,brown:0x674733,blond:0xe6bf64,auburn:0xab5139,silver:0xd8dce6,violet:0x9d72d3};
export const SKIN = { light: 0xf3ceac, medium: 0xbc8159, dark: 0x744d3c, robot: 0xb8d7df };
export function avatarSvg(a: Avatar, color:number): string {
  a=avatarOf(a);
  const skin="#"+SKIN[a.face].toString(16).padStart(6,"0");
  const body="#"+(Number.isFinite(color)?Math.round(color)&0xffffff:0x3c8de0).toString(16).padStart(6,"0");
  const hair="#"+HAIR[a.hairColor].toString(16).padStart(6,"0");
  const hairShape=a.hair==="bald"?"":a.hair==="curly"?'<path d="M34 30Q25 15 40 13Q43 1 55 10Q65 1 75 13Q89 15 79 31Z" fill="'+hair+'"/>':a.hair==="bob"?'<path d="M32 45V26Q34 6 57 9Q81 8 81 30L74 43L69 22L45 25L44 48Z" fill="'+hair+'"/>':'<path d="M34 29Q32 7 57 10Q80 7 80 28L66 21L52 26L43 23L40 32Z" fill="'+hair+'"/>';
  const hairBack=a.hair==="ponytail"?'<path d="M37 24Q12 20 17 51L31 67L25 42L40 36Z" fill="'+hair+'"/>':a.hair==="braids"?'<path d="M38 26L30 39L36 48L30 58L35 71M73 27L80 40L74 49L81 60L76 71" fill="none" stroke="'+hair+'" stroke-width="10"/>':"";
  const helmet=a.helmet==="none"?"":a.helmet==="beret"?'<path d="M31 27Q29 13 54 11L79 17L82 28L37 33Z" fill="'+body+'"/><path d="M37 30H77" stroke="#273b38" stroke-width="5"/>':a.helmet==="mohawk"
    ? '<path d="M39 26L43 8L51 15L58 3L64 13L70 8L75 29" fill="'+hair+'"/>'
    : '<path d="M34 30V25Q35 11 54 11H59Q78 12 79 28V32Z" fill="'+(a.helmet==="cap"?"#89966b":a.helmet==="visor"?"#506d84":"#788878")+'"/><path d="M40 20Q55 12 70 20" fill="none" stroke="#bdc8b4" stroke-width="3"/><path d="M32 28H80V34H32Z" fill="#43564a"/>'+
      (a.helmet==="cap"?'<path d="M66 29H89V34H67" fill="#66784f"/>':'<rect x="30" y="31" width="11" height="15" rx="4" fill="#4c6054"/><circle cx="35" cy="37" r="2.5" fill="#b9c7ad" stroke="none"/>');
  const emblem=a.emblem==="bolt"
    ? '<path d="M59 58L48 71H55L52 81L66 65H59L63 58Z" fill="#ffe8af" stroke="none"/>'
    : a.emblem==="star"
      ? '<path d="M57 59L60 66L68 67L62 72L64 80L57 76L50 80L52 72L46 67L54 66Z" fill="#ffe8af" stroke="none"/>'
      : '<path d="M49 65Q49 58 57 58Q65 58 65 65V70L62 73V78H52V73L49 70Z" fill="#eae8d3" stroke="none"/><path d="M51 66h4v4h-4zm8 0h4v4h-4zm-4 7h4v3h-4" fill="#354d41" stroke="none"/>';
  const outfit=a.outfit==="dress"?'<path d="M42 68H73L88 104H29Z" fill="'+body+'"/><path d="M45 91H76" stroke="#f6dc9e" stroke-width="3"/>':a.outfit==="jacket"?'<path d="M38 49L53 58L48 90H36ZM76 49L62 58L65 90H81Z" fill="'+body+'"/><path d="M56 52V91" stroke="#e8d8ad"/>':a.outfit==="flight-suit"?'<path d="M39 51H78V87H38Z" fill="'+body+'"/><path d="M57 52V87M39 61H77" stroke="#dfded1" stroke-width="3"/>':"";
  const facial=a.facialHair==="none"?"":a.facialHair==="moustache"?'<path d="M60 40Q65 36 69 40Q74 36 78 41L74 44L68 42L63 44Z" fill="'+hair+'"/>':a.facialHair==="goatee"?'<path d="M63 44H74L70 53H65Z" fill="'+hair+'"/>':'<path d="M44 40L55 46L73 43L76 47L65 55L52 52Z" fill="'+hair+'"/>';
  const glasses=a.glasses==="none"?'<circle cx="68" cy="35" r="2" fill="#253b35"/>':a.glasses==="round"?'<circle cx="61" cy="35" r="5" fill="#a7dbdf" fill-opacity=".65"/><circle cx="74" cy="35" r="5" fill="#a7dbdf" fill-opacity=".65"/><path d="M66 35H69"/>':a.glasses==="aviator"?'<path d="M54 31H78L75 41L68 37L61 41Z" fill="#554b36"/><path d="M56 33H76" stroke="#e5bf76"/>':'<rect x="56" y="32" width="21" height="8" rx="3" fill="#253b35"/><path d="M59 34H69" stroke="#daece0" stroke-width="1.7"/>';
  return '<svg role="img" aria-label="Customized '+a.body+' pilot, '+a.outfit+', '+a.hair+' hair" viewBox="0 0 120 130">'+
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
    outfit+emblem+hairBack+
    '<rect x="49" y="38" width="16" height="12" rx="4" fill="'+skin+'"/><ellipse cx="57" cy="32" rx="'+(a.body==="female"?19:21)+'" ry="20" fill="'+skin+'"/><path d="M77 33L82 37L76 41" fill="'+skin+'"/><circle cx="37" cy="37" r="5" fill="'+skin+'"/>'+
    (a.face==="robot"?'<path d="M44 38V45H66M49 41H59M49 45H59" fill="none" stroke="#607f79" stroke-width="2"/>':'<path d="M62 44Q68 46 73 42" fill="none" stroke="#684f40" stroke-width="1.7"/>')+
    hairShape+helmet+facial+glasses+
    '<path d="M73 64L82 73L96 68" fill="none" stroke-width="13"/><path d="M73 64L82 73L96 68" fill="none" stroke="'+skin+'" stroke-width="8"/><circle cx="95" cy="68" r="6" fill="#455b4b"/>'+
    '<path d="M88 59H111V67H99L98 75H91L92 67H86Z" fill="#a4b9c0"/><path d="M107 61H116V66H107Z" fill="#34433a"/><path d="M91 62H104" stroke="#d9e3d4" stroke-width="2"/>'+
    '</g></svg>';
}

export interface PilotPose {
  x:number;y:number;h:number;color:number;avatar:Avatar;aim:number;walk:number;
  airborne:boolean;jetting:boolean;alpha:number;recoil:number;weapon:string|null;
  otherWeapon:string|null;now:number;hit:boolean;
  charge?:number;reload?:number;otherCharge?:number;otherReload?:number;
}
/** Feet and the gun grip use the same stance height/muzzle ratio as combat. */
export function drawPilot(g:Graphics,p:PilotPose):void {
  const {x,y,h,alpha,avatar}=p,top=y-h,f=Math.cos(p.aim)>=0?1:-1;
  const ink=0x21322e,skin=SKIN[avatar.face],hair=HAIR[avatar.hairColor],crouched=h<35;
  const color=p.hit?0xffddd0:p.color,hip=y-h*.25;
  const step=p.airborne?3:p.walk*(crouched?2.5:4.7),headR=crouched?7.2:9;
  const shape=(xx:number,yy:number,w:number,hh:number,c:number,rad=3)=>
    g.roundRect(xx,yy,w,hh,rad).fill({color:c,alpha}).stroke({color:ink,width:1.4,alpha});
  // A crouch folds the knees and vest; it does not extend the vest below the feet.
  for(const side of [-1,1]) {
    const foot=x+side*6+step*side,fy=y-(p.airborne?(side===f?3:7):Math.max(0,step*side*.45));
    const kneeX=crouched?x+side*9:foot-side*2,kneeY=crouched?hip+2:(hip+fy)*.5;
    g.moveTo(x+side*4,hip).lineTo(kneeX,kneeY).lineTo(foot,fy-4).stroke({width:8,color:ink,alpha});
    g.moveTo(x+side*4,hip).lineTo(kneeX,kneeY).lineTo(foot,fy-4).stroke({width:5.5,color:0x566858,alpha});
    shape(foot-5+(f<0?-2:0),fy-5,12,5,0x34433a,2);
    g.moveTo(foot-4,fy-1).lineTo(foot+5,fy-1).stroke({width:1,color:0x98a690,alpha});
  }
  const packX=x-f*13,packTop=top+h*.34,packHeight=h*.43;
  shape(packX-5,packTop,10,packHeight,0x687d73,3);
  g.moveTo(packX-3,packTop+3).lineTo(packX-3,packTop+packHeight-4).stroke({width:2,color:0xa1b6a4,alpha});
  shape(packX-4,packTop+packHeight-2,8,4,0x33493f,1);
  if(p.jetting) {
    const jy=packTop+packHeight+2,jet=12+Math.sin(p.now/29)*4;
    g.poly([packX-4,jy,packX-6,jy+9,packX,jy+jet+8,packX+6,jy+6,packX+4,jy]).fill({color:0xf08b38,alpha:.85*alpha});
    g.poly([packX-3,jy,packX,jy+jet,packX+3,jy]).fill({color:0xffed9b,alpha});
  }
  const shoulder=top+h*.38,vestHeight=hip-shoulder+3;
  shape(x-11,shoulder,22,vestHeight,color,5);
  g.poly([x-10,shoulder+3,x-4,shoulder-1,x+5,shoulder,x+11,shoulder+4,x+8,hip,x-8,hip]).fill({color:0x536453,alpha:.45*alpha}).stroke({color:ink,width:1.2,alpha});
  g.moveTo(x-7,shoulder+3).lineTo(x-3,hip-2).moveTo(x+7,shoulder+3).lineTo(x+3,hip-2).stroke({width:2,color:0xc5c6a3,alpha:.7*alpha});
  shape(x-12,hip-2,24,5,0x394b3d,2);
  shape(x-9,hip-6,6,6,0x9aa084,1);shape(x+3,hip-6,6,6,0x9aa084,1);
  if(avatar.outfit==="dress") {
    g.poly([x-7,shoulder+5,x+7,shoulder+5,x+15,hip+5,x-15,hip+5]).fill({color,alpha}).stroke({color:ink,width:1.4,alpha});
    g.moveTo(x-12,hip+2).lineTo(x+12,hip+2).stroke({color:0xf6dc9e,width:1.5,alpha});
  } else if(avatar.outfit==="flight-suit") {
    shape(x-10,shoulder,20,vestHeight,color,3);
    g.moveTo(x,shoulder+2).lineTo(x,hip).moveTo(x-8,shoulder+6).lineTo(x+8,shoulder+6).stroke({color:0xdfded1,width:1.5,alpha});
  } else if(avatar.outfit==="jacket") {
    g.poly([x-10,shoulder,x-2,shoulder+5,x-4,hip,x-11,hip,x-11,shoulder]).fill({color,alpha}).stroke({color:ink,width:1,alpha});
    g.poly([x+10,shoulder,x+2,shoulder+5,x+4,hip,x+11,hip,x+11,shoulder]).fill({color,alpha}).stroke({color:ink,width:1,alpha});
  }
  const emblemY=shoulder+vestHeight*.4;
  if(avatar.emblem==="star")g.star(x,emblemY,5,3.5,1.6).fill({color:0xffe8af,alpha});
  else if(avatar.emblem==="bolt")g.poly([x+2,emblemY-4,x-3,emblemY+1,x,emblemY+1,x-1,emblemY+4,x+4,emblemY-1,x+1,emblemY-1]).fill({color:0xffe8af,alpha});
  else {g.circle(x,emblemY,2.8).fill({color:0xeae8d3,alpha});g.rect(x-2,emblemY+1,4,2).fill({color:0xeae8d3,alpha});}
  const headX=x+(crouched?f*3:0),headY=top+headR+1;
  if(avatar.hair==="ponytail")g.poly([headX-f*6,top+6,headX-f*14,top+8,headX-f*15,top+20,headX-f*9,top+17]).fill({color:hair,alpha}).stroke({color:ink,width:1,alpha});
  if(avatar.hair==="braids")for(const side of [-1,1])for(let i=0;i<5;i++)g.circle(headX+side*(headR-1)+Math.sin(i*2)*1.2,headY+i*3,2.5).fill({color:hair,alpha});
  shape(headX-3,headY+headR-3,6,6,skin,2);
  g.ellipse(headX,headY,headR*(avatar.body==="female"?.9:1),headR).fill({color:skin,alpha}).stroke({width:1.5,color:ink,alpha});
  g.circle(headX+f*headR,headY+1,2).fill({color:skin,alpha});
  g.circle(headX-f*(headR-1),headY+2,2.5).fill({color:skin,alpha}).stroke({width:1,color:ink,alpha});
  g.moveTo(headX+f*2,headY+headR-2).lineTo(headX+f*6,headY+headR-3).stroke({color:0x684f40,width:1,alpha});
  if(avatar.hair!=="bald") {
    g.poly([headX-headR,headY,headX-headR,top+2,headX,top-1,headX+headR,top+3,headX+headR,top+7,headX+2,top+5,headX-4,top+8]).fill({color:hair,alpha});
    if(avatar.hair==="bob")shape(headX-f*headR-3,top+5,6,headR+8,hair,2);
    if(avatar.hair==="curly")for(let i=0;i<5;i++)g.circle(headX-headR+i*headR/2,top+2+Math.sin(i)*2,4).fill({color:hair,alpha});
  }
  if(avatar.helmet==="mohawk") {
    g.poly([headX-6,top+3,headX-3,top-5,headX,top-2,headX+3,top-7,headX+6,top+3]).fill({color:hair,alpha}).stroke({width:1.3,color:ink,alpha});
  } else if(avatar.helmet==="beret") {
    g.poly([headX-headR-2,top+5,headX-headR,top,headX+2,top-3,headX+headR+2,top+2,headX+headR,top+6]).fill({color,alpha}).stroke({width:1.4,color:ink,alpha});
  } else if(avatar.helmet!=="none") {
    const helmet=avatar.helmet==="cap"?0x89966b:avatar.helmet==="visor"?0x506d84:0x788878;
    g.roundRect(headX-headR-1,top-1,headR*2+2,headR+2,4).fill({color:helmet,alpha}).stroke({width:1.5,color:ink,alpha});
    g.moveTo(headX-headR+3,top+2).lineTo(headX+headR-2,top+2).stroke({width:2,color:0xbdc8b4,alpha});
    if(avatar.helmet==="cap")g.rect(headX+f*(headR-2)-(f<0?8:0),top+headR-2,10,3).fill({color:helmet,alpha});
    else shape(headX-f*(headR+1)-2,headY-1,5,8,0x4c6054,2);
  }
  const eyeX=headX+(f>0?0:-headR+1),eyeY=headY;
  if(avatar.glasses==="none")g.circle(headX+f*4,eyeY+1,1.2).fill({color:ink,alpha});
  else if(avatar.glasses==="round") {
    g.circle(headX+f*4,eyeY+1,3).fill({color:0xa7dbdf,alpha:.6*alpha}).stroke({color:ink,width:1,alpha});
    g.moveTo(headX-f*headR,eyeY).lineTo(headX+f,eyeY).stroke({color:ink,width:1,alpha});
  } else {
    g.roundRect(eyeX,eyeY,headR,avatar.glasses==="aviator"?4.5:3.5,1.4).fill({color:avatar.glasses==="aviator"?0x554b36:avatar.helmet==="visor"||avatar.face==="robot"?0xb7e7e1:0x253b35,alpha});
    g.moveTo(eyeX+1,eyeY+1).lineTo(eyeX+headR-2,eyeY+1).stroke({width:1,color:avatar.glasses==="aviator"?0xe5bf76:0xdaece0,alpha:.85*alpha});
  }
  if(avatar.facialHair==="moustache")g.moveTo(headX+f,headY+4).lineTo(headX+f*4,headY+3).lineTo(headX+f*7,headY+5).stroke({color:hair,width:2.5,alpha});
  else if(avatar.facialHair==="beard")g.poly([headX-headR+2,headY+3,headX-3,headY+7,headX+headR-1,headY+4,headX+4,headY+headR+2,headX-4,headY+headR]).fill({color:hair,alpha});
  else if(avatar.facialHair==="goatee")g.poly([headX+f,headY+6,headX+f*6,headY+6,headX+f*4,headY+headR+2]).fill({color:hair,alpha});

  const held=(id:string,offhand:boolean)=>{
    if(id==="riot-shield") {
      const panel=shieldBox({x:x-11,y:top,w:22,h},p.aim);
      g.roundRect(panel.x,panel.y,panel.w,panel.h,2).fill({color:0x56798d,alpha}).stroke({color:ink,width:1.2,alpha});
      g.rect(panel.x+1,panel.y+3,panel.w-2,Math.min(8,panel.h*.25)).fill({color:0xa4d0d4,alpha});
      g.rect(panel.x+1,panel.y+panel.h*.57,panel.w-2,3).fill({color:0xd9c681,alpha});
      return;
    }
    const reload=offhand?p.otherReload??0:p.reload??0,charge=offhand?p.otherCharge:p.charge;
    const cycling=reload>0?Math.sin(reload*Math.PI):0;
    const aim=p.aim-f*p.recoil*.025+f*cycling*.18;
    const gx=x-Math.cos(aim)*p.recoil*3-(offhand?f*3:0);
    const gy=y-h*.68+(offhand?h*.13:0);
    const c=Math.cos(aim),ss=Math.sin(aim);
    const arm=(along:number,lower:number)=>{
      const hx=gx+c*along-ss*lower*f,hy=gy+ss*along+c*lower*f;
      g.moveTo(x-f*5,shoulder+3).lineTo(x+f*3,shoulder+7).lineTo(hx,hy).stroke({width:7,color:ink,alpha,cap:"round"});
      g.moveTo(x-f*5,shoulder+3).lineTo(x+f*3,shoulder+7).lineTo(hx,hy).stroke({width:4.5,color:skin,alpha,cap:"round"});
      g.circle(hx,hy,3).fill({color:0x455b4b,alpha}).stroke({width:1,color:ink,alpha});
    };
    arm(3,7);
    if(!WEAPONS[id]?.oneHanded&&!offhand)arm(cycling?12:24,cycling?13:3);
    drawWeapon(g,id,gx,gy,aim,.9,alpha,{charge,reload,now:p.now});
  };
  if(p.otherWeapon)held(p.otherWeapon,true);
  if(p.weapon)held(p.weapon,false);
}
