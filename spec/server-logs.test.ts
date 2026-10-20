import { WebSocket } from "ws";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomManager, type Client, type Room } from "../src/server/rooms.ts";
import type { Db } from "../src/server/db.ts";
import { Btn } from "../src/shared/types.ts";
import { TestPlayer } from "./lib/client.ts";

function pilot(id: string, name = "Same pilot") {
  const messages: any[] = [];
  const client: Client = {
    ws: { readyState: WebSocket.OPEN, bufferedAmount: 0, send: (s: string) => messages.push(JSON.parse(s)), close: vi.fn() } as unknown as WebSocket,
    profile: { id, name, color: 123, prefs: {}, matches: 0, wins: 0, kills: 0, deaths: 0, mvps: 0 },
    room: null, windowStart: Date.now(), windowCount: 0, strikes: 0,
  };
  return { client, messages };
}
function setup(mode = "tdm") {
  const manager = new RoomManager({ call: vi.fn(async () => ({ duplicate: false })) } as unknown as Db);
  const host = pilot("id-host"), guest = pilot("id-guest");
  const room = manager.create({ isPublic: false, settings: { mode, bots: 0, mapPickups: false, loadout: ["m93ba", null, null] } }, host.client.profile) as Room;
  room.join(host.client);
  if (mode !== "training") room.join(guest.client);
  return { manager, room, host, guest };
}
async function start(room: Room, host: ReturnType<typeof pilot>, guest?: ReturnType<typeof pilot>) {
  if (guest) room.handle(guest.client, { t: "ready", ready: true });
  room.handle(host.client, { t: "start" });
  await vi.waitFor(() => expect(room.state).toBe("playing"));
}
let lines: Record<string, unknown>[] = [];
let quiet: string | undefined;
beforeEach(() => {
  lines = []; quiet = process.env.LOG_QUIET; delete process.env.LOG_QUIET;
  vi.spyOn(console, "log").mockImplementation((s: string) => { lines.push(JSON.parse(s)); });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (quiet !== undefined) process.env.LOG_QUIET = quiet;
  else delete process.env.LOG_QUIET;
});
const events = (name: string) => lines.filter(l => l.event === name);

