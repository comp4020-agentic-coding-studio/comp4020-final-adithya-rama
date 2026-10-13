import { setImmediate as yieldTurn } from "node:timers/promises";
import { GRAVITY, JUMP_SPEED } from "../shared/constants.ts";
import { lineOfSight } from "../shared/physics.ts";
import type { MapDefinition, RoomSettings } from "../shared/types.ts";

type Node={x:number;y:number};
type Edge={to:number;cost:number};
type Graph={nodes:Node[];edges:Edge[][]};
const graphs=new WeakMap<MapDefinition,Map<string,Graph>>();
const supported=(map:MapDefinition,p:Node):boolean=>[...map.solids,...map.platforms].some(s=>
  Math.abs(p.y-s.y)<.1&&p.x>=s.x+10&&p.x<=s.x+s.w-10);
const destinations=new WeakMap<MapDefinition,Node[]>();
export function botDestinations(map:MapDefinition):Node[]{
  let nodes=destinations.get(map);
  if(!nodes){nodes=map.navNodes.filter(p=>map.physics==="space"||supported(map,p));if(!nodes.length)nodes=map.navNodes;destinations.set(map,nodes);}
  return nodes;
}
const flight=(map:MapDefinition,s:RoomSettings)=>map.physics==="space"||s.flight;
function edgeAllowed(map:MapDefinition,s:RoomSettings,a:Node,b:Node):boolean {
  const flying=flight(map,s),dx=Math.abs(b.x-a.x),rise=a.y-b.y;
  if(dx>540||Math.abs(rise)>600||rise>(flying?500:JUMP_SPEED**2/(2*GRAVITY*s.gravity)*.94))return false;
  // Ground movement can jump its feet over a lip. Flight sweeps the whole
  // standing body, preventing shortcuts through the corner of a rock island.
  for(const h of flying?[2,23,43.5]:[23,44])for(const xx of flying?[-10.5,10.5]:[0])
    if(!lineOfSight(map,a.x+xx,a.y-h,b.x+xx,b.y-h))return false;
  if(!flying&&dx>60) {
    // A short drop may be intentional. Do not plan a long walk over empty air.
    for(let x=Math.min(a.x,b.x)+30;x<Math.max(a.x,b.x)-20;x+=40){
      const y=a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);
      if(!map.solids.some(r=>x>=r.x&&x<=r.x+r.w&&r.y>=y-45&&r.y<y+140))return false;
    }
  }
  return true;
}
const flyingAir=(map:MapDefinition,s:RoomSettings,p:Node)=>flight(map,s)&&!supported(map,p);
const pendingGraphs=new WeakMap<MapDefinition,Map<string,Promise<void>>>();
const graphKey=(map:MapDefinition,s:RoomSettings)=>flight(map,s)?"flight":"ground:"+s.gravity;
function cacheFor(map:MapDefinition):Map<string,Graph>{
  let cache=graphs.get(map);if(!cache){cache=new Map();graphs.set(map,cache);}return cache;
}
function emptyGraph(map:MapDefinition,s:RoomSettings):Graph{
  const nodes=map.navNodes.filter(p=>flight(map,s)||supported(map,p));
  return {nodes,edges:nodes.map(()=>[])};
}
function connectNode(map:MapDefinition,s:RoomSettings,graph:Graph,i:number):void{
  const {nodes,edges}=graph;
  const candidates=nodes.map((p,j)=>({j,d:Math.hypot(p.x-nodes[i].x,p.y-nodes[i].y)}))
    .filter(c=>c.j!==i&&c.d<640).sort((a,b)=>a.d-b.d).slice(0,80);
  for(const {j,d}of candidates)if(edgeAllowed(map,s,nodes[i],nodes[j]))
    edges[i].push({to:j,cost:d+Math.max(0,nodes[i].y-nodes[j].y)*.4+(map.physics!=="space"&&flyingAir(map,s,nodes[j])?280:0)});
}
function graphFor(map:MapDefinition,s:RoomSettings):Graph {
  const cache=cacheFor(map),key=graphKey(map,s),found=cache.get(key);if(found)return found;
  const graph=emptyGraph(map,s);
  for(let i=0;i<graph.nodes.length;i++)connectNode(map,s,graph,i);
  cache.set(key,graph);return graph;
}
async function prewarmGraph(map:MapDefinition,s:RoomSettings):Promise<void>{
  const cache=cacheFor(map),key=graphKey(map,s);if(cache.has(key))return;
  let pending=pendingGraphs.get(map);if(!pending){pending=new Map();pendingGraphs.set(map,pending);}
  const existing=pending.get(key);if(existing)return existing;
  const building=(async()=>{
    const graph=emptyGraph(map,s);
    // Work is prepared before match announcement in small event-loop turns.
    // Publish only complete graphs; active route queries never see partial edges.
    for(let i=0;i<graph.nodes.length;){
      await yieldTurn();
      const started=performance.now();
      do {connectNode(map,s,graph,i++);}
      while(i<graph.nodes.length&&performance.now()-started<4);
    }
    cache.set(key,graph);
  })();
  pending.set(key,building);
  try{await building;}finally{pending.delete(key);}
}
/** At most four legal ground-gravity variants plus one flight graph per map. */
export async function prewarmBotNavigation(map:MapDefinition,s:RoomSettings):Promise<void>{
  if(!map.version)return; // Original arenas use the legacy local planner.
  botDestinations(map);
  if(map.physics!=="space")await prewarmGraph(map,{...s,flight:false});
  if(flight(map,s))await prewarmGraph(map,s);
}
export function botNavigationCacheStats(map:MapDefinition):{variants:number;nodes:number;edges:number}{
  const values=[...(graphs.get(map)?.values()??[])];
  return {variants:values.length,nodes:values.reduce((n,g)=>n+g.nodes.length,0),
    edges:values.reduce((n,g)=>n+g.edges.reduce((m,list)=>m+list.length,0),0)};
}

