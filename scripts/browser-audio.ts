// Decodes the shipped clips and exercises real Web Audio scheduling in Chromium.
// This checks playback plumbing, not subjective loudness/feel on human speakers.
import {chromium} from "playwright";
import {mkdirSync,writeFileSync} from "node:fs";
const base=process.env.PREVIEW_URL??"http://127.0.0.1:8100";
const browser=await chromium.launch({args:["--autoplay-policy=no-user-gesture-required"]});
const page=await browser.newPage();
const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
page.on("console",m=>{if(m.type()==="warning"||m.type()==="error")errors.push(m.text());});
try {
 await page.route("**/__audio_check__",r=>r.fulfill({contentType:"text/html",body:"<!doctype html><button>Enable audio</button>"}));
 await page.goto(base+"/__audio_check__");
 await page.getByRole("button").click();
 const result=await page.evaluate(async()=>{
  const src="/audio.ts";
  const {GameAudio,AUDIO_FILES,SHOT_SOUNDS}=await import(src);
  const audio=new GameAudio();
  const actual=AudioContext.prototype.createBufferSource;
  let starts=0,decoded=0;
  const decode=AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData=function(...args:Parameters<AudioContext["decodeAudioData"]>){return decode.apply(this,args).then(buffer=>{decoded++;if(buffer.length<=0||buffer.duration<=0)throw Error("Empty clip");return buffer;});};
  AudioContext.prototype.createBufferSource=function(){
    const source=actual.call(this),start=source.start.bind(source);
    source.start=(...args:Parameters<AudioBufferSourceNode["start"]>)=>{starts++;start(...args);};
    return source;
  };
  await audio.unlock();
  audio.scene([{id:1,x:100,y:300},{id:2,x:280,y:300}],{x:100,y:280});
  for(const w of Object.keys(SHOT_SOUNDS)){audio.event({t:"shot",by:1,w,x1:100,y1:270,x2:500,y2:270,hit:false},1);await new Promise(r=>setTimeout(r,30));}
  const firearms=starts;if(firearms!==Object.keys(SHOT_SOUNDS).length)throw Error("Firearm clips not scheduled");
  await new Promise(r=>setTimeout(r,30));
  const beforePellets=starts;
  for(let i=0;i<7;i++)audio.event({t:"shot",by:1,w:"spas12",x1:100,y1:270,x2:500,y2:270,hit:false},1);
  if(starts-beforePellets!==1)throw Error("Shotgun audio duplicated per pellet");
  const beforeVoices=starts;
  audio.event({t:"hurt",id:2,amount:30},1);audio.event({t:"kill",killer:1,attacker:1,victim:2,w:"smaw"},1);
  if(starts-beforeVoices!==3)throw Error("Impact and hurt/death vocals not scheduled");
  audio.muted=true;const beforeMute=starts;
  audio.event({t:"shot",by:2,w:"magnum",x1:200,y1:270,x2:500,y2:270,hit:false},1);
  if(starts!==beforeMute)throw Error("Muted sound scheduled");
  audio.muted=false;audio.volume=.2;
  const beforeFar=starts;
  audio.event({t:"shot",by:3,w:"m14",x1:8000,y1:270,x2:8500,y2:270,hit:false},1);
  if(starts!==beforeFar)throw Error("Out-of-range sound scheduled");
  audio.destroy();
  return {decoded,expected:AUDIO_FILES.length,firearmProfiles:firearms,pelletSoundCount:1,voiceAndImpactStarts:3,mute:true,distance:true,destroyed:true};
 });
 if(result.decoded!==result.expected)errors.push("Not all clips decoded");
 mkdirSync("test-results/audio-revision",{recursive:true});
 writeFileSync("test-results/audio-revision/report.json",JSON.stringify({at:new Date().toISOString(),browser:browser.version(),...result,errors,scope:"Real Chromium decode/playback scheduling; no human auditory assessment."},null,2));
 if(errors.length)throw Error(errors.join("\n"));
 console.log(JSON.stringify(result));
} finally {await browser.close();}
