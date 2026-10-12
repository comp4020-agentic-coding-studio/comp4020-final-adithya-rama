import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {AUDIO_FILES,SHOT_SOUNDS,spatialMix} from "../src/client/audio.ts";
import {WEAPONS} from "../src/shared/weapons.ts";

describe("recorded combat audio",()=>{
  it("ships intact, bounded, credited clips for every sample reference",()=>{
    const root="src/client/public/audio/";
    const manifest=JSON.parse(readFileSync(root+"manifest.json","utf8")) as {file:string;bytes:number;sha256:string}[];
    expect(manifest.map(m=>m.file).sort()).toEqual(AUDIO_FILES.map(n=>n+".ogg").sort());
    for(const entry of manifest){const file=readFileSync(root+entry.file);expect(file.subarray(0,4).toString()).toBe("OggS");expect(file.length).toBe(entry.bytes);expect(createHash("sha256").update(file).digest("hex")).toBe(entry.sha256);}
    expect(manifest.reduce((n,m)=>n+m.bytes,0)).toBeLessThan(250000);
    expect(readFileSync(root+"CREDITS.md","utf8")).toContain("not the original Mini Militia");
    for(const gun of Object.values(WEAPONS).filter(w=>w.behavior==="hitscan")){expect(AUDIO_FILES).toContain(SHOT_SOUNDS[gun.id]?.clip);}
  });
  it("gives every conventional gun a distinct sample/filter/pitch identity",()=>{
    const profiles=Object.values(SHOT_SOUNDS).map(({clip,rate,lowpass})=>JSON.stringify([clip,rate,lowpass]));
    expect(new Set(profiles).size).toBe(profiles.length);
  });
  it("attenuates by distance and pans around the current camera without hearing distant rooms",()=>{
    const listener={x:100,y:100};
    expect(spatialMix(100,100,listener)).toEqual({gain:1,pan:0});
    expect(spatialMix(500,100,listener).gain).toBeLessThan(1);
    expect(spatialMix(500,100,listener).pan).toBeGreaterThan(0);
    expect(spatialMix(-300,100,listener).pan).toBeLessThan(0);
    expect(spatialMix(1800,100,listener).gain).toBe(0);
  });
});
