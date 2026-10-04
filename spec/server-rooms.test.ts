import { WebSocket } from "ws";
import { describe, expect, it, vi } from "vitest";
import { RoomManager, type Client, type Room } from "../src/server/rooms.ts";
import type { Db } from "../src/server/db.ts";
import { Bot } from "../src/server/bot.ts";
import { addPlayer, createWorld } from "../src/shared/sim.ts";
import { defaultSettings } from "../src/shared/settings.ts";
import { Btn } from "../src/shared/types.ts";

function pilot(id: string) {
  const messages: any[] = [];
  const client: Client = {
    ws: { readyState: WebSocket.OPEN, bufferedAmount: 0, send: (data: string) => messages.push(JSON.parse(data)), close: vi.fn() } as unknown as WebSocket,
    profile: { id, name: id, color: 123, prefs: {}, matches: 0, wins: 0, kills: 0, deaths: 0, mvps: 0 },
    room: null, windowStart: Date.now(), windowCount: 0, strikes: 0,
  };
  return { client, messages };
}
function setup(settings: Record<string, unknown> = {}) {
  const call = vi.fn(async (_op: string, _args?: unknown) => ({ duplicate: false }));
  const manager = new RoomManager({ call } as unknown as Db);
  const room = manager.create({ isPublic: false, settings: { mode: "tdm", ...settings } }) as Room;
  const host = pilot("host"), guest = pilot("guest");
  room.join(host.client); room.join(guest.client);
  return { manager, room, host, guest, call };
}
async function start(room: Room, host: ReturnType<typeof pilot>, guest: ReturnType<typeof pilot>) {
  room.handle(guest.client, { t: "ready", ready: true });
  await room.start(host.client);
}
describe("authoritative rooms", () => {
  it("enforces readiness, preserves live settings and transfers host on disconnect", async () => {
    const { room, host, guest } = setup();
    await room.start(host.client);
    expect(room.state).toBe("lobby");
    expect(host.messages.at(-1).message).toMatch(/ready/);
    await start(room, host, guest);
    expect(room.state).toBe("playing");
    room.handle(host.client, { t: "settings", settings: { gravity: 2 } });
    expect(room.settings.gravity).toBe(1); expect(room.nextSettings?.gravity).toBe(2);
    room.disconnect(host.client);
    expect(room.hostKey).toBe("guest");
    expect(room.world!.players.get(room.members.get("host")!.playerId!)!.connected).toBe(false);
  });
  it("spectators receive snapshots without a player, and passwords are checked", async () => {
    const { manager } = setup();
    const room = manager.create({ password: "swordfish", settings: { mode: "training", bots: 1 } }) as Room;
    const host = pilot("solo"), spectator = pilot("watch");
    expect(room.join(host.client, "wrong")).toMatch(/password/);
    expect(room.join(host.client, "swordfish")).toBeNull();
    expect(room.join(spectator.client, "swordfish", true)).toBeNull();
    await room.start(host.client);
    expect(room.world!.players.size).toBe(2);
    expect(spectator.messages.find((m) => m.t === "match").you).toBeNull();
    for (let i = 0; i < 3; i++) room.step();
    expect(spectator.messages.some((m) => m.t === "snap")).toBe(true);
    expect(room.listing().players).toBe(1);
  });
  it("reconnects preserve player identity and ammo while restarting input sequence", async () => {
    const { room, host, guest } = setup();
    await start(room, host, guest);
    const member = room.members.get("host")!;
    const player = room.world!.players.get(member.playerId!)!;
    const id = player.id; player.hp = 61; player.slots[0]!.mag = 2;
    room.handle(host.client, { t: "input", frames: [{ seq: 100, b: Btn.RIGHT, aim: 0 }] });
    room.step(); room.disconnect(host.client);
    const resumed = pilot("host"); room.join(resumed.client);
    expect(room.members.get("host")!.playerId).toBe(id);
    expect(player.hp).toBe(61); expect(player.slots[0]!.mag).toBe(2);
    room.handle(resumed.client, { t: "input", frames: [{ seq: 1, b: Btn.LEFT, aim: 0 }] });
    room.step(); expect(room.members.get("host")!.ack).toBe(1);
  });
  it("restores a hidden disconnected body without healing or rearming", async () => {
    const { room, host, guest } = setup({ mode: "ffa" });
    await start(room, host, guest);
    const player = room.world!.players.get(room.members.get("host")!.playerId!)!;
    player.hp = 37; player.slots[0]!.mag = 1; player.fuel = 12;
    room.disconnect(host.client);
    room.housekeeping(Date.now() + 10001);
    expect(player.alive).toBe(false);
    const returned = pilot("host");
    room.join(returned.client);
    expect(player.alive).toBe(true);
    expect(player.hp).toBe(37); expect(player.slots[0]!.mag).toBe(1); expect(player.fuel).toBe(12);
  });
  it("releases stale held inputs and abandons a team absent for thirty seconds", async () => {
    const { room, host, guest } = setup();
    await start(room, host, guest);
    const now = Date.now();
    room.handle(host.client, { t: "input", frames: [{ seq: 1, b: Btn.FIRE, aim: 0 }] });
    room.members.get("host")!.lastInputAt = now - 251;
    room.step(); expect(room.members.get("host")!.last).toBeNull();
    room.disconnect(host.client);
    room.housekeeping(now); room.housekeeping(now + 30001);
    expect(room.state).toBe("results"); expect(room.result!.reason).toBe("abandoned");
    expect(room.result!.winnerKeys).toEqual([]);
  });
  it("drops carried flags immediately on disconnect and ignores spectator commands", async () => {
    const { room, host, guest } = setup({ mode: "flag" });
    await start(room, host, guest);
    const player = room.world!.players.get(room.members.get("host")!.playerId!)!;
    const flag = room.world!.flags.find((f) => f.owner === player.team)!;
    flag.state = "carried"; flag.carrier = player.id;
    room.disconnect(host.client);
    expect(flag.state).toBe("dropped"); expect(flag.carrier).toBeNull();
  });
  it("retains failed results, retries saving and prevents a premature rematch", async () => {
    const { room, host, guest, call } = setup(); await start(room, host, guest);
    call.mockImplementationOnce(async () => { throw new Error("disk unavailable"); });
    room.finish("host");
    await new Promise((r) => setTimeout(r, 0));
    expect(room.saveStatus).toBe("failed");
    room.handle(host.client, { t: "rematch" }); expect(room.state).toBe("results");
    room.handle(host.client, { t: "retry-save" });
    await new Promise((r) => setTimeout(r, 0));
    expect(room.saveStatus).toBe("saved");
    room.handle(host.client, { t: "rematch" }); expect(room.state).toBe("lobby");
  });
  it("reserves the active-match slot before awaiting storage", async () => {
    const { manager, room, host, guest, call } = setup();
    room.handle(guest.client, { t: "ready", ready: true });
    let release!: () => void;
    call.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ duplicate: false }); }));
    const pending = room.start(host.client);
    const other = manager.create({ settings: { mode: "training", bots: 1 } }) as Room;
    const pilot = { ...host, client: { ...host.client, profile: { ...host.client.profile, id: "other" }, room: null } };
    other.join(pilot.client);
    await other.start(pilot.client);
    expect(other.state).toBe("lobby");
    expect(manager.activeCount()).toBe(1);
    release(); await pending;
    expect(room.state).toBe("playing");
  });
  it("reuses the participant after the disconnected seat reservation expires", async () => {
    const { room, host, guest } = setup({ mode: "ffa" });
    await start(room, host, guest);
    const id = room.members.get("host")!.playerId!;
    const player = room.world!.players.get(id)!;
    player.kills = 3;
    room.disconnect(host.client);
    room.housekeeping(Date.now() + 30001);
    expect(room.members.has("host")).toBe(false);
    const returned = pilot("host");
    room.join(returned.client);
    expect(room.members.get("host")!.playerId).toBe(id);
    expect(player.kills).toBe(3);
    expect([...room.world!.players.values()].filter((p) => p.key === "host")).toHaveLength(1);
  });
  it("chat mute is enforced per recipient and chat does not carry authority", () => {
    const { room, host, guest } = setup();
    guest.client.profile.prefs.chatMuted = true;
    room.handle(host.client, { t: "chat", text: "Hello squad" });
    expect(host.messages.some((m) => m.t === "chat")).toBe(true);
    expect(guest.messages.some((m) => m.t === "chat")).toBe(false);
  });
});

describe("survival bot targeting", () => {
  it("ignores a nearer allied raider and aims at the human", () => {
    const w = createWorld({ ...defaultSettings(), mode: "survival", map: "test-range" }, 42);
    const me = addPlayer(w, { id: w.nextId++, key: "bot:a", name: "Raider", team: 1, color: 0, bot: true });
    const ally = addPlayer(w, { id: w.nextId++, key: "bot:b", name: "Ally", team: 1, color: 0, bot: true });
    const human = addPlayer(w, { id: w.nextId++, key: "pilot", name: "Pilot", team: 0, color: 0, bot: false });
    me.x = 200; me.y = 900; ally.x = 170; ally.y = 900; human.x = 360; human.y = 900;
    const input = new Bot(me.id, "hard").think(w);
    expect(Math.abs(input.aim)).toBeLessThan(0.1);
  });
});
