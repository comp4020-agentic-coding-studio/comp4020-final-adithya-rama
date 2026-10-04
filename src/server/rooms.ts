import { randomInt, randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import {
  CHECKPOINT_MS,
  MAX_ACTIVE_ROOMS,
  MAX_INPUT_QUEUE,
  MAX_WAITING_ROOMS,
  PROTOCOL_VERSION,
  SEAT_RESERVE_MS,
  SNAPSHOT_RATE,
  TICK_RATE,
} from "../shared/constants.ts";
import type { ClientMessage, Profile, RoomListing, RoomState, RoomView, RosterEntry, SaveStatus, ServerMessage } from "../shared/protocol.ts";
import { MODE_NAMES, PVP_MODES, sanitizeSettings, TEAM_MODES } from "../shared/settings.ts";
import { addPlayer, computeResult, contributionScore, createWorld, snapshot, stepWorld, type World } from "../shared/sim.ts";
import { ALL_BUTTONS, type GameEvent, type InputFrame, type MatchResult, type RoomSettings, type Team } from "../shared/types.ts";
import { Bot } from "./bot.ts";
import type { Db } from "./db.ts";
import { log } from "./log.ts";

const BODY_VULNERABLE_MS = 10_000;
const EMPTY_ROOM_MS = 30_000;
const UNJOINED_ROOM_MS = 60_000;
const TICK_MS = 1000 / TICK_RATE;
const SNAP_EVERY = TICK_RATE / SNAPSHOT_RATE;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface Client {
  ws: WebSocket;
  profile: Profile;
  room: Room | null;
  windowStart: number;
  windowCount: number;
  strikes: number;
}

interface Member {
  key: string;
  profile: Profile;
  team: Team;
  ready: boolean;
  joinedAt: number;
  client: Client | null;
  disconnectedAt: number | null;
  playerId: number | null;
  queue: InputFrame[];
  last: InputFrame | null;
  lastQueuedSeq: number;
  ack: number;
}

export function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

export class Room {
  readonly code: string;
  name: string;
  isPublic: boolean;
  readonly createdAt = Date.now();
  settings: RoomSettings;
  state: RoomState = "lobby";
  members = new Map<string, Member>();
  hostKey: string | null = null;
  world: World | null = null;
  matchId: string | null = null;
  result: MatchResult | null = null;
  saveStatus: SaveStatus = "saving";
  private starting = false;
  private bots: Bot[] = [];
  private events: GameEvent[] = [];
  private lastCheckpoint = 0;
  private checkpointing = false;
  private emptySince: number | null = Date.now();
  closed = false;

  private manager: RoomManager;

  constructor(manager: RoomManager, code: string, opts: { name: string; isPublic: boolean; settings: RoomSettings }) {
    this.manager = manager;
    this.code = code;
    this.name = opts.name;
    this.isPublic = opts.isPublic;
    this.settings = opts.settings;
  }

  private get db(): Db {
    return this.manager.db;
  }

  listing(): RoomListing {
    return {
      code: this.code,
      name: this.name,
      state: this.state,
      mode: this.settings.mode,
      map: this.settings.map,
      players: this.members.size,
      capacity: this.settings.capacity,
    };
  }

  view(forKey: string): RoomView {
    return {
      code: this.code,
      name: this.name,
      isPublic: this.isPublic,
      state: this.state,
      settings: this.settings,
      members: [...this.members.values()].map((m) => ({
        key: m.key,
        name: m.profile.name,
        color: m.profile.color,
        team: m.team,
        ready: m.ready,
        host: m.key === this.hostKey,
        connected: m.client !== null,
      })),
      you: forKey,
    };
  }

  private broadcastRoom(): void {
    for (const m of this.members.values()) if (m.client) send(m.client.ws, { t: "room", room: this.view(m.key) });
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const m of this.members.values()) {
      if (m.client && m.client.ws.readyState === WebSocket.OPEN) m.client.ws.send(data);
    }
  }

  private teamFor(excludeKey?: string): Team {
    if (!TEAM_MODES.includes(this.settings.mode)) return -1;
    const counts = [0, 0];
    for (const m of this.members.values()) if (m.key !== excludeKey && m.team !== -1) counts[m.team]++;
    return counts[0] <= counts[1] ? 0 : 1;
  }

  private rebalanceTeams(): void {
    for (const m of this.members.values()) m.team = -1;
    for (const m of [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt)) m.team = this.teamFor(m.key);
  }

  join(client: Client): string | null {
    const key = client.profile.id;
    const existing = this.members.get(key);
    if (existing) {
      if (existing.client && existing.client !== client) {
        send(existing.client.ws, { t: "error", message: "You opened this room in another tab." });
        existing.client.room = null;
        existing.client.ws.close(4000, "replaced");
      }
      existing.client = client;
      existing.profile = client.profile;
      existing.disconnectedAt = null;
      client.room = this;
      if (this.world && existing.playerId !== null) {
        const p = this.world.players.get(existing.playerId);
        if (p) p.connected = true;
      }
      log("reconnect", { room: this.code, profile: key });
      this.afterJoin(existing);
      return null;
    }
    if (this.members.size >= this.settings.capacity) return "That room is full.";
    const m: Member = {
      key,
      profile: client.profile,
      team: this.teamFor(),
      ready: false,
      joinedAt: Date.now(),
      client,
      disconnectedAt: null,
      playerId: null,
      queue: [],
      last: null,
      lastQueuedSeq: 0,
      ack: 0,
    };
    this.members.set(key, m);
    client.room = this;
    if (!this.hostKey) this.hostKey = key;
    if (this.world && this.state === "playing") this.addToWorld(m);
    log("join", { room: this.code, profile: key, members: this.members.size });
    this.afterJoin(m);
    return null;
  }

  private afterJoin(m: Member): void {
    this.emptySince = null;
    this.broadcastRoom();
    if (!m.client) return;
    if (this.state === "playing" && this.world && this.matchId) {
      send(m.client.ws, {
        t: "match",
        matchId: this.matchId,
        settings: this.settings,
        you: m.playerId,
        roster: this.roster(),
        tick: this.world.tick,
      });
      this.broadcast({ t: "roster", roster: this.roster() });
    } else if (this.state === "results" && this.result) {
      send(m.client.ws, { t: "results", result: this.result, save: this.saveStatus });
    }
  }

  private addToWorld(m: Member): void {
    if (!this.world) return;
    const id = this.world.nextId++;
    if (TEAM_MODES.includes(this.settings.mode) && m.team === -1) m.team = this.teamFor(m.key);
    addPlayer(this.world, { id, key: m.key, name: m.profile.name, team: m.team, color: m.profile.color, bot: false });
    m.playerId = id;
    m.queue = [];
    m.last = null;
  }

  private roster(): RosterEntry[] {
    if (!this.world) return [];
    return [...this.world.players.values()].map((p) => ({ id: p.id, key: p.key, name: p.name, team: p.team, color: p.color, bot: p.bot }));
  }

  // The socket went away; the seat is held for SEAT_RESERVE_MS.
  disconnect(client: Client): void {
    const m = this.members.get(client.profile.id);
    if (!m || m.client !== client) return;
    m.client = null;
    m.disconnectedAt = Date.now();
    m.queue = [];
    if (this.world && m.playerId !== null) {
      const p = this.world.players.get(m.playerId);
      if (p) p.connected = false;
    }
    log("disconnect", { room: this.code, profile: m.key });
    this.broadcastRoom();
  }

  leave(client: Client): void {
    const m = this.members.get(client.profile.id);
    if (!m || m.client !== client) return;
    client.room = null;
    this.removeMember(m);
    send(client.ws, { t: "left" });
  }

  private removeMember(m: Member): void {
    this.members.delete(m.key);
    if (this.world && m.playerId !== null) {
      const p = this.world.players.get(m.playerId);
      if (p) {
        p.connected = false;
        p.alive = false;
      }
    }
    if (this.hostKey === m.key) {
      const next = [...this.members.values()].filter((o) => o.client).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      this.hostKey = next?.key ?? null;
      if (next) log("host_transfer", { room: this.code, to: next.key });
    }
    if (this.state === "lobby" && TEAM_MODES.includes(this.settings.mode)) {
      // keep lobby teams balanced as people leave
      const counts = [0, 0];
      for (const o of this.members.values()) if (o.team !== -1) counts[o.team]++;
      if (Math.abs(counts[0] - counts[1]) > 1) this.rebalanceTeams();
    }
    log("leave", { room: this.code, profile: m.key, members: this.members.size });
    if (this.members.size === 0) {
      if (this.state === "playing") this.finish("abandoned");
      this.close();
      return;
    }
    if (this.world) this.broadcast({ t: "roster", roster: this.roster() });
    this.broadcastRoom();
  }

  handle(client: Client, msg: ClientMessage): void {
    const m = this.members.get(client.profile.id);
    if (!m || m.client !== client) return;
    const isHost = m.key === this.hostKey;
    switch (msg.t) {
      case "input":
        this.queueInput(m, msg.frames);
        return;
      case "ready":
        if (this.state !== "lobby") return;
        m.ready = msg.ready === true;
        break;
      case "team":
        if (this.state !== "lobby" || !TEAM_MODES.includes(this.settings.mode)) return;
        if (msg.team !== 0 && msg.team !== 1) return this.reject(client, "Unknown team.");
        m.team = msg.team;
        break;
      case "settings": {
        if (!isHost) return this.reject(client, "Only the host can change room settings.");
        if (this.state === "playing") return this.reject(client, "Settings are frozen until the round ends.");
        const prevMode = this.settings.mode;
        const next = sanitizeSettings({ ...this.settings, ...msg.settings }, this.settings);
        if (next.capacity < this.members.size) next.capacity = Math.max(this.members.size, 1);
        if (next.mode === "training" && this.members.size > 1) {
          return this.reject(client, "Training is for one player; the room has others in it.");
        }
        this.settings = next;
        if (prevMode !== next.mode) this.rebalanceTeams();
        for (const o of this.members.values()) o.ready = false;
        break;
      }
      case "start":
        if (!isHost) return this.reject(client, "Only the host can start the round.");
        void this.start(client);
        return;
      case "end":
        if (!isHost) return this.reject(client, "Only the host can end the round.");
        if (this.state === "playing") this.finish("host");
        return;
      case "rematch":
        if (!isHost) return this.reject(client, "Only the host can start a rematch.");
        if (this.state !== "results") return;
        this.backToLobby();
        break;
      default:
        return;
    }
    this.broadcastRoom();
  }

  private reject(client: Client, message: string): void {
    log("rejected", { room: this.code, profile: client.profile.id, reason: message });
    send(client.ws, { t: "error", message });
  }

  private queueInput(m: Member, frames: unknown): void {
    if (this.state !== "playing" || m.playerId === null || !Array.isArray(frames) || frames.length > 4) return;
    for (const f of frames as InputFrame[]) {
      if (typeof f !== "object" || f === null) continue;
      if (!Number.isInteger(f.seq) || f.seq <= m.lastQueuedSeq || f.seq > m.lastQueuedSeq + 1000) continue;
      if (!Number.isInteger(f.b) || f.b < 0 || f.b > ALL_BUTTONS || !Number.isFinite(f.aim)) continue;
      const view = typeof f.view === "number" && Number.isFinite(f.view) ? f.view : undefined;
      m.lastQueuedSeq = f.seq;
      m.queue.push({ seq: f.seq, b: f.b, aim: f.aim, view });
    }
    while (m.queue.length > MAX_INPUT_QUEUE) m.queue.shift();
  }

  // One frame per member per tick, so sending faster can't move faster. When
  // the queue backs up, two frames merge into one step instead of skipping
  // presses, which keeps the server close to the client's present.
  private nextInput(m: Member): InputFrame | undefined {
    let f = m.queue.shift();
    if (f && m.queue.length > 3) {
      const g = m.queue.shift()!;
      f = { ...g, b: g.b | f.b };
    }
    if (f) {
      m.ack = f.seq;
      m.last = f;
      return f;
    }
    return m.last ?? undefined;
  }

  async start(client: Client): Promise<void> {
    if (this.state !== "lobby" || this.starting) return;
    if (this.manager.activeCount() >= MAX_ACTIVE_ROOMS) {
      return this.reject(client, "Another match is running, and this server hosts one live match at a time. Try again when it ends.");
    }
    if (PVP_MODES.includes(this.settings.mode) && this.members.size + this.settings.bots < 2) {
      return this.reject(client, "Add a bot or wait for another player: a match needs at least two fighters.");
    }
    this.starting = true;
    const matchId = randomUUID();
    try {
      await this.db.call("createMatch", {
        id: matchId,
        roomCode: this.code,
        mode: this.settings.mode,
        map: this.settings.map,
        settings: JSON.stringify(this.settings),
      });
    } catch (e) {
      this.starting = false;
      log("storage_failure", { op: "createMatch", error: (e as Error).message });
      return this.reject(client, "The match couldn't be recorded, so it didn't start. Try again in a moment.");
    }
    this.starting = false;
    if (this.state !== "lobby" || this.closed) return;
    this.matchId = matchId;
    this.result = null;
    this.events = [];
    this.lastCheckpoint = Date.now();
    this.world = createWorld(this.settings, randomInt(1, 2 ** 31));
    for (const m of [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt)) this.addToWorld(m);
    this.bots = [];
    for (let i = 0; i < this.settings.bots; i++) {
      const id = this.world.nextId++;
      let team: Team = -1;
      if (TEAM_MODES.includes(this.settings.mode)) {
        const counts = [0, 0];
        for (const p of this.world.players.values()) if (p.team !== -1) counts[p.team]++;
        team = counts[0] <= counts[1] ? 0 : 1;
      }
      addPlayer(this.world, { id, key: `bot:${i + 1}`, name: `Bot ${i + 1}`, team, color: 0x9a9a9a, bot: true });
      this.bots.push(new Bot(id, this.settings.botDifficulty));
    }
    this.state = "playing";
    log("match_start", { room: this.code, match: matchId, mode: this.settings.mode, map: this.settings.map, humans: this.members.size, bots: this.bots.length });
    this.broadcastRoom();
    for (const m of this.members.values()) {
      if (m.client) {
        send(m.client.ws, { t: "match", matchId, settings: this.settings, you: m.playerId, roster: this.roster(), tick: this.world.tick });
      }
    }
  }

  step(): void {
    const w = this.world;
    if (!w || this.state !== "playing") return;
    const inputs = new Map<number, InputFrame>();
    for (const m of this.members.values()) {
      if (m.playerId === null) continue;
      const f = this.nextInput(m);
      if (f) inputs.set(m.playerId, f);
    }
    for (const bot of this.bots) inputs.set(bot.playerId, bot.think(w));
    stepWorld(w, inputs);
    if (w.events.length > 0) {
      this.events.push(...w.events);
      w.events = [];
    }
    if (w.tick % SNAP_EVERY === 0) this.sendSnapshots();
    if (w.over) this.finish(w.overReason ?? "time");
  }

  private sendSnapshots(): void {
    const w = this.world!;
    const base = JSON.stringify(snapshot(w, this.events));
    this.events = [];
    for (const m of this.members.values()) {
      const ws = m.client?.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) continue;
      if (ws.bufferedAmount > 256 * 1024) continue; // a stalled client skips snapshots rather than growing a queue
      ws.send(`{"t":"snap","ack":${m.ack},${base.slice(1)}`);
    }
  }

  private participants() {
    const w = this.world!;
    return [...w.players.values()].map((p) => ({
      key: p.key,
      profileId: p.bot ? null : p.key,
      name: p.name,
      team: p.team,
      bot: p.bot,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      deliveries: p.deliveries,
      score: contributionScore(w.settings.mode, p),
    }));
  }

  housekeeping(now: number): void {
    for (const m of [...this.members.values()]) {
      if (m.client || m.disconnectedAt === null) continue;
      const gone = now - m.disconnectedAt;
      if (this.world && m.playerId !== null && gone > BODY_VULNERABLE_MS) {
        const p = this.world.players.get(m.playerId);
        if (p?.alive) p.alive = false; // despawned, not killed: no death is recorded
      }
      if (gone > SEAT_RESERVE_MS) this.removeMember(m);
    }
    const connected = [...this.members.values()].some((m) => m.client);
    if (connected) this.emptySince = null;
    else if (this.emptySince === null) this.emptySince = now;
    const limit = this.members.size === 0 && !this.matchId ? UNJOINED_ROOM_MS : EMPTY_ROOM_MS;
    if (this.emptySince !== null && now - this.emptySince > limit) {
      if (this.state === "playing") this.finish("abandoned");
      this.close();
      return;
    }
    if (this.state === "playing" && this.matchId && !this.checkpointing && now - this.lastCheckpoint >= CHECKPOINT_MS) {
      this.lastCheckpoint = now;
      this.checkpointing = true;
      this.db
        .call("checkpoint", { matchId: this.matchId, participants: this.participants() })
        .catch((e) => log("storage_failure", { op: "checkpoint", error: (e as Error).message }))
        .finally(() => (this.checkpointing = false));
    }
  }

  finish(reason: MatchResult["reason"]): void {
    const w = this.world;
    if (!w || !this.matchId || this.state !== "playing") return;
    w.over = true;
    this.sendSnapshots();
    const result = computeResult(w, this.matchId, reason, (p) => (p.bot ? null : p.key));
    this.result = result;
    this.state = "results";
    this.saveStatus = "saving";
    log("match_end", { room: this.code, match: this.matchId, reason, mode: result.mode, teamScores: result.teamScores });
    this.broadcastRoom();
    this.broadcast({ t: "results", result, save: "saving" });
    const matchId = this.matchId;
    this.db
      .call<{ duplicate: boolean }>("finalize", { result })
      .then((r) => {
        this.saveStatus = "saved";
        log("match_saved", { match: matchId, duplicate: r.duplicate });
      })
      .catch((e) => {
        this.saveStatus = "failed";
        log("storage_failure", { op: "finalize", match: matchId, error: (e as Error).message });
      })
      .finally(() => {
        if (this.matchId === matchId) this.broadcast({ t: "save", matchId, save: this.saveStatus });
      });
  }

  private backToLobby(): void {
    this.state = "lobby";
    this.world = null;
    this.bots = [];
    this.matchId = null;
    this.result = null;
    for (const m of [...this.members.values()]) {
      m.ready = false;
      m.playerId = null;
      m.queue = [];
      m.last = null;
      m.lastQueuedSeq = 0;
      m.ack = 0;
      if (!m.client) this.members.delete(m.key);
    }
    log("rematch", { room: this.code });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const m of this.members.values()) {
      if (m.client) {
        m.client.room = null;
        send(m.client.ws, { t: "left" });
      }
    }
    this.members.clear();
    this.manager.rooms.delete(this.code);
    log("room_closed", { room: this.code });
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();
  private timer: NodeJS.Timeout | null = null;
  private last = 0;
  private acc = 0;
  private stepTimes: number[] = [];
  private lastStats = Date.now();

  readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  start(): void {
    this.last = performance.now();
    this.timer = setInterval(() => this.loop(), 8);
    setInterval(() => {
      const now = Date.now();
      for (const r of [...this.rooms.values()]) r.housekeeping(now);
      if (now - this.lastStats > 60_000) this.stats(now);
    }, 1000).unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private loop(): void {
    const now = performance.now();
    this.acc += now - this.last;
    this.last = now;
    // catch up at most four ticks, then drop the rest rather than spiral
    if (this.acc > TICK_MS * 4) this.acc = TICK_MS * 4;
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      const t0 = performance.now();
      for (const r of this.rooms.values()) if (r.state === "playing") r.step();
      if (this.activeCount() > 0) {
        this.stepTimes.push(performance.now() - t0);
        if (this.stepTimes.length > 3600) this.stepTimes.shift();
      }
    }
  }

  private stats(now: number): void {
    this.lastStats = now;
    const sorted = [...this.stepTimes].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const mem = process.memoryUsage();
    log("stats", {
      rooms: this.rooms.size,
      active: this.activeCount(),
      stepP95Ms: Math.round(p95 * 1000) / 1000,
      rssMb: Math.round(mem.rss / 1048576),
      heapMb: Math.round(mem.heapUsed / 1048576),
    });
  }

  stepP95(): number {
    const sorted = [...this.stepTimes].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  }

  activeCount(): number {
    let n = 0;
    for (const r of this.rooms.values()) if (r.state === "playing") n++;
    return n;
  }

  create(opts: { name?: string; isPublic?: boolean; settings?: unknown }): Room | string {
    const waiting = [...this.rooms.values()].filter((r) => r.state !== "playing").length;
    if (waiting >= MAX_WAITING_ROOMS) return "The server has as many open rooms as it can hold. Join one from the list instead.";
    let code = "";
    do {
      code = Array.from({ length: 5 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
    } while (this.rooms.has(code));
    const settings = sanitizeSettings(opts.settings);
    const name = (opts.name ?? "").replace(/[^\p{L}\p{N} _.'!-]/gu, "").trim().slice(0, 24) || `${MODE_NAMES[settings.mode]} room`;
    const room = new Room(this, code, { name, isPublic: opts.isPublic !== false && settings.mode !== "training", settings });
    this.rooms.set(code, room);
    log("room_created", { room: code, mode: settings.mode, public: room.isPublic });
    return room;
  }

  listings(): RoomListing[] {
    return [...this.rooms.values()].filter((r) => r.isPublic && !r.closed).map((r) => r.listing());
  }

  quickJoin(): Room | string {
    const open = [...this.rooms.values()]
      .filter((r) => r.isPublic && r.state !== "results" && r.members.size < r.settings.capacity && r.members.size > 0)
      .sort((a, b) => b.members.size - a.members.size);
    return open[0] ?? this.create({ isPublic: true });
  }

  welcome(client: Client): void {
    send(client.ws, { t: "welcome", v: PROTOCOL_VERSION, profile: client.profile });
  }
}
