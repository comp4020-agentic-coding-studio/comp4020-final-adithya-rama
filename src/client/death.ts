import type { MapDefinition } from "../shared/types.ts";
import { rayRect, playerTravelBounds } from "../shared/physics.ts";

export interface CameraPoint { x:number; y:number }
export interface CameraActor extends CameraPoint { id:number; alive:boolean; connected?:boolean }

/** A death camera never transfers to an unrelated pilot or a respawned killer. */
export class DeathCamera {
  private killer:number|null=null;
  private point:CameraPoint|null=null;
  private following=true;
  died(victim:CameraPoint & {id:number},attacker:number|null):void {
    this.killer=attacker===victim.id?null:attacker;
    this.point={x:victim.x,y:victim.y};
    this.following=true;
  }
  reset():void {this.killer=null;this.point=null;this.following=true;}
  stopFollowing():void {this.following=false;}
  resolve(localAlive:boolean,actors:CameraActor[]):{point:CameraPoint;killer:number|null;following:boolean}|null {
    if(localAlive){this.reset();return null;}
    if(!this.point)return null;
    if(this.killer!==null&&this.following) {
      const killer=actors.find(p=>p.id===this.killer);
      if(killer?.alive&&killer.connected!==false)this.point={x:killer.x,y:killer.y};
      else this.following=false;
    }
    return {point:{...this.point},killer:this.killer,following:this.killer!==null&&this.following};
  }
}

export type DebrisKind="helmet"|"head"|"vest"|"arm"|"leg"|"boot"|"blood";
export interface DeathDebris {
  kind:DebrisKind;
  x:number;y:number;vx:number;vy:number;
  angle:number;spin:number;
  radius:number;color:number;
  age:number;ttl:number;
  settled:boolean;
}
export const MAX_DEATH_DEBRIS=96;
export function isRocketDeath(weapon:string):boolean {return weapon==="smaw";}

export function rocketDebris(
  victim:{id:number;x:number;y:number;vx:number;vy:number;height:number},
  colors:{armor:number;skin:number;helmet:number},
  reduced:boolean,
  impact?:CameraPoint,
):DeathDebris[] {
  if(reduced)return [];
  let seed=(victim.id*1664525+Math.round(victim.x)*1013904223+Math.round(victim.y))>>>0;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const body:Array<{kind:DebrisKind;ox:number;oy:number;radius:number;color:number}>=[
    {kind:"helmet",ox:0,oy:-victim.height+3,radius:7,color:colors.helmet},
    {kind:"head",ox:0,oy:-victim.height+10,radius:7,color:colors.skin},
    {kind:"vest",ox:0,oy:-victim.height*.52,radius:8,color:colors.armor},
    {kind:"arm",ox:-8,oy:-victim.height*.49,radius:4,color:colors.skin},
    {kind:"arm",ox:8,oy:-victim.height*.49,radius:4,color:colors.skin},
    {kind:"leg",ox:-5,oy:-victim.height*.25,radius:5,color:colors.armor},
    {kind:"leg",ox:5,oy:-victim.height*.25,radius:5,color:colors.armor},
    {kind:"boot",ox:-6,oy:-5,radius:4,color:0x34433a},
    {kind:"boot",ox:6,oy:-5,radius:4,color:0x34433a},
  ];
  for(let i=0;i<10;i++)body.push({kind:"blood",ox:(random()-.5)*10,oy:-victim.height*.55,radius:1.6,color:0x9d493b});
  const source=impact??{x:victim.x,y:victim.y-victim.height*.48};
  return body.map((p,i)=>{
    const dx=victim.x+p.ox-source.x,dy=victim.y+p.oy-source.y;
    const distance=Math.hypot(dx,dy),a=distance>2?Math.atan2(dy,dx):(i/body.length)*Math.PI*2;
    const speed=150+random()*170;
    return ({
    ...p,x:victim.x+p.ox,y:victim.y+p.oy,
    vx:victim.vx*.25+Math.cos(a)*speed+(random()-.5)*55,
    vy:victim.vy*.15+Math.sin(a)*speed-80,
    angle:random()*Math.PI*2,spin:(random()-.5)*12,
    age:0,ttl:p.kind==="blood"?1700:2900+random()*350,settled:false,
  });});
}
export function appendDebris(current:DeathDebris[],added:DeathDebris[]):DeathDebris[] {
  return [...current,...added].slice(-MAX_DEATH_DEBRIS);
}

/** Cosmetic small-body motion, with swept solid and one-way platform contact. */
export function advanceDebris(parts:DeathDebris[],elapsedMs:number,map:Pick<MapDefinition,"solids"|"platforms"|"width"|"height"|"physics">):DeathDebris[] {
  const elapsed=Number.isFinite(elapsedMs)?Math.max(0,elapsedMs):0;
  for(const p of parts) {
    p.age+=elapsed;
    if(p.age>=p.ttl||p.settled)continue;
    let left=Math.min(250,elapsed)/1000;
    while(left>0) {
      const dt=Math.min(1/120,left);left-=dt;
      p.vy+=(map.physics==="space"?0:640)*dt;
      const dx=p.vx*dt,dy=p.vy*dt;
      let t=1,nx=0,ny=0;
      for(const solid of map.solids) {
        const r={x:solid.x-p.radius,y:solid.y-p.radius,w:solid.w+p.radius*2,h:solid.h+p.radius*2};
        const hit=rayRect(p.x,p.y,dx,dy,r);
        if(hit<0||hit>t)continue;
        const hx=p.x+dx*hit,hy=p.y+dy*hit;
        const faces=[{distance:Math.abs(hx-r.x),x:-1,y:0},{distance:Math.abs(hx-r.x-r.w),x:1,y:0},{distance:Math.abs(hy-r.y),x:0,y:-1},{distance:Math.abs(hy-r.y-r.h),x:0,y:1}];
        faces.sort((a,b)=>a.distance-b.distance);
        t=hit;nx=faces[0].x;ny=faces[0].y;
      }
      if(dy>0)for(const floor of map.platforms) {
        const hit=(floor.y-p.radius-p.y)/dy;
        const hx=p.x+dx*hit;
        if(p.y+p.radius<=floor.y+.01&&hit>=0&&hit<=t&&hx+p.radius>floor.x&&hx-p.radius<floor.x+floor.w) {t=hit;nx=0;ny=-1;}
      }
      p.x+=dx*t+nx*.02;p.y+=dy*t+ny*.02;
      p.angle+=p.spin*dt;
      if(nx||ny) {
        if(p.kind==="blood"){p.vx=0;p.vy=0;p.spin=0;p.settled=true;break;}
        if(nx)p.vx=-p.vx*.28;
        if(ny) {p.vy=Math.abs(p.vy)<45?0:-p.vy*.28;p.vx*=.67;}
        p.spin*=.65;
        if(ny===-1&&p.vy===0&&Math.abs(p.vx)<6){p.settled=true;p.vx=0;p.spin=0;break;}
      }
    }
  }
  const bounds=playerTravelBounds(map);
  return parts.filter(p=>p.age<p.ttl&&p.x>bounds.x-80&&p.x<bounds.x+bounds.w+80&&p.y>bounds.y-80&&p.y<bounds.y+bounds.h+80);
}