describe("server logs tell people apart through real room actions", () => {
  it("names creation, joins, accepted rules and refusals without accepting a guest's settings", async () => {
    const { room, host, guest } = setup();
    expect(events("room_created")).toEqual([expect.objectContaining({ profile: "id-host", name: "Same pilot" })]);
    expect(events("join").map(l => [l.profile, l.name])).toEqual([["id-host", "Same pilot"], ["id-guest", "Same pilot"]]);
    room.handle(guest.client, { t: "settings", settings: { gravity: 2 } });
    expect(room.settings.gravity).toBe(1);
    expect(events("rejected")).toEqual([expect.objectContaining({ profile: "id-guest", name: "Same pilot", action: "settings" })]);
    room.handle(host.client, { t: "settings", settings: { gravity: 2 } });
    expect(events("settings")).toEqual([expect.objectContaining({ profile: "id-host", changes: { gravity: 2 }, deferred: false })]);
    room.handle(guest.client, { t: "team", team: 1 });
    await start(room, host, guest);
    expect(events("team")).toEqual([expect.objectContaining({ profile: "id-guest", team: 1 })]);
    expect(events("ready")).toEqual([expect.objectContaining({ profile: "id-guest", ready: true })]);
    expect(events("start_requested")).toEqual([expect.objectContaining({ profile: "id-host" })]);
    room.handle(host.client, { t: "settings", settings: { gravity: .5 } });
    expect(room.settings.gravity).toBe(2);
    expect(events("settings").at(-1)).toMatchObject({ changes: { gravity: .5 }, deferred: true });
    room.handle(host.client, { t: "end" });
    await vi.waitFor(() => expect(room.saveStatus).toBe("saved"));
    expect(events("end_requested")).toEqual([expect.objectContaining({ profile: "id-host" })]);
    room.handle(host.client, { t: "rematch" });
    expect(events("rematch_requested")).toEqual([expect.objectContaining({ profile: "id-host" })]);
    room.handle(host.client, { t: "spectate", spectate: true });
    expect(room.hostKey).toBe("id-guest");
    expect(events("host_transfer").at(-1)).toMatchObject({ from: "id-host", to: "id-guest", profile: "id-guest", name: "Same pilot" });
    room.handle(host.client, { t: "ready", ready: true });
    expect(events("rejected").at(-1)).toMatchObject({ profile: "id-host", action: "ready" });
  });

  it("logs a simulation kill with distinct actor IDs even when both names match", async () => {
    const { room, host, guest } = setup("ffa"); await start(room, host, guest);
    const w = room.world!, shooter = w.players.get(room.members.get("id-host")!.playerId!)!, target = w.players.get(room.members.get("id-guest")!.playerId!)!;
    w.map = { ...w.map, solids: [{ x: 0, y: 900, w: w.map.width, h: 100 }], platforms: [] };
    Object.assign(shooter, { x: 200, y: 900, vx: 0, vy: 0, onGround: true, protectUntil: 0 });
    Object.assign(target, { x: 400, y: 900, vx: 0, vy: 0, onGround: true, protectUntil: 0, hp: 80 });
    room.handle(host.client, { t: "input", frames: [{ seq: 1, b: Btn.FIRE, aim: 0 }] }); room.step();
    expect(target.alive).toBe(false);
    expect(events("kill")).toEqual([expect.objectContaining({ by: "Same pilot", byProfile: "id-host", byPlayer: shooter.id,
      victim: "Same pilot", victimProfile: "id-guest", victimPlayer: target.id, weapon: "m93ba", match: room.matchId })]);
    for (let n = 0; n < 3; n++) room.step();
    expect(events("kill")).toHaveLength(1);
    expect(lines.some(l => ["shot", "hurt", "input"].includes(String(l.event)))).toBe(false);
  });

  it("logs and sends a disconnect flag drop once, without waiting for another simulation step", async () => {
    const { room, host, guest } = setup("flag"); await start(room, host, guest);
    const w = room.world!, p = w.players.get(room.members.get("id-host")!.playerId!)!;
    const home = w.map.flagHomes.find(h => h.team === p.team)!;
    Object.assign(p, { x: home.x, y: home.y, vx: 0, vy: 0, protectUntil: 0 });
    room.step();
    expect(events("flag")).toContainEqual(expect.objectContaining({ action: "pickup", byProfile: "id-host", byPlayer: p.id }));
    room.disconnect(host.client);
    expect(events("flag")).toContainEqual(expect.objectContaining({ action: "drop", byProfile: "id-host", by: "Same pilot" }));
    expect(events("disconnect").at(-1)).toMatchObject({ profile: "id-host", name: "Same pilot" });
    for (let n = 0; n < 3; n++) room.step();
    expect(events("flag").filter(e => e.action === "drop")).toHaveLength(1);
    expect(guest.messages.some(m => m.t === "snap" && m.events.some((e: any) => e.t === "flag" && e.action === "drop"))).toBe(true);
    const resumed = pilot("id-host"); room.join(resumed.client);
    expect(events("reconnect").at(-1)).toMatchObject({ profile: "id-host", name: "Same pilot" });
  });

  it("retains a final flag-drop log when the only fighter leaves and the room closes immediately", async () => {
    const { room, host } = setup("training"); await start(room, host);
    const w = room.world!, p = w.players.get(room.members.get("id-host")!.playerId!)!;
    const home = w.map.flagHomes.find(h => h.team === p.team)!;
    Object.assign(p, { x: home.x, y: home.y, vx: 0, vy: 0, protectUntil: 0 }); room.step();
    expect(w.flags.some(f => f.carrier === p.id)).toBe(true);
    room.leave(host.client);
    expect(room.closed).toBe(true);
    expect(events("flag").filter(e => e.action === "drop")).toEqual([expect.objectContaining({ byProfile: "id-host", match: room.matchId })]);
    await vi.waitFor(() => expect(room.saveStatus).toBe("saved"));
  });
});

