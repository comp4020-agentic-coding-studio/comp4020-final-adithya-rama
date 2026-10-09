// Browser evidence only: authentic room setup, real keyboard controls and
// observed WebSocket traffic. No page-side game state or simulation is mutated.
// Usage: mise exec -- pnpm build && mise exec -- node scripts/browser-arsenal.ts
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Page } from "playwright";
import { Btn, type GameEvent, type PlayerSnap, type WorldSnapshot, type RoomSettings } from "../src/shared/types.ts";
import { WEAPONS, THROWABLES } from "../src/shared/weapons.ts";
import { MAPS } from "../src/shared/maps.ts";

const port = Number(process.env.ARSENAL_PORT ?? 8094);
const base = `http://127.0.0.1:${port}`;
const out = "test-results/browser-arsenal";
mkdirSync(out, { recursive: true });
const databaseDir = mkdtempSync(join(tmpdir(), "jet-skirmish-browser-arsenal-"));
const startedAt = new Date().toISOString();
const server = spawn(process.execPath, ["--max-old-space-size=160", "src/server/main.ts"], {
  env: { ...process.env, PORT: String(port), DB_PATH: join(databaseDir, "ephemeral.db") },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (b: Buffer) => { serverLog += b.toString(); });
server.stderr.on("data", (b: Buffer) => { serverLog += b.toString(); });

interface Capture {
  label: string;
  you: number | null;
  latest: WorldSnapshot | null;
  events: GameEvent[];
  projectileKinds: Set<string>;
  armedMine: boolean;
  gasArea: boolean;
  fireFrames: number;
  throwFrames: number;
  pickupFrames: number;
  dualFrames: number;
  snapshots: number;
  saved: boolean;
  errors: string[];
}
const freshCapture = (label: string): Capture => ({
  label, you: null, latest: null, events: [], projectileKinds: new Set(),
  armedMine: false, gasArea: false, fireFrames: 0, throwFrames: 0,
  pickupFrames: 0, dualFrames: 0, snapshots: 0, saved: false, errors: [],
});
let current = freshCapture("boot");
const problems: string[] = [];
const evidence: Record<string, unknown>[] = [];
const pageErrors: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function until(predicate: () => boolean, label: string, timeout = 5000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await delay(50);
  }
}
function own(): PlayerSnap {
  const p = current.latest?.players.find((p) => p.id === current.you);
  check(p, "missing local player snapshot");
  return p;
}
async function tap(page: Page, key: string, ms = 110): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
}
async function begin(page: Page, label: string, loadout: RoomSettings["loadout"], bots = 0, settings: Partial<RoomSettings> = {}): Promise<void> {
  current = freshCapture(label);
  console.log("BEGIN browser " + label);
  const response = await page.request.post(`${base}/api/rooms`, {
    data: { name: `Arsenal ${label}`, isPublic: false, settings: {
      mode: "training", map: "test-range", bots, botDifficulty: "hard",
      durationMin: 2, loadout, health: 2, flight: false, respawnSec: 1, ...settings,
    } },
  });
  check(response.status() === 201, `create ${label}: HTTP ${response.status()} ${await response.text()}`);
  const { code } = await response.json() as { code: string };
  await page.goto(`${base}/r/${code}`);
  await page.getByRole("button", { name: "Join room", exact: true }).click();
  await page.locator("#start").waitFor({ timeout: 10000 });
  await page.locator("#start").click();
  await page.locator("canvas").waitFor({ timeout: 10000 });
  await until(() => current.you !== null && current.latest !== null, "first authoritative snapshot");
  await page.locator(".hud-weapon").waitFor();
  await page.waitForTimeout(180);
}
async function finish(page: Page, label: string): Promise<void> {
  if (await page.locator("canvas").count()) {
    await page.locator('[data-el="menuButton"]').click();
    await page.getByRole("button", { name: "End round now", exact: true }).click();
  }
  await page.getByText("Results saved to your match history.", { exact: true }).waitFor({ timeout: 10000 });
  current.saved = true;
  await page.screenshot({ path: `${out}/${label}-results.png`, fullPage: true });
  await page.getByRole("button", { name: "Leave room", exact: true }).click();
  await page.locator("#practice").waitFor();
  await until(() => current.saved, "saved result");
  check(current.errors.length === 0, current.errors.join("; "));
}
function traceEvidence() {
  return {
    inputFrames: { fire: current.fireFrames, throw: current.throwFrames, pickup: current.pickupFrames, dual: current.dualFrames },
    snapshotCount: current.snapshots,
    projectileKinds: [...current.projectileKinds],
    eventTypes: [...new Set(current.events.map((e) => e.t))],
    saved: current.saved,
  };
}
async function moveTo(page: Page, x: number): Promise<void> {
  const deadline = Date.now() + 14000;
  let held = "";
  try {
    while (Math.abs(own().x - x) > 22) {
      check(Date.now() < deadline, `could not walk to x=${x}; stopped at ${own().x}`);
      const next = own().x < x ? "KeyD" : "KeyA";
      if (next !== held) {
        if (held) await page.keyboard.up(held);
        await page.keyboard.down(next); held = next;
      }
      await page.waitForTimeout(50);
    }
  } finally {
    if (held) await page.keyboard.up(held);
    await page.waitForTimeout(150);
  }
}

