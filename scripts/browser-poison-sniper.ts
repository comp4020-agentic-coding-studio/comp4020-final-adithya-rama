// Real firing/throw inputs, independent guests and authoritative outcomes.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { TestPlayer, sleep } from "../spec/lib/client.ts";
import { Btn, PF, type GameEvent, type WorldSnapshot } from "../src/shared/types.ts";

const base=process.env.APP_URL??"http://localhost:8112";
const out="test-results/"+(process.env.REPORT_TAG??"poison-sniper-local");
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),checks:unknown[]=[],errors:string[]=[];
async function checkViewport(mobile:boolean){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage(),ally=new TestPlayer(base),enemy=new TestPlayer(base);
  let snap:WorldSnapshot|null=null,you=-1,seq=0;
  const events:GameEvent[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("websocket",ws=>ws.on("framereceived",({payload})=>{
    const m=JSON.parse(String(payload));
    if(m.t==="match")you=m.you;
    if(m.t==="snap"){snap=m;events.push(...m.events);}
  }));
  const actor=(id:number)=>snap!.players.find(p=>p.id===id)!;
  async function until(test:()=>boolean,label:string,ms=15000){
    const end=Date.now()+ms;
    while(!test()){if(Date.now()>end)throw Error(label);await sleep(30);}
  }
  async function tap(key:string){await page.keyboard.down(key);await sleep(100);await page.keyboard.up(key);}
  async function move(guest:TestPlayer,id:number,x:number){
    const timer=setInterval(()=>{
      const p=actor(id),b=Math.abs(p.x-x)>6?(p.x<x?Btn.RIGHT:Btn.LEFT):0;
      guest.send({t:"input",frames:[{seq:++seq,b,aim:0},{seq:++seq,b,aim:0}]});
    },34);
    try{await until(()=>Math.abs(actor(id).x-x)<8,"walk into range");}
    finally{clearInterval(timer);guest.send({t:"input",frames:[{seq:++seq,b:0,aim:0}]});}
  }
  try{
    await page.goto(base);await page.locator("#practice").waitFor();
    const res=await page.request.post(base+"/api/rooms",{data:{name:"Sniper and poison check",isPublic:false,settings:{
      mode:"tdm",map:"test-range",bots:0,durationMin:2,randomSpawns:false,friendlyFire:false,
      mapPickups:false,loadout:["m93ba",null,null],throwables:["gas"],
    }}});
    assert.equal(res.status(),201);const {code}=await res.json();
    await page.goto(base+"/r/"+code+"?renderProbe=1");
    await page.getByRole("button",{name:"Join room",exact:true}).click();
    await page.locator("#start").waitFor();
    if(await page.locator('[data-team="0"]').count())await page.locator('[data-team="0"]').click();
    for(const [guest,name,team] of [[ally,"Poison Ally",0],[enemy,"Poison Opponent",1]] as const){
      await guest.visit();await guest.http("/api/me",{method:"PATCH",body:{name}});
      await guest.connect();await guest.waitFor("welcome");
      guest.send({t:"join",code});await guest.waitFor("room",m=>m.room.code===code);
      guest.send({t:"team",team});await guest.waitFor("room",m=>m.room.members.some(p=>p.key===m.room.you&&p.team===team));
      guest.send({t:"ready",ready:true});await guest.waitFor("room",m=>m.room.members.some(p=>p.key===m.room.you&&p.ready));
    }
    await page.locator("#start:not(:disabled)").click();
    const a=await ally.waitFor("match"),e=await enemy.waitFor("match");
    await until(()=>!!snap?.players.find(p=>p.id===you),"own snapshot");
    const x=actor(you).x,direction=x>900?-1:1;
    await move(enemy,e.you!,x+direction*220);
    await until(()=>!(actor(e.you!).f&PF.PROTECTED),"enemy spawn protection expires");
    assert.equal(actor(e.you!).hp,100);
    await tap(direction===1?"ArrowRight":"ArrowLeft");await tap("KeyJ");
    await until(()=>events.some(ev=>ev.t==="kill"&&ev.victim===e.you&&ev.killer===you),"single sniper hit kills");
    assert.equal(events.filter(ev=>ev.t==="shot"&&ev.by===you&&ev.w==="m93ba").length,1);
    assert.equal(actor(you).mag,4);
    checks.push({mobile,sniper:"one shot killed a 100 HP unshielded opponent",match:e.matchId});
    await until(()=>!!(actor(e.you!).f&PF.ALIVE)&&!(actor(e.you!).f&PF.PROTECTED),"opponent respawn");
    await Promise.all([move(ally,a.you!,x+direction*45),move(enemy,e.you!,x+direction*90)]);
    const ids=[you,a.you!,e.you!],before=ids.map(id=>actor(id).hp);
    await tap("ArrowDown");
    if(mobile)await page.getByRole("button",{name:"Throw",exact:true}).click();
    else await tap("KeyG");
    await until(()=>!!snap?.areas.length,"poison grenade creates cloud");
    await until(()=>ids.every((id,i)=>actor(id).hp<before[i]),"owner, ally and opponent all take poison damage");
    const after=ids.map(id=>actor(id).hp);
    await page.screenshot({path:`${out}/${mobile?"phone":"desktop"}-cloud-1.png`});
    await sleep(700);
    await page.screenshot({path:`${out}/${mobile?"phone":"desktop"}-cloud-2.png`});
    const clouds=await page.evaluate(()=>((window as any).__jetRenderProbe.config.poisonClouds));
    assert.ok(clouds>0);checks.push({mobile,poison:{friendlyFire:false,before,after,renderedClouds:clouds}});
    assert.deepEqual(errors,[]);
  }finally{
    try{
      if(mobile)await page.getByRole("button",{name:"Menu",exact:true}).click();
      else await page.keyboard.press("Escape");
      await page.getByRole("button",{name:"End round now",exact:true}).click({timeout:3000});
      await page.getByText("Results saved to your match history.",{exact:true}).waitFor({timeout:5000});
      await page.getByRole("button",{name:"Leave room",exact:true}).click();
    }catch{}
    ally.quit();enemy.quit();await context.close();
  }
}
try{for(const mobile of [false,true])await checkViewport(mobile);}
finally{await browser.close();}
writeFileSync(out+"/report.json",JSON.stringify({base,at:new Date().toISOString(),checks,errors},null,2));
console.log(JSON.stringify({base,checks,errors}));
