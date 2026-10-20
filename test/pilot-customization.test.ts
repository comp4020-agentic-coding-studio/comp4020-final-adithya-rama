import {describe,it,expect} from "vitest";
import {AVATAR_CHOICES,DEFAULT_AVATAR,PILOT_PRESETS,avatarOf} from "../src/shared/avatar.ts";
import {sanitizePrefs} from "../src/server/validation.ts";
import {avatarSvg,drawPilot} from "../src/client/avatar-art.ts";
import type {Graphics} from "pixi.js";
describe("pilot identity and cosmetics",()=>{
  it("upgrades legacy pilots without losing their existing appearance choices",()=>{
    expect(sanitizePrefs({avatar:{helmet:"visor",face:"robot",emblem:"star"}}).avatar)
      .toEqual({...DEFAULT_AVATAR,helmet:"visor",face:"robot",emblem:"star"});
  });
  it("validates every saved choice and rejects malformed assistance preferences",()=>{
    for(const [key,values] of Object.entries(AVATAR_CHOICES)){
      for(const value of values)expect(sanitizePrefs({avatar:{...DEFAULT_AVATAR,[key]:value}}).avatar).toEqual({...DEFAULT_AVATAR,[key]:value});
      expect(()=>sanitizePrefs({avatar:{...DEFAULT_AVATAR,[key]:"<script>"}})).toThrow();
    }
    for(const key of ["aimAssist","sightGuide"])expect(()=>sanitizePrefs({[key]:"yes"})).toThrow();
    expect(sanitizePrefs({aimAssist:false,sightGuide:false},{avatar:PILOT_PRESETS[1].avatar})).toEqual({aimAssist:false,sightGuide:false,avatar:PILOT_PRESETS[1].avatar});
  });
  it("offers visually distinct original presets, with no HTML injection from arbitrary input",()=>{
    expect(new Set(PILOT_PRESETS.map(p=>avatarSvg(p.avatar,0x123456))).size).toBe(PILOT_PRESETS.length);
    expect(avatarSvg(avatarOf({hairColor:'\" onload=\"bad',outfit:"<script>"}),NaN)).not.toMatch(/<script|onload|NaN/);
  });
  it("renders all appearance choices at both stances and facings with finite geometry",()=>{
    for(const [key,values] of Object.entries(AVATAR_CHOICES))for(const value of values)for(const h of [26,40])for(const aim of [0,Math.PI]){
      const calls:unknown[][]=[];
      const g=new Proxy({}, {get:()=> (...args:unknown[])=>{calls.push(args);return g;}}) as Graphics;
      drawPilot(g,{x:100,y:200,h,color:0x999999,avatar:avatarOf({...DEFAULT_AVATAR,[key]:value}),aim,walk:0,airborne:false,jetting:false,alpha:1,recoil:0,weapon:null,otherWeapon:null,now:0,hit:false});
      expect(calls.flat(3).filter(v=>typeof v==="number").every(Number.isFinite)).toBe(true);
    }
  });
});
