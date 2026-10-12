import type { GameEvent } from "../shared/types.ts";

/** Recorded sources are credited in /audio/CREDITS.md; never Mini Militia rips. */
export const AUDIO_FILES = ["pistol", "silenced", "revolver", "smg", "machine-pistol", "ak", "carbine", "marksman", "sniper", "shotgun", "auto-shotgun", "hurt-1", "hurt-2", "death-1", "death-2", "death-3"] as const;
type Clip = typeof AUDIO_FILES[number];
export const SHOT_SOUNDS: Record<string, { clip: Clip; rate: number; gain: number; lowpass?: number }> = {
  "mini-eagle": {clip:"pistol",rate:1.12,gain:.56},
  "golden-eagle": {clip:"silenced",rate:.87,gain:.54,lowpass:2800},
  magnum:{clip:"revolver",rate:.85,gain:.7},
  uzi:{clip:"smg",rate:1.17,gain:.37},
  tec9:{clip:"machine-pistol",rate:1.08,gain:.44},
  mp5:{clip:"smg",rate:.89,gain:.43,lowpass:4800},
  ak47:{clip:"ak",rate:1,gain:.56},
  m4:{clip:"carbine",rate:1.04,gain:.5},
  "tavor-x95":{clip:"carbine",rate:.83,gain:.58,lowpass:6100},
  xm8:{clip:"carbine",rate:1.19,gain:.43},
  m14:{clip:"marksman",rate:1,gain:.67},
  m93ba:{clip:"sniper",rate:.87,gain:.85},
  spas12:{clip:"shotgun",rate:.9,gain:.8},
  aa20:{clip:"auto-shotgun",rate:1.03,gain:.65},
  minigun:{clip:"machine-pistol",rate:.77,gain:.3},
};
export function spatialMix(x:number,y:number,listener:{x:number;y:number}):{gain:number;pan:number} {
  const distance=Math.hypot(x-listener.x,y-listener.y);
  return {gain:Math.max(0,1-distance/1700)**1.6,pan:Math.max(-.85,Math.min(.85,(x-listener.x)/750))};
}

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private buffers=new Map<Clip,AudioBuffer>();
  private loading:Promise<void>|null=null;
  private sources=new Set<AudioBufferSourceNode|OscillatorNode>();
  private voices=new Map<number,number>();
  private shots=new Map<string,number>();
  private positions=new Map<number,{x:number;y:number}>();
  private listener={x:0,y:0};
  private _muted=false;
  private _volume=.35;
  private destroyed=false;
  get muted():boolean{return this._muted;}
  set muted(value:boolean){this._muted=value;this.applyVolume();}
  get volume():number{return this._volume;}
  set volume(value:number){this._volume=Math.max(0,Math.min(1,Number.isFinite(value)?value:0));this.applyVolume();}
  private applyVolume():void {
    if(this.master&&this.context)this.master.gain.setTargetAtTime(this._muted?0:this._volume,this.context.currentTime,.015);
  }
  scene(players:readonly {id:number;x:number;y:number}[],listener:{x:number;y:number}):void {
    this.listener=listener;this.positions.clear();for(const p of players)this.positions.set(p.id,{x:p.x,y:p.y-24});
  }
  async unlock():Promise<void> {
    if(this.destroyed)return;
    if(!this.context) {
      this.context=new AudioContext();
      this.master=this.context.createGain();
      this.compressor=this.context.createDynamicsCompressor();
      this.compressor.threshold.value=-12;this.compressor.knee.value=15;this.compressor.ratio.value=5;
      this.master.connect(this.compressor);this.compressor.connect(this.context.destination);this.applyVolume();
    }
    if(this.context.state==="suspended")await this.context.resume();
    const ctx=this.context;
    this.loading??=Promise.all(AUDIO_FILES.map(async name=>{
      try {
        const r=await fetch("/audio/"+name+".ogg");if(!r.ok)throw Error(String(r.status));
        const buffer=await ctx.decodeAudioData(await r.arrayBuffer());
        if(!this.destroyed)this.buffers.set(name,buffer);
      } catch { if(!this.destroyed)console.warn("Audio clip unavailable: "+name); }
    })).then(()=>{});
    await this.loading;
  }
  private output(level:number,pan=0):{gain:GainNode;panner:StereoPannerNode}|null {
    const ctx=this.context;
    if(!ctx||!this.master||ctx.state!=="running"||this.muted||level<.001||this.sources.size>=40)return null;
    const gain=ctx.createGain();gain.gain.value=level;
    const panner=ctx.createStereoPanner();panner.pan.value=pan;
    gain.connect(panner);panner.connect(this.master);return {gain,panner};
  }
  private play(name:Clip,level:number,pan=0,rate=1,lowpass?:number):boolean {
    const ctx=this.context,buffer=this.buffers.get(name);
    if(!ctx||!buffer)return false;
    const nodes=this.output(level,pan);if(!nodes)return true;
    const source=ctx.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;
    let filter:BiquadFilterNode|undefined;
    if(lowpass){filter=ctx.createBiquadFilter();filter.type="lowpass";filter.frequency.value=lowpass;source.connect(filter);filter.connect(nodes.gain);}
    else source.connect(nodes.gain);
    this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();filter?.disconnect();nodes.gain.disconnect();nodes.panner.disconnect();};
    source.start();return true;
  }
  private tone(freq:number,end:number,length:number,type:OscillatorType,level=.2,pan=0):void {
    const ctx=this.context,nodes=this.output(level,pan);if(!ctx||!nodes)return;
    const oscillator=ctx.createOscillator();oscillator.type=type;
    oscillator.frequency.setValueAtTime(freq,ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,end),ctx.currentTime+length);
    nodes.gain.gain.setValueAtTime(level,ctx.currentTime);
    nodes.gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+length);
    oscillator.connect(nodes.gain);this.sources.add(oscillator);oscillator.start();oscillator.stop(ctx.currentTime+length);
    oscillator.onended=()=>{this.sources.delete(oscillator);oscillator.disconnect();nodes.gain.disconnect();nodes.panner.disconnect();};
  }
  private noise(length:number,level:number,cutoff:number,pan=0):void {
    const ctx=this.context,nodes=this.output(level,pan);if(!ctx||!nodes)return;
    const b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*length),ctx.sampleRate),data=b.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*5);
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=b;filter.type="lowpass";filter.frequency.value=cutoff;
    source.connect(filter);filter.connect(nodes.gain);this.sources.add(source);source.start();
    source.onended=()=>{this.sources.delete(source);source.disconnect();filter.disconnect();nodes.gain.disconnect();nodes.panner.disconnect();};
  }
  private at(id:number|undefined,local:number|null):{gain:number;pan:number} {
    if(id===local)return {gain:1,pan:0};
    const p=id===undefined?undefined:this.positions.get(id);
    return p?spatialMix(p.x,p.y,this.listener):{gain:.25,pan:0};
  }
  event(e:GameEvent,local:number|null):void {
    if(this.destroyed||this.muted)return;
    const now=performance.now();
    if(e.t==="shot") {
      // A shotgun sends one trace per pellet; sound fires once per discharge.
      // Independent shooters and different dual weapons never silence each other.
      const key=e.by+":"+e.w;if(now-(this.shots.get(key)??-Infinity)<18)return;
      this.shots.set(key,now);if(this.shots.size>256)this.shots.clear();
      const mix=e.by===local?{gain:1,pan:0}:spatialMix(e.x1,e.y1,this.listener);
      const shot=SHOT_SOUNDS[e.w];
      if(shot&&this.play(shot.clip,shot.gain*mix.gain,mix.pan,shot.rate,shot.lowpass))return;
      if(e.w==="smaw"){this.noise(.42,.65*mix.gain,1500,mix.pan);this.tone(140,35,.25,"triangle",.4*mix.gain,mix.pan);}
      else if(e.w==="rg6"){this.noise(.11,.3*mix.gain,950,mix.pan);this.tone(180,65,.12,"sine",.45*mix.gain,mix.pan);}
      else if(e.w==="flamethrower")this.noise(.16,.2*mix.gain,2300,mix.pan);
      else if(e.w==="saw-launcher"){this.tone(450,155,.24,"sawtooth",.16*mix.gain,mix.pan);this.noise(.08,.2*mix.gain,5200,mix.pan);}
      else if(e.w==="phasr")this.tone(1250,260,.13,"sine",.17*mix.gain,mix.pan);
      else if(e.w==="emp-gun"){this.tone(110,840,.17,"triangle",.2*mix.gain,mix.pan);this.noise(.1,.15*mix.gain,6400,mix.pan);}
      else this.noise(.07,.3*mix.gain,4100,mix.pan);
    } else if(e.t==="hurt") {
      const mix=this.at(e.id,local);
      this.noise(.055,.12*mix.gain,550,mix.pan);
      if(now-(this.voices.get(e.id)??-Infinity)>500) {
        this.voices.set(e.id,now);this.play(e.id%2?"hurt-1":"hurt-2",.38*mix.gain,mix.pan);
      }
    } else if(e.t==="kill") {
      const mix=this.at(e.victim,local);
      this.play((["death-1","death-2","death-3"] as const)[e.victim%3],.6*mix.gain,mix.pan);
      if(e.killer===local)this.tone(630,315,.055,"sine",.08);
    } else if(e.t==="explode") {
      const mix=spatialMix(e.x,e.y,this.listener);
      this.noise(.75,.72*mix.gain,950,mix.pan);this.tone(95,25,.55,"sine",.6*mix.gain,mix.pan);
    } else if(e.t==="shield") {
      const mix=this.at(e.id,local);this.noise(.035,.19*mix.gain,8000,mix.pan);this.tone(1550,670,.15,"triangle",.12*mix.gain,mix.pan);
    } else if(e.t==="reload"&&e.id===local) {
      this.noise(.07,.2,3200);this.tone(350,180,.045,"triangle",.12);
    } else if(e.t==="melee") {const mix=this.at(e.by,local);this.noise(.18,.17*mix.gain,1900,mix.pan);}
    else if(e.t==="pickup"&&e.id===local){this.noise(.035,.09,3800);this.tone(430,850,.09,"sine",.09);}
    else if(e.t==="flashbang"){const mix=spatialMix(e.x,e.y,this.listener);this.noise(.2,.32*mix.gain,8000,mix.pan);}
    else if(e.t==="flash"&&e.id===local)this.tone(1700,1100,.5,"sine",.025);
    else if(e.t==="flag"&&e.action==="delivery")this.tone(440,880,.4,"triangle",.15);
    else if(e.t==="wave")this.tone(300,900,.45,"triangle",.12);
  }
  destroy():void {
    this.destroyed=true;for(const source of this.sources){try{source.stop();}catch{}}
    this.sources.clear();this.buffers.clear();this.positions.clear();this.voices.clear();this.shots.clear();
    void this.context?.close();this.context=null;this.master=null;this.compressor=null;
  }
}
