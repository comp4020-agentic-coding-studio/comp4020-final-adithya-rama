// Real keyboard inputs; assertions read authoritative snapshots and shot events.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import type { PlayerSnap, WorldSnapshot } from "../src/shared/types.ts";

const base = process.env.APP_URL ?? "http://localhost:8110";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
let you = -1, snapshot: WorldSnapshot | null = null;
const shots: { x1: number; y1: number; x2: number; y2: number }[] = [];
const errors: string[] = [];
const checks: string[] = [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(test: () => boolean, label: string) {
  const deadline = Date.now() + 10000;
  while (!test()) {
    if (Date.now() > deadline) throw Error("Timed out: " + label);
    await delay(30);
  }
}
function me(): PlayerSnap | undefined { return snapshot?.players.find(p => p.id === you); }
page.on("pageerror", e => errors.push(e.message));
page.on("websocket", ws => ws.on("framereceived", ({ payload }) => {
  const m = JSON.parse(String(payload));
  if (m.t === "match") you = m.you;
  if (m.t === "snap") {
    snapshot = m;
    shots.push(...m.events.filter((e: { t: string; by: number }) => e.t === "shot" && e.by === you));
  }
}));
try {
  await page.goto(base);
  await page.locator("#practice").waitFor();
  const response = await page.request.post(base + "/api/rooms", { data: {
    name: "Independent aim check", isPublic: false,
    settings: { mode: "training", map: "lunarcy", bots: 0, durationMin: 2,
      randomSpawns: false, unlimitedAmmo: true, loadout: ["uzi", null, null], mapPickups: false },
  } });
  assert.equal(response.status(), 201);
  const { code } = await response.json();
  await page.goto(base + "/r/" + code);
  await page.getByRole("button", { name: "Join room", exact: true }).click();
  await page.locator("#start:not(:disabled)").click();
  await page.locator("canvas").waitFor();
  await until(() => !!me(), "own snapshot");
  await page.keyboard.down("Numpad8");
  await page.keyboard.down("KeyA");
  await page.keyboard.down("Space");
  await until(() => shots.length >= 3 && Math.abs((me()?.aim ?? 0) + Math.PI / 2) < .02, "upward fire");
  assert.ok(shots.some(s => s.y2 < s.y1 && Math.abs(s.x2 - s.x1) < 15), "shots travel upward");
  checks.push("Numpad fires upward while moving left and boosting");
  await page.keyboard.up("Numpad8");
  await page.keyboard.up("KeyA");
  await page.keyboard.down("KeyD");
  await delay(600);
  assert.ok(Math.abs(me()!.aim + Math.PI / 2) < .02, "released aim survives direction reversal");
  checks.push("Released numpad aim stays upward after reversing movement");
  await page.keyboard.down("Numpad6");
  await delay(400);
  const before = shots.length;
  await page.keyboard.up("KeyD");
  await page.keyboard.down("KeyA");
  await until(() => shots.length > before && Math.abs(me()?.aim ?? 10) < .02, "rightward fire while reversing");
  checks.push("Held numpad fire stays rightward through another reversal");
  for (const key of ["Numpad6", "KeyA", "Space"]) await page.keyboard.up(key);
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/independent-aim.png" });
  assert.deepEqual(errors, []);
} finally {
  for (const key of ["Numpad8", "Numpad6", "KeyA", "KeyD", "Space"]) await page.keyboard.up(key).catch(() => {});
  if (await page.locator("canvas").count()) {
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "End round now", exact: true }).click();
    await page.getByText("Results saved to your match history.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Leave room", exact: true }).click();
  }
  await browser.close();
}
writeFileSync("test-results/independent-aim.json", JSON.stringify({ base, at: new Date().toISOString(), checks, errors }, null, 2));
console.log(JSON.stringify({ base, checks, errors }));
