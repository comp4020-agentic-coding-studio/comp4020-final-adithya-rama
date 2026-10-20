// URL-only UI entry in two isolated browser profiles. Security probes use the
// guest's real WebSocket; gameplay uses ordinary inputs, never injected state.
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { MAPS } from "../src/shared/maps.ts";

const base = process.env.APP_URL ?? "http://localhost:8108";
const tag = process.env.REPORT_TAG ?? "crit10";
mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch();
const failures: string[] = [];
const evidence: Record<string, unknown> = { base, startedAt: new Date().toISOString() };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(check: () => boolean, label: string, ms = 15000) {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw Error("Timed out: " + label);
    await sleep(30);
  }
}
function observe(page: Page) {
  const s = { room: null as any, start: null as any, snap: null as any, result: null as any, saved: false, errors: [] as string[], events: [] as any[] };
  page.on("pageerror", e => failures.push(e.message));
  page.on("websocket", ws => ws.on("framereceived", frame => {
    const m = JSON.parse(String(frame.payload));
    if (m.t === "room") s.room = m.room;
    if (m.t === "match") { s.start = m; s.result = null; s.saved = false; s.snap = null; }
    if (m.t === "snap") { s.snap = m; s.events.push(...m.events); }
    if (m.t === "results") { s.result = m.result; s.saved = m.save === "saved"; }
    if (m.t === "save") s.saved = m.save === "saved";
    if (m.t === "error") s.errors.push(m.message);
  }));
  return s;
}
type Observed = ReturnType<typeof observe>;
async function namePilot(page: Page, name: string) {
  await page.goto(base);
  await page.locator("#profile-button").click();
  await page.locator('#profile-form [name="name"]').fill(name);
  await page.locator('#profile-form [name="muted"]').check();
  await page.locator('#profile-form [name="reducedShake"]').check();
  const saved = page.waitForResponse(r => r.url().endsWith("/api/me") && r.request().method() === "PATCH");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  if (!(await saved).ok()) throw Error("Profile save failed");
  await page.locator("#profile-button").getByText(name, { exact: true }).waitFor();
  return await page.evaluate(async () => (await (await fetch("/api/me")).json()).profile);
}
async function select(page: Page, s: Observed, field: string, value: string) {
  await page.locator(`[data-setting="${field}"]`).selectOption(value);
  await until(() => String(s.room?.settings[field]) === value, field + " acknowledged");
}
async function reject(page: Page, s: Observed, message: object) {
  const count = s.errors.length;
  await page.evaluate(m => {
    const socket = (window as any).__critSocket as WebSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw Error("No guest connection");
    socket.send(JSON.stringify(m));
  }, message);
  await until(() => s.errors.length > count, "server rejection");
  if (!/host/i.test(s.errors.at(-1)!)) throw Error("Expected host-only rejection: " + s.errors.at(-1));
}
async function walk(page: Page, s: Observed, x: number) {
  await page.bringToFront();
  let held = "";
  try {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      const me = s.snap?.players.find((p: any) => p.id === s.start?.you);
      if (me && Math.abs(me.x - x) < 12) return;
      if (me) {
        const next = me.x < x ? "KeyD" : "KeyA";
        if (next !== held) {
          if (held) await page.keyboard.up(held);
          await page.keyboard.down(next); held = next;
        }
      }
      await sleep(30);
    }
    throw Error("Walk did not reach " + x);
  } finally { if (held) await page.keyboard.up(held); }
}
async function end(page: Page, a: Observed, b: Observed) {
  await page.bringToFront();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "End round now", exact: true }).click();
  await until(() => a.saved && b.saved && !!a.result && !!b.result, "both results committed");
  if (JSON.stringify(a.result) !== JSON.stringify(b.result)) throw Error("Results differ between profiles");
}
try {
  const health = await (await fetch(base + "/healthz")).json() as { active: number };
  if (health.active > 0) throw Error("Another match is active; rehearsal did not create or join a room.");
  const hostContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await guestContext.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols); (window as any).__critSocket = this;
      }
    };
  });
  const host = await hostContext.newPage(), guest = await guestContext.newPage();
  const h = observe(host), g = observe(guest);
  const hp = await namePilot(host, "C10 Host");
  const gp = await namePilot(guest, "C10 Guest");
  if (hp.id === gp.id) throw Error("Independent profiles received same identity");
  const hc = await hostContext.cookies(), gc = await guestContext.cookies();
  if (!hc.some(c => c.httpOnly) || !gc.some(c => c.httpOnly)) throw Error("Missing HttpOnly identity cookie");
  evidence.profiles = [{ id: hp.id, name: hp.name }, { id: gp.id, name: gp.name }];
  evidence.isolatedProfiles = true;
  evidence.httpOnlyCookies = true;

  await host.locator("#create summary").click();
  await host.locator('#create-form [name="name"]').fill("Crit 10 rehearsal");
  await host.locator('#create-form [name="map"]').selectOption("cryptworks");
  await host.locator('#create-form [name="isPublic"]').uncheck();
  await host.getByRole("button", { name: "Create room", exact: true }).click();
  await until(() => !!h.room, "created room");
  const code = h.room.code; evidence.room = code;
  await guest.locator("#join summary").click();
  await guest.locator("#code").fill(code);
  await guest.getByRole("button", { name: "Join room", exact: true }).click();
  await until(() => g.room?.members.length === 2 && h.room.members.length === 2, "both named members visible");
  if (!h.room.members.some((m: any) => m.name === gp.name)) throw Error("Joined with stale profile name");
  await host.locator(".advanced-rules summary").click();
  await host.locator('[data-setting="flight"]').uncheck();
  await until(() => h.room.settings.flight === false, "flight disabled");
  await host.locator('[data-setting="randomSpawns"]').uncheck();
  await until(() => h.room.settings.randomSpawns === false, "safe anchored spawn setting");
  await select(host, h, "bots", "0");
  await select(host, h, "durationMin", "2");
  await host.locator(".arsenal-settings summary").click();
  await host.locator('[data-loadout="0"]').selectOption("machete");
  await until(() => h.room.settings.loadout[0] === "machete", "machete loadout");
  await reject(guest, g, { t: "settings", settings: { damage: 2 } });
  await reject(guest, g, { t: "start" });
  if (h.room.settings.damage !== 1) throw Error("Guest changed host's damage setting");
  if (await guest.locator("#start").count()) throw Error("Guest sees host start button");
  await guest.locator("#ready").click();
  await until(() => h.room.members.some((m: any) => m.name === gp.name && m.ready), "live readiness");
  await host.screenshot({ path: `test-results/${tag}-lobby-desktop.png` });
  await guest.screenshot({ path: `test-results/${tag}-lobby-phone.png` });
  await host.locator("#start").click();
  await until(() => !!h.snap && !!g.snap, "both clients playing");
  const firstId = h.start.matchId;
  await reject(guest, g, { t: "end" });
  const hostBody = h.snap.players.find((p: any) => p.id === h.start.you);
  await walk(guest, g, hostBody.x + 30);
  await host.bringToFront();
  // Hold beyond an input-transmission interval; instantaneous press/release
  // can both occur between sampled game frames.
  await host.keyboard.down("ArrowRight"); await sleep(100); await host.keyboard.up("ArrowRight");
  evidence.beforeMelee = h.snap.players.map((p: any) => ({ id: p.id, x: p.x, y: p.y, aim: p.aim, hp: p.hp, flags: p.f, weapon: p.s[p.a] }));
  await host.keyboard.down("KeyV"); await sleep(100); await host.keyboard.up("KeyV");
  await until(() => h.events.some(e => e.t === "kill" && e.killer === h.start.you), "actual melee kill");
  await host.screenshot({ path: `test-results/${tag}-combat.png` });
  await end(host, h, g);
  evidence.combat = { matchId: firstId, identicalSavedResults: true, scores: h.result.teamScores };
  await reject(guest, g, { t: "rematch" });
  await host.locator("#rematch").click();
  await until(() => h.room.state === "lobby" && g.room.state === "lobby", "rematch lobby");
  await select(host, h, "mode", "flag");
  await guest.locator("#ready").click();
  await until(() => h.room.members.some((m: any) => m.name === gp.name && m.ready), "flag readiness");
  await host.locator("#start").click();
  await until(() => h.start.matchId !== firstId && !!h.snap && g.start.matchId === h.start.matchId && !!g.snap, "flag round");
  const team = h.start.roster.find((p: any) => p.id === h.start.you).team;
  const map = MAPS.cryptworks, home = map.flagHomes.find(f => f.team === team)!;
  await walk(host, h, home.x);
  await until(() => h.snap.flags.some((f: any) => f.carrier === h.start.you), "own flag picked up");
  const goal = map.goals.find(f => f.team !== team)!.rect;
  await walk(host, h, goal.x + goal.w / 2);
  await until(() => h.snap.ts[team] === 1 && g.snap.ts[team] === 1, "live shared delivery score");
  await end(host, h, g);
  evidence.flag = { matchId: h.result.matchId, team, deliveries: h.result.teamScores[team], identicalSavedResults: true };
  for (const [page, profile] of [[host, hp], [guest, gp]] as const) {
    const history = await page.evaluate(async () => await (await fetch("/api/me/matches")).json());
    if (![firstId, h.result.matchId].every(id => history.matches.some((m: any) => m.id === id))) throw Error(profile.name + " missing match history");
  }
  await host.locator("#rematch").click();
  await until(() => h.room.state === "lobby", "final lobby");
  await host.locator("#leave").click();
  await until(() => g.room.members.some((m: any) => m.key === g.room.you && m.host), "host transfer");
  evidence.hostTransferred = true;
  evidence.hostOnlyRejections = g.errors;
  await guest.locator("#leave").click();
  await host.reload();
  const returning = await host.evaluate(async () => (await (await fetch("/api/me")).json()).profile);
  if (returning.id !== hp.id) throw Error("Returning browser lost its identity");
  evidence.returningIdentityPreserved = true;
} catch (error) {
  failures.push((error as Error).stack ?? String(error));
} finally {
  await browser.close();
}
const report = { ...evidence, finishedAt: new Date().toISOString(), failures };
writeFileSync(`test-results/${tag}.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
if (failures.length) process.exitCode = 1;
