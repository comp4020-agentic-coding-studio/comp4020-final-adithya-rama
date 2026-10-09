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
  const snow=map.biome==="snow",cave=map.biome==="cavern",range=map.biome==="range";
  const rs=map.solids,ink=cave?0x28322e:INK;
  for(const r of rs)g.rect(r.x,r.y,r.w,r.h).fill(map.theme.rock);
  // Interior geology is seeded and built once. No collision is inferred from art.
  for(let y=35;y<map.height;y+=51)for(let x=25;x<map.width;x+=57) {
    const n=x*7+y*13,cx=x+noise(n)*24,cy=y+noise(n+2)*22,rx=10+noise(n+7)*19,ry=8+noise(n+9)*14;
    const pts=[cx-rx,cy-ry*.4,cx-rx*.35,cy-ry,cx+rx*.8,cy-ry*.6,cx+rx,cy+ry*.35,cx+rx*.2,cy+ry,cx-rx*.75,cy+ry*.65];
    if(pts.every((v,i)=>i%2===1||inside(rs,v,pts[i+1]))) {
      g.poly(pts).fill(mix(map.theme.rock,noise(n+5)>.5?0xc6c9b7:0x374a43,.16+noise(n+6)*.23)).stroke({color:ink,width:1.4,alpha:.7});
      g.moveTo(pts[0]+2,pts[1]).lineTo(pts[2],pts[3]+3).lineTo(pts[4]-2,pts[5]+2).stroke({color:0xe2e4cf,width:1,alpha:.32});
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
    g.roundRect(p.x,p.y,p.w,p.h,3).fill(cave?0x77674c:0x8a7551).stroke({width:2.5,color:ink});
    g.moveTo(p.x+2,p.y+3).lineTo(p.x+p.w-2,p.y+3).stroke({width:snow?5:3,color:snow?0xf2faf5:0xcfb687});
    for(let x=p.x+13;x<p.x+p.w-4;x+=24)g.moveTo(x,p.y+3).lineTo(x-2,p.y+p.h-2).stroke({width:1.5,color:0x4c4e37});
    // One-way platforms have a discreet downward notch at both ends.
    for(const x of [p.x+8,p.x+p.w-8])g.poly([x-3,p.y+p.h+3,x,p.y+p.h+6,x+3,p.y+p.h+3]).fill(map.theme.accent);
  }
}
export function drawScenery(g:Graphics,map:MapDefinition):void {
  g.clear();
  const snow=map.biome==="snow";
  for(const p of map.scenery??[]) {
    const x=p.x,y=p.y,w=p.w??80,h=p.h??150,flip=p.flip?-1:1;
    if(p.kind==="palm") {
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
