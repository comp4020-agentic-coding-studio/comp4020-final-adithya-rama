import type { MapDefinition, Rect } from "./types.ts";
import { overlaps } from "./physics.ts";

export const rect=(x:number,y:number,w:number,h:number):Rect=>({x,y,w,h});
export type Point=readonly[number,number];

/** Quantised authored contour. The same exact union is painted and collided.
 * Horizontal bands cap vertical risers at 20px, including irregular ground. */
export function contour(points:Point[],step=20):Rect[] {
  const result:Rect[]=[];
  const top=Math.floor(Math.min(...points.map(p=>p[1]))/step)*step;
  const bottom=Math.ceil(Math.max(...points.map(p=>p[1]))/step)*step;
  for(let y=top;y<bottom;y+=step) {
    const scan=y+step/2, xs:number[]=[];
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length];
      if((a[1]<=scan&&b[1]>scan)||(b[1]<=scan&&a[1]>scan)) xs.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }
    xs.sort((a,b)=>a-b);
    for(let i=0;i+1<xs.length;i+=2) {
      const x=Math.round(xs[i]),right=Math.round(xs[i+1]);
      if(right>x)result.push(rect(x,y,right-x,step));
    }
  }
  return mergeBands(result);
}
function mergeBands(rs:Rect[]):Rect[] {
  const result:Rect[]=[];
  for(const r of rs) {
    const prev=result.find(p=>p.x===r.x&&p.w===r.w&&p.y+p.h===r.y);
    if(prev)prev.h+=r.h;else result.push({...r});
  }
  return result;
}

/** Carve actual passages out of terrain, never only paint a door over a wall. */
export function carve(solids:Rect[],holes:Rect[]):Rect[] {
  let out=solids;
  for(const h of holes)out=out.flatMap(s=>{
    if(!overlaps(s,h))return[s];
    const x=Math.max(s.x,h.x),right=Math.min(s.x+s.w,h.x+h.w);
    const y=Math.max(s.y,h.y),bottom=Math.min(s.y+s.h,h.y+h.h);
    return[rect(s.x,s.y,s.w,y-s.y),rect(s.x,bottom,s.w,s.y+s.h-bottom),
      rect(s.x,y,x-s.x,bottom-y),rect(right,y,s.x+s.w-right,bottom-y)].filter(r=>r.w>0&&r.h>0);
  });
  return mergeBands(out);
}

export function clearBody(solids:Rect[],x:number,y:number,height=44):boolean {
  return !solids.some(s=>overlaps(rect(x-12,y-height,24,height),s));
}
export function landing(solids:Rect[],x:number,near:number):{x:number;y:number} {
  const levels:{x:number;y:number;cost:number}[]=[];
  for(const dx of [0,-16,16,-32,32,-48,48])for(const s of solids) {
    const xx=x+dx;
    if(xx-12>=s.x&&xx+12<=s.x+s.w&&clearBody(solids,xx,s.y))
      levels.push({x:xx,y:s.y,cost:Math.abs(s.y-near)+Math.abs(dx)*2});
  }
  levels.sort((a,b)=>a.cost-b.cost);
  if(!levels.length)throw Error("No clear landing at "+x+","+near);
  return{x:levels[0].x,y:levels[0].y};
}
/** Surface nodes plus clear air junctions. Bots filter unsupported nodes when
 * flight is disabled, so the graph does not invent a walkable air bridge. */
export function navigation(map:Pick<MapDefinition,"solids"|"width"|"height"|"physics">):{x:number;y:number}[] {
  const out:{x:number;y:number}[]=[];
  const add=(x:number,y:number)=>{
    if(x<24||x>map.width-24||y<50||y>map.height-20||!clearBody(map.solids,x,y))return;
    if(map.physics!=="space"&&!map.solids.some(s=>x>=s.x&&x<=s.x+s.w&&s.y>=y-1))return;
    if(!out.some(p=>Math.abs(p.x-x)<48&&Math.abs(p.y-y)<18))out.push({x,y});
  };
  for(const s of map.solids)if(s.w>=28) {
    add(s.x+18,s.y);add(s.x+s.w-18,s.y);
    for(let x=s.x+80;x<s.x+s.w-40;x+=150)add(x,s.y);
  }
  for(const s of map.solids)if(s.w>=60&&s.h>=25) {
    for(const x of [s.x-20,s.x+s.w+20])for(const y of [s.y-24,s.y,s.y+64])add(x,y);
  }
  // Sparse junctions are sufficient because graph edges retain full-body LOS.
  for(let y=140;y<map.height-60;y+=180)for(let x=110;x<map.width-40;x+=180)add(x,y);
  return out;
}
