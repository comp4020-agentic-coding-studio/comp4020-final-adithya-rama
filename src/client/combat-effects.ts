import type { Graphics } from "pixi.js";
import { SAW_RADIUS } from "../shared/constants.ts";
import type { ProjectileSnap } from "../shared/types.ts";

/** Flame lobes stay inside the authoritative shot segment, including wall contact. */
export function flameLobes(x1:number,y1:number,x2:number,y2:number,phase:number) {
  const length=Math.hypot(x2-x1,y2-y1),angle=Math.atan2(y2-y1,x2-x1);
  if(length<1)return [];
  const c=Math.cos(angle),s=Math.sin(angle);
  return Array.from({length:5},(_,i)=>{
    const along=length*(.12+i*.18);
    const radius=Math.min(3+i*2.1,along,length-along);
    const ripple=Math.sin(phase*8+i*2.3)*radius*.35;
    return {x:x1+c*along-s*ripple,y:y1+s*along+c*ripple,radius,heat:1-i*.13};
  });
}

export function drawFlame(g:Graphics,x1:number,y1:number,x2:number,y2:number,t:number,lowFlash:boolean):void {
  const fade=Math.max(0,1-t),lobes=flameLobes(x1,y1,x2,y2,t);
  if(!lobes.length)return;
  const angle=Math.atan2(y2-y1,x2-x1),nx=-Math.sin(angle),ny=Math.cos(angle);
  const ribbon=(width:number,color:number,alpha:number)=>{
    const points=[x1,y1];
    for(const lobe of lobes)points.push(lobe.x+nx*lobe.radius*width,lobe.y+ny*lobe.radius*width);
    points.push(x2,y2);
    for(const lobe of [...lobes].reverse())points.push(lobe.x-nx*lobe.radius*width,lobe.y-ny*lobe.radius*width);
    g.poly(points).fill({color,alpha:alpha*fade});
  };
  ribbon(1,lowFlash?0x99532d:0xd9561b,lowFlash?.3:.5);
  ribbon(.65,lowFlash?0xb17635:0xffa12b,lowFlash?.35:.7);
  ribbon(.25,lowFlash?0xc39b54:0xffdf82,lowFlash?.4:.8);
  g.moveTo(x1,y1).lineTo(lobes[0].x,lobes[0].y).stroke({color:lowFlash?0x688b98:0x9ee6f1,width:2,alpha:fade*.8});
}

export function sawReflected(previous:Pick<ProjectileSnap,"vx"|"vy">,current:Pick<ProjectileSnap,"vx"|"vy">):boolean {
  const speed=Math.hypot(previous.vx,previous.vy)*Math.hypot(current.vx,current.vy);
  return speed>400&&(previous.vx*current.vx+previous.vy*current.vy)/speed<.9;
}

interface SawTrack {x:number;y:number;vx:number;vy:number;at:number;points:Array<{x:number;y:number}>}
export const MAX_SAW_TRACKS=64;
export const MAX_SAW_TRAIL=5;
/** Never joins incoming and outgoing trails across a bounce or a visibility gap. */
export class SawTrails {
  readonly tracks=new Map<number,SawTrack>();
  clear():void {this.tracks.clear();}
  update(projectiles:ProjectileSnap[],now:number):Array<{x:number;y:number}> {
    const impacts:Array<{x:number;y:number}>=[],seen=new Set<number>();
    for(const p of projectiles) {
      if(p.k!=="saw-launcher"&&p.k!=="saw")continue;
      seen.add(p.id);
      let track=this.tracks.get(p.id);
      if(!track||now-track.at>200) {
        track={x:p.x,y:p.y,vx:p.vx,vy:p.vy,at:now,points:[]};
        this.tracks.set(p.id,track);
      } else if(sawReflected(track,p)) {
        impacts.push({x:p.x,y:p.y});track.points=[];
      } else if(Math.hypot(track.x-p.x,track.y-p.y)>3) {
        track.points.push({x:track.x,y:track.y});
        track.points=track.points.slice(-MAX_SAW_TRAIL);
      }
      Object.assign(track,{x:p.x,y:p.y,vx:p.vx,vy:p.vy,at:now});
    }
    for(const id of this.tracks.keys())if(!seen.has(id))this.tracks.delete(id);
    while(this.tracks.size>MAX_SAW_TRACKS)this.tracks.delete(this.tracks.keys().next().value!);
    return impacts.slice(-MAX_SAW_TRACKS);
  }
}

export function drawSaw(g:Graphics,p:Pick<ProjectileSnap,"id"|"x"|"y"|"vx"|"vy">,now:number,trail:ReadonlyArray<{x:number;y:number}>,lowFlash:boolean):void {
  for(let i=0;i<trail.length;i++) {
    const start=trail[i],end=trail[i+1]??p;
    g.moveTo(start.x,start.y).lineTo(end.x,end.y).stroke({color:0x9cb6bd,width:3,alpha:(i+1)/(trail.length+1)*.28});
  }
  const rotation=now*.022+p.id,scale=SAW_RADIUS/12,teeth:number[]=[];
  for(let i=0;i<36;i++) {
    const angle=rotation+i*Math.PI/18,r=(i%3===0?12:i%3===1?8:10)*scale;
    teeth.push(p.x+Math.cos(angle)*r,p.y+Math.sin(angle)*r);
  }
  g.poly(teeth).fill(0xc2d0d4).stroke({width:1.5,color:0x425760});
  g.circle(p.x,p.y,7*scale).fill(0x586e75).stroke({width:1,color:0xf0d68d});
  for(let i=0;i<3;i++) {
    const angle=rotation+i*Math.PI*2/3;
    g.moveTo(p.x+Math.cos(angle)*3*scale,p.y+Math.sin(angle)*3*scale).lineTo(p.x+Math.cos(angle)*6*scale,p.y+Math.sin(angle)*6*scale).stroke({width:1.5,color:lowFlash?0x8caaa9:0xe8eeee});
  }
  g.circle(p.x,p.y,2.4*scale).fill(0xe6b25a);
}
/** Cosmetic shake falls to zero outside the local impact neighbourhood. */
export function explosionShake(x:number,y:number,radius:number,camera:{x:number;y:number}):number {
  if(![x,y,radius,camera.x,camera.y].every(Number.isFinite))return 0;
  const reach=Math.max(260,radius*2.5),proximity=Math.max(0,1-Math.hypot(x-camera.x,y-camera.y)/reach);
  return 9*proximity*proximity;
}

/** The same cosmetic particles drift on Lunarcy instead of falling under Earth gravity. */
export function cosmeticPosition(origin:{x:number;y:number;vx:number;vy:number},seconds:number,space:boolean) {
  return {x:origin.x+origin.vx*seconds,y:origin.y+origin.vy*seconds+(space?0:120*seconds*seconds)};
}
