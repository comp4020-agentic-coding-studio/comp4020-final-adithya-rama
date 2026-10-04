// Production-contract load/latency check. Run only against an isolated test DB.
import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { Btn } from "../src/shared/types.ts";
import { TestPlayer, sleep } from "../spec/lib/client.ts";
import { startLatencyProxy } from "./latency-proxy.ts";

const target = process.env.APP_URL ?? "http://localhost:8081";
const seconds = Number(process.env.DURATION_S ?? 60);
const roomCount = Number(process.env.ROOMS ?? 1);
const mode = process.env.LOAD_MODE ?? "ffa";
const count = mode === "survival" ? 4 : 8;
const rtt = Number(process.env.RTT_MS ?? 0);
const jitter = Number(process.env.JITTER_MS ?? 0);
const tag = process.env.REPORT_TAG ?? `${mode}-${roomCount}rooms-${rtt}ms`;
if (!Number.isFinite(seconds) || seconds < 1 || seconds > 7200 || ![1,2].includes(roomCount)) throw Error("invalid load configuration");
const proxy = rtt || jitter ? await startLatencyProxy(target, rtt, jitter) : null;
const base = proxy?.origin ?? target;
const samples: any[] = [];
const failures: string[] = [];
const ackDelays: number[] = [];
const pingTimes: number[] = [];
const clients: TestPlayer[] = [];
let completed = 0;
let packet = 0;
let active = true;
const timers = new Set<ReturnType<typeof setTimeout>>();
const groups: { host: TestPlayer; players: TestPlayer[]; code: string; seq: number[]; view: number[]; match: string; ready: boolean; ids: number[]; snap: any; maxEnemies: number; reachedEight: boolean }[] = [];
const originStart = performance.now();
const sendLater = (p: TestPlayer, msg: any) => {
  const delay = 0; // Bidirectional network delay is applied by the proxy, including heartbeat frames.
  if (!delay) { if (p.ws?.readyState === 1) p.send(msg); return; }
  const timer = setTimeout(() => { timers.delete(timer); if (active && p.ws?.readyState === 1) p.send(msg); }, delay);
  timers.add(timer);
};
const arm = (p: TestPlayer, group: typeof groups[number], i: number) => {
  p.ws!.on("message", data => {
    const m = JSON.parse(data.toString());
    if (m.t === "pong") pingTimes.push(Date.now() - m.c);
    if (m.t === "snap") {
      group.view[i] = m.tick;
      if(i===0) { group.snap=m; const enemies=m.players.filter((p:any)=>!group.ids.includes(p.id)&&(p.f&1)).length;
        group.maxEnemies=Math.max(group.maxEnemies,enemies); if(enemies>=8)group.reachedEight=true; }
      if (m.ack > 0) {
        // Observed input acknowledgement age, expressed in simulation-frame time.
        ackDelays.push(Math.max(0, (group.seq[i] - m.ack) * 1000 / 60));
        if (ackDelays.length > 10000) ackDelays.shift();
      }
    }
  });
  p.ws!.on("close", (code) => { if (active && code !== 1000) failures.push(`unexpected connection close ${code}`); });
};
async function startRound(g: typeof groups[number]) {
  g.ready = false;
  for (const p of g.players) { p.drain(); p.send({ t:"ready", ready:true }); }
  await sleep(100);
  g.host.send({ t:"start" });
  const matches = await Promise.all(g.players.map(p=>p.waitFor("match")));
  g.match = matches[0].matchId;
  if (matches.some(m=>m.matchId !== g.match)) throw Error("clients disagree on match identity");
  g.ids=matches.map(m=>m.you!); g.snap=null;
  g.seq.fill(0); g.view.fill(0); g.ready = true;
}
try {
  for (let j=0;j<roomCount;j++) {
    const players: TestPlayer[] = [];
    for (let i=0;i<count;i++) {
      const p = new TestPlayer(base); clients.push(p); players.push(p);
      await p.visit();
      await p.http("/api/me",{method:"PATCH",body:{name:`Probe-${j}-${i}`}});
      await p.connect();
    }
    const host = players[0];
    const created = await host.http<{code:string}>("/api/rooms", {method:"POST", body:{
      isPublic:false, name:`Acceptance ${mode} ${j}`, settings:{
        mode, capacity:count, durationMin:2, bots:0, unlimitedAmmo:true, unlimitedFuel:true,
        loadout:mode === "survival" ? ["phasr","minigun"] : j % 2 ? ["smaw","rg6"] : ["minigun","saw-launcher"], health:2, damage:0.5,
        ...(mode === "survival" ? {map:"crosscurrent",flight:false,botDifficulty:"easy"} : {}),
        scoreLimit:0
      }
    }});
    if (created.status !== 201) throw Error(`create room failed: ${JSON.stringify(created.body)}`);
    const g = {host,players,code:created.body.code,seq:players.map(()=>0),view:players.map(()=>0),match:"",ready:false,ids:[] as number[],snap:null as any,maxEnemies:0,reachedEight:false};
    groups.push(g);
    for (let i=0;i<players.length;i++) {
      const p=players[i]; arm(p,g,i);
      p.send({t:"join",code:g.code});
      await p.waitFor("room");
    }
    await startRound(g);
  }
  const start=performance.now();
  let nextSample=start;
  let nextInput=start;
  while(performance.now()-start < seconds*1000) {
    const now=performance.now();
    for(const g of groups) {
      const result=g.host.inbox.find(m=>m.t==="results");
      if(result?.t==="results") {
        const save=await g.host.waitFor("save",m=>m.matchId===result.result.matchId,15000);
        if(save.save!=="saved") throw Error("match result did not save");
        completed++;
        g.host.send({t:"rematch"});
        await g.host.waitFor("room",m=>m.room.state==="lobby");
        await startRound(g);
      }
    }
    if(now >= nextInput) {
      nextInput=now+1000/30;
      for(const g of groups) if(g.ready) for(let i=0;i<g.players.length;i++){
        const n=g.seq[i];
        const cycle=Math.floor(n/240)%2;
        let b=(cycle?Btn.LEFT:Btn.RIGHT)|((n%16<12)?Btn.FIRE:0)|((n%180<120)?Btn.JET:0)|
          ((n%100<2)?Btn.THROW:0)|((n%240<2)?Btn.SWITCH:0)|((n%80<2)?Btn.PICKUP:0);
        let aim=Math.sin(n/80+i)*Math.PI;
        if(mode==="survival" && g.snap) {
          const me=g.snap.players.find((p:any)=>p.id===g.ids[i]);
          const enemies=g.snap.players.filter((p:any)=>!g.ids.includes(p.id)&&(p.f&1));
          if(me && enemies.length) {
            const foe=enemies.sort((a:any,b:any)=>Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y))[0];
            aim=Math.atan2(foe.y-me.y,foe.x-me.x);
            const holding=(g.snap.survival?.wave??0)>=2 && !g.reachedEight;
            b=(Math.abs(foe.x-me.x)>700 ? (foe.x>me.x?Btn.RIGHT:Btn.LEFT):0)|Btn.PICKUP;
            if(!holding && n%16<14)b|=Btn.FIRE;
            if(n%80<2)b|=Btn.THROW;
          }
        }
        sendLater(g.players[i],{t:"input",frames:[0,1].map(()=>({seq:++g.seq[i],b,
          aim, view:Math.max(0,g.view[i]-6)}))});
        // Keep result/save notifications while shedding high-frequency snapshots.
        g.players[i].inbox=g.players[i].inbox.filter(m=>m.t==="results"||m.t==="save"||m.t==="error").slice(-100);
      }
    }
    if(now>=nextSample) {
      nextSample=now+5000;
      for (const g of groups) g.host.send({t:"ping",c:Date.now()});
      const res=await fetch(new URL("/healthz",base));
      if(!res.ok) throw Error("health check failed");
      const s=await res.json();
      samples.push({seconds:Math.round((now-start)/1000),...s});
      if(s.rssMb>=200) failures.push(`RSS exceeded target: ${s.rssMb} MB`);
      if(s.stepP95Ms>=8) failures.push(`simulation p95 exceeded target: ${s.stepP95Ms} ms`);
      if(samples.length%12===0) console.log(JSON.stringify({progressSeconds:Math.round((now-start)/1000),mode,rooms:roomCount,...s}));
    }
    await sleep(5);
  }
  for(const g of groups){
    if(!g.host.inbox.some(m=>m.t==="results")) g.host.send({t:"end"});
    const result=await g.host.waitFor("results");
    const save=await g.host.waitFor("save",m=>m.matchId===result.result.matchId,15000);
    if(save.save!=="saved") throw Error("final save failed");
    for(const p of g.players) {
      const history=await p.http<any>("/api/me/matches");
      if(!history.body.matches.some((m:any)=>m.id===result.result.matchId)) throw Error("result missing from participant history");
    }
    completed++;
  }
} catch(e) {
  failures.push((e as Error).stack ?? String(e));
} finally {
  active=false;
  for(const t of timers) clearTimeout(t);
  for(const p of clients) p.quit();
  await sleep(150);
  if (proxy) await proxy.close();
}
const sorted=ackDelays.sort((a,b)=>a-b);
const report={
  base:target,mode,roomCount,playersPerRoom:count,requestedSeconds:seconds,elapsedSeconds:Math.round((performance.now()-originStart)/1000),
  syntheticRttMs:rtt,jitterMs:jitter,completedMatches:completed,
  latencyMethod:proxy ? "ordered bidirectional WebSocket and heartbeat proxy" : "direct localhost",
  measuredPingP95Ms:pingTimes.sort((a,b)=>a-b)[Math.floor(pingTimes.length*.95)]??null,
  peakEnemiesPerRoom:groups.map(g=>g.maxEnemies),
  samples, maxRssMb:Math.max(0,...samples.map(s=>s.rssMb)),
  maxStepP95Ms:Math.max(0,...samples.map(s=>s.stepP95Ms)),
  ackFrameAgeP95Ms:sorted[Math.floor(sorted.length*0.95)]??null,
  failures:[...new Set(failures)]
};
mkdirSync("test-results",{recursive:true});
writeFileSync(`test-results/${tag}.json`,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({...report,samples:report.samples.length}));
if(failures.length) process.exitCode=1;
