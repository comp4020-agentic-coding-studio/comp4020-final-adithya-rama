import type { Graphics } from "pixi.js";
import type { MapDefinition, Rect } from "../shared/types.ts";
const INK=0x293b35;
function mix(a:number,b:number,t:number):number {const c=(s:number)=>Math.round(((a>>s)&255)*(1-t)+((b>>s)&255)*t);return(c(16)<<16)|(c(8)<<8)|c(0);}
function noise(n:number):number {const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);}
function inside(rs:Rect[],x:number,y:number):boolean{return rs.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);}
interface Edge {x1:number;y1:number;x2:number;y2:number;top:boolean;bottom:boolean}
function edges(rs:Rect[]):Edge[] {
  const xs=[...new Set(rs.flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b);
  const ys=[...new Set(rs.flatMap(r=>[r.y,r.y+r.h]))].sort((a,b)=>a-b);
  const out:Edge[]=[];
  for(const r of rs) {
    for(const [y,dir] of [[r.y,-1],[r.y+r.h,1]]) {
      const cuts=xs.filter(x=>x>=r.x&&x<=r.x+r.w);
      let start:number|null=null;
      for(let i=0;i<cuts.length-1;i++) {
        const exposed=!inside(rs,(cuts[i]+cuts[i+1])/2,y+dir*.1);
        if(exposed&&start===null)start=cuts[i];
        if(start!==null&&(!exposed||i===cuts.length-2)){const end=exposed?cuts[i+1]:cuts[i];out.push({x1:start,y1:y,x2:end,y2:y,top:dir<0,bottom:dir>0});start=null;}
      }
    }
    for(const [x,dir] of [[r.x,-1],[r.x+r.w,1]]) {
      const cuts=ys.filter(y=>y>=r.y&&y<=r.y+r.h);
      let start:number|null=null;
      for(let i=0;i<cuts.length-1;i++) {
        const exposed=!inside(rs,x+dir*.1,(cuts[i]+cuts[i+1])/2);
        if(exposed&&start===null)start=cuts[i];
        if(start!==null&&(!exposed||i===cuts.length-2)){out.push({x1:x,y1:start,x2:x,y2:exposed?cuts[i+1]:cuts[i],top:false,bottom:false});start=null;}
      }
    }
  }
  return out;
}
export function drawTerrain(g:Graphics,map:MapDefinition):void {
  g.clear();
  const snow=map.biome==="snow",cave=map.biome==="cavern",range=map.biome==="range",desert=map.biome==="desert",palace=map.biome==="palace";
  const rs=map.solids,ink=cave?0x28322e:INK;
  if(palace) {
    // Recessed rear masonry is deliberately lighter, without the dark collision
    // contour. Draw it before terrain so stairs/columns retain exact solid edges.
    const rooms=[
      {x:110,y:475,w:585,h:330},{x:2105,y:475,w:585,h:330},
      {x:130,y:850,w:640,h:280},{x:2030,y:850,w:640,h:280},
      {x:1110,y:380,w:580,h:290},{x:1110,y:715,w:580,h:285},
    ];
    for(const room of rooms) {
      const {x,y,w,h}=room;
      g.rect(x,y,w,h).fill(0xd5cbb8);
      g.rect(x+12,y+14,w-24,h-28).stroke({width:3,color:0xc1b18c});
      g.rect(x+19,y+21,w-38,h-42).stroke({width:1.5,color:0xe8dcc0});
      const n=Math.max(2,Math.floor(w/150)),gap=w/n;
      for(let i=0;i<n;i++) {
        const cx=x+gap*(i+.5),wy=y+48,ww=gap*.55,hh=h-76;
        // Pointed, recessed windows make a room rather than an opaque obstacle.
        g.moveTo(cx-ww/2,wy+hh).lineTo(cx-ww/2,wy+ww*.65)
          .quadraticCurveTo(cx-ww/2,wy+16,cx,wy)
          .quadraticCurveTo(cx+ww/2,wy+16,cx+ww/2,wy+ww*.65)
          .lineTo(cx+ww/2,wy+hh).closePath().fill(0xafb6b6).stroke({width:4,color:0xc1b18d});
        g.moveTo(cx,wy+13).lineTo(cx,wy+hh-7).stroke({width:3,color:0xd0c5ad});
        g.moveTo(cx-ww*.42,wy+hh*.63).lineTo(cx+ww*.42,wy+hh*.63).stroke({width:3,color:0xd0c5ad});
        g.rect(cx-ww*.56,wy+hh-2,ww*1.12,7).fill(0xc6b58e);
      }
      g.rect(x+10,y+h-22,w-20,15).fill(0xc7b990);
      for(let xx=x+24;xx<x+w-20;xx+=36)
        g.poly([xx,y+h-17,xx+5,y+h-12,xx,y+h-7,xx-5,y+h-12]).fill(0xa79772);
    }
  }
  for(const r of rs)g.rect(r.x,r.y,r.w,r.h).fill(map.theme.rock);
  // Interior geology is seeded and built once. No collision is inferred from art.
  for(let y=35;!palace&&y<map.height;y+=51)for(let x=25;x<map.width;x+=57) {
    const n=x*7+y*13,cx=x+noise(n)*24,cy=y+noise(n+2)*22,rx=10+noise(n+7)*19,ry=8+noise(n+9)*14;
    const pts=[cx-rx,cy-ry*.4,cx-rx*.35,cy-ry,cx+rx*.8,cy-ry*.6,cx+rx,cy+ry*.35,cx+rx*.2,cy+ry,cx-rx*.75,cy+ry*.65];
    if(pts.every((v,i)=>i%2===1||inside(rs,v,pts[i+1]))) {
      g.poly(pts).fill(mix(map.theme.rock,noise(n+5)>.5?0xc6c9b7:0x374a43,.16+noise(n+6)*.23)).stroke({color:ink,width:1.4,alpha:.7});
      g.moveTo(pts[0]+2,pts[1]).lineTo(pts[2],pts[3]+3).lineTo(pts[4]-2,pts[5]+2).stroke({color:0xe2e4cf,width:1,alpha:.32});
    }
  }
  if(palace||desert) {
    // Cut blocks and sediment bands replace the cave's irregular inclusions.
    // All seams are clipped to solid rectangles, never false ledges in open air.
    for(const r of rs)for(let yy=r.y+26;yy<r.y+r.h;yy+=palace?32:46) {
      g.moveTo(r.x+1,yy).lineTo(r.x+r.w-1,yy).stroke({width:1.3,color:palace?0x827c76:0x93643d,alpha:.6});
      if(palace)for(let xx=r.x+((Math.floor(yy/32)%2)*38)+25;xx<r.x+r.w-5;xx+=76)
        g.moveTo(xx,yy).lineTo(xx,Math.min(yy+32,r.y+r.h)).stroke({width:1,color:0x847f79,alpha:.55});
    }
  }
  for(const e of edges(rs)) {
    g.moveTo(e.x1,e.y1).lineTo(e.x2,e.y2).stroke({width:3.5,color:ink});
    if(e.top&&e.y1>35) {
      const len=e.x2-e.x1;
      if(snow) {
        g.rect(e.x1,e.y1,len,10).fill(0xd7e7e9);
        const cap:number[]=[e.x1,e.y1+5,e.x1,e.y1-3];
        for(let x=e.x1;x<=e.x2;x+=14)cap.push(x,e.y1-3-noise(x+e.y1)*5);
        cap.push(e.x2,e.y1-3,e.x2,e.y1+7);
        g.poly(cap).fill(0xf6fcf7).stroke({width:1.5,color:ink});
        for(let x=e.x1+12;x<e.x2-8;x+=35)g.poly([x,e.y1+7,x+5,e.y1+21+noise(x)*12,x+10,e.y1+7]).fill(0xcfe8ed).stroke({width:1,color:0x627f85});
      } else if(desert) {
        g.rect(e.x1,e.y1,len,8).fill(0xe9be7b);
        g.moveTo(e.x1,e.y1+2).lineTo(e.x2,e.y1+2).stroke({width:3,color:0xffdda0});
        for(let x=e.x1+8;x<e.x2;x+=29)g.moveTo(x,e.y1+7).lineTo(Math.min(x+10,e.x2),e.y1+10).stroke({width:1.3,color:0xa47745});
      } else if(palace) {
        g.rect(e.x1,e.y1,len,9).fill(0xe9dfc5);
        g.moveTo(e.x1,e.y1+9).lineTo(e.x2,e.y1+9).stroke({width:2,color:0x8a8071});
        g.moveTo(e.x1,e.y1+3).lineTo(e.x2,e.y1+3).stroke({width:2,color:0xfff0d3});
        if(len>95)for(let x=e.x1+20;x<e.x2-10;x+=38)
          if(inside(rs,x,e.y1+15))g.poly([x,e.y1+10,x+5,e.y1+14,x,e.y1+18,x-5,e.y1+14]).fill(0x9e875a);
      } else if(!cave&&!range) {
        g.rect(e.x1,e.y1,len,9).fill(0x568047);
        const cap=[e.x1,e.y1+5,e.x1,e.y1-2];
        for(let x=e.x1+5;x<e.x2;x+=13)cap.push(x,e.y1-5-noise(x+e.y1)*8,x+4,e.y1+1);
        cap.push(e.x2,e.y1,e.x2,e.y1+7);
        g.poly(cap).fill(map.theme.platform).stroke({color:ink,width:1.6});
      } else {
        g.rect(e.x1,e.y1,len,5).fill(map.theme.platform);
        if(cave&&len>90)for(let x=e.x1+15;x<e.x2-10;x+=65)g.poly([x,e.y1,x+8,e.y1-9,x+17,e.y1]).fill(map.theme.rock).stroke({width:1.5,color:ink});
      }
    }
    if(e.bottom&&cave&&e.x2-e.x1>100)for(let x=e.x1+20;x<e.x2-10;x+=73)
      g.poly([x,e.y1-1,x+8,e.y1+14,x+19,e.y1-1]).fill(map.theme.rock).stroke({width:1.5,color:ink});
  }
  for(const p of map.platforms) {
    if(cave||palace||desert) {
      const base=palace?0xc6b99e:desert?0xbc8d56:0x717c78,cap=palace?0xf2e5c4:desert?0xf2cb8f:0xa6afa0;
      g.poly([p.x,p.y,p.x+p.w,p.y,p.x+p.w-3,p.y+p.h,p.x+3,p.y+p.h]).fill(base).stroke({width:2.5,color:ink});
      g.rect(p.x+1,p.y+1,p.w-2,4).fill(cap);
      for(let x=p.x+27;x<p.x+p.w-6;x+=37)g.moveTo(x,p.y+5).lineTo(x-4,p.y+p.h).stroke({width:1.5,color:ink,alpha:.6});
      if(palace)for(const x of [p.x+12,p.x+p.w-12])
        g.poly([x-6,p.y+p.h,x+6,p.y+p.h,x+3,p.y+p.h+7,x-3,p.y+p.h+7]).fill(0xb6a57c);
    } else {
      g.roundRect(p.x,p.y,p.w,p.h,3).fill(snow?0x8095a0:0x8a7551).stroke({width:2.5,color:ink});
      g.moveTo(p.x+2,p.y+3).lineTo(p.x+p.w-2,p.y+3).stroke({width:snow?5:3,color:snow?0xf2faf5:0xcfb687});
      for(let x=p.x+13;x<p.x+p.w-4;x+=24)g.moveTo(x,p.y+3).lineTo(x-2,p.y+p.h-2).stroke({width:1.5,color:snow?0x526b77:0x4c4e37});
      if(snow)for(let x=p.x+10;x<p.x+p.w-10;x+=37)
        g.poly([x,p.y+p.h,x+4,p.y+p.h+10,x+7,p.y+p.h]).fill(0xd6f0f2);
    }
    // Only this small underside mark denotes a one-way ledge.
    for(const x of [p.x+8,p.x+p.w-8])g.poly([x-3,p.y+p.h+3,x,p.y+p.h+6,x+3,p.y+p.h+3]).fill(map.theme.accent);
  }
}
export function drawScenery(g:Graphics,map:MapDefinition):void {
  g.clear();
  const snow=map.biome==="snow";
  for(const p of map.scenery??[]) {
    const x=p.x,y=p.y,w=p.w??80,h=p.h??150,flip=p.flip?-1:1;
    if(p.kind==="cactus") {
      const c=0x648577;
      g.moveTo(x,y-2).lineTo(x,y-h+15).stroke({width:w*.32,color:INK,cap:"round"});
      g.moveTo(x,y-3).lineTo(x,y-h+15).stroke({width:w*.32-5,color:c,cap:"round"});
      for(const [side,drop] of [[-1,.42],[1,.65]]) {
        const xx=x+side*w*.45,yy=y-h*drop;
        g.moveTo(x,yy).lineTo(xx,yy).lineTo(xx,yy-h*.25).stroke({width:w*.19,color:INK,cap:"round",join:"round"});
        g.moveTo(x,yy).lineTo(xx,yy).lineTo(xx,yy-h*.25).stroke({width:w*.19-4,color:c,cap:"round",join:"round"});
      }
      g.moveTo(x-3,y-9).lineTo(x-3,y-h+17).stroke({width:2,color:0xa5b48a});
      for(let yy=y-15;yy>y-h+20;yy-=18)g.moveTo(x+3,yy).lineTo(x+7,yy-5).stroke({width:1.5,color:0x344e43});
      g.circle(x,y-h+6,5).fill(0xe9a374).stroke({width:1.5,color:INK});
    } else if(p.kind==="urn") {
      const c=map.biome==="palace"?0xcabb93:map.biome==="desert"?0xbe7551:0x858a78;
      g.poly([x-w*.27,y-h,x+w*.27,y-h,x+w*.20,y-h*.77,x+w*.46,y-h*.53,x+w*.34,y-7,x+w*.18,y,x-w*.18,y,x-w*.34,y-7,x-w*.46,y-h*.53,x-w*.20,y-h*.77]).fill(c).stroke({width:2.5,color:INK});
      g.ellipse(x,y-h,w*.29,4).fill(0x4d4d40).stroke({width:2,color:INK});
      g.moveTo(x-w*.35,y-h*.47).lineTo(x+w*.35,y-h*.47).stroke({width:5,color:map.theme.accent});
      g.moveTo(x-w*.15,y-h*.69).lineTo(x-w*.23,y-h*.5).lineTo(x-w*.15,y-h*.15).stroke({width:2,color:0xeee0b1,alpha:.7});
    } else if(p.kind==="column") {
      // The narrow column is drawn over the corresponding collision pillar.
      g.rect(x-w/2,y-h,w,h).fill(map.biome==="desert"?0xc29b67:0xc8c0ac).stroke({width:2,color:INK});
      for(let xx=x-w*.3;xx<x+w*.4;xx+=w*.2)g.moveTo(xx,y-h+14).lineTo(xx,y-10).stroke({width:2,color:0x948c7a});
      g.rect(x-w/2,y-h,w,13).fill(0xeee0be).stroke({width:2,color:INK});
      g.rect(x-w/2,y-10,w,10).fill(0xe0d0a6).stroke({width:2,color:INK});
    } else if(p.kind==="banner") {
      const c=p.flip?0x657f9f:0x94655d;
      g.poly([x,y,x+w,y,x+w,y+h-20,x+w/2,y+h,x,y+h-20]).fill(c).stroke({width:2,color:0x494b48});
      g.poly([x+7,y+8,x+w-7,y+8,x+w-7,y+h-24,x+w/2,y+h-10,x+7,y+h-24]).stroke({width:2,color:0xccb885});
      g.star(x+w/2,y+h*.4,6,w*.23,w*.11).fill(0xd0bb7c);
      g.moveTo(x-5,y).lineTo(x+w+5,y).stroke({width:5,color:0x9c946e});
    } else if(p.kind==="dome") {
      // Recessed roof mural: muted, no black collision outline or walkable cap.
      const c=mix(map.theme.sky,0x8d979a,.28);
      g.moveTo(x-w/2,y).quadraticCurveTo(x-w*.45,y-h*.68,x,y-h).quadraticCurveTo(x+w*.45,y-h*.68,x+w/2,y).closePath().fill(c);
      for(const s of [-.3,0,.3])g.moveTo(x+w*s,y).quadraticCurveTo(x+w*s*.8,y-h*.55,x,y-h).stroke({color:mix(c,0x78868a,.2),width:3});
      g.rect(x-w*.48,y-8,w*.96,8).fill(mix(c,0x78868a,.2));
      g.moveTo(x,y-h).lineTo(x,y-h-22).stroke({width:3,color:0x9d977d});
      g.circle(x,y-h-24,5).fill(0xb8aa75);
    } else if(p.kind==="palm") {
      const bend=flip*h*.18;
      g.poly([x-10,y,x+10,y,x+bend+7,y-h,x+bend-5,y-h]).fill(0x9a9061).stroke({color:INK,width:2.5});
      for(let n=15;n<h;n+=17)g.moveTo(x-8+bend*n/h,y-n).lineTo(x+9+bend*n/h,y-n-7).stroke({width:2,color:0x556243});
      const cx=x+bend,cy=y-h;
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4-.2,len=h*(.42+noise(i+x)*.16),ex=cx+Math.cos(a)*len,ey=cy+Math.sin(a)*len*.5;
        const nx=-Math.sin(a)*14,ny=Math.cos(a)*14;
        g.poly([cx,cy,cx+(ex-cx)*.45+nx,cy+(ey-cy)*.3+ny,ex,ey,cx+(ex-cx)*.6-nx,cy+(ey-cy)*.3-ny]).fill(i%2?0x466943:0x678950).stroke({width:2,color:INK});
        g.moveTo(cx,cy).lineTo(ex,ey).stroke({width:1.5,color:0x354f36});
      }
      g.circle(cx-5,cy+4,6).fill(0x776844);g.circle(cx+4,cy+7,6).fill(0x8d7749);
    } else if(p.kind==="pine") {
      g.poly([x-8,y,x+8,y,x+5,y-h*.86,x-3,y-h*.86]).fill(0x786d58).stroke({width:2,color:INK});
      for(let i=0;i<4;i++){
        const yy=y-h+i*h*.19,half=h*(.16+i*.06),bottom=yy+h*.43;
        const shape=[x,yy,x+half,bottom-8,x+half*.57,bottom-15,x+half*.23,bottom,x-half*.3,bottom-8,x-half,bottom-3];
        g.poly(shape).fill(i%2?0x58745b:0x426553).stroke({width:2.5,color:INK});
        if(snow)g.poly([x,yy,x+half*.70,bottom-h*.14,x+half*.33,bottom-h*.18,x,bottom-h*.1,x-half*.23,bottom-h*.17,x-half*.73,bottom-h*.12]).fill(0xf0f7ed).stroke({width:1.5,color:0x7b958a});
      }
    } else if(p.kind==="fern") {
      for(let i=0;i<8;i++){const a=-Math.PI+i*Math.PI/7,ex=x+Math.cos(a)*w*.5,ey=y+Math.sin(a)*w*.4;
        g.poly([x,y,x+(ex-x)*.4-8,y+(ey-y)*.4-10,ex,ey,x+(ex-x)*.5+5,y+(ey-y)*.5]).fill(i%2?0x547747:0x82a355).stroke({width:1.5,color:INK});}
    } else if(p.kind==="bunker") {
      // Rear wall is scenery; the roof, jambs and floor exactly match bunker().
      g.rect(x+24,y-h+22,w-48,h-22).fill(0x6c715f);
      for(let yy=y-h+40;yy<y;yy+=21)g.moveTo(x+25,yy).lineTo(x+w-25,yy).stroke({width:1,color:0x535b4c,alpha:.5});
      const wx=x+w*.5-27,wy=y-h+47;
      g.rect(wx-4,wy-4,62,48).fill(0x343f38);
      g.rect(wx,wy,54,40).fill(map.theme.sky);
      g.moveTo(wx+27,wy).lineTo(wx+27,wy+40).stroke({width:4,color:0x494e3e});
      g.roundRect(wx-5,wy+38,64,9,3).fill(snow?0xf0f7f3:0x9f986b).stroke({width:2,color:INK});
      for(const xx of [x,x+w-24])for(let yy=y-h+22;yy<y-72;yy+=18){
        g.roundRect(xx,yy,24,20,8).fill(0x8c8664).stroke({width:2,color:INK});
        g.circle(xx+12,yy+10,5).stroke({width:1,color:0x5b6147});
      }
      for(const yy of [y-h,y]){
        g.roundRect(x-1,yy,w+2,22,8).fill(0x9a9068).stroke({width:3,color:INK});
        g.moveTo(x+10,yy+8).lineTo(x+w-14,yy+7).stroke({width:2,color:0xb3aa81});
        for(let xx=x+45;xx<x+w;xx+=63)g.moveTo(xx,yy+11).lineTo(xx+18,yy+14).stroke({width:1.5,color:0x61664b});
      }
      if(snow)g.poly([x-5,y-h,x-2,y-h-7,x+15,y-h-4,x+33,y-h-9,x+w-10,y-h-7,x+w+5,y-h-2,x+w+3,y-h+5,x+4,y-h+5]).fill(0xf2faf4).stroke({width:2,color:INK});
    } else if(p.kind==="crate") {
      g.roundRect(x-w/2,y-h,w,h,3).fill(0x918061).stroke({width:2.5,color:INK});
      g.rect(x-w/2+5,y-h+4,w-10,h-8).stroke({width:3,color:0xc0ab79});
      g.moveTo(x-w/2+4,y-h+3).lineTo(x+w/2-4,y-4).stroke({width:5,color:0xbaa36f});
    } else if(p.kind==="lantern") {
      g.moveTo(x,y).lineTo(x,y+h-13).stroke({width:2,color:0x303f38});
      g.circle(x,y+h,25).fill({color:0xffd27f,alpha:.1});
      g.roundRect(x-7,y+h-11,14,20,3).fill(0xffd78a).stroke({width:3,color:INK});
      g.moveTo(x-9,y+h-11).lineTo(x+9,y+h-11).stroke({width:4,color:0x4c5442});
    } else if(p.kind==="crystal") {
      for(let i=0;i<5;i++){const xx=x-w/2+i*w/5,hh=h*(.5+noise(x+i)*.5);
        g.poly([xx,y,xx-5,y-hh*.7,xx+2,y-hh,xx+10,y-hh*.8,xx+14,y]).fill(i%2?0x7eae98:0xabcbb0).stroke({width:2,color:INK});
        g.moveTo(xx+2,y-hh+5).lineTo(xx+5,y-3).stroke({width:1,color:0xe1efd1});}
    } else if(p.kind==="bones") {
      g.ellipse(x,y-5,15,8).fill(0xc1c0a1).stroke({width:2,color:INK});
      g.circle(x-5,y-7,3).fill(0x495246);g.circle(x+5,y-7,3).fill(0x495246);
      g.moveTo(x+18,y-3).lineTo(x+w*.6,y-8).stroke({width:4,color:0xb6b79c});
    } else if(p.kind==="bridge") {
      for(let xx=x+12;xx<x+w;xx+=50)g.moveTo(xx,y+14).lineTo(xx+10,y+35).stroke({width:3,color:0x5c6046});
      g.moveTo(x,y+25).quadraticCurveTo(x+w/2,y+70,x+w,y+25).stroke({width:3,color:0x656749});
    }
  }
}
export function drawBackdropLayer(g:Graphics,map:MapDefinition,width:number,height:number,layer:number):void {
  g.clear();
  const snow=map.biome==="snow",cave=map.biome==="cavern",color=cave?(layer?0x435951:0x3c514b):snow?(layer?0xa9bbc1:0xc6ccd8):(layer?0x9bb59b:0xb2c6ad);
  const base=height*.75;
  if(map.biome==="desert") {
    const dune=height*(layer?.84:.70),c=layer?0xd5b27e:0xe0c49b;
    g.moveTo(-500,height+100).lineTo(-500,dune);
    for(let x=-500;x<width+500;x+=400)g.quadraticCurveTo(x+150,dune-80-noise(x)*90,x+400,dune);
    g.lineTo(width+900,height+100).closePath().fill(c);
    if(!layer) {
      g.circle(width*.78,height*.22,45).fill(0xf9e9bd);
      for(let x=-180;x<width+400;x+=530)g.poly([x,base,x+50,base-160,x+140,base-210,x+230,base-205,x+290,base-150,x+330,base]).fill(0xd7b88d);
    } else {
      const x=width*.62,y=height*.83;
      g.ellipse(x,y,165,13).fill(0xabc4b1);
      g.ellipse(x,y-1,112,7).fill(0xc7d5bb);
    }
    return;
  }
  if(map.biome==="palace") {
    const c=layer?0xb8bcc6:0xc7c9d3,y=height*(layer?.91:.72);
    for(let x=-400;x<width+500;x+=280) {
      const hh=150+noise(x)*120;
      g.rect(x,y-hh,180,hh+height*.3).fill(c);
      g.moveTo(x-5,y-hh).quadraticCurveTo(x+5,y-hh-85,x+90,y-hh-125).quadraticCurveTo(x+175,y-hh-85,x+185,y-hh).closePath().fill(c);
      for(let i=0;i<3;i++)g.roundRect(x+22+i*48,y-hh+28,24,65,12).fill(mix(c,0x81939b,.17));
      g.rect(x+86,y-hh-150,8,25).fill(c);
    }
    if(layer)for(let x=-200;x<width+300;x+=145) {
      g.rect(x,y-45,10,160).fill(0xafb5bd);
      g.moveTo(x+10,y+8).quadraticCurveTo(x+75,y-70,x+145,y+8).stroke({width:11,color:0xafb5bd});
    }
    return;
  }
  if(map.biome==="coast") {
    const sea=height*(layer?.64:.57);
    if(!layer) {
      g.rect(-500,sea,width+1000,height).fill(0x93babc);
      for(let x=-400;x<width+500;x+=430)
        g.poly([x,sea+10,x+65,sea-60,x+150,sea-85,x+210,sea-45,x+280,sea+10]).fill(0xa4bcb3);
    } else {
      for(let i=0;i<18;i++){const x=noise(i*13)*width,y=sea+noise(i+3)*height*.3;
        g.moveTo(x,y).lineTo(x+30+noise(i)*100,y).stroke({width:2,color:0xd5e7dc,alpha:.6});}
      // Distant coast beacon anchors the maritime silhouette without collision.
      const x=width*.72;
      g.poly([x-18,sea,x-12,sea-95,x+12,sea-95,x+18,sea]).fill(0x9dac99);
      g.rect(x-17,sea-102,34,8).fill(0x91a28e);
      g.poly([x-19,sea-104,x,sea-116,x+19,sea-104]).fill(0x91a28e);
    }
    return;
  }
  if(cave) {
    for(let x=-400;x<width+500;x+=160){
      const hh=height*(.5+noise(x+layer)*.7);
      g.poly([x-60,height+100,x-30,height-hh,x+20,height-hh-80,x+85,height-hh+40,x+110,height+100]).fill(color);
      g.poly([x-60,-10,x-20,height*.22+noise(x)*100,x+30,height*.1,x+90,-10]).fill(layer?0x2e413c:0x344b45);
    }
    for(let i=0;i<35;i++)g.circle(noise(i*4)*width,noise(i+20)*height,1.5).fill({color:0xb8c3a5,alpha:.3});
    return;
  }
  const mountain=[-500,height+120];
  for(let x=-500;x<width+500;x+=110)mountain.push(x,base-height*(.15+noise(x+layer*80)*.4));
  mountain.push(width+500,height+120);
  g.poly(mountain).fill(color);
  if(layer)for(let x=-350;x<width+400;x+=55) {
    const hh=height*(.12+noise(x)*.25),yy=base+height*.12;
    if(snow) {
      g.rect(x-3,yy-hh*.8,6,hh*.8).fill(0x99adaf);
      g.poly([x,yy-hh,x+hh*.22,yy-hh*.25,x+hh*.10,yy-hh*.3,x+hh*.32,yy,x-hh*.28,yy,x-hh*.13,yy-hh*.4,x-hh*.2,yy-hh*.35]).fill(0x97adb1);
    } else {
      g.rect(x-4,yy-hh*.65,8,hh*.65).fill(0x8ca68b);
      g.ellipse(x,yy-hh*.65,hh*.4,hh*.28).fill(0x91aa8d);
      g.ellipse(x+hh*.23,yy-hh*.4,hh*.28,hh*.22).fill(0x91aa8d);
    }
  }
}
