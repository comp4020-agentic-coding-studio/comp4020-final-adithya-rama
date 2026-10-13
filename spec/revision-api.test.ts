import {describe,expect,inject,it} from "vitest";
import WebSocket from "ws";
import {PROTOCOL_VERSION} from "../src/shared/constants.ts";
import {TestPlayer} from "./lib/client.ts";
const base=inject("baseUrl");

describe("Classic PC preference and protocol contract",()=>{
  it("persists scope, touch placement and independent accessibility choices across visits",async()=>{
    const p=new TestPlayer(base);await p.visit();
    const prefs={scopes:{smaw:3,m93ba:2},touchLayout:{scale:1.1,opacity:.7,positions:{throw:{x:.8,y:.7},move:{x:.2,y:.85}}},lowFlash:true,reducedBlood:true,cameraLookAhead:false,bindings:{KeyC:262144}};
    const save=await p.http("/api/me",{method:"PATCH",body:{prefs}});expect(save.status).toBe(200);
    expect((await p.visit()).prefs).toMatchObject(prefs);
    await p.http("/api/me",{method:"PATCH",body:{prefs:{volume:.25}}});
    expect((await p.visit()).prefs).toMatchObject({...prefs,volume:.25});
    for(const invalid of [{scopes:{smaw:99}},{touchLayout:{scale:2,opacity:.7,positions:{}}},{touchLayout:{scale:1,opacity:.7,positions:{throw:{x:-1,y:.5}}}},{touchLayout:{scale:1,opacity:.7,positions:{bad:{x:.5,y:.5}}}}]){
      expect((await p.http("/api/me",{method:"PATCH",body:{prefs:invalid}})).status).toBe(400);
    }
    expect((await p.visit()).prefs).toMatchObject(prefs);
  });
  it("clearly rejects an outdated socket before room admission",async()=>{
    const p=new TestPlayer(base);await p.visit();
    const url=new URL("/ws?v="+(PROTOCOL_VERSION-1),base);url.protocol=url.protocol==="https:"?"wss:":"ws:";
    const ws=new WebSocket(url,{headers:{Cookie:p.cookie,Origin:p.origin}});
    const received:Record<string,unknown>[]=[];
    const ended=await new Promise<{code:number;reason:string}>((resolve,reject)=>{
      ws.on("message",data=>received.push(JSON.parse(data.toString())));
      ws.once("error",reject);ws.once("close",(code,reason)=>resolve({code,reason:String(reason)}));
    });
    expect(ended.code).toBe(1002);expect(ended.reason).toMatch(/reload/i);
    expect(received).toEqual([expect.objectContaining({t:"error",message:expect.stringMatching(/reload/i)})]);
    await p.connect();try{expect((await p.waitFor("welcome")).v).toBe(PROTOCOL_VERSION);}finally{p.close();}
  });
});
