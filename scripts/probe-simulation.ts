/**
 * Shared-simulation timing only: no sockets, renderer, persistence or bot planning.
 * Maximum legal room size + unlimited-ammo room setting; normal health/deaths.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import { MAPS } from "../src/shared/maps.ts";
import { defaultSettings, sanitizeSettings } from "../src/shared/settings.ts";
import { addPlayer, createWorld, stepWorld } from "../src/shared/sim.ts";
import { Btn, type InputFrame } from "../src/shared/types.ts";

const ticks = Math.min(3600, Math.max(120, Number(process.env.PROBE_TICKS) || 1800));
const ids = process.env.PROBE_MAPS?.split(",") ?? Object.keys(MAPS);
const weapons = ["minigun", "aa20", "phasr", "rg6", "saw-launcher", "emp-gun"];
const samples: Record<string, unknown>[] = [];
const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
const start = performance.now(), initialRss = process.memoryUsage().rss;
let peakRss = initialRss;
for (const id of ids) {
  if (!MAPS[id]) throw new Error("Unknown map: " + id);
  for (const weapon of weapons) {
    const init = performance.now();
    const settings = sanitizeSettings({ ...defaultSettings(), map: id, mode: "ffa", capacity: 8,
      loadout: [weapon, null, null], scoreLimit: 0, durationMin: 15, health: 2, damage: .5,
      unlimitedAmmo: true, respawnSec: 1, mapPickups: true, throwables: ["frag", "flash", "gas", "emp", "mine"] });
    const w = createWorld(settings, 1701);
    for (let i = 0; i < 8; i++) addPlayer(w, { id: w.nextId++, key: "probe-" + i, name: "Probe " + i, team: -1, color: i, bot: false });
    const initMs = performance.now() - init, durations: number[] = [];
    let maxProjectiles = 0, maxAreas = 0, maxEvents = 0, shots = 0, deaths = 0;
    for (let tick = 0; tick < ticks; tick++) {
      const inputs = new Map<number, InputFrame>();
      for (const p of w.players.values()) {
        const target = [...w.players.values()].filter(o => o.alive && o.id !== p.id)
          .sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
        let b = Btn.FIRE | Btn.CONTINUOUS_FIRE;
        // Legal pressed-edge throws empty the five carried types; no invented ammo.
        if (tick % 30 === 0) b |= Btn.THROW | Btn.NEXT_THROWABLE;
        if (tick % 360 < 180) b |= p.id % 2 ? Btn.RIGHT : Btn.LEFT;
        else b |= p.id % 2 ? Btn.LEFT : Btn.RIGHT;
        if (tick % 180 < 60) b |= Btn.JET;
        inputs.set(p.id, { seq: tick + 1, b, aim: target ? Math.atan2(target.y - p.y, target.x - p.x) : 0 });
      }
      const begin = performance.now(); stepWorld(w, inputs); durations.push(performance.now() - begin);
      maxProjectiles = Math.max(maxProjectiles, w.projectiles.length);
      maxAreas = Math.max(maxAreas, w.areas.length); maxEvents = Math.max(maxEvents, w.events.length);
      shots += w.events.filter(e => e.t === "shot").length;
      deaths += w.events.filter(e => e.t === "kill").length;
      w.events = [];
    }
    const firstStepMs = durations[0]; durations.sort((a,b) => a-b);
    const memory = process.memoryUsage(); peakRss = Math.max(peakRss, memory.rss);
    samples.push({ map: id, weapon, actors: 8, ticks, solids: w.map.solids.length, platforms: w.map.platforms.length,
      physics: w.map.physics ?? "terrestrial", initMs, firstStepMs, p50Ms: quantile(durations,.5),
      p95Ms: quantile(durations,.95), maxMs: durations.at(-1), maxProjectiles, maxAreas, maxEvents,
      shots, deaths, rssBytes: memory.rss, heapUsedBytes: memory.heapUsed });
  }
}
const report = {
  recordedAt: new Date().toISOString(), runtime: process.version, platform: platform(), release: release(),
  cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryLimit: "not constrained", cpuLimit: "not constrained",
  note: "In-process simulation only; excludes input creation timings, bot planning, serialization, sockets, database, renderer and production contention. Legal unlimited-ammo room setting; no synthetic projectile injection.",
  elapsedMs: performance.now() - start, initialRssBytes: initialRss, peakSampledRssBytes: peakRss, samples,
};
await mkdir("test-results", { recursive: true });
const output = process.env.PROBE_REPORT ?? "test-results/oct14-simulation-probe.json";
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
const worst = [...samples].sort((a,b) => Number(b.p95Ms) - Number(a.p95Ms)).slice(0,5);
console.log(JSON.stringify({ output, cases: samples.length, elapsedMs: report.elapsedMs, peakSampledRssBytes: peakRss, worst }, null, 2));