/** Map-only A*; no targets or player states are cached. */
export function planBotRoute(map:MapDefinition,s:RoomSettings,start:Node,goal:Node):Node[] {
  if(edgeAllowed(map,s,start,goal))return[goal];
  const graph=graphFor(map,s),count=graph.nodes.length;
  const nodes=[...graph.nodes,start,goal],end=count+1;
  const links=(a:Node,reverse=false)=>graph.nodes.map((p,i)=>({to:i,cost:Math.hypot(p.x-a.x,p.y-a.y)}))
    .filter(e=>e.cost<640).sort((a,b)=>a.cost-b.cost).slice(0,80)
    .filter(e=>reverse?edgeAllowed(map,s,nodes[e.to],a):edgeAllowed(map,s,a,nodes[e.to]));
  const initial=links(start),final=new Map(links(goal,true).map(e=>[e.to,e.cost]));
  const dist=new Float64Array(nodes.length).fill(Infinity),prev=new Int32Array(nodes.length).fill(-1);
  const open=new Set<number>([count]);dist[count]=0;
  while(open.size){
    let at=-1,best=Infinity;
    for(const i of open){const f=dist[i]+Math.hypot(nodes[i].x-goal.x,nodes[i].y-goal.y);if(f<best){best=f;at=i;}}
    if(at===end)break;
    if(at<0)break;
    open.delete(at);
    const edges=at===count?initial:graph.edges[at];
    for(const e of [...edges,...(final.has(at)?[{to:end,cost:final.get(at)!}]:[])]){
      const cost=dist[at]+e.cost;
      if(cost<dist[e.to]){dist[e.to]=cost;prev[e.to]=at;open.add(e.to);}
    }
  }
  if(prev[end]<0)return[];
  const route:Node[]=[];let at=end;
  while(at!==count){route.unshift(nodes[at]);at=prev[at];if(at<0)return[];}
  return route;
}
