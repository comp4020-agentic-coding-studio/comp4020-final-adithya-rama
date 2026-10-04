import WebSocket from "ws";
import { describe, expect, inject, it } from "vitest";
import { Btn } from "../src/shared/types.ts";
import { sleep, TestPlayer } from "./lib/client.ts";

// Crit 8: "a stranger can visit, do the core thing, and find their trace
// still there when they come back". The core thing is playing a round; the
// trace is the saved result in the pilot's match history.
const baseUrl = inject("baseUrl");

async function playInputs(p: TestPlayer, ms: number, b: number): Promise<void> {
  let seq = 0;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    p.send({ t: "input", frames: [{ seq: ++seq, b, aim: 0 }, { seq: ++seq, b, aim: 0 }] });
    await sleep(33);
  }
}

describe("proof of life", () => {
  it("a stranger plays a round and finds it in their history when they come back", async () => {
    const stranger = new TestPlayer(baseUrl);
    const profile = await stranger.visit();
    expect(stranger.cookie).toMatch(/^js_sid=/);

    const created = await stranger.http<{ code: string }>("/api/rooms", {
      method: "POST",
      body: { isPublic: false, settings: { mode: "training", bots: 1, durationMin: 2 } },
    });
    expect(created.status).toBe(201);

    await stranger.connect();
    stranger.send({ t: "join", code: created.body.code });
    await stranger.waitFor("room", (m) => m.room.state === "lobby");
    stranger.send({ t: "start" });
    const match = await stranger.waitFor("match");
    expect(match.you).not.toBeNull();
    const snap = await stranger.waitFor("snap");
    expect(snap.players.length).toBe(2);

    await playInputs(stranger, 600, Btn.RIGHT | Btn.FIRE);
    const moved = await stranger.waitFor("snap");
    const me = moved.players.find((p) => p.id === match.you)!;
    expect(me).toBeDefined();
    expect(moved.ack).toBeGreaterThan(0);

    stranger.send({ t: "end" });
    const results = await stranger.waitFor("results");
    expect(results.result.matchId).toBe(match.matchId);
    expect(results.result.scoringNote).toMatch(/kills/);
    await stranger.waitFor("save", (m) => m.matchId === match.matchId);
    stranger.quit();

    // coming back later: same browser cookie, fresh connection
    const again = await stranger.http<{ profile: { id: string } }>("/api/me");
    expect(again.body.profile.id).toBe(profile.id);
    const history = await stranger.http<{ matches: { id: string; status: string; mode: string }[] }>("/api/me/matches");
    const entry = history.body.matches.find((m) => m.id === match.matchId);
    expect(entry, "the round is in the stranger's history").toBeDefined();
    expect(entry!.status).toBe("completed");
    expect(entry!.mode).toBe("training");

    const detail = await stranger.http<{ match: { participants: unknown[] } }>(`/api/matches/${match.matchId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.match.participants.length).toBe(2);
  }, 30_000);

  it("a different visitor is a different pilot with their own history", async () => {
    const other = new TestPlayer(baseUrl);
    const p = await other.visit();
    const history = await other.http<{ matches: unknown[] }>("/api/me/matches");
    expect(history.body.matches).toEqual([]);
    const me = await other.http<{ profile: { id: string } }>("/api/me");
    expect(me.body.profile.id).toBe(p.id);
  });

  it("a renamed pilot keeps the new name on return", async () => {
    const p = new TestPlayer(baseUrl);
    await p.visit();
    const res = await p.http("/api/me", { method: "PATCH", body: { name: "Ace Pilot" } });
    expect(res.status).toBe(200);
    const me = await p.http<{ profile: { name: string } }>("/api/me");
    expect(me.body.profile.name).toBe("Ace Pilot");
    const bad = await p.http("/api/me", { method: "PATCH", body: { name: "<script>" } });
    expect(bad.status).toBe(200);
    const bad2 = await p.http("/api/me", { method: "PATCH", body: { name: "" } });
    expect(bad2.status).toBe(400);
  });

  it("two pilots in one team round see the same outcome", async () => {
    const host = new TestPlayer(baseUrl);
    const guest = new TestPlayer(baseUrl);
    await host.visit();
    await guest.visit();
    const { body } = await host.http<{ code: string }>("/api/rooms", {
      method: "POST",
      body: { isPublic: false, settings: { mode: "tdm", durationMin: 2 } },
    });
    await host.connect();
    await guest.connect();
    host.send({ t: "join", code: body.code });
    await host.waitFor("room");
    guest.send({ t: "join", code: body.code });
    const view = await guest.waitFor("room", (m) => m.room.members.length === 2);
    const teams = view.room.members.map((m) => m.team).sort();
    expect(teams).toEqual([0, 1]);

    // a guest can't change settings or start the round
    guest.send({ t: "settings", settings: { durationMin: 15 } });
    expect((await guest.waitFor("error")).message).toMatch(/host/);
    guest.send({ t: "start" });
    expect((await guest.waitFor("error")).message).toMatch(/host/);

    host.send({ t: "start" });
    const [mh, mg] = await Promise.all([host.waitFor("match"), guest.waitFor("match")]);
    expect(mh.matchId).toBe(mg.matchId);
    // fabricated messages carry no authority
    guest.send({ t: "damage", target: mh.you, amount: 999 });
    guest.send({ t: "score", team: 1 });
    await Promise.all([playInputs(host, 400, Btn.LEFT), playInputs(guest, 400, Btn.RIGHT)]);
    host.send({ t: "end" });
    const [rh, rg] = await Promise.all([host.waitFor("results"), guest.waitFor("results")]);
    expect(rh.result).toEqual(rg.result);
    expect(rh.result.teamScores).toEqual([0, 0]);
    expect(rh.result.draw).toBe(true);
    await host.waitFor("save");
    host.quit();
    guest.quit();
  }, 30_000);

  it("a dropped pilot reconnects to the same seat without a fresh player", async () => {
    const p = new TestPlayer(baseUrl);
    await p.visit();
    const { body } = await p.http<{ code: string }>("/api/rooms", {
      method: "POST",
      body: { isPublic: false, settings: { mode: "training", bots: 1 } },
    });
    await p.connect();
    p.send({ t: "join", code: body.code });
    await p.waitFor("room");
    p.send({ t: "start" });
    const first = await p.waitFor("match");
    p.close();
    await sleep(300);
    p.drain();
    await p.connect();
    p.send({ t: "join", code: body.code });
    const second = await p.waitFor("match");
    expect(second.matchId).toBe(first.matchId);
    expect(second.you).toBe(first.you);
    const snap = await p.waitFor("snap");
    expect(snap.players.filter((pl) => pl.id === first.you).length).toBe(1);
    p.send({ t: "end" });
    await p.waitFor("save");
    p.quit();
  }, 30_000);
});

describe("refusals", () => {
  it("a socket without a session is refused", async () => {
    const url = new URL("/ws", baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url);
    const status = await new Promise<number>((resolve) => {
      ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      ws.on("open", () => resolve(101));
    });
    expect(status).toBe(401);
  });

  it("a cross-origin socket is refused", async () => {
    const p = new TestPlayer(baseUrl);
    await p.visit();
    const url = new URL("/ws", baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url, { headers: { Cookie: p.cookie, Origin: "https://evil.example" } });
    const status = await new Promise<number>((resolve) => {
      ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      ws.on("open", () => resolve(101));
    });
    expect(status).toBe(403);
  });

  it("the health check answers", async () => {
    const res = await fetch(new URL("/healthz", baseUrl));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
