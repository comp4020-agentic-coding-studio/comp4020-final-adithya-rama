import type { GameEvent } from "../shared/types.ts";

// Original procedural effects, with no downloaded audio assets.
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastShot = 0;
  muted = false;
  volume = 0.35;
  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }
  private tone(freq: number, end: number, length: number, type: OscillatorType, level = 0.3): void {
    const ctx = this.context;
    if (!ctx || !this.master || this.muted || ctx.state !== "running") return;
    this.master.gain.value = Math.max(0, Math.min(1, this.volume));
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), ctx.currentTime + length);
    gain.gain.setValueAtTime(level, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + length);
    oscillator.connect(gain); gain.connect(this.master);
    oscillator.start(); oscillator.stop(ctx.currentTime + length);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  event(e: GameEvent, local: number | null): void {
    if (e.t === "shot") {
      const now = performance.now();
      if (now - this.lastShot < 35) return;
      this.lastShot = now;
      const energy = e.w === "phasr" || e.w === "emp-gun";
      const heavy = ["m93ba", "spas12", "smaw"].includes(e.w);
      this.tone(energy ? 700 : heavy ? 140 : 260, energy ? 180 : 35, heavy ? 0.15 : 0.07, energy ? "sine" : "sawtooth", e.by === local ? 0.2 : 0.065);
    } else if(e.t==="flashbang") this.tone(1000,180,0.22,"triangle",0.12);
    else if(e.t==="flash"&&e.id===local) this.tone(1200,700,0.45,"sine",0.04);
    else if (e.t === "explode") this.tone(90, 20, 0.45, "sawtooth", 0.4);
    else if (e.t === "pickup" && e.id === local) this.tone(500, 1000, 0.12, "sine");
    else if (e.t === "reload" && e.id === local) this.tone(120, 260, 0.1, "triangle");
    else if (e.t === "hurt" && e.id === local) this.tone(160, 65, 0.1, "square", 0.1);
    else if (e.t === "kill" && e.killer === local) this.tone(600, 1200, 0.2, "sine");
    else if (e.t === "flag" && e.action === "delivery") this.tone(440, 880, 0.4, "triangle");
    else if (e.t === "wave") this.tone(300, 900, 0.45, "triangle");
  }
  destroy(): void { void this.context?.close(); this.context = null; }
}
