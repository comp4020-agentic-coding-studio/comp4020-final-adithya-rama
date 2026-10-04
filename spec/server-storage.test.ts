import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Db } from "../src/server/db.ts";
import { defaultSettings } from "../src/shared/settings.ts";
import type { MatchResult } from "../src/shared/types.ts";
import { sanitizePrefs } from "../src/server/validation.ts";

const opened: Db[] = [];
const directories: string[] = [];
async function database(path?: string) {
  const dir = path ? null : mkdtempSync(join(tmpdir(), "jet-storage-test-"));
  if (dir) directories.push(dir);
  const file = path ?? join(dir!, "game.db");
  const db = new Db(file); opened.push(db); await db.ready;
  return { db, file };
}
afterEach(async () => {
  for (const db of opened.splice(0)) await db.close().catch(() => {});
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
async function seed(db: Db, matchId = "round", mode = "tdm") {
  await db.call("createGuest", { tokenHash: "token", id: "pilot", name: "Pilot", color: 123 });
  await db.call("createMatch", { id: matchId, roomCode: "ABCDE", mode, map: "outpost-yard", settings: JSON.stringify(defaultSettings()) });
}
function result(matchId = "round", mode: MatchResult["mode"] = "tdm"): MatchResult {
  return {
    matchId, mode, map: "outpost-yard", reason: "time", draw: false, winnerTeam: 0, winnerKeys: ["pilot"],
    teamScores: [2, 0], durationSec: 120, endedAt: new Date().toISOString(), scoringNote: "Kills",
    participants: [{ key: "pilot", profileId: "pilot", name: "Pilot", team: 0, bot: false, kills: 2, deaths: 1,
      assists: 1, deliveries: 0, score: 5, mvp: true, weaponStats: { uzi: { shots: 10, hits: 4, damage: 200, kills: 2 } } }],
  };
}
describe("durable server storage", () => {
  it("finalizes idempotently and stores per-weapon totals once", async () => {
    const { db } = await database(); await seed(db);
    expect(await db.call("finalize", { result: result() })).toEqual({ duplicate: false });
    expect(await db.call("finalize", { result: result() })).toEqual({ duplicate: true });
    const profile = await db.call<any>("sessionProfile", { tokenHash: "token" });
    expect(profile.matches).toBe(1); expect(profile.kills).toBe(2); expect(profile.wins).toBe(1);
    expect(await db.call("weaponStats", { profileId: "pilot" })).toEqual([{ weapon: "uzi", shots: 10, hits: 4, damage: 200, kills: 2 }]);
  });
  it("keeps training totals separate and checks match ownership", async () => {
    const { db } = await database(); await seed(db, "round", "training");
    await db.call("finalize", { result: result("round", "training") });
    const profile = await db.call<any>("sessionProfile", { tokenHash: "token" });
    expect(profile.matches).toBe(0);
    expect(await db.call("weaponStats", { profileId: "pilot" })).toEqual([]);
    expect(await db.call("match", { id: "round", profileId: "another" })).toBeNull();
    expect(await db.call("match", { id: "round", profileId: "pilot" })).not.toBeNull();
  });
  it("restores completed results and interrupts only live checkpointed rounds", async () => {
    const first = await database(); await seed(first.db);
    await first.db.call("finalize", { result: result() });
    await first.db.call("createMatch", { id: "partial", roomCode: "ABCDE", mode: "tdm", map: "outpost-yard", settings: "{}" });
    await first.db.call("checkpoint", { matchId: "partial", participants: result().participants });
    await first.db.close();
    const { db } = await database(first.file);
    expect(await db.call("interruptLive")).toBe(1);
    const history = await db.call<any[]>("history", { profileId: "pilot", before: null, limit: 20 });
    expect(history.find((m) => m.id === "round").status).toBe("completed");
    expect(history.find((m) => m.id === "partial").status).toBe("interrupted");
    expect(history.find((m) => m.id === "partial").won).toBe(0);
    expect(history.find((m) => m.id === "partial").mvp).toBe(0);
    await expect(db.call("finalize", { result: result("partial") })).rejects.toThrow(/interrupted/);
  });
  it("coalesces pending checkpoints and finalization cannot be overwritten", async () => {
    const { db } = await database(); await seed(db);
    const busy = db.call("history", { profileId: "pilot", before: null, limit: 20 });
    const first = db.call("checkpoint", { matchId: "round", participants: result().participants });
    const changed = result().participants.map((p) => ({ ...p, kills: 9 }));
    const second = db.call("checkpoint", { matchId: "round", participants: changed });
    expect(db.queueDepth).toBeLessThanOrEqual(2);
    await Promise.all([busy, first, second]);
    const detail = await db.call<any>("match", { id: "round" });
    expect(detail.participants[0].kills).toBe(9);
    await db.call("finalize", { result: result() });
    expect(await db.call("checkpoint", { matchId: "round", participants: changed })).toBe(false);
    expect((await db.call<any>("match", { id: "round" })).participants[0].kills).toBe(2);
  });
  it("isolates saved presets by profile owner", async () => {
    const { db } = await database(); await seed(db);
    await db.call("savePreset", { id: "preset", profileId: "pilot", name: "Jet night", settings: JSON.stringify(defaultSettings()) });
    expect(await db.call("presets", { profileId: "other" })).toEqual([]);
    expect(await db.call("deletePreset", { id: "preset", profileId: "other" })).toBe(false);
    expect((await db.call<any[]>("presets", { profileId: "pilot" }))[0].settings.mode).toBe("tdm");
    expect(await db.call("deletePreset", { id: "preset", profileId: "pilot" })).toBe(true);
  });
  it("rejects unknown operations without wedging subsequent database work", async () => {
    const { db } = await database();
    await expect(db.call("simulate-storage-failure")).rejects.toThrow(/unknown op/);
    expect(await db.call("interruptLive")).toBe(0);
  });
});
describe("profile preference validation", () => {
  it("rejects non-object data and invalid bindings and keeps only known keys", () => {
    expect(() => sanitizePrefs(null)).toThrow();
    expect(() => sanitizePrefs([])).toThrow();
    expect(() => sanitizePrefs({ bindings: { KeyA: 3 } })).toThrow();
    expect(() => sanitizePrefs({ volume: 2 })).toThrow();
    expect(sanitizePrefs({ volume: 0.4, ignored: "x", bindings: { KeyA: 1, ArrowLeft: -4 } }, { muted: true }))
      .toEqual({ muted: true, volume: 0.4, bindings: { KeyA: 1, ArrowLeft: -4 } });
  });
});
