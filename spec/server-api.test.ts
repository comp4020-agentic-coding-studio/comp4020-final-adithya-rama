import { describe, expect, inject, it } from "vitest";
import { TestPlayer } from "./lib/client.ts";

const baseUrl = inject("baseUrl");
describe("profile and saved room API", () => {
  it("serves process and feature evidence as HTML without arbitrary repository access", async () => {
    for (const path of ["/readme/PROCESS.md", "/readme/docs/FEATURES.md"]) {
      const response = await fetch(new URL(path, baseUrl));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(await response.text()).toContain("<h1");
    }
    expect((await fetch(new URL("/readme/mise.local.toml", baseUrl))).status).toBe(404);
    expect((await fetch(new URL("/readme/docs/../../mise.local.toml", baseUrl))).status).toBe(404);
  });
  it("rejects non-object request bodies and malformed preferences", async () => {
    const p = new TestPlayer(baseUrl); await p.visit();
    for (const body of [null, [], "bad", { prefs: null }, { prefs: [] }, { prefs: { bindings: { KeyA: 123 } } }]) {
      expect((await p.http("/api/me", { method: "PATCH", body })).status).toBe(400);
    }
    expect((await p.http("/api/rooms", { method: "POST", body: null })).status).toBe(400);
    expect((await p.http("/api/rooms", { method: "POST", body: { password: ["not-a-password"] } })).status).toBe(400);
  });
  it("saves sanitized cosmetics/preferences, merges updates and isolates presets", async () => {
    const p = new TestPlayer(baseUrl), other = new TestPlayer(baseUrl);
    await p.visit(); await other.visit();
    const avatar = { helmet: "visor", face: "robot", emblem: "bolt" };
    const saved = await p.http("/api/me", { method: "PATCH", body: { color: 123456, prefs: { avatar, muted: true, volume: 0.5, chatMuted: true, bindings: { KeyA: 1, ArrowUp: -6 }, ignored: "discard" } } });
    expect(saved.status).toBe(200);
    const changed = await p.http<any>("/api/me", { method: "PATCH", body: { prefs: { volume: 0.8 } } });
    expect(changed.body.profile.prefs).toEqual({ avatar, muted: true, volume: 0.8, chatMuted: true, bindings: { KeyA: 1, ArrowUp: -6 } });
    const created = await p.http<any>("/api/presets", { method: "POST", body: { name: "Flag night", settings: { mode: "flag", unlimitedFuel: true } } });
    expect(created.status).toBe(201);
    expect(created.body.preset.settings.mode).toBe("flag");
    const id = created.body.preset.id;
    expect((await other.http<any>("/api/presets")).body.presets).toEqual([]);
    expect((await other.http("/api/presets/" + id, { method: "DELETE" })).status).toBe(404);
    expect((await p.http<any>("/api/presets")).body.presets).toHaveLength(1);
    expect((await p.http("/api/presets/" + id, { method: "DELETE" })).status).toBe(200);
    expect((await p.http<any>("/api/me/weapons")).body.weapons).toEqual([]);
  });
  it("protects password rooms and lets a spectator watch without occupying a fighter slot", async () => {
    const host = new TestPlayer(baseUrl), watcher = new TestPlayer(baseUrl);
    await host.visit(); await watcher.visit();
    const created = await host.http<{ code: string }>("/api/rooms", { method: "POST", body: { password: "private", isPublic: false, settings: { mode: "training", bots: 1 } } });
    await host.connect(); await watcher.connect();
    try {
      host.send({ t: "join", code: created.body.code, password: "private" }); await host.waitFor("room");
      watcher.send({ t: "join", code: created.body.code, password: "wrong", spectate: true });
      expect((await watcher.waitFor("error")).message).toMatch(/password/);
      watcher.send({ t: "join", code: created.body.code, password: "private", spectate: true });
      const joined = await watcher.waitFor("room");
      expect(joined.room.members.find((m) => m.key === watcher.profile.id)?.spectator).toBe(true);
      host.send({ t: "start" });
      const match = await watcher.waitFor("match");
      expect(match.you).toBeNull();
      expect((await watcher.waitFor("snap")).players).toHaveLength(2);
      host.send({ t: "end" });
      await host.waitFor("save", (m) => m.save === "saved");
      expect((await watcher.http("/api/matches/" + match.matchId)).status).toBe(404);
      expect((await host.http("/api/matches/" + match.matchId)).status).toBe(200);
    } finally { host.quit(); watcher.quit(); }
  });
});
