// Component acceptance with real DOM pointer events; this is not a server-save claim.
import {chromium} from "playwright";
import {mkdirSync,writeFileSync} from "node:fs";
import type {TouchControls} from "../src/client/touch.ts";
import type {Input} from "../src/client/input.ts";
import type {TouchLayout} from "../src/shared/touch-layout.ts";
import {Btn} from "../src/shared/types.ts";
declare global {interface Window {__touchFixture:{touch:TouchControls;input:Input;edit():void;saved:TouchLayout|null}}}
const base=process.env.PREVIEW_URL??"http://127.0.0.1:8103",out="test-results/oct14-touch-layout";
mkdirSync(out,{recursive:true});const errors:string[]=[],browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage();
page.on("pageerror",e=>errors.push(e.message));
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
await page.route("**/__touch-layout__",route=>route.fulfill({contentType:"text/html",body:'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><body style="margin:0"><main class="game" style="position:relative;width:100vw;height:100vh;background:linear-gradient(#47626b,#88a899 65%,#4e6348)"><canvas style="width:100%;height:100%"></canvas><div style="position:absolute;top:20px;left:20px;color:white;pointer-events:none">TOUCH CONTROL FIXTURE<br><small>Local component input · no match</small></div></main></body>'}));
async function setup(){
  await page.goto(base+"/__touch-layout__");
  await page.evaluate(async()=>{
    const [{TouchControls},{Input}]=await Promise.all([import(String("/touch.ts")),import(String("/input.ts"))]);
    const game=document.querySelector<HTMLElement>(".game")!,input=new Input(game.querySelector("canvas")!,{onScoreboard(){},onMenu(){}}),saved=JSON.parse(localStorage.getItem("layout-proof")??"null") as TouchLayout|null;
    const touch=new TouchControls(game,input,{scoreboard(){},menu(){},zoom(){}},saved);
    window.__touchFixture={touch,input,saved,edit(){touch.editLayout((value:TouchLayout)=>{window.__touchFixture.saved=value;localStorage.setItem("layout-proof",JSON.stringify(value));});}};
  });
  await page.waitForFunction(()=>document.querySelector<HTMLElement>('[data-control="slot3"]')!.offsetWidth>0);
}
async function bounds(){
  return page.locator("[data-control]").evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {key:(el as HTMLElement).dataset.control,x:r.x,y:r.y,w:r.width,h:r.height};}));
}
async function assertReachable(width:number,height:number){const boxes=await bounds();assert(boxes.length===18,"Expected all18 controls");for(const b of boxes)assert(b.w>=43.9&&b.h>=43.9&&b.x>=7.5&&b.y>=7.5&&b.x+b.w<=width-7.5&&b.y+b.h<=height-7.5,"Unreachable control "+JSON.stringify(b));}
try{
  await setup();await assertReachable(390,844);await page.screenshot({path:out+"/phone-default.png"});
  await page.getByRole("button",{name:"Slot 3",exact:true}).click();assert(await page.evaluate(()=>window.__touchFixture.input.sampleButtons())===Btn.SLOT3,"Short slot tap missing");assert(await page.evaluate(()=>window.__touchFixture.input.sampleButtons())===0,"Short slot tap repeated");
  const aim=(await bounds()).find(b=>b.key==="aim")!;await page.mouse.move(aim.x+aim.w*.9,aim.y+aim.h/2);await page.mouse.down();assert((await page.evaluate(()=>window.__touchFixture.input.buttons()))&Btn.FIRE,"Aim stick did not hold fire");
  await page.evaluate(()=>window.__touchFixture.edit());await page.mouse.up();assert(await page.evaluate(()=>window.__touchFixture.input.buttons())===0,"Editor retained fire");
  const throwing=(await bounds()).find(b=>b.key==="throw")!;await page.mouse.move(throwing.x+throwing.w/2,throwing.y+throwing.h/2);await page.mouse.down();await page.mouse.move(90,320,{steps:12});await page.mouse.up();
  assert(await page.evaluate(()=>window.__touchFixture.input.sampleButtons())===0,"Dragging emitted a throw");
  await page.locator("[data-layout-size]").fill("1.2");await page.locator("[data-layout-opacity]").fill("0.55");
  await page.screenshot({path:out+"/phone-edit.png"});await page.getByRole("button",{name:"Save layout",exact:true}).click();
  const saved=await page.evaluate(()=>window.__touchFixture.saved);assert(saved?.scale===1.2&&saved.opacity===.55&&saved.positions.throw,"Size/opacity/position not saved");
  assert(await page.evaluate(()=>window.__touchFixture.input.enabled),"Input not restored after save");await setup();await assertReachable(390,844);
  const reloaded=await page.evaluate(()=>window.__touchFixture.saved);assert(JSON.stringify(saved)===JSON.stringify(reloaded),"Constructor did not restore saved layout");
  await page.getByRole("button",{name:"Throw",exact:true}).click();assert(await page.evaluate(()=>window.__touchFixture.input.sampleButtons())===Btn.THROW,"Moved throw no longer works");
  await page.screenshot({path:out+"/phone-saved.png"});
  await page.evaluate(()=>window.__touchFixture.edit());
  const beforeOverlap=await bounds(),throwBox=beforeOverlap.find(b=>b.key==="throw")!,slotBox=beforeOverlap.find(b=>b.key==="slot1")!;
  await page.mouse.move(throwBox.x+throwBox.w/2,throwBox.y+throwBox.h/2);await page.mouse.down();await page.mouse.move(slotBox.x+slotBox.w/2,slotBox.y+slotBox.h/2,{steps:8});await page.mouse.up();
  assert(await page.getByRole("button",{name:"Save layout",exact:true}).isDisabled(),"Overlapping controls were saveable");
  await page.screenshot({path:out+"/phone-overlap-warning.png"});await page.getByRole("button",{name:"Reset",exact:true}).click();assert(await page.getByRole("button",{name:"Save layout",exact:true}).isEnabled(),"Reset did not recover overlapping controls");await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(80);await assertReachable(844,390);await page.screenshot({path:out+"/landscape-adapted.png"});
  await page.evaluate(()=>window.__touchFixture.edit());await page.getByRole("button",{name:"Reset",exact:true}).click();await page.keyboard.press("Escape");assert(!await page.getByRole("dialog",{name:"Arrange touch controls"}).count(),"Escape did not cancel editor");
  assert(await page.evaluate(()=>window.__touchFixture.input.enabled),"Cancel did not restore input");
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(80);await page.evaluate(()=>window.__touchFixture.edit());await page.getByRole("button",{name:"Reset",exact:true}).click();await page.getByRole("button",{name:"Save layout",exact:true}).click();
  assert((await page.evaluate(()=>window.__touchFixture.saved))?.scale===1,"Reset did not save defaults");await assertReachable(390,844);
  assert(errors.length===0,errors.join("\n"));
  writeFileSync(out+"/report.json",JSON.stringify({at:new Date().toISOString(),browser:browser.version(),scope:"Actual touch/input components and DOM pointer events. Local storage fixture verifies callback/constructor restoration, not server preference persistence.",controls:18,checks:["short slot3 tap","held aim clears on edit","drag is not a grenade throw","position,size,opacity save","constructor restoration","moved button remains functional","overlap disables Save and Reset recovers","portrait/landscape bounds","Escape cancel","reset save"],errors},null,2));
  console.log("18 touch controls: edit, save, restore, rotation, cancel and input cleanup passed; no page errors.");
}finally{await browser.close();}
