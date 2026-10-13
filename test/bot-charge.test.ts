import{describe,it,expect}from"vitest";
import{Bot,BOT_TUNING}from"../src/server/bot.ts";
import{stepWorld}from"../src/shared/sim.ts";
import{player,world}from"./helpers.ts";
describe("practice bot charged weapons",()=>{
 it.each(["minigun","saw-launcher"])("easy bots complete %s charging before their firing window ends",weapon=>{
  const w=world({mode:"ffa",loadout:[weapon,null,null],flight:false,unlimitedAmmo:true,health:2});
  const me=player(w,-1,{x:200,y:900}),target=player(w,-1,{x:550,y:900});
  const bot=new Bot(me.id,"easy");let firedAt=-1;
  for(let tick=0;tick<360&&firedAt<0;tick++){
   stepWorld(w,new Map([[me.id,bot.think(w)]]));
   if(w.events.some(e=>e.t==="shot"&&e.by===me.id&&e.w===weapon))firedAt=w.tick;
  }
  expect(target.alive).toBe(true);
  expect(firedAt).toBeGreaterThanOrEqual(BOT_TUNING.easy.reaction);
  expect(firedAt).toBeGreaterThan(0);
 });
});
