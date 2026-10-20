import { heightOf, lineOfSight, rayRect } from "../shared/physics.ts";
import { PF, type MapDefinition, type PlayerSnap, type Team } from "../shared/types.ts";
import { PLAYER_W } from "../shared/constants.ts";
import { WEAPONS } from "../shared/weapons.ts";

export interface AimTarget { id:number; x:number; y:number; crouch:boolean; enemy:boolean; alive:boolean; protected:boolean }
/** Match the displayed interpolation time without retaining any revoked visibility. */
export function visibleAimTargets(rendered:Iterable<PlayerSnap>,current:readonly PlayerSnap[],
  teams:ReadonlyMap<number,{team:Team}>,you:number,teamMode:boolean):AimTarget[] {
  const allowed=new Map(current.map(p=>[p.id,p])),mine=teams.get(you);
  return [...rendered].filter(p=>p.id!==you&&allowed.has(p.id)&&teams.has(p.id)).map(p=>{
    const latest=allowed.get(p.id)!;
    return {id:p.id,x:p.x,y:p.y,crouch:!!(p.f&PF.CROUCH),alive:!!(p.f&PF.ALIVE)&&!!(latest.f&PF.ALIVE),
      protected:!!(latest.f&PF.PROTECTED),
      enemy:!!mine&&!(teamMode&&mine.team!==-1&&mine.team===teams.get(p.id)!.team)};
  });
}
/** Stateless, bounded correction. Caller supplies only currently server-authorized actors.
 * Never accumulates corrections, predicts hidden motion, fires, or changes a deliberate hit.
 */
export function assistedAim(raw:number,origin:{x:number;y:number},weapon:string|null,
  targets:readonly AimTarget[],map:MapDefinition,enabled:boolean):number {
  const def=WEAPONS[weapon??""];
  if(!enabled||!def||!["hitscan","beam","emp"].includes(def.behavior))return raw;
  const candidates=targets.filter(t=>t.enemy&&t.alive&&!t.protected);
  const dx=Math.cos(raw),dy=Math.sin(raw);
  // Preserve precise manual shots, including headshots, rather than pulling them to the chest.
  if(candidates.some(t=>{
    const h=heightOf(t),distance=rayRect(origin.x,origin.y,dx,dy,{x:t.x-PLAYER_W/2,y:t.y-h,w:PLAYER_W,h});
    return distance<=def.range&&lineOfSight(map,origin.x,origin.y,origin.x+dx*distance,origin.y+dy*distance);
  }))return raw;
  const cone=(def.category==="precision"?2:6)*Math.PI/180;
  let best=cone,correction=0,bestId=Infinity;
  for(const t of candidates) {
    const y=t.y-heightOf(t)*.55,distance=Math.hypot(t.x-origin.x,y-origin.y);
    if(distance<35||distance>def.range||!lineOfSight(map,origin.x,origin.y,t.x,y))continue;
    const delta=Math.atan2(Math.sin(Math.atan2(y-origin.y,t.x-origin.x)-raw),Math.cos(Math.atan2(y-origin.y,t.x-origin.x)-raw));
    if(Math.abs(delta)<best||Math.abs(delta)===best&&t.id<bestId) {
      best=Math.abs(delta);bestId=t.id;
      correction=delta*.25; // At most 1.5 degrees; precision weapons at most 0.5 degrees.
    }
  }
  return raw+correction;
}
