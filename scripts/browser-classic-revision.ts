// Current-app UI/network acceptance for the researched Classic PC revision.
// Dedicated guests and private rooms only. No game-state injection or debug hooks.
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium,type Page} from "playwright";
import {TestPlayer} from "../spec/lib/client.ts";
import type {Profile,RoomView} from "../src/shared/protocol.ts";
import type {PlayerSnap,WorldSnapshot} from "../src/shared/types.ts";
import type {TouchLayout} from "../src/shared/touch-layout.ts";
const base=process.env.APP_URL??"http://localhost:8104",out="test-results/"+(process.env.REPORT_TAG??"oct14-classic-revision");
const mapIds=["outpost","high-tower","ice-box","pyramid","lunarcy","catacombs"];
mkdirSync(out,{recursive:true});const failures:string[]=[],checks:unknown[]=[],browser=await chromium.launch();
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test:()=>boolean,label:string,ms=12000){const end=Date.now()+ms;while(!test()){if(Date.now()>end)throw Error("Timed out: "+label);await delay(25);}}
function observe(page:Page,tag:string){
  const state={room:null as RoomView|null,you:null as number|null,snap:null as WorldSnapshot|null,saved:false,matchId:""};
  page.on("pageerror",e=>failures.push(tag+": "+e.message));page.on("console",m=>{if(m.type()==="error")failures.push(tag+": "+m.text());});
  page.on("websocket",ws=>ws.on("framereceived",({payload})=>{try{const m=JSON.parse(String(payload));if(m.t==="room")state.room=m.room;if(m.t==="match"){state.you=m.you;state.matchId=m.matchId;state.snap=null;state.saved=false;}if(m.t==="snap")state.snap=m;if(m.t==="save"&&m.save==="saved"||m.t==="results"&&m.save==="saved")state.saved=true;}catch{}}));
  return state;
}
type Observed=ReturnType<typeof observe>;
function own(state:Observed):PlayerSnap {const p=state.snap?.players.find(p=>p.id===state.you);assert.ok(p,"authoritative own player");return p;}
async function profile(page:Page):Promise<Profile>{const response=await page.request.get(base+"/api/me");assert.equal(response.status(),200);return(await response.json()).profile;}
async function savedPref(page:Page,test:(prefs:Record<string,unknown>)=>boolean,label:string):Promise<Profile>{const end=Date.now()+5000;let p=await profile(page);while(!test(p.prefs)&&Date.now()<end){await delay(80);p=await profile(page);}assert.ok(test(p.prefs),label);return p;}
async function fit(page:Page,label:string){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+" horizontal overflow");}
async function tap(page:Page,key:string){await page.keyboard.down(key);await delay(80);await page.keyboard.up(key);await delay(80);}
async function field(page:Page,mobile:boolean){if(mobile)await page.getByRole("button",{name:"Menu",exact:true}).click();else await page.keyboard.press("Escape");await page.getByRole("button",{name:"Resume",exact:true}).waitFor();}
async function create(page:Page,map:string,mode="training"){
  const response=await page.request.post(base+"/api/rooms",{data:{name:"Classic revision "+map,isPublic:false,settings:{mode,map,bots:0,capacity:mode==="training"?1:2,durationMin:2,health:2,damage:.5,loadout:["smaw","m93ba","uzi"],mapPickups:false,unlimitedFuel:map==="lunarcy",flight:map!=="lunarcy"}}});
  assert.equal(response.status(),201,await response.text());const code=(await response.json()).code as string;
  await page.goto(base+"/r/"+code);await page.getByRole("button",{name:"Join room",exact:true}).click();await page.locator("#start").waitFor();return code;
}
async function start(page:Page,state:Observed,observer:TestPlayer,code:string){
  observer.drain();observer.send({t:"join",code,spectate:true});await observer.waitFor("room",m=>m.room.code===code);
  await page.locator("#start:not(:disabled)").click();const joined=await observer.waitFor("match");await observer.waitFor("snap");await page.locator("canvas").waitFor();await until(()=>state.matchId===joined.matchId&&!!state.snap,"matching browser/observer match");await delay(300);assert.equal(joined.you,null,"independent observer remains spectator");return joined;
}
async function finish(page:Page,state:Observed,observer:TestPlayer,mobile:boolean){
  await field(page,mobile);await page.getByRole("button",{name:"End round now",exact:true}).click();
  await page.getByText("Results saved to your match history.",{exact:true}).waitFor();await until(()=>state.saved,"browser saved result");
  await observer.waitFor("results");observer.send({t:"leave"});await observer.waitFor("left");
  await page.getByRole("button",{name:"Leave room",exact:true}).click();await page.locator("#practice").waitFor();
}
async function scope(page:Page,mobile:boolean){if(mobile)await page.getByRole("button",{name:"Scope",exact:true}).click();else await tap(page,"KeyZ");}
async function selectSlot(page:Page,state:Observed,slot:number,mobile:boolean){if(mobile)await page.getByRole("button",{name:"Slot "+(slot+1),exact:true}).click();else await tap(page,"Digit"+(slot+1));await until(()=>own(state).a===slot,"slot "+slot);}
async function scopeProof(page:Page,state:Observed,mobile:boolean){
  assert.equal(own(state).s[0],"smaw");await scope(page,mobile);
  await savedPref(page,p=>(p.scopes as Record<string,number>|undefined)?.smaw===1,"first SMAW scope saved");
  if(!mobile){await page.keyboard.down("KeyZ");await delay(650);await page.keyboard.up("KeyZ");}else await scope(page,true);
  await savedPref(page,p=>(p.scopes as Record<string,number>|undefined)?.smaw===2,"one held press changes scope once");
  await page.locator(".loadout-heading").filter({hasText:"Far scope"}).waitFor();
  await selectSlot(page,state,1,mobile);await page.locator(".loadout-heading").filter({hasText:"Near scope"}).waitFor();await scope(page,mobile);
  await savedPref(page,p=>(p.scopes as Record<string,number>|undefined)?.m93ba===1,"sniper independently saves scope");
  await selectSlot(page,state,0,mobile);await page.locator(".loadout-heading").filter({hasText:"Far scope"}).waitFor();
}
async function nextRulesProof(page:Page,state:Observed,mobile:boolean){
  await field(page,mobile);await page.getByRole("button",{name:"Next-round rules",exact:true}).click();
  const modal=page.locator("dialog[data-next-rules]");await modal.waitFor();
  const control=(key:string)=>modal.locator('[data-setting="'+key+'"]');
  await control("mode").selectOption("tdm");await until(()=>state.room?.nextSettings?.mode==="tdm","next-round TDM acknowledged");
  await modal.locator('[data-setting="capacity"]:not(:disabled) option[value="2"]').waitFor({state:"attached"});
  assert.equal(await control("capacity").locator("option").evaluateAll(els=>Math.min(...els.map(el=>Number((el as HTMLOptionElement).value)))),2);
  assert.equal(await control("map").locator('option[value="test-range"]').count(),0,"PvP excludes Test Range");
  await control("map").selectOption("lunarcy");await until(()=>state.room?.nextSettings?.map==="lunarcy","next-round Lunarcy acknowledged");
  await modal.locator('[data-setting="gravity"]:disabled').waitFor();
  assert.match(await control("gravity").textContent()??"",/Zero gravity/);
  for(const key of ["flight","unlimitedFuel"]){assert.equal(await control(key).isDisabled(),true);assert.equal(await control(key).isChecked(),true);}
  await control("mode").selectOption("survival");await until(()=>state.room?.nextSettings?.mode==="survival","next-round Survival acknowledged");
  await modal.locator('[data-setting="bots"]:disabled').waitFor();
  assert.deepEqual(await control("capacity").locator("option").evaluateAll(els=>els.map(el=>Number((el as HTMLOptionElement).value))),[1,2,3,4]);
  assert.equal(await control("bots").inputValue(),"0");
  await control("mode").selectOption("training");await until(()=>state.room?.nextSettings?.mode==="training","next-round Training acknowledged");
  await modal.locator('[data-setting="map"] option[value="test-range"]').waitFor({state:"attached"});
  assert.equal(await control("capacity").isDisabled(),true);
  await control("map").selectOption("outpost");await until(()=>state.room?.nextSettings?.map==="outpost","next-round terrestrial map acknowledged");
  await modal.locator('[data-setting="gravity"]:not(:disabled)').waitFor();
  await control("gravity").selectOption("0.5");await until(()=>state.room?.nextSettings?.gravity===.5,"next-round gravity acknowledged");
  assert.equal(await control("flight").isDisabled(),false);assert.equal(await control("unlimitedFuel").isDisabled(),false);
  assert.equal(state.room?.settings.mode,"training","staged rules leave current mode unchanged");assert.equal(state.room?.settings.map,"outpost","staged rules leave current map unchanged");assert.equal(state.room?.settings.gravity,1,"staged rules leave current gravity unchanged");
  await fit(page,(mobile?"phone":"desktop")+" next-round rules");await page.screenshot({path:out+"/"+(mobile?"phone":"desktop")+"-next-round-rules.png",fullPage:true});
  await modal.getByRole("button",{name:"Close dialog",exact:true}).click();await page.getByRole("button",{name:"Resume",exact:true}).click();
  checks.push({viewport:mobile?"phone":"desktop",nextRoundRules:{pvpMinimum2:true,survivalBotsDisabled:true,trainingRangeRestored:true,lunarcyForcedRules:true,terrestrialGravityRestored:true,currentRoundUnchanged:true}});
}
async function touchProof(page:Page,state:Observed):Promise<TouchLayout>{
  await field(page,true);await page.getByRole("button",{name:"Arrange touch controls",exact:true}).click();await page.getByRole("dialog",{name:"Arrange touch controls"}).waitFor();
  const throwing=await page.locator('[data-control="throw"]').boundingBox();assert.ok(throwing);await page.mouse.move(throwing.x+throwing.width/2,throwing.y+throwing.height/2);await page.mouse.down();await page.mouse.move(88,320,{steps:10});await page.mouse.up();
  await page.locator("[data-layout-size]").fill("1.1");await page.locator("[data-layout-opacity]").fill("0.65");
  await page.screenshot({path:out+"/phone-touch-editor.png"});
  const grenadesBefore={...own(state).throwables};await page.getByRole("button",{name:"Save layout",exact:true}).click();
  const p=await savedPref(page,p=>{const l=p.touchLayout as TouchLayout|undefined;return l?.scale===1.1&&l.opacity===.65&&!!l.positions.throw;},"touch layout saved to server profile");
  await delay(200);assert.deepEqual(own(state).throwables,grenadesBefore,"dragging never throws a grenade");
  await selectSlot(page,state,2,true);await selectSlot(page,state,0,true);return p.prefs.touchLayout as TouchLayout;
}
try{
 for(const mobile of [false,true]){
  const tag=mobile?"phone":"desktop",context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1}),page=await context.newPage(),state=observe(page,tag),observer=new TestPlayer(base);
  let savedLayout:TouchLayout|null=null;
  try{
    await observer.visit();await observer.connect();await observer.waitFor("welcome");
    await page.goto(base);await page.locator("#profile-button").click();await page.locator("#profile-form").waitFor();
    await page.locator('#profile-form input[name="name"]').fill("Revision "+tag);await page.locator('input[name="lowFlash"]').check();await page.locator('input[name="reducedBlood"]').check();
    await page.locator("#profile-form").getByRole("button",{name:"Save",exact:true}).click();await savedPref(page,p=>p.lowFlash===true&&p.reducedBlood===true,"accessibility preferences saved");
    await page.reload();await page.locator("#profile-button").click();assert.equal(await page.locator('input[name="lowFlash"]').isChecked(),true);assert.equal(await page.locator('input[name="reducedBlood"]').isChecked(),true);await fit(page,tag+" profile");await page.screenshot({path:out+"/"+tag+"-profile.png"});await page.locator("[data-close-profile]").click();
    // Lobby contract first, with room settings accepted by an independent socket.
    const rulesCode=await create(page,"lunarcy","tdm");observer.send({t:"join",code:rulesCode,spectate:true});await observer.waitFor("room",m=>m.room.code===rulesCode);
    const capacity=await page.locator('[data-setting="capacity"] option').evaluateAll(els=>els.map(el=>Number((el as HTMLOptionElement).value)));assert.equal(Math.min(...capacity),2);
    await page.locator(".advanced-rules summary").click();assert.equal(await page.locator('[data-setting="flight"]').isDisabled(),true);assert.equal(await page.locator('[data-setting="flight"]').isChecked(),true);assert.equal(await page.locator('[data-setting="unlimitedFuel"]').isDisabled(),true);assert.equal(await page.locator('[data-setting="unlimitedFuel"]').isChecked(),true);
    await page.getByText("SPACE RULES",{exact:false}).waitFor();assert.equal(await page.locator('.advanced-rules input[value="Zero gravity"]').isDisabled(),true);
    await page.locator('[data-setting="mode"]').selectOption("survival");const survival=await observer.waitFor("room",m=>m.room.settings.mode==="survival");assert.equal(survival.room.settings.bots,0);await page.locator('[data-setting="bots"]:disabled').waitFor();assert.equal(await page.locator('[data-setting="bots"]').isDisabled(),true);assert.deepEqual(await page.locator('[data-setting="capacity"] option').evaluateAll(els=>els.map(el=>Number((el as HTMLOptionElement).value))),[1,2,3,4]);await fit(page,tag+" rules");await page.screenshot({path:out+"/"+tag+"-space-rules.png",fullPage:true});
    observer.send({t:"leave"});await observer.waitFor("left");await page.locator("#leave").click();await page.locator("#practice").waitFor();checks.push({viewport:tag,pvpMinimum2:true,survivalBotSettingDisabled:true,lunarcyFuelFlightForced:true,accessibilityReload:true});
    for(const [index,map] of mapIds.entries()){
      const code=await create(page,map);const options=await page.locator('[data-setting="map"] option').evaluateAll(els=>els.map(el=>(el as HTMLOptionElement).value));assert.ok(mapIds.every(id=>options.includes(id)),"six referenced arenas selectable");
      await page.locator(".lobby-map-preview").screenshot({path:out+"/"+tag+"-"+map+"-lobby.png"});
      const match=await start(page,state,observer,code);assert.equal(match.settings.map,map);assert.equal(await page.locator(".weapon-card[data-slot]").count(),3);
      if(index===0){
        await scopeProof(page,state,mobile);
        if(mobile)savedLayout=await touchProof(page,state);
        await field(page,mobile);assert.equal(await page.locator("[data-blood]").isChecked(),true);assert.equal(await page.locator("[data-flash]").isChecked(),true);await page.getByRole("button",{name:"Resume",exact:true}).click();
        for(let n=0;own(state).throwable!=="flash"&&n<5;n++){if(mobile)await page.getByRole("button",{name:"Type",exact:true}).click();else await tap(page,"KeyT");await delay(90);}
        assert.equal(own(state).throwable,"flash");await tap(page,"ArrowDown");
        if(mobile)await page.getByRole("button",{name:"Throw",exact:true}).click();else await tap(page,"KeyG");
        await until(()=>own(state).flash>0,"real flashbang exposure",6000);await until(()=>own(state).flashStrength>0,"nonzero flash strength");
        const flash=page.locator('[data-el="flash"]');await page.waitForFunction(()=>{const el=document.querySelector<HTMLElement>('[data-el="flash"]');return el&&Number(getComputedStyle(el).opacity)>0;});
        assert.equal(await flash.evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(38, 44, 50)");await page.screenshot({path:out+"/"+tag+"-dark-flash.png"});await until(()=>own(state).flash===0,"flash expires",6000);
        await nextRulesProof(page,state,mobile);
      }else if(index===1){
        const p=await profile(page);assert.deepEqual(p.prefs.scopes,{smaw:2,m93ba:1});await page.locator(".loadout-heading").filter({hasText:"Far scope"}).waitFor();
        if(mobile){assert.deepEqual(p.prefs.touchLayout,savedLayout);const throwBox=await page.locator('[data-control="throw"]').boundingBox();assert.ok(throwBox&&Math.abs(throwBox.x+throwBox.width/2-88)<2&&Math.abs(throwBox.y+throwBox.height/2-320)<2,"touch placement restored after reload");assert.equal(await page.locator('[data-control="throw"]').evaluate(el=>getComputedStyle(el).opacity),"0.65");}
      }
      await fit(page,tag+" "+map);await page.screenshot({path:out+"/"+tag+"-"+map+"-game.png"});
      checks.push({viewport:tag,map,matchId:match.matchId,independentObserver:true,threeWeaponCards:true});
      await finish(page,state,observer,mobile);
      if(index===0){await page.reload();await page.locator("#practice").waitFor();}
    }
  }catch(error){await page.screenshot({path:out+"/"+tag+"-failure.png",fullPage:true}).catch(()=>{});throw error;}finally{
    // On a failed assertion, use the normal host menu to end a possible round.
    try{if(await page.locator("canvas").count()){if(!await page.getByRole("button",{name:"End round now",exact:true}).isVisible())await field(page,mobile);await page.getByRole("button",{name:"End round now",exact:true}).click();await page.getByText("Results saved to your match history.",{exact:true}).waitFor({timeout:5000});}if(await page.getByRole("button",{name:"Leave room",exact:true}).count())await page.getByRole("button",{name:"Leave room",exact:true}).click();}catch{}
    observer.quit();await context.close();
  }
 }
}catch(error){failures.push((error as Error).stack??String(error));}
finally{await browser.close();}
writeFileSync(out+"/report.json",JSON.stringify({at:new Date().toISOString(),base,browser:browser.version(),checks,failures,limits:"Production app at the recorded base URL, real UI actions and independently observed server settings/snapshots. Emulated viewports; no physical-device or subjective game-feel claim."},null,2));console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;
