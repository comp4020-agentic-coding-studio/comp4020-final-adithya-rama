/** Cold navigation + warm maximum-survival-shape CPU probe; no network/DB/render. */
import { mkdir, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { Bot } from "../src/server/bot.ts";
import { planBotRoute } from "../src/server/bot-navigation.ts";
import { MAPS } from "../src/shared/maps.ts";
import { defaultSettings, sanitizeSettings } from "../src/shared/settings.ts";
import { addPlayer, createWorld, stepWorld } from "../src/shared/sim.ts";
import { Btn, type InputFrame } from "../src/shared/types.ts";
const ids=["outpost","high-tower","ice-box","pyramid","lunarcy","catacombs"];
const ticks=Math.min(3600,Math.max(180,Number(process.env.PROBE_TICKS)||1800));
const percentile=(values:number[],q:number)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))]??0;};
const summarize=(values:number[])=>({firstMs:values[0]??0,p50Ms:percentile(values,.5),p95Ms:percentile(values,.95),maxMs:Math.max(...values)});
const cold:Record<string,unknown>[]=[],samples:Record<string,unknown>[]=[];
const start=performance.now();let peakRss=process.memoryUsage().rss;
for(const id of ids){
  for(const flight of MAPS[id].physics==="space"?[true]:[false,true]){
    const map={...MAPS[id]},settings=sanitizeSettings({...defaultSettings(),map:id,flight});
    const a=map.flagHomes[0],b=map.flagHomes[1];
    const t=performance.now();const route=planBotRoute(map,settings,a,b);const coldMs=performance.now()-t;
    const warm:number[]=[];for(let n=0;n<10;n++){const t=performance.now();planBotRoute(map,settings,a,b);warm.push(performance.now()-t);}
    cold.push({map:id,flight,solids:map.solids.length,nodes:map.navNodes.length,routeNodes:route.length,coldMs,warm:summarize(warm)});
  }
  for(const weapon of ["minigun","rg6"]){
    const settings=sanitizeSettings({...defaultSettings(),map:id,mode:"survival",capacity:4,durationMin:15,scoreLimit:0,
      loadout:[weapon,null,null],unlimitedAmmo:true,health:2,damage:.5,flight:true,botDifficulty:"hard",
      throwables:["frag","flash","gas","emp","mine"]});
    const w=createWorld(settings,42);
    for(let i=0;i<4;i++)addPlayer(w,{id:w.nextId++,key:"probe-human-"+i,name:"Probe",team:0,color:i,bot:false});
    // Start a valid eight-enemy wave directly for measurement, without timing
    // earlier waves. Gameplay rules perform every spawn; no actors are injected.
    Object.assign(w.survival!,{wave:9,cleared:8,toSpawn:8,remaining:8,nextSpawnTick:w.tick+1,nextWaveTick:0});
    for(let n=0;n<600&&[...w.players.values()].filter(p=>p.bot&&p.alive).length<8;n++){stepWorld(w,new Map());w.events=[];}
    const initialBots=[...w.players.values()].filter(p=>p.bot&&p.alive).length;
    if(initialBots!==8)throw new Error(id+" failed to prepare eight live enemies");
    const bots=new Map<number,Bot>(),brain:number[]=[],simulation:number[]=[],total:number[]=[];
    let peakBots=0,peakPlayers=0,peakProjectiles=0,shots=0;
    for(let n=0;n<ticks&&!w.over;n++){
      const begin=performance.now(),inputs=new Map<number,InputFrame>();
      for(const p of w.players.values())if(p.bot&&!bots.has(p.id))bots.set(p.id,new Bot(p.id,"hard"));
      const thinkStart=performance.now();
      for(const bot of bots.values())inputs.set(bot.playerId,bot.think(w));
      brain.push(performance.now()-thinkStart);
      for(const p of w.players.values())if(!p.bot){
        const target=[...w.players.values()].filter(o=>o.bot&&o.alive).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
        let b=Btn.FIRE|Btn.CONTINUOUS_FIRE;
        if(n%30===0)b|=Btn.THROW|Btn.NEXT_THROWABLE;
        if(n%360<180)b|=p.id%2?Btn.LEFT:Btn.RIGHT;else b|=p.id%2?Btn.RIGHT:Btn.LEFT;
        if(n%180<60)b|=Btn.JET;
        inputs.set(p.id,{seq:n+1,b,aim:target?Math.atan2(target.y-p.y,target.x-p.x):0});
      }
      const simStart=performance.now();stepWorld(w,inputs);simulation.push(performance.now()-simStart);
      total.push(performance.now()-begin);
      peakBots=Math.max(peakBots,[...w.players.values()].filter(p=>p.bot&&p.alive).length);
      peakPlayers=Math.max(peakPlayers,[...w.players.values()].filter(p=>p.alive).length);
      peakProjectiles=Math.max(peakProjectiles,w.projectiles.length);
      shots+=w.events.filter(e=>e.t==="shot").length;w.events=[];
    }
    const memory=process.memoryUsage();peakRss=Math.max(peakRss,memory.rss);
    samples.push({map:id,weapon,measuredTicks:total.length,initialBots,peakBots,peakPlayers,peakProjectiles,shots,
      wave:w.survival!.wave,overReason:w.overReason,brain:summarize(brain),simulation:summarize(simulation),
      total:summarize(total),rssBytes:memory.rss});
  }
}
const report={recordedAt:new Date().toISOString(),runtime:process.version,cpu:cpus()[0]?.model,logicalCpus:cpus().length,
  limits:"No CPU/memory quota; Node old-space160MB",note:"Direct wave9 setup, then real server bot brains and shared simulation with4human input streams/8enemy maximum. First brain tick may construct caches. Cold route tests use fresh map identities. Excludes network, DB, rendering; not capacity proof.",
  elapsedMs:performance.now()-start,peakSampledRssBytes:peakRss,cold,samples};
await mkdir("test-results",{recursive:true});const output="test-results/oct14-bot-probe.json";
await writeFile(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({output,elapsedMs:report.elapsedMs,peakSampledRssBytes:peakRss,
  worstCold:[...cold].sort((a,b)=>Number(b.coldMs)-Number(a.coldMs)).slice(0,3),
  worstWarm:[...samples].sort((a,b)=>Number((b.total as {p95Ms:number}).p95Ms)-Number((a.total as {p95Ms:number}).p95Ms)).slice(0,3)},null,2));