try {
  await until(() => serverLog.includes('"event":"listening"'), "server startup", 10000);
  const health = await fetch(`${base}/healthz`);
  check(health.ok, "isolated server is not healthy");
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text()); });
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      try {
        const msg = JSON.parse(String(payload)) as { t: string; frames?: { b: number }[] };
        if (msg.t === "input") for (const frame of msg.frames ?? []) {
          if (frame.b & Btn.FIRE) current.fireFrames++;
          if (frame.b & Btn.THROW) current.throwFrames++;
          if (frame.b & Btn.PICKUP) current.pickupFrames++;
          if (frame.b & Btn.DUAL) current.dualFrames++;
        }
      } catch { /* Non-JSON traffic does not establish gameplay evidence. */ }
    });
    socket.on("framereceived", ({ payload }) => {
      try {
        const msg = JSON.parse(String(payload));
        if (msg.t === "match") current.you = msg.you;
        if (msg.t === "error") current.errors.push(msg.message);
        if (msg.t === "save" && msg.save === "saved") current.saved = true;
        if (msg.t === "results" && msg.save === "saved") current.saved = true;
        if (msg.t === "snap") {
          current.latest = msg;
          current.snapshots++;
          current.events.push(...msg.events);
          if (current.events.length > 6000) current.events.splice(0, 1000);
          for (const pr of msg.projectiles) {
            current.projectileKinds.add(pr.k);
            if (pr.k === "mine" && pr.armed) current.armedMine = true;
          }
          if (msg.areas.some((a: { k: string }) => a.k === "gas")) current.gasArea = true;
        }
      } catch { /* Keep the browser running so page errors remain visible. */ }
    });
  });
  await page.goto(base);
  await page.locator("#practice").waitFor();

  const guns = Object.values(WEAPONS).filter((w) => w.category !== "equipment");
  for (const weapon of [...guns, WEAPONS.machete]) {
    try {
      await begin(page, weapon.id, [weapon.id, null, null]);
      const hudBefore = await page.locator(".hud-weapon").innerText();
      check(hudBefore.includes(weapon.name), `${weapon.id}: missing weapon name in HUD`);
      const before = own().slots[0]!.mag;
      await page.keyboard.down("ArrowRight");
      await page.keyboard.down("KeyJ");
      await page.waitForTimeout(600);
      await page.keyboard.up("KeyJ");
      await page.keyboard.up("ArrowRight");
      await page.waitForTimeout(180);
      const after = own().slots[0]!.mag;
      check(current.fireFrames > 0, `${weapon.id}: no real fire input sent`);
      if (weapon.behavior === "projectile") {
        check(current.projectileKinds.has(weapon.id), `${weapon.id}: no authoritative projectile snapshot`);
      } else if (weapon.behavior === "melee") {
        check(current.events.some((e) => e.t === "melee" && e.by === current.you), "machete: missing authoritative melee event");
      } else {
        check(current.events.some((e) => e.t === "shot" && e.by === current.you && e.w === weapon.id), `${weapon.id}: no authoritative shot event`);
      }
      if (weapon.category !== "equipment") check(after < before, `${weapon.id}: magazine did not decrease`);
      const hudAfter = await page.locator(".hud-weapon").innerText();
      await page.screenshot({ path: `${out}/${weapon.id}-game.png` });
      await finish(page, weapon.id);
      evidence.push({ item: weapon.id, status: "passed", behavior: weapon.behavior, hudBefore, hudAfter,
        magazineBefore: before, magazineAfter: after, ...traceEvidence(), screenshot: `${weapon.id}-game.png` });
      console.log(`PASS browser ${weapon.id}`);
    } catch (error) {
      console.error("CASE " + weapon.id + ": " + (error as Error).message);
      problems.push(`${weapon.id}: ${(error as Error).message}`);
      await page.screenshot({ path: `${out}/${weapon.id}-failed.png` });
      try { await finish(page, weapon.id); } catch { break; }
    }
  }

  try {
    await begin(page, "riot-shield", ["riot-shield", "mini-eagle", null], 1);
    await tap(page, "KeyF");
    check(own().dual, "shield: compatible sidearm did not enter dual wield");
    const deadline = Date.now() + 20000;
    while (!current.events.some((e) => e.t === "shield" && e.id === current.you) && Date.now() < deadline) {
      const me = own(), enemy = current.latest!.players.find((p) => p.id !== me.id && (p.f & 1));
      if (enemy) {
        // Mouse aiming raises the shield without the new keyboard aim-fire action.
        await page.mouse.move(enemy.x < me.x ? 120 : 1800, 525);
        if (Math.abs(enemy.x - me.x) > 260) await moveTo(page, enemy.x + (me.x < enemy.x ? -160 : 160));
      }
      await page.waitForTimeout(100);
    }
    const shieldEvents = current.events.filter((e) => e.t === "shield" && e.id === current.you).length;
    check(shieldEvents > 0, "shield: no frontal block observed against training bot");
    const hud = await page.locator(".hud-weapon").innerText();
    check(hud.includes("Riot shield") && hud.includes("DUAL"), "shield HUD missing equipment or dual state");
    await page.screenshot({ path: `${out}/riot-shield-game.png` });
    await finish(page, "riot-shield");
    evidence.push({ item: "riot-shield", status: "passed", hud, shieldEvents, ...traceEvidence() });
    console.log("PASS browser riot-shield");
  } catch (error) {
    problems.push(`riot-shield: ${(error as Error).message}`);
    await page.screenshot({ path: `${out}/riot-shield-failed.png` });
    try { await finish(page, "riot-shield"); } catch { /* Report below. */ }
  }

  try {
    await begin(page, "three-slots", ["mini-eagle", "uzi", "magnum"]);
    check(own().slots.length === 3, "third inventory slot missing in authoritative snapshot");
    check(await page.locator("[data-slot]").count() === 3, "HUD must show three weapon slots");
    for (const [key, slot] of [["Digit3", 2], ["Digit1", 0], ["Digit2", 1], ["Tab", 2]] as const) {
      await tap(page, key);
      await until(() => own().a === slot, key + " selects slot " + slot);
    }
    const before = own().slots.map((slot) => slot?.mag);
    await tap(page, "KeyF");
    check(own().dual && own().dualSlot === 0, "selected third slot must pair with first compatible slot");
    await page.keyboard.down("Numpad8");
    await page.waitForTimeout(450);
    await page.keyboard.up("Numpad8");
    await page.waitForTimeout(150);
    const after = own().slots.map((slot) => slot?.mag);
    check(after[0]! < before[0]! && after[2]! < before[2]!, "both paired weapons must spend their own ammo");
    check(after[1] === before[1], "carried third gun must not fire as a third hand");
    await tap(page, "KeyR");
    await until(() => own().slots[2]!.reloadEnd > 0, "third-slot reload starts");
    await until(() => own().slots[2]!.reloadEnd === 0 && own().slots[2]!.mag === WEAPONS.magnum.mag, "third-slot reload finishes");
    const droppedAmmo = own().slots[2]!.mag;
    await tap(page, "KeyX");
    await until(() => own().slots[2] === null, "third-slot drop");
    await tap(page, "KeyE");
    await until(() => own().slots[2]?.weapon === "magnum", "third-slot recovery");
    check(own().slots[2]!.mag === droppedAmmo, "dropped gun ammunition must survive pickup");
    const initialGrenade = own().throwable;
    await tap(page, "KeyT");
    check(own().throwable !== initialGrenade, "grenade cycle must move off the default frag");
    await page.screenshot({ path: out + "/three-slots-game.png" });
    await finish(page, "three-slots");
    evidence.push({ item: "three-slots", status: "passed", magazineBefore: before, magazineAfter: after, droppedAmmo, ...traceEvidence() });
    console.log("PASS browser three-slots");
  } catch (error) {
    problems.push("three-slots: " + (error as Error).message);
    await page.screenshot({ path: out + "/three-slots-failed.png" });
    try { await finish(page, "three-slots"); } catch { /* Report below. */ }
  }

  // Each effect gets an isolated round. Explicit allowlists include optional
  // EMP/mines, and spending before walking onto a pickup proves replenishment.
  for (const id of Object.keys(THROWABLES)) {
    const label = "throwable-" + id;
    try {
      await begin(page, label, ["mini-eagle", null, null], 0, { throwables: [id] });
      const spot = MAPS["test-range"].pickups.find((p) => p.kind === "throwable" && p.item === id)!;
      await moveTo(page, spot.x + 90);
      check(own().throwable === id, id + ": selected throwable missing");
      const before = own().throwables[id];
      const throwsBefore = current.throwFrames;
      // A vertical throw stays nearby, so flash can be observed on this pilot.
      await page.keyboard.down("Numpad8");
      await tap(page, "KeyG");
      await page.keyboard.up("Numpad8");
      await until(() => current.projectileKinds.has(id), id + " projectile snapshot");
      check(current.throwFrames > throwsBefore, id + ": no real throw input");
      const afterThrow = own().throwables[id];
      check(afterThrow < before, id + ": grenade inventory did not decrease");
      if (id === "frag" || id === "emp") await until(
        () => current.events.some((e) => e.t === "explode" && e.r === THROWABLES[id].radius),
        id + " authoritative explosion", 4500);
      if (id === "flash") {
        await until(() => current.events.some((e) => e.t === "flashbang") && own().flash > 0, "authoritative flash effect", 4500);
        check(current.events.some((e) => e.t === "flash" && e.id === current.you), "flash: local impairment event missing");
        await page.locator(".flash-overlay").waitFor({ state: "visible" });
        check(Number(await page.locator(".flash-overlay").evaluate((element) => getComputedStyle(element).opacity)) > 0, "flash overlay has no visible opacity");
      }
      if (id === "gas") await until(() => current.gasArea, "visible authoritative gas area", 4500);
      if (id === "mine") await until(() => current.armedMine, "mine attached and armed", 6500);
      const hud = await page.locator(".hud-weapon").innerText();
      check(hud.includes(THROWABLES[id].name), id + ": missing grenade HUD");
      await page.screenshot({ path: out + "/" + label + "-game.png" });
      await moveTo(page, spot.x);
      await until(() => (own().throwables[id] ?? 0) > afterThrow, id + " walk-up pickup replenishes spent inventory", 7000);
      const afterPickup = own().throwables[id];
      await finish(page, label);
      evidence.push({ item: id, status: "passed", hud, before, afterThrow, afterPickup, pickupX: spot.x,
        gasArea: id === "gas" ? current.gasArea : undefined, armedMine: id === "mine" ? current.armedMine : undefined, ...traceEvidence() });
      console.log("PASS browser throwable " + id);
    } catch (error) {
      problems.push(label + ": " + (error as Error).message);
      await page.screenshot({ path: out + "/" + label + "-failed.png" });
      try { await finish(page, label); } catch { /* Report below. */ }
    }
  }

  const historyResponse = await page.request.get(`${base}/api/me/matches?limit=50`);
  check(historyResponse.ok(), "personal match history is unavailable");
  const history = await historyResponse.json() as { matches: { status: string }[] };
  check(history.matches.length >= guns.length + 3 + Object.keys(THROWABLES).length && history.matches.every((match) => match.status === "completed"),
    "expected all arsenal cases to have saved, completed training sessions");
  evidence.push({ item: "history", httpStatus: historyResponse.status(), completedMatches: history.matches.length });
  if (pageErrors.length) problems.push(...pageErrors.map((p) => "browser error: " + p));
} catch (error) {
  problems.push(`harness: ${(error as Error).message}`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await Promise.race([new Promise<void>((resolve) => server.once("exit", () => resolve())), delay(5000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
  writeFileSync(join(out, "server.log"), serverLog);
  const report = { startedAt, endedAt: new Date().toISOString(), viewport: { width: 1920, height: 1080 },
    scope: "Real desktop browser input, HUD and authoritative network effects; no claim of damage/balance coverage for every weapon.",
    evidence, pageErrors, problems };
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  rmSync(databaseDir, { recursive: true, force: true });
}
if (problems.length) {
  for (const problem of problems) console.error("FAIL " + problem);
  process.exitCode = 1;
} else {
  console.log(`PASS browser arsenal: 21 firearms, machete, shield, three-slot inventory and five throwable types; evidence in ${out}`);
}
