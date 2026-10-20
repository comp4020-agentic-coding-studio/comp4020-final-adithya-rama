// Production-app acceptance against the reported base URL. Reads the existing renderer probe; all actor
// motion and setting changes use ordinary UI/input, never injected game state.
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium,type Page} from "playwright";
import {MAPS} from "../src/shared/maps.ts";
import {playerTravelBounds} from "../src/shared/physics.ts";
import {PF,type PlayerSnap,type WorldSnapshot} from "../src/shared/types.ts";
import type {RoomView} from "../src/shared/protocol.ts";
import {TestPlayer} from "../spec/lib/client.ts";
const base=process.env.APP_URL??"http://localhost:8107",out="test-results/"+(process.env.REPORT_TAG??"oct21-crit10-gameplay");
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),failures:string[]=[],checks:unknown[]=[];
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test:()=>boolean|Promise<boolean>,label:string,ms=15000){const end=Date.now()+ms;while(!await test()){if(Date.now()>end)throw Error("Timed out: "+label);await delay(30);}}
async function tap(page:Page,key:string){await page.keyboard.down(key);await delay(90);await page.keyboard.up(key);await delay(100);}
async function camera(page:Page){return page.evaluate(()=>((window as unknown as {__jetRenderProbe:{config:{camera:{x:number;y:number}}}}).__jetRenderProbe.config.camera));}
async function menu(page:Page,mobile:boolean){if(mobile)await page.getByRole("button",{name:"Menu",exact:true}).click();else await page.keyboard.press("Escape");await page.getByRole("button",{name:"Resume",exact:true}).waitFor();}
try{
 for(const mobile of [false,true]){
  const tag=mobile?"phone":"desktop",context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1}),page=await context.newPage(),observer=new TestPlayer(base);
  const state={room:null as RoomView|null,snap:null as WorldSnapshot|null,you:null as number|null,matchId:""};
  const me=():PlayerSnap=>{const p=state.snap?.players.find(p=>p.id===state.you);assert.ok(p,"own authoritative player");return p;};
  page.on("pageerror",e=>failures.push(tag+": "+e.message));page.on("console",m=>{if(m.type()==="error")failures.push(tag+": "+m.text());});
  page.on("websocket",ws=>ws.on("framereceived",({payload})=>{const m=JSON.parse(String(payload));if(m.t==="room")state.room=m.room;if(m.t==="match"){state.you=m.you;state.matchId=m.matchId;state.snap=null;}if(m.t==="snap")state.snap=m;}));
  try{
   await observer.visit();await observer.connect();await observer.waitFor("welcome");
   await page.goto(base+"/?renderProbe=1");await page.locator("#practice").waitFor();
   // An old saved true value must not bring directional panning back.
   const prefs=await page.request.patch(base+"/api/me",{data:{prefs:{cameraLookAhead:true,reducedShake:true,trainingTipsHidden:true}}});assert.equal(prefs.status(),200);
   await page.reload();await page.locator("#profile-button").click();assert.equal(await page.locator('[name="cameraLookAhead"]').count(),0);await page.locator("[data-close-profile]").click();
   const response=await page.request.post(base+"/api/rooms",{data:{name:"Crit 10 "+tag,isPublic:false,settings:{mode:"training",map:"lunarcy",bots:0,durationMin:5,loadout:["smaw","m93ba","uzi"],throwables:["frag","flash","gas","emp","mine"],mapPickups:false}}});assert.equal(response.status(),201);const {code}=await response.json();
   await page.goto(base+"/r/"+code+"?renderProbe=1");await page.getByRole("button",{name:"Join room",exact:true}).click();await page.locator("#start").waitFor();
   observer.send({t:"join",code,spectate:true});await observer.waitFor("room",m=>m.room.code===code);
   await page.locator(".advanced-rules summary").click();const random=page.locator('[data-setting="randomSpawns"]');assert.equal(await random.isChecked(),true);
   assert.match(await random.locator("..").getAttribute("title")??"",/safer, varied/);
   await random.uncheck();await observer.waitFor("room",m=>m.room.settings.randomSpawns===false);await until(()=>state.room?.settings.randomSpawns===false,"random spawns off acknowledged");
   await page.locator(".preset-controls summary").click();await page.locator("#save-preset").click();await page.locator('dialog input[name="name"]').fill("Anchored "+tag);await page.getByRole("button",{name:"Save preset",exact:true}).click();await page.locator("#presets option").filter({hasText:"Anchored "+tag}).waitFor({state:"attached"});
   await random.check();await observer.waitFor("room",m=>m.room.settings.randomSpawns===true);await until(()=>state.room?.settings.randomSpawns===true,"random spawns on acknowledged");
   const preset=await page.locator("#presets option").filter({hasText:"Anchored "+tag}).getAttribute("value");assert.ok(preset);await page.locator("#presets").selectOption(preset);await page.locator("#apply-preset").click();await observer.waitFor("room",m=>m.room.settings.randomSpawns===false);await until(()=>state.room?.settings.randomSpawns===false,"preset random spawn restoration");assert.equal(await random.isChecked(),false);
   await page.screenshot({path:out+"/"+tag+"-random-spawns.png",fullPage:true});
   await page.locator("#start:not(:disabled)").click();const match=await observer.waitFor("match");await observer.waitFor("snap");await page.locator("canvas").waitFor();await until(()=>state.matchId===match.matchId&&!!state.snap,"browser/observer matching match");await delay(1000);
   const hud=await page.locator(".hud-weapon").evaluate(el=>{const rect=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:rect.width,height:rect.height,background:s.backgroundColor,cards:[...el.querySelectorAll<HTMLElement>(".weapon-card")].map(card=>({text:card.innerText,opacity:getComputedStyle(card).opacity,background:getComputedStyle(card).backgroundColor,ammo:card.querySelector(".ammo")?.textContent,nameSize:getComputedStyle(card.querySelector(".weapon-name")!).fontSize}))};});
   assert.ok(hud.width<=(mobile?380:330));assert.ok(hud.height<=(mobile?150:190),"compact HUD height: "+hud.height);assert.match(hud.background,/0\.52\)/);assert.equal(hud.cards.length,3);for(const card of hud.cards){assert.equal(card.opacity,"1");assert.ok(card.ammo);assert.ok(parseFloat(card.nameSize)>=10);}
   assert.equal(await page.locator(".grenade-chip").count(),5);assert.match(await page.locator('[data-el="grenade-bag"]').innerText(),/5\/6/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:out+"/"+tag+"-compact-hud.png"});
   // Get above the terrain using real thrust, then stop against the finite outer
   // safety envelope. No solid asteroid is placed over either spawn anchor.
   const bounds=playerTravelBounds(MAPS.lunarcy);
   await page.keyboard.down("Space");await until(()=>me().y<bounds.y+45&&Math.abs(me().vy)<1,"top travel envelope",20000);await page.keyboard.up("Space");await delay(1100);
   const before=await camera(page),position={x:me().x,y:me().y};
   for(const key of ["ArrowRight","ArrowLeft","ArrowUp","ArrowDown"]){await tap(page,key);await delay(220);const after=await camera(page);assert.ok(Math.hypot(after.x-before.x,after.y-before.y)<1,"turning does not pan: "+key);assert.ok(Math.hypot(me().x-position.x,me().y-position.y)<1,"turn-only input does not move");}
   const captures:unknown[]=[];
   async function capture(side:string){await delay(1000);const p=me(),c=await camera(page);assert.ok(p.f&PF.ALIVE);assert.ok(Math.abs(c.x-p.x)<3,side+" camera x follows player");assert.ok(Math.abs(c.y-(p.y-22))<3,side+" camera y follows player");captures.push({side,player:{x:p.x,y:p.y,hp:p.hp},camera:c});await page.screenshot({path:out+"/"+tag+"-outside-"+side+".png"});}
   await capture("top");
   await page.keyboard.down("KeyA");await until(()=>me().x<bounds.x+15&&Math.abs(me().vx)<1,"left travel envelope",20000);await page.keyboard.up("KeyA");await capture("left");
   await page.keyboard.down("KeyS");await until(()=>me().y>bounds.y+bounds.h-1&&Math.abs(me().vy)<1,"bottom travel envelope",20000);await page.keyboard.up("KeyS");await capture("bottom");
   await page.keyboard.down("KeyD");await until(()=>me().x>bounds.x+bounds.w-15&&Math.abs(me().vx)<1,"right travel envelope",25000);await page.keyboard.up("KeyD");await capture("right");
   if(mobile)for(let i=0;i<3;i++){await page.getByRole("button",{name:"Scope",exact:true}).click();await delay(120);}else for(let i=0;i<3;i++)await tap(page,"KeyZ");
   await page.locator(".loadout-heading").filter({hasText:"Range scope"}).waitFor();await capture("right-range");
   await menu(page,mobile);assert.equal(await page.locator("[data-look]").count(),0);await page.getByRole("button",{name:"Next-round rules",exact:true}).click();const next=page.locator("dialog[data-next-rules]");await next.locator('[data-setting="randomSpawns"]').check();await observer.waitFor("room",m=>m.room.nextSettings?.randomSpawns===true);await until(()=>state.room?.nextSettings?.randomSpawns===true,"staged random setting");assert.equal(state.room?.settings.randomSpawns,false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await next.getByRole("button",{name:"Close dialog",exact:true}).click();
   await page.getByRole("button",{name:"End round now",exact:true}).click();await page.getByText("Results saved to your match history.",{exact:true}).waitFor();await observer.waitFor("results");observer.send({t:"leave"});await observer.waitFor("left");await page.getByRole("button",{name:"Leave room",exact:true}).click();
   checks.push({viewport:tag,matchId:match.matchId,legacyLookAheadIgnored:true,randomSpawns:{defaultTrue:true,lobbyToggle:true,presetRestored:true,stagedWithoutChangingCurrent:true},hud,turningNoPan:true,outsideTravel:captures,saved:true});
   // Terrestrial fall damage remains recoverable with powered flight. Exercise
   // the cue and the rule together, after the separate zero-gravity perimeter.
   const recoveryResponse=await page.request.post(base+"/api/rooms",{data:{name:"Recovery "+tag,isPublic:false,settings:{mode:"training",map:"outpost",randomSpawns:false,bots:0,durationMin:2,flight:true,unlimitedFuel:true,thrust:2,moveSpeed:2,loadout:["uzi",null,null],mapPickups:false}}});assert.equal(recoveryResponse.status(),201);const recoveryCode=(await recoveryResponse.json()).code;
   await page.goto(base+"/r/"+recoveryCode+"?renderProbe=1");await page.getByRole("button",{name:"Join room",exact:true}).click();await page.locator("#start").waitFor();
   observer.drain();observer.send({t:"join",code:recoveryCode,spectate:true});await observer.waitFor("room",m=>m.room.code===recoveryCode);await page.locator("#start").click();const recoveryMatch=await observer.waitFor("match");await observer.waitFor("snap");await until(()=>state.matchId===recoveryMatch.matchId&&!!state.snap,"recovery match joined");
   const initialHp=me().hp;await page.keyboard.down("Space");await page.keyboard.down("KeyA");await until(()=>me().x< -160,"fly beyond terrestrial left edge");await page.keyboard.up("KeyA");await page.keyboard.up("Space");
   await until(()=>me().y>MAPS.outpost.height+20,"fall below terrestrial terrain",20000);await page.locator('[data-el="fall"]').waitFor();await until(()=>me().hp<initialHp,"gradual exterior fall damage");const damagedHp=me().hp;assert.ok(damagedHp>0);await page.screenshot({path:out+"/"+tag+"-fall-warning.png"});
   await page.keyboard.down("Space");await until(()=>!!(me().f&PF.JETTING),"recovery thrust acknowledged");const poweredHp=me().hp;await page.locator('[data-el="fall"]').waitFor({state:"hidden"});await until(()=>me().y<MAPS.outpost.height-50,"powered recovery above terrain height",12000);assert.ok(me().f&PF.ALIVE);assert.ok(me().hp>=poweredHp,"powered recovery stops falling damage after authoritative thrust acknowledgement");await page.screenshot({path:out+"/"+tag+"-powered-recovery.png"});await page.keyboard.up("Space");
   const recovery={matchId:recoveryMatch.matchId,initialHp,damagedHp,poweredHp,recoveredHp:me().hp,fallCueVisible:true,thrustClearedCue:true,saved:true};
   await menu(page,mobile);await page.getByRole("button",{name:"End round now",exact:true}).click();await page.getByText("Results saved to your match history.",{exact:true}).waitFor();await observer.waitFor("results");observer.send({t:"leave"});await observer.waitFor("left");await page.getByRole("button",{name:"Leave room",exact:true}).click();
   checks.push({viewport:tag,recovery});
  }catch(error){await page.screenshot({path:out+"/"+tag+"-failure.png",fullPage:true}).catch(()=>{});throw error;}finally{
   for(const key of ["Space","KeyA","KeyS","KeyD"])await page.keyboard.up(key).catch(()=>{});
   try{if(await page.locator("canvas").count()){if(!await page.getByRole("button",{name:"End round now",exact:true}).isVisible())await menu(page,mobile);await page.getByRole("button",{name:"End round now",exact:true}).click();await page.getByText("Results saved to your match history.",{exact:true}).waitFor({timeout:5000});}if(await page.getByRole("button",{name:"Leave room",exact:true}).count())await page.getByRole("button",{name:"Leave room",exact:true}).click();}catch{}
   observer.quit();await context.close();
  }
 }
}catch(error){failures.push((error as Error).stack??String(error));}
finally{await browser.close();}
writeFileSync(out+"/report.json",JSON.stringify({at:new Date().toISOString(),base,browser:browser.version(),checks,failures,limits:"Production-app acceptance against the reported base URL, using actual keyboard/touch UI actions and read-only render diagnostics. Emulated phone viewport, not physical phone performance or human playtesting. Retained 160 ms position smoothing permits follow lag during fast travel; settled camera checks do not claim exact centering during motion."},null,2));console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;
