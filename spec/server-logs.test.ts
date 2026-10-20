import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomManager, type Client, type Room } from "../src/server/rooms.ts";
import type { Db } from "../src/server/db.ts";

// Crit 10: the server log has to say who did what, so two people in separate
// browsers can be told apart from `flyctl logs` alone.
function pilot(id: string, name: string) {
  const client: Client = {
    ws: { readyState: WebSocket.OPEN, bufferedAmount: 0, send: () => {}, close: vi.fn() } as unknown as WebSocket,
    profile: { id, name, color: 123, prefs: {}, matches: 0, wins: 0, kills: 0, deaths: 0, mvps: 0 },
    room: null, windowStart: Date.now(), windowCount: 0, strikes: 0,
  };
  return client;
}

let lines: Record<string, unknown>[] = [];
let quiet: string | undefined;
beforeEach(() => {
  lines = [];
  quiet = process.env.LOG_QUIET;
  delete process.env.LOG_QUIET;
  vi.spyOn(console, "log").mockImplementation((s: string) => { lines.push(JSON.parse(s)); });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (quiet !== undefined) process.env.LOG_QUIET = quiet;
});

const events = (name: string) => lines.filter((l) => l.event === name);

describe("server logs tell people apart", () => {
  it("names the person behind each join, accepted action and refusal", async () => {
    const manager = new RoomManager({ call: vi.fn(async () => ({ duplicate: false })) } as unknown as Db);
    const room = manager.create({ isPublic: false, settings: { mode: "tdm" } }) as Room;
    const host = pilot("id-host", "Pilot-AAAA"), guest = pilot("id-guest", "Pilot-BBBB");
    room.join(host); room.join(guest);

    expect(events("join").map((l) => [l.profile, l.name])).toEqual([["id-host", "Pilot-AAAA"], ["id-guest", "Pilot-BBBB"]]);

    room.handle(guest, { t: "settings", settings: { gravity: 2 } });
    expect(events("rejected")).toEqual([expect.objectContaining({ profile: "id-guest", name: "Pilot-BBBB" })]);

    room.handle(host, { t: "settings", settings: { gravity: 2 } });
    expect(events("settings")).toEqual([expect.objectContaining({ profile: "id-host", name: "Pilot-AAAA" })]);

    room.handle(guest, { t: "ready", ready: true });
    expect(events("ready")).toEqual([expect.objectContaining({ name: "Pilot-BBBB", ready: true })]);

    await room.start(host);
    expect(events("start_requested")).toHaveLength(0); // start() called directly, not via a message
    room.handle(host, { t: "end" });
    expect(events("end_requested")).toEqual([expect.objectContaining({ name: "Pilot-AAAA" })]);
  });

  it("logs kills and flag actions by the names players see", () => {
    const manager = new RoomManager({ call: vi.fn(async () => ({ duplicate: false })) } as unknown as Db);
    const room = manager.create({ isPublic: false, settings: { mode: "tdm" } }) as Room;
    const r = room as unknown as { world: unknown; logGameEvent(e: unknown): void };
    r.world = { players: new Map([[1, { name: "Pilot-AAAA" }], [2, { name: "Pilot-BBBB" }]]) };
    r.logGameEvent({ t: "kill", killer: 1, victim: 2, w: "ak" });
    r.logGameEvent({ t: "flag", owner: 0, action: "pickup", by: 2 });
    r.logGameEvent({ t: "shot", by: 1, w: "ak", x1: 0, y1: 0, x2: 1, y2: 1, hit: false });

    expect(events("kill")).toEqual([expect.objectContaining({ by: "Pilot-AAAA", victim: "Pilot-BBBB", weapon: "ak" })]);
    expect(events("flag")).toEqual([expect.objectContaining({ by: "Pilot-BBBB", action: "pickup", team: 0 })]);
    expect(lines.some((l) => l.event === "shot")).toBe(false);
  });
});
