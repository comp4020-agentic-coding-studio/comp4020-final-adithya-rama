// A browser and two independent scripted guests. No injected render/game state.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { TestPlayer, sleep } from "../spec/lib/client.ts";
import { Btn, type WorldSnapshot } from "../src/shared/types.ts";

const base=process.env.APP_URL??"http://localhost:8111";
const out="test-results/"+(process.env.REPORT_TAG??"nameplates-local");
mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const errors:string[]=[],checks:unknown[]=[];
async function checkViewport(size:{width:number;height:number}) {
const mobile=size.width===390;
const context=await browser.newContext({viewport:size,hasTouch:mobile,isMobile:mobile});
const page=await context.newPage();
const ally=new TestPlayer(base),enemy=new TestPlayer(base);
let snap:WorldSnapshot|null=null,you=-1;
page.on("pageerror",e=>errors.push(e.message));
page.on("websocket",ws=>ws.on("framereceived",({payload})=>{
  const m=JSON.parse(String(payload));
  if(m.t==="match")you=m.you;
  if(m.t==="snap")snap=m;
}));
async function until(test:()=>boolean,label:string,ms=15000){
  const end=Date.now()+ms;
  while(!test()){if(Date.now()>end)throw Error(label);await sleep(30);}
}
type Plate={id:number;text:string;color:number;visible:boolean;fontPixels:number;width:number;height:number;x:number;y:number};
async function plates():Promise<Plate[]>{
  return page.evaluate(()=>((window as any).__jetRenderProbe.config.nameplates??[]));
}
async function moveGuest(guest:TestPlayer,id:number,x:number){
  let seq=0;
  const timer=setInterval(()=>{
    const p=snap?.players.find(p=>p.id===id);
    const b=p&&Math.abs(p.x-x)>6?(p.x<x?Btn.RIGHT:Btn.LEFT):0;
    guest.send({t:"input",frames:[{seq:++seq,b,aim:0},{seq:++seq,b,aim:0}]});
  },34);
  try{await until(()=>Math.abs((snap?.players.find(p=>p.id===id)?.x??-10000)-x)<8,"guest walks into view");}
  finally{clearInterval(timer);guest.send({t:"input",frames:[{seq:++seq,b:0,aim:0}]});}
}
try{
  await page.goto(base);await page.locator("#practice").waitFor();
  const res=await page.request.post(base+"/api/rooms",{data:{name:"Readable teams",isPublic:false,settings:{
    mode:"tdm",map:"test-range",bots:0,durationMin:2,randomSpawns:false,mapPickups:false,loadout:["uzi",null,null],
  }}});
  assert.equal(res.status(),201);
  const {code}=await res.json();
  await page.goto(base+"/r/"+code+"?renderProbe=1");
  await page.getByRole("button",{name:"Join room",exact:true}).click();
  await page.locator("#start").waitFor();
  if(await page.locator('[data-team="0"]').count())await page.locator('[data-team="0"]').click();
  for(const [guest,name,team] of [[ally,"Friendly Pilot",0],[enemy,"Opposing Pilot",1]] as const){
    await guest.visit();
    assert.equal((await guest.http("/api/me",{method:"PATCH",body:{name}})).status,200);
    await guest.connect();await guest.waitFor("welcome");
    guest.send({t:"join",code});await guest.waitFor("room",m=>m.room.code===code);
    guest.send({t:"team",team});
    await guest.waitFor("room",m=>m.room.members.some(p=>p.key===m.room.you&&p.team===team));
    guest.send({t:"ready",ready:true});
    await guest.waitFor("room",m=>m.room.members.some(p=>p.key===m.room.you&&p.ready));
  }
  await page.locator("#start:not(:disabled)").click();
  const a=await ally.waitFor("match"),e=await enemy.waitFor("match");
  await until(()=>!!snap?.players.find(p=>p.id===you),"own snapshot");
  const host=snap!.players.find(p=>p.id===you)!;
  // Keep all three actors in the open ground-floor part of this small arena.
  const targets=host.x<900?[host.x+100,host.x+220]:[host.x-100,host.x-220];
  await Promise.all([moveGuest(ally,a.you!,targets[0]),moveGuest(enemy,e.you!,targets[1])]);
    await sleep(700);
    for(const scope of ["Near","Far"]){
      if(scope==="Far")for(let i=0;i<2;i++){
        if(mobile)await page.getByRole("button",{name:"Scope",exact:true}).click();
        else {await page.keyboard.down("KeyZ");await sleep(100);await page.keyboard.up("KeyZ");}
        await sleep(100);
      }
      await sleep(500);
      const tags=await plates(),friendly=tags.find(p=>p.id===a.you)!,hostile=tags.find(p=>p.id===e.you)!;
      assert.ok(friendly?.visible&&hostile?.visible);
      assert.equal(friendly.color,0x8ff0ac);assert.equal(hostile.color,0xff8b91);
      assert.match(friendly.text,/^ALLY · Friendly Pilot/);assert.match(hostile.text,/^ENEMY · Opposing/);
      for(const tag of [friendly,hostile]){
        assert.ok(Math.abs(tag.fontPixels-13)<.01,"fixed CSS font size");
        assert.ok(tag.width<220,"bounded plate width");
      }
      const visible=tags.filter(p=>p.visible);
      for(const tag of visible)for(const other of visible.filter(p=>p.id!==tag.id)){
        assert.ok(Math.abs(tag.x-other.x)>(tag.width+other.width)/2||
          tag.y<other.y-other.height||tag.y-tag.height>other.y,"nameplates do not overlap");
      }
      checks.push({viewport:size,scope,tags});
      await page.screenshot({path:`${out}/${size.width}-${scope}.png`});
    }
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
try{
  for(const size of [{width:1920,height:1080},{width:390,height:844}])await checkViewport(size);
}finally{await browser.close();}
writeFileSync(out+"/report.json",JSON.stringify({base,at:new Date().toISOString(),checks,errors},null,2));
console.log(JSON.stringify({base,viewChecks:checks.length,errors}));
