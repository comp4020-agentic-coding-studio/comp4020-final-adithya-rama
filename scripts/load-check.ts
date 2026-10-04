// A short load probe: one scripted human plus seven bots in a full room for
// DURATION_S seconds, sampling /healthz for memory and simulation step time.
// This is a probe, not the 30-minute soak the plan's acceptance requires.
// Usage: APP_URL=... DURATION_S=60 node scripts/load-check.ts
import { Btn } from "../src/shared/types.ts";
import { sleep, TestPlayer } from "../spec/lib/client.ts";

const base = process.env.APP_URL ?? "http://localhost:8080";
const seconds = Number(process.env.DURATION_S ?? 60);

const p = new TestPlayer(base);
await p.visit();
const { body } = await p.http<{ code: string }>("/api/rooms", {
  method: "POST",
  body: { isPublic: false, settings: { mode: "ffa", bots: 7, botDifficulty: "hard", durationMin: 5 } },
});
await p.connect();
p.send({ t: "join", code: body.code });
await p.waitFor("room");
p.send({ t: "start" });
await p.waitFor("match");

const samples: { rssMb: number; stepP95Ms: number }[] = [];
let seq = 0;
const end = Date.now() + seconds * 1000;
let nextSample = Date.now();
while (Date.now() < end) {
  const b = (seq / 60) % 2 < 1 ? Btn.RIGHT | Btn.FIRE | Btn.JET : Btn.LEFT | Btn.FIRE;
  p.send({ t: "input", frames: [{ seq: ++seq, b, aim: seq / 50 }, { seq: ++seq, b, aim: seq / 50 }] });
  p.drain();
  if (Date.now() >= nextSample) {
    nextSample += 5000;
    samples.push(await (await fetch(new URL("/healthz", base))).json());
  }
  await sleep(33);
}
p.send({ t: "end" });
await p.waitFor("save", () => true, 15_000);
p.quit();

const rss = samples.map((s) => s.rssMb);
console.log(JSON.stringify({ seconds, samples: samples.length, rssMb: { first: rss[0], max: Math.max(...rss), last: rss.at(-1) }, stepP95Ms: Math.max(...samples.map((s) => s.stepP95Ms)) }));
