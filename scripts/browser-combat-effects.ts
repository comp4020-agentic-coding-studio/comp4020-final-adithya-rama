// Real browser controls plus an independent guest, against the running production build.
// APP_URL=http://localhost:8131 REPORT_TAG=combat-effects-local mise exec -- node scripts/browser-combat-effects.ts
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
import {TestPlayer,sleep} from "../spec/lib/client.ts";
import {Btn,PF,type GameEvent,type WorldSnapshot} from "../src/shared/types.ts";
const base=process.env.APP_URL??"http://localhost:8131",out="test-results/"+(process.env.REPORT_TAG??"combat-effects-local");
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),checks:unknown[]=[],errors:string[]=[];
try {
for(const mobile of [false,true]) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage(),target=new TestPlayer(base),cdp=await context.newCDPSession(page);
  const events:GameEvent[]=[];let snap:WorldSnapshot|null=null,you=-1,seq=0,enemy=-1;
  page.on("pageerror",e=>errors.push(e.message));
  page.on("websocket",ws=>ws.on("framereceived",({payload})=>{
    const m=JSON.parse(String(payload));if(m.t==="match")you=m.you;
    if(m.t==="snap"){snap=m;events.push(...m.events);}
  }));
  const actor=(id:number)=>snap!.players.find(p=>p.id===id)!;
  async function until(test:()=>boolean,label:string,ms=15000){const end=Date.now()+ms;while(!test()){if(Date.now()>end)throw Error(label);await sleep(20);}}
  async function move(x:number) {
    const timer=setInterval(()=>{const p=actor(enemy),b=Math.abs(p.x-x)>6?(p.x<x?Btn.RIGHT:Btn.LEFT):0;target.send({t:"input",frames:[{seq:++seq,b,aim:0},{seq:++seq,b,aim:0}]});},34);
    try{await until(()=>Math.abs(actor(enemy).x-x)<8,"target walks into position");}
    finally{clearInterval(timer);target.send({t:"input",frames:[{seq:++seq,b:0,aim:0}]});}
    await sleep(150);
  }
  async function shoot(direction:number,ms:number,capture?:string) {
    if(mobile) {
      const rect=await page.locator('[data-control="aim"]').boundingBox();assert.ok(rect);
      const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
      await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{id:1,x,y,radiusX:2,radiusY:2}]});
      await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{id:1,x:x+direction*rect.width*.45,y,radiusX:2,radiusY:2}]});
      await sleep(ms);if(capture)await page.screenshot({path:out+"/"+(mobile?"phone":"desktop")+"-"+capture+".png"});await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    } else {
      await page.keyboard.press(direction>0?"ArrowRight":"ArrowLeft");
      await page.keyboard.down("KeyJ");await sleep(ms);if(capture)await page.screenshot({path:out+"/"+(mobile?"phone":"desktop")+"-"+capture+".png"});await page.keyboard.up("KeyJ");
    }
  }
  async function slot(n:number) {if(mobile)await page.getByRole("button",{name:"Slot "+n,exact:true}).click();else await page.keyboard.press("Digit"+n);await sleep(150);}
  const probe=()=>page.evaluate(()=>((window as any).__jetRenderProbe.config));
  try {
    await page.goto(base);await page.locator("#practice").waitFor();
    await page.request.patch(base+"/api/me",{data:{prefs:{reducedShake:true,reducedBlood:false,lowFlash:false,muted:true,aimAssist:false}}});
    const response=await page.request.post(base+"/api/rooms",{data:{name:"Combat visual acceptance",isPublic:false,settings:{mode:"tdm",map:"test-range",bots:0,randomSpawns:false,mapPickups:false,durationMin:2,loadout:["smaw","flamethrower","saw-launcher"],unlimitedAmmo:true}}});
    assert.equal(response.status(),201);const{code}=await response.json();
    await page.goto(base+"/r/"+code+"?renderProbe=1");await page.getByRole("button",{name:"Join room",exact:true}).click();await page.locator("#start").waitFor();
    await target.visit();await target.http("/api/me",{method:"PATCH",body:{name:"Effects Target"}});await target.connect();await target.waitFor("welcome");
    target.send({t:"join",code});await target.waitFor("room",m=>m.room.code===code);target.send({t:"team",team:1});await target.waitFor("room",m=>m.room.members.some(p=>p.key===m.room.you&&p.team===1));
    target.send({t:"ready",ready:true});await target.waitFor("room",m=>m.room.members.some(p=>p.key===m.room.you&&p.ready));
    await page.locator("#start:not(:disabled)").click();const match=await target.waitFor("match");enemy=match.you!;
    await until(()=>!!snap?.players.find(p=>p.id===you),"first gameplay snapshot");
    await page.locator(".match-loading").waitFor({state:"hidden"});
    const x=actor(you).x,direction=x>900?-1:1;
    await move(x+direction*220);await until(()=>!(actor(enemy).f&PF.PROTECTED),"spawn protection");
    await shoot(direction,180);
    await until(()=>events.some(e=>e.t==="kill"&&e.victim===enemy&&e.w==="smaw"),"rocket eliminates target");
    const firstShot=events.find(e=>e.t==="shot"&&e.by===you&&e.w==="smaw");
    assert.ok(firstShot?.t==="shot");assert.equal(Math.sign(firstShot.x2-firstShot.x1),direction,"first rocket uses the new aim immediately");
    await page.waitForFunction(()=>Number((window as any).__jetRenderProbe?.config.peakDeathDebris)>0);
    await page.screenshot({path:out+"/"+(mobile?"phone":"desktop")+"-rocket.png"});
    const rocket=await probe();assert.ok(rocket.peakDeathDebris>=9);assert.ok(rocket.peakDeathDebris<=96);
    await until(()=>!!(actor(enemy).f&PF.ALIVE)&&!(actor(enemy).f&PF.PROTECTED),"target respawns");
    await move(x+direction*125);await slot(2);
    const hp=actor(enemy).hp;await shoot(direction,650,"flame");

    const flame=await probe();assert.ok(flame.peakFlames>0);assert.ok(actor(enemy).hp<hp);
    await slot(3);await shoot(-direction,750);
    await until(()=>!!snap?.projectiles.some(p=>p.k==="saw-launcher"),"launched saw");
    await page.screenshot({path:out+"/"+(mobile?"phone":"desktop")+"-saw.png"});
    const saw=await probe();assert.ok(saw.peakSaws>0);assert.ok(saw.peakFx<=180);
    await page.getByRole("button",{name:mobile?"Menu":"Menu / Esc",exact:true}).click();
    await page.locator("[data-flash]").check();await page.locator("[data-blood]").check();
    await page.getByRole("button",{name:"Resume",exact:true}).click();
    await sleep(100);const reduced=await probe();assert.equal(reduced.effects.lowFlash,true);assert.equal(reduced.effects.reducedBlood,true);
    checks.push({mobile,match:match.matchId,rocketDebris:rocket.peakDeathDebris,flamePulses:flame.peakFlames,saws:saw.peakSaws,peakFx:saw.peakFx,reduced:reduced.effects});
  }catch(error){checks.push({mobile,error:String(error),players:(snap as WorldSnapshot|null)?.players.map(p=>({id:p.id,x:p.x,y:p.y,aim:p.aim,hp:p.hp,mag:p.mag,slot:p.a})),events:events.slice(-15)});throw error;}finally {
    try{await page.getByRole("button",{name:mobile?"Menu":"Menu / Esc",exact:true}).click();await page.getByRole("button",{name:"End round now",exact:true}).click({timeout:3000});await page.getByText("Results saved to your match history.",{exact:true}).waitFor({timeout:5000});await page.getByRole("button",{name:"Leave room",exact:true}).click();}catch{}
    target.quit();await context.close();
  }
}
assert.deepEqual(errors,[]);
}catch(error){errors.push(String(error));throw error;}finally{await browser.close();writeFileSync(out+"/report.json",JSON.stringify({base,at:new Date().toISOString(),checks,errors},null,2));}
console.log(JSON.stringify({base,checks,errors}));