describe("HTTP and socket identity logging", () => {
  it("logs guest/rename/create/denied flows, updates an unjoined socket's name, and enforces saved-data ownership", async () => {
    const temp = mkdtempSync(join(tmpdir(), "jet-crit10-logs-"));
    const listener = createServer(); await new Promise<void>(r => listener.listen(0, "127.0.0.1", r));
    const address = listener.address(); if (!address || typeof address === "string") throw Error("No test port");
    const port = address.port; await new Promise<void>(r => listener.close(() => r()));
    const child = spawn(process.execPath, ["src/server/main.ts"], { cwd: resolve(import.meta.dirname, ".."),
      env: { ...process.env, PORT: String(port), DB_PATH: join(temp, "test.sqlite"), LOG_QUIET: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    const captured: Record<string, unknown>[] = []; let pending = "";
    child.stdout.on("data", chunk => {
      pending += String(chunk);
      let newline: number;
      while ((newline = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        try { captured.push(JSON.parse(line)); } catch { /* runtime banners are not events */ }
      }
    });
    child.stderr.resume();
    const base = "http://127.0.0.1:" + port, a = new TestPlayer(base), b = new TestPlayer(base);
    try {
      await vi.waitFor(() => expect(captured.some(l => l.event === "listening")).toBe(true), { timeout: 10000 });
      const initialA = await a.visit(), initialB = await b.visit();
      await a.connect(); await b.connect(); await a.waitFor("welcome"); await b.waitFor("welcome");
      // PATCH occurs after socket creation but before any room membership.
      for (const p of [a, b]) expect((await p.http("/api/me", { method: "PATCH", body: { name: "Echo" } })).status).toBe(200);
      const preset = await a.http("/api/presets", { method: "POST", body: { name: "Own rules", settings: { mode: "training" } } });
      expect((await b.http("/api/presets")).body.presets).toEqual([]);
      expect((await b.http("/api/presets/" + preset.body.preset.id, { method: "DELETE" })).status).toBe(404);
      expect((await a.http("/api/presets")).body.presets).toHaveLength(1);
      const made = await a.http("/api/rooms", { method: "POST", body: { name: "Log rehearsal", isPublic: false, password: "test-room-password", settings: { mode: "training", bots: 0 } } });
      const code = made.body.code;
      a.send({ t: "join", code, password: "test-room-password" }); await a.waitFor("room");
      b.send({ t: "join", code, password: "wrong-test-password", spectate: true }); expect((await b.waitFor("error")).message).toMatch(/password/);
      b.send({ t: "join", code, password: "test-room-password", spectate: true }); const joined = await b.waitFor("room");
      expect(joined.room.members.every(m => m.name === "Echo")).toBe(true);
      b.send({ t: "settings", settings: { gravity: 2 } }); expect((await b.waitFor("error")).message).toMatch(/host/);
      a.send({ t: "chat", text: "private chat marker" });
      a.send({ t: "start" }); const match = await a.waitFor("match");
      expect(match.settings.gravity).toBe(1);
      a.send({ t: "end" }); await a.waitFor("save", m => m.save === "saved");
      expect((await a.http("/api/matches/" + match.matchId)).status).toBe(200);
      expect((await b.http("/api/matches/" + match.matchId)).status).toBe(404);
      expect((await b.http("/api/me/matches")).body.matches).toEqual([]);
      await vi.waitFor(() => expect(captured.some(l => l.event === "rejected" && l.action === "read_match")).toBe(true));
      for (const p of [initialA, initialB]) {
        expect(captured).toContainEqual(expect.objectContaining({ event: "guest_created", profile: p.id, name: p.name }));
        expect(captured).toContainEqual(expect.objectContaining({ event: "rename", profile: p.id, name: "Echo", from: p.name, to: "Echo" }));
      }
      expect(captured).toContainEqual(expect.objectContaining({ event: "room_created", profile: initialA.id, name: "Echo", room: code }));
      expect(captured).toContainEqual(expect.objectContaining({ event: "rejected", profile: initialB.id, name: "Echo", action: "join" }));
      expect(captured).toContainEqual(expect.objectContaining({ event: "rejected", profile: initialB.id, action: "delete_preset" }));
      const text = JSON.stringify(captured);
      for (const privateValue of [a.cookie, b.cookie, "test-room-password", "wrong-test-password", "private chat marker"])
        expect(text.includes(privateValue)).toBe(false);
    } finally {
      a.quit(); b.quit();
      const ended = new Promise<void>(r => child.once("exit", () => r()));
      if (child.exitCode === null) { child.kill("SIGTERM"); await ended; }
      rmSync(temp, { recursive: true, force: true });
    }
  }, 20000);
});
