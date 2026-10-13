/**
 * Real isolated-server admission/sync/persistence matrix.
 * Host-ending a short round does not prove flag traversal, balance or full gameplay.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { TestPlayer, sleep } from "../spec/lib/client.ts";
import { GAMEPLAY_VERSION } from "../src/shared/constants.ts";
import { MAPS } from "../src/shared/maps.ts";
import { Btn, type Mode, type MatchResult } from "../src/shared/types.ts";
import type { ServerMessage } from "../src/shared/protocol.ts";

const port=Number(process.env.MATRIX_PORT??8110),base="http://127.0.0.1:"+port;
const maps=["outpost","high-tower","ice-box","pyramid","lunarcy","catacombs"];
const modes:Mode[]=["ffa","tdm","flag","training","survival"];
const resultDir="test-results";mkdirSync(resultDir,{recursive:true});
try{const response=await fetch(base+"/healthz",{signal:AbortSignal.timeout(500)});if(response.ok)throw new Error("Matrix port already occupied");}
catch(error){if((error as Error).message==="Matrix port already occupied")throw error;}
const databaseDir=mkdtempSync(join(tmpdir(),"jet-reference-matrix-"));
const server=spawn(process.execPath,["--max-old-space-size=160","src/server/main.ts"],{
  env:{...process.env,PORT:String(port),DB_PATH:join(databaseDir,"matrix.db"),ACTIVE_ROOM_LIMIT:"1"},stdio:["ignore","pipe","pipe"]});
let serverLog="";server.stdout.on("data",(data:Buffer)=>{serverLog+=data.toString();});server.stderr.on("data",(data:Buffer)=>{serverLog+=data.toString();});
const cases:Record<string,unknown>[]=[],failures:string[]=[];const started=performance.now();
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message);}
async function waitReady(){for(let n=0;n<100;n++){try{if((await fetch(base+"/healthz")).ok)return;}catch{}await sleep(100);}throw new Error("Isolated server did not start");}
async function waitEmpty(){for(let n=0;n<60;n++){const h=await(await fetch(base+"/healthz")).json() as {rooms:number};if(h.rooms===0)return;await sleep(50);}throw new Error("Previous test room did not close");}
type SnapshotMessage=Extract<ServerMessage,{t:"snap"}>;
try{
  await waitReady();
  for(const map of maps)for(const mode of modes){
    const peers=[new TestPlayer(base),new TestPlayer(base)],snaps=[new Map<number,SnapshotMessage>(),new Map<number,SnapshotMessage>()];
    const errors:string[]=[];let intentionalClose=false;
    let summary:Record<string,unknown>={map,mode,pass:false};
    try{
      for(let i=0;i<2;i++){
        await peers[i].visit();await peers[i].connect();
        peers[i].ws!.on("message",data=>{const m=JSON.parse(data.toString()) as ServerMessage;
          if(m.t==="snap")snaps[i].set(m.tick,m);if(m.t==="error")errors.push(m.message);});
        peers[i].ws!.on("close",(code,reason)=>{if(!intentionalClose)errors.push("Unexpected socket close "+code+": "+reason.toString());});
      }
      const created=await peers[0].http<{code:string}>("/api/rooms",{method:"POST",body:{name:"Reference matrix "+map+" "+mode,isPublic:false,
        settings:{map,mode,capacity:mode==="training"?1:2,bots:mode==="training"?1:0,botDifficulty:"easy",durationMin:2,scoreLimit:0,
          flight:true,health:2,damage:.5,loadout:["m4","mini-eagle","rg6"],unlimitedAmmo:true}}});
      assert(created.status===201,"Room creation rejected: "+JSON.stringify(created.body));
      for(let i=0;i<2;i++){peers[i].send({t:"join",code:created.body.code,spectate:mode==="training"&&i===1});await peers[i].waitFor("room");}
      peers[0].send({t:"ready",ready:true});if(mode!=="training")peers[1].send({t:"ready",ready:true});
      await peers[0].waitFor("room",m=>m.room.members.length===2&&m.room.members.every(p=>p.spectator||p.host||p.ready));
      peers[0].send({t:"start"});const matches=await Promise.all(peers.map(p=>p.waitFor("match")));
      assert(matches[0].matchId===matches[1].matchId,"Peer match identity mismatch");
      assert(matches.every(m=>m.settings.map===map&&m.settings.mode===mode),"Server did not retain requested map/mode");
      if(map==="lunarcy")assert(matches.every(m=>m.settings.flight&&m.settings.unlimitedFuel),"Space profile not authoritative");
      const initial=await Promise.all(peers.map(p=>p.waitFor("snap")));const seq=initial.map(s=>s.ack);
      const begin=performance.now();let packets=0;
      while(performance.now()-begin<2500){
        for(let i=0;i<2;i++)if(matches[i].you!==null){
          const snapshots=[...snaps[i].values()],latest=snapshots.at(-1)??initial[i];
          const b=(packets<35?Btn.RIGHT:Btn.LEFT)|(packets%30<18?Btn.JET:0)|Btn.FIRE|Btn.CONTINUOUS_FIRE|
            (packets===20?Btn.THROW:0)|(packets===45?Btn.SLOT2:0);
          peers[i].send({t:"input",frames:[0,1].map(()=>({seq:++seq[i],b,aim:i===0?-.2:Math.PI+.2,view:latest.tick}))});
        }
        packets++;await sleep(34);
      }
      const common=[...snaps[0].keys()].filter(t=>snaps[1].has(t));
      assert(common.length>=20,"Too few matching authoritative snapshot ticks");
      for(const tick of common){
        const a=snaps[0].get(tick)!,b=snaps[1].get(tick)!;
        assert(JSON.stringify(a.ts)===JSON.stringify(b.ts),"Team scores disagree at tick "+tick);
        assert(JSON.stringify(a.scores)===JSON.stringify(b.scores),"Public scoreboard disagrees at tick "+tick);
        for(const actor of a.players){const other=b.players.find(p=>p.id===actor.id);
          if(other)assert(actor.x===other.x&&actor.y===other.y&&actor.hp===other.hp,"Common actor state diverged at tick "+tick);}
      }
      const movement=matches.map((m,i)=>{if(m.you===null)return null;const samples=[...snaps[i].values()].map(s=>s.players.find(p=>p.id===m.you)).filter(p=>p!==undefined);
        const first=samples[0],distance=Math.max(...samples.map(p=>Math.hypot(p.x-first.x,p.y-first.y)));
        assert(distance>5,"Normal movement inputs did not move fighter "+i);
        assert([...snaps[i].values()].some(s=>s.ack>0),"No fighter input acknowledgement");
        return {player:m.you,distance};});
      peers[0].send({t:"end"});const results=await Promise.all(peers.map(p=>p.waitFor("results")));
      assert(JSON.stringify(results[0].result)===JSON.stringify(results[1].result),"Result payload disagreement");
      for(let i=0;i<2;i++)if(results[i].save!=="saved")await peers[i].waitFor("save",m=>m.matchId===matches[0].matchId&&m.save==="saved");
      const result=results[0].result;
      assert(result.map===map&&result.mode===mode&&result.mapVersion===(MAPS[map].version??1)&&result.rulesVersion===GAMEPLAY_VERSION,"Result versions/map/mode missing or incorrect");
      for(let i=0;i<2;i++)if(matches[i].you!==null){
        const history=await peers[i].http<{matches:{id:string}[]}>("/api/me/matches");
        assert(history.status===200&&history.body.matches.some(m=>m.id===result.matchId),"Saved result absent from fighter history");
        const detail=await peers[i].http<{match:{result:MatchResult}}>("/api/matches/"+result.matchId);
        assert(detail.status===200&&JSON.stringify(detail.body.match.result)===JSON.stringify(result),"Persisted result differs from broadcast");
      }
      assert(errors.length===0,errors.join("; "));
      summary={...summary,pass:true,matchId:result.matchId,commonTicks:common.length,firstTick:common[0],lastTick:common.at(-1),
        movement,saved:true,mapVersion:result.mapVersion,rulesVersion:result.rulesVersion,reason:result.reason,
        note:mode==="training"?"One fighter plus independent spectator; saved history checked for fighter":"Two independent fighters"};
    }catch(error){const failure=map+"/"+mode+": "+(error as Error).message;failures.push(failure);summary={...summary,error:failure};}
    finally{intentionalClose=true;for(const p of peers)p.quit();await waitEmpty();}
    cases.push(summary);console.log(JSON.stringify({progress:cases.length,of:30,map,mode,pass:summary.pass}));
  }
}catch(error){failures.push((error as Error).message);}
finally{
  server.kill("SIGTERM");await Promise.race([once(server,"exit"),sleep(3000)]);
  if(server.exitCode===null)server.kill("SIGKILL");
  writeFileSync(join(resultDir,"oct14-reference-modes-server.log"),serverLog);
}
const report={recordedAt:new Date().toISOString(),base,elapsedSeconds:(performance.now()-started)/1000,
  scope:"Real HTTP/WebSocket admission, normal inputs, common authoritative ticks/scores, identical saved results/version fields across6maps×5modes. Host-ended short rounds do not prove flag traversal, completed survival waves or game balance.",
  requestedCases:30,passed:cases.filter(c=>c.pass).length,failures,cases};
writeFileSync(join(resultDir,"oct14-reference-modes.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({passed:report.passed,requestedCases:30,failures,elapsedSeconds:report.elapsedSeconds}));
if(failures.length)process.exitCode=1;
