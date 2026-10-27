import type { Graphics } from "pixi.js";
import { shieldPanel, shieldCorners } from "../shared/combat-geometry.ts";
import { WEAPONS } from "../shared/weapons.ts";
import { drawWeapon } from "./weapon-art.ts";
import { avatarOf, type Avatar } from "../shared/avatar.ts";
import {SKIN,shade,headSvg,drawHead} from "./pilot-head.ts";
export {HAIR,SKIN,AVATAR_PORTRAIT_VIEWBOX} from "./pilot-head.ts";
export { avatarOf, DEFAULT_AVATAR, type Avatar } from "../shared/avatar.ts";
export function avatarSvg(raw: Avatar, color:number): string {
  const a=avatarOf(raw),tint=Number.isFinite(color)?Math.round(color)&0xffffff:0x3c8de0;
  const hex=(n:number)=>"#"+(n&0xffffff).toString(16).padStart(6,"0");
  const fabric=hex(shade(tint,-22)),shadow=hex(shade(tint,-59)),highlight=hex(shade(tint,24)),skin=hex(SKIN[a.face]);
  const emblem=a.emblem==="star"?'<path d="M60 61L62 66L67 66L63 70L64 75L60 72L55 75L56 70L52 66L58 66Z" fill="#dfcda0"/>':a.emblem==="bolt"?'<path d="M61 60L54 69L59 69L57 76L66 65L61 65L64 60Z" fill="#dfcda0"/>':'<path d="M54 66Q54 60 60 60Q66 60 66 66L64 70L64 74L56 74L56 70Z" fill="#dfcda0"/><path d="M56 65L59 65L59 68L56 68ZM62 65L65 65L65 68L62 68ZM59 70L61 70L61 73L59 73Z" fill="#30424a"/>';
  const torso=a.outfit==="armour"?
    '<path d="M40 49L50 44L70 46L81 54L76 87L42 87Z" fill="'+fabric+'"/><path d="M47 51L58 48L72 52L75 72L67 83L48 80L44 67Z" fill="'+shadow+'"/><path d="M48 53L58 51L70 55L70 65L48 65Z" fill="'+highlight+'"/><path d="M45 72L57 74L72 71M47 77L68 79" fill="none" stroke="#adc1b2" stroke-opacity=".5"/><path d="M43 49L48 48L49 80L44 81ZM73 51L77 53L73 81L69 82Z" fill="#6e7d6b"/>':
    a.outfit==="flight-suit"?'<path d="M42 48L52 44L69 46L79 53L75 87L43 87Z" fill="'+fabric+'"/><path d="M44 57L50 53L53 84L44 84ZM69 51L76 55L72 84L67 82Z" fill="'+shadow+'"/><path d="M59 49L59 86M46 60L73 60" stroke="#c6c8b3" stroke-width="1.5"/><path d="M45 71L54 71L54 78L45 78ZM64 71L73 71L73 78L64 78Z" fill="'+highlight+'"/>':
    a.outfit==="jacket"?'<path d="M40 50L50 44L58 53L67 45L79 52L78 89L40 89Z" fill="'+fabric+'"/><path d="M51 47L59 55L67 48L67 85L51 85Z" fill="#b3b29d"/><path d="M49 44L58 54L51 62L46 58L50 69L47 89L39 87L41 50ZM69 45L60 54L66 62L72 58L67 69L70 89L79 87L78 52Z" fill="'+shadow+'"/><path d="M43 72L49 73M70 74L76 73" stroke="#c8bd98" stroke-width="1.5"/>':
    '<path d="M44 48L52 45L59 51L68 46L76 51L72 71L84 103Q63 109 36 103L46 72Z" fill="'+fabric+'"/><path d="M51 53L55 71L47 101M68 52L65 72L73 102M60 76L61 104" stroke="'+shadow+'" stroke-width="3" fill="none"/><path d="M43 96Q61 101 78 96" stroke="'+highlight+'" fill="none"/><path d="M46 70L71 70L72 75L45 75Z" fill="#4a5148"/>';
  return '<svg role="img" aria-label="Customized '+a.body+' pilot, '+a.outfit+', '+a.hair+' hair" viewBox="0 0 120 130">'+
    '<ellipse cx="61" cy="121" rx="33" ry="4" fill="#0c202b" opacity=".28"/>'+
    '<g class="avatar-rig" stroke="#233039" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">'+
    '<g class="avatar-exhaust" stroke="none"><path d="M25 85L23 101L28 98L30 115L37 97L35 86" fill="#e98742"/><path d="M29 86L30 105L34 89" fill="#f6d986"/></g>'+
    '<path d="M23 48L29 43L40 47L41 85L24 87Z" fill="#485e61"/><path d="M25 49L29 47L31 79L26 81Z" fill="#91a9a2"/><path d="M32 48L37 49L37 79L33 80Z" fill="#6f8b85"/><path d="M23 82L39 81L39 89L25 91Z" fill="#293f49"/><path d="M27 86L35 85" stroke="#b6c7aa"/>'+
    '<path d="M45 84L59 86L56 101L52 113L42 112L42 100ZM62 85L76 84L76 99L82 111L71 115L65 102Z" fill="#4c615b"/><path d="M47 90L50 100L47 108M68 88L69 99L75 108" stroke="#859588" stroke-width="2" fill="none"/>'+
    '<path d="M42 99L53 100L52 107L42 107ZM68 99L77 97L80 104L71 107Z" fill="#3b5052"/><path d="M44 101L51 102M70 101L76 101" stroke="#8fa199"/>'+
    '<path d="M41 108L53 110L55 115L54 120L34 120L34 116ZM71 109L81 108L88 115L89 119L69 121L67 117Z" fill="#283c44"/><path d="M35 117L52 117M71 118L86 116" stroke="#9baa9e"/><path d="M42 111L49 112M74 111L79 111" stroke="#768b83"/>'+torso+
    '<path d="M39 50Q44 45 49 48L50 57L43 63L35 60Z" fill="'+fabric+'"/><path d="M72 49Q79 47 83 53L83 60L76 63L71 57Z" fill="'+fabric+'"/><path d="M39 52L46 50M75 52L80 54" stroke="'+highlight+'" stroke-width="1.5"/>'+
    (a.outfit!=="dress"?'<path d="M40 84L76 84L77 91L40 91Z" fill="#35484a"/><path d="M44 78L53 78L54 89L43 89ZM65 78L74 78L75 89L64 89Z" fill="#84917b"/><path d="M45 82L51 82M66 82L72 82" stroke="#bfcaac"/><path d="M56 85L63 85L63 90L56 90Z" fill="#c7b683"/>':'')+
    '<g stroke="none">'+emblem+'</g>'+
    '<path d="M36 58L44 59L43 73L51 79L47 85L35 77L32 69Z" fill="'+skin+'"/><path d="M34 64L41 65" stroke="#b7c5b1" stroke-width="3"/><path d="M45 76L52 79L54 84L49 89L43 83Z" fill="#3c5356"/>'+
    '<g transform="translate(58 33) scale(.82)" stroke-width="1.1">'+headSvg(a,tint)+'</g>'+
    '<path d="M76 61L83 68L97 65L99 72L82 78L74 71Z" fill="'+skin+'"/><path d="M77 62L81 66L78 71L73 67Z" fill="'+fabric+'"/><path d="M92 65L98 64L102 68L99 75L94 76L91 71Z" fill="#3c5356"/>'+
    '<path d="M91 61L98 61L97 74L92 75L90 72Z" fill="#35454c"/><path d="M88 56L109 56L113 60L112 64L90 65L87 62Z" fill="#9eacaf"/><path d="M91 57L107 57" stroke="#d1ded7"/><path d="M109 59L118 59L118 63L109 63Z" fill="#2d4049"/><path d="M97 66L103 66L102 70L97 71" fill="none"/><path d="M91 58L94 58M96 58L99 58" stroke="#4e666d"/>'+
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
  const ink=0x21322e,skin=SKIN[avatar.face],crouched=h<35;
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
  // Empty inventory is a real stance: keep relaxed arms after dropping equipment.
  if(!p.weapon&&!p.otherWeapon)for(const side of [-1,1]) {
    const sx=x+side*9,sy=shoulder+3,ex=x+side*(crouched?15:13),ey=hip-4;
    const wristX=x+side*(crouched?13:11),wristY=hip+1;
    g.moveTo(sx,sy).lineTo(ex,ey).lineTo(wristX,wristY).stroke({color:ink,width:7,alpha,cap:"round",join:"round"});
    g.moveTo(sx,sy).lineTo(ex,ey).lineTo(wristX,wristY).stroke({color:skin,width:4.5,alpha,cap:"round",join:"round"});
    g.moveTo(sx,sy-1).lineTo(sx+side*2,sy+2).stroke({color,width:6,alpha,cap:"round"});
    shape(wristX-3,wristY-2,6,5,0x3c5356,1.5);
  }
  const headX=x+(crouched?f*3:0),headY=top+headR+1;
  drawHead(g,avatar,color,headX,headY,headR/22,f,alpha);

  const held=(id:string,offhand:boolean)=>{
    if(id==="riot-shield") {
      const panel=shieldPanel({x:x-11,y:top,w:22,h},p.aim);
      g.poly(shieldCorners(panel)).fill({color:0x56798d,alpha}).stroke({color:ink,width:1.2,alpha});
      g.poly(shieldCorners({...panel,length:panel.length*.4},1)).fill({color:0xa4d0d4,alpha});
      const c=Math.cos(panel.angle),s=Math.sin(panel.angle);
      g.moveTo(panel.x-c*2-s*panel.length*.32,panel.y-s*2+c*panel.length*.32)
        .lineTo(panel.x+c*2-s*panel.length*.32,panel.y+s*2+c*panel.length*.32).stroke({color:0xd9c681,width:3,alpha});
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
