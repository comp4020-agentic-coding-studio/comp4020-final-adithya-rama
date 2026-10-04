import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
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
import { addPlayer, computeResult, contributionScore, createWorld, dropFlags, snapshot, stepWorld, type World } from "../shared/sim.ts";
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
  roundTripMs?: number;
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
  spectator: boolean;
  lastInputAt: number;
  lastChatAt: number;
  stalledSince: number | null;
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
  nextSettings: RoomSettings | null = null;
  private passwordSalt: string;
  private passwordHash: Buffer | null;
  state: RoomState = "lobby";
  members = new Map<string, Member>();
  hostKey: string | null = null;
  world: World | null = null;
  matchId: string | null = null;
  result: MatchResult | null = null;
  saveStatus: SaveStatus = "saving";
  starting = false;
  private bots: Bot[] = [];
  private hiddenBodies = new Set<number>();
  private events: GameEvent[] = [];
  private lastCheckpoint = 0;
  private absentSince: [number | null, number | null] = [null, null];
  private finalizing = false;
  private nextSaveAttempt = 0;
  private saveAttempts = 0;
  private emptySince: number | null = Date.now();
  closed = false;

  private manager: RoomManager;

  constructor(manager: RoomManager, code: string, opts: { name: string; isPublic: boolean; settings: RoomSettings; password?: string }) {
    this.manager = manager;
    this.code = code;
    this.name = opts.name;
    this.isPublic = opts.isPublic;
    this.settings = opts.settings;
    this.passwordSalt = randomBytes(16).toString("hex");
    this.passwordHash = opts.password ? this.hashPassword(opts.password) : null;
  }

  get hasPassword(): boolean { return this.passwordHash !== null; }

  private hashPassword(password: string): Buffer {
    return createHash("sha256").update(this.passwordSalt).update(password).digest();
  }

  private fighters(): Member[] { return [...this.members.values()].filter((m) => !m.spectator); }

  private transferHost(): void {
    const current = this.hostKey && this.members.get(this.hostKey);
    if (current && current.client && !current.spectator) return;
    const next = this.fighters().filter((m) => m.client).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    this.hostKey = next?.key ?? null;
    if (next) log("host_transfer", { room: this.code, to: next.key });
  }

  updateProfile(profile: Profile): void {
    const member = this.members.get(profile.id);
    if (!member) return;
    member.profile = profile;
    if (member.client) member.client.profile = profile;
    const player = member.playerId === null ? null : this.world?.players.get(member.playerId);
    if (player) { player.name = profile.name; player.color = profile.color; }
    this.broadcastRoom();
    if (this.world) this.broadcast({ t: "roster", roster: this.roster() });
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
      players: this.fighters().length + (PVP_MODES.includes(this.settings.mode) ? this.settings.bots : 0),
      capacity: this.settings.capacity,
      hasPassword: this.hasPassword,
      spectators: [...this.members.values()].filter((m) => m.spectator).length,
    };
  }

  view(forKey: string): RoomView {
    return {
      code: this.code,
      name: this.name,
      isPublic: this.isPublic,
      state: this.state,
      settings: this.settings,
      nextSettings: this.nextSettings ?? undefined,
      hasPassword: this.hasPassword,
      members: [...this.members.values()].map((m) => ({
        key: m.key,
        name: m.profile.name,
        color: m.profile.color,
        team: m.team,
        ready: m.ready,
        host: m.key === this.hostKey,
        connected: m.client !== null,
        spectator: m.spectator,
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
    if (this.settings.mode === "survival") return 0;
    if (!TEAM_MODES.includes(this.settings.mode)) return -1;
    const counts = [0, 0];
    for (const m of this.members.values()) if (!m.spectator && m.key !== excludeKey && m.team !== -1) counts[m.team]++;
    return counts[0] <= counts[1] ? 0 : 1;
  }

  private rebalanceTeams(): void {
    for (const m of this.members.values()) m.team = -1;
    for (const m of this.fighters().sort((a, b) => a.joinedAt - b.joinedAt)) m.team = this.teamFor(m.key);
  }

  join(client: Client, password?: string, spectate = false): string | null {
    const key = client.profile.id;
    const existing = this.members.get(key);
    if (this.starting && !spectate && !existing?.spectator) return "The round is starting; join again in a moment.";
    if (!existing && this.passwordHash && (typeof password !== "string" || !timingSafeEqual(this.hashPassword(password), this.passwordHash))) return "Incorrect room password.";
    if (existing) {
      if (existing.client && existing.client !== client) {
        send(existing.client.ws, { t: "error", message: "You opened this room in another tab." });
        existing.client.room = null;
        existing.client.ws.close(4000, "replaced");
      }
      existing.client = client;
      existing.profile = client.profile;
      existing.disconnectedAt = null;
      existing.queue = [];
      existing.last = null;
      existing.lastQueuedSeq = 0;
      existing.ack = 0;
      existing.lastInputAt = Date.now();
      this.transferHost();
      client.room = this;
      if (this.world && existing.playerId !== null) {
        const p = this.world.players.get(existing.playerId);
        if (p) { p.connected = true; p.reserved = false; if (this.hiddenBodies.delete(p.id) && p.hp > 0) p.alive = true; }
      }
      log("reconnect", { room: this.code, profile: key });
      this.afterJoin(existing);
      return null;
    }
    const humanLimit = this.settings.mode === "training" ? 1 : this.settings.mode === "survival" ? Math.min(4, this.settings.capacity) : this.settings.capacity;
    if (!spectate && this.fighters().length >= humanLimit) return "That room is full; you can join as a spectator.";
    if (!spectate && this.world && this.state === "playing" && PVP_MODES.includes(this.settings.mode) &&
        [...this.world.players.values()].filter((p) => p.connected).length >= this.settings.capacity) return "All fighter slots are occupied; spectating is available.";
    if (!spectate && this.world && ![...this.world.players.values()].some((p) => p.key === key) && [...this.world.players.values()].filter((p) => !p.bot).length >= 64) return "This round has reached its participant limit; spectate or join the next round.";
    if (this.members.size >= 24) return "This room has reached its spectator limit.";
    const m: Member = {
      key,
      profile: client.profile,
      team: spectate ? -1 : this.teamFor(),
      ready: false,
      joinedAt: Date.now(),
      client,
      disconnectedAt: null,
      playerId: null,
      queue: [],
      last: null,
      lastQueuedSeq: 0,
      ack: 0,
      spectator: spectate,
      lastInputAt: Date.now(),
      lastChatAt: 0,
      stalledSince: null,
    };
    this.members.set(key, m);
    client.room = this;
    this.transferHost();
    if (!m.spectator && this.world && this.state === "playing") this.addToWorld(m);
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
    if (!this.world || m.spectator) return;
    const prior = [...this.world.players.values()].find((p) => p.key === m.key);
    if (prior) {
      prior.connected = true;
      prior.reserved = false;
      if (this.hiddenBodies.delete(prior.id) && prior.hp > 0) prior.alive = true;
      prior.name = m.profile.name;
      m.playerId = prior.id;
      m.team = prior.team;
      return;
    }
    const id = this.world.nextId++;
    if (TEAM_MODES.includes(this.settings.mode) && m.team === -1) m.team = this.teamFor(m.key);
    addPlayer(this.world, { id, key: m.key, name: m.profile.name, team: m.team, color: m.profile.color, bot: false });
    m.playerId = id;
    m.queue = [];
    m.last = null;
  }

  private roster(): RosterEntry[] {
    if (!this.world) return [];
    return [...this.world.players.values()].filter((p) => p.connected || p.alive).map((p) => ({ id: p.id, key: p.key, name: p.name, team: p.team, color: p.color, bot: p.bot, avatar: this.members.get(p.key)?.profile.prefs.avatar as import("../shared/protocol.ts").Avatar | undefined }));
  }

  // The socket went away; the seat is held for SEAT_RESERVE_MS.
  disconnect(client: Client): void {
    const m = this.members.get(client.profile.id);
    if (!m || m.client !== client) return;
    m.client = null;
    m.disconnectedAt = Date.now();
    m.queue = [];
    m.last = null;
    client.room = null;
    if (this.world && m.playerId !== null) {
      const p = this.world.players.get(m.playerId);
      if (p) { p.connected = false; p.reserved = true; dropFlags(this.world, p.id); }
    }
    this.transferHost();
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
        dropFlags(this.world, p.id);
        p.connected = false;
        p.reserved = false;
        if (p.alive) this.hiddenBodies.add(p.id);
        p.alive = false;
      }
    }
    this.transferHost();
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
        if (m.spectator || this.starting || this.state !== "lobby") return;
        m.ready = msg.ready === true;
        break;
      case "team":
        if (m.spectator || this.starting || this.state !== "lobby" || !TEAM_MODES.includes(this.settings.mode)) return;
        if (msg.team !== 0 && msg.team !== 1) return this.reject(client, "Unknown team.");
        m.team = msg.team;
        m.ready = false;
        break;
      case "settings": {
        if (!isHost) return this.reject(client, "Only the host can change room settings.");
        if (this.starting) return this.reject(client, "The round is starting.");
        if (!msg.settings || typeof msg.settings !== "object" || Array.isArray(msg.settings)) return this.reject(client, "Invalid room settings.");
        const base = this.nextSettings ?? this.settings;
        const prevMode = this.settings.mode;
        const next = sanitizeSettings({ ...base, ...msg.settings }, base);
        const humans = this.fighters().length;
        if (next.capacity < humans) next.capacity = Math.max(humans, 1);
        if ((next.mode === "training" && humans > 1) || (next.mode === "survival" && humans > 4)) {
          return this.reject(client, "Training allows one human and survival allows four; ask extra players to spectate.");
        }
        if (this.state === "playing") { this.nextSettings = next; break; }
        this.settings = next;
        if (prevMode !== next.mode) this.rebalanceTeams();
        for (const o of this.members.values()) o.ready = false;
        break;
      }
      case "chat": {
        if (typeof msg.text !== "string" || Date.now() - m.lastChatAt < 800) return;
        const text = msg.text.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 240);
        if (!text) return;
        m.lastChatAt = Date.now();
        for (const other of this.members.values()) if (other.client && other.profile.prefs.chatMuted !== true) {
          send(other.client.ws, { t: "chat", key: m.key, name: m.profile.name, text, at: m.lastChatAt });
        }
        return;
      }
      case "spectate":
        if (this.state === "playing" || this.starting) return this.reject(client, "Change spectator status between rounds.");
        if (typeof msg.spectate !== "boolean") return;
        if (!msg.spectate && m.spectator && this.fighters().length >= this.settings.capacity) return this.reject(client, "The fighter slots are full.");
        m.spectator = msg.spectate;
        m.team = m.spectator ? -1 : this.teamFor(m.key);
        m.ready = false;
        this.transferHost();
        break;
      case "retry-save":
        if (this.state === "results" && this.saveStatus === "failed") void this.persistResult();
        return;
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
        if (this.saveStatus !== "saved") return this.reject(client, "Results must finish saving before a rematch. Retry saving if needed.");
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
    if (this.state !== "playing" || m.playerId === null || !Array.isArray(frames) || frames.length > 2) return;
    for (const f of frames as InputFrame[]) {
      if (typeof f !== "object" || f === null) continue;
      if (!Number.isInteger(f.seq) || f.seq <= m.lastQueuedSeq || f.seq > m.lastQueuedSeq + 1000) continue;
      if (!Number.isInteger(f.b) || f.b < 0 || f.b > ALL_BUTTONS || !Number.isFinite(f.aim)) continue;
      const tick = this.world?.tick ?? 0;
      const rewind = Math.min(9, 6 + Math.ceil((m.client?.roundTripMs ?? 100) * TICK_RATE / 2000));
      const view = typeof f.view === "number" && Number.isFinite(f.view) ? Math.max(tick - rewind, Math.min(tick, Math.floor(f.view))) : undefined;
      m.lastInputAt = Date.now();
      m.lastQueuedSeq = f.seq;
      m.queue.push({ seq: f.seq, b: f.b, aim: Math.atan2(Math.sin(f.aim), Math.cos(f.aim)), view });
    }
    while (m.queue.length > MAX_INPUT_QUEUE) m.queue.shift();
  }

  // One frame per member per tick, so sending faster can't move faster. When
  // the queue backs up, two frames merge into one step instead of skipping
  // presses, which keeps the server close to the client's present.
  private nextInput(m: Member): InputFrame | undefined {
    if (!m.client || Date.now() - m.lastInputAt > 250) { m.last = null; m.queue = []; return undefined; }
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
    if (this.manager.activeCount() >= this.manager.activeRoomLimit) {
      return this.reject(client, "The server has reached its live-match capacity. Try again when a match ends.");
    }
    const fighters = this.fighters().filter((m) => m.client);
    if (!fighters.length) return this.reject(client, "At least one connected player is needed.");
    if (fighters.some((m) => m.key !== this.hostKey && !m.ready)) return this.reject(client, "Every other player must be ready.");
    if (PVP_MODES.includes(this.settings.mode) && fighters.length + this.settings.bots > this.settings.capacity) return this.reject(client, "Reduce bots so fighters fit the room capacity.");
    if (TEAM_MODES.includes(this.settings.mode) && this.settings.bots === 0 && ![0, 1].every((team) => fighters.some((m) => m.team === team))) return this.reject(client, "Both teams need a player or bot.");
    if (PVP_MODES.includes(this.settings.mode) && fighters.length + this.settings.bots < 2) {
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
    const currentFighters = this.fighters().filter((m) => m.client);
    const missingTeam = TEAM_MODES.includes(this.settings.mode) && this.settings.bots === 0 && ![0, 1].every((team) => currentFighters.some((m) => m.team === team));
    if (this.state !== "lobby" || this.closed || !currentFighters.length || missingTeam ||
        (PVP_MODES.includes(this.settings.mode) && currentFighters.length + this.settings.bots < 2)) {
      await this.db.call("abandonUnstarted", { matchId }).catch(() => {});
      this.broadcast({ t: "error", message: "Players left while the round was starting; ready up again." });
      return;
    }
    this.matchId = matchId;
    this.result = null;
    this.events = [];
    this.absentSince = [null, null];
    this.saveAttempts = 0;
    this.lastCheckpoint = Date.now();
    this.world = createWorld(this.settings, randomInt(1, 2 ** 31));
    for (const m of this.fighters().filter((m) => m.client).sort((a, b) => a.joinedAt - b.joinedAt)) this.addToWorld(m);
    this.bots = [];
    for (let i = 0; i < (this.settings.mode === "survival" ? 0 : this.settings.bots); i++) {
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
    log("match_start", { room: this.code, match: matchId, mode: this.settings.mode, map: this.settings.map, humans: this.fighters().filter((m) => m.client).length, bots: this.bots.length });
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
    if (w.settings.mode === "survival") {
      for (const p of w.players.values()) if (p.bot && !this.bots.some((b) => b.playerId === p.id)) this.bots.push(new Bot(p.id, this.settings.botDifficulty));
    }
    for (const bot of this.bots) inputs.set(bot.playerId, bot.think(w));
    const beforeIds = w.players.size;
    stepWorld(w, inputs);
    if (w.players.size !== beforeIds) this.broadcast({ t: "roster", roster: this.roster() });
    if (w.events.length > 0) {
      this.events.push(...w.events);
      w.events = [];
    }
    if (w.tick % SNAP_EVERY === 0) this.sendSnapshots();
    if (w.over) this.finish(w.overReason ?? "time");
  }

  private sendSnapshots(): void {
    const w = this.world!;
    const state = snapshot(w, this.events);
    state.players = state.players.filter((p) => {
      const player = w.players.get(p.id);
      return player?.connected || player?.alive;
    });
    const base = JSON.stringify(state);
    this.events = [];
    for (const m of this.members.values()) {
      const ws = m.client?.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) continue;
      if (ws.bufferedAmount > 256 * 1024) {
        m.stalledSince ??= Date.now();
        if (Date.now() - m.stalledSince > 5000) ws.close(1008, "connection too slow");
        continue;
      }
      m.stalledSince = null;
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
      weaponStats: p.weaponStats,
    }));
  }

  housekeeping(now: number): void {
    if (this.closed && this.saveStatus === "saved") { this.manager.rooms.delete(this.code); return; }
    for (const m of [...this.members.values()]) {
      if (m.client || m.disconnectedAt === null) continue;
      const gone = now - m.disconnectedAt;
      if (this.world && m.playerId !== null && gone > BODY_VULNERABLE_MS) {
        const p = this.world.players.get(m.playerId);
        if (p?.alive) { this.hiddenBodies.add(p.id); p.alive = false; } // retain health/ammo; this is not a death
      }
      if (gone > SEAT_RESERVE_MS) this.removeMember(m);
    }
    if (this.state === "playing" && TEAM_MODES.includes(this.settings.mode) && this.world) {
      for (const team of [0, 1] as const) {
        const present = [...this.world.players.values()].some((p) => p.team === team && p.connected);
        if (present) this.absentSince[team] = null;
        else {
          this.absentSince[team] ??= now;
          if (now - this.absentSince[team]! >= SEAT_RESERVE_MS) this.finish("abandoned");
        }
      }
    }
    if (this.state === "results" && this.saveStatus === "failed" && now >= this.nextSaveAttempt) void this.persistResult();
    const connected = this.fighters().some((m) => m.client);
    if (connected) this.emptySince = null;
    else if (this.emptySince === null) this.emptySince = now;
    const limit = this.members.size === 0 && !this.matchId ? UNJOINED_ROOM_MS : EMPTY_ROOM_MS;
    if (this.emptySince !== null && now - this.emptySince > limit) {
      if (this.state === "playing") this.finish("abandoned");
      this.close();
      return;
    }
    if (this.state === "playing" && this.matchId && now - this.lastCheckpoint >= CHECKPOINT_MS) {
      this.lastCheckpoint = now;
      this.db
        .call("checkpoint", { matchId: this.matchId, participants: this.participants() })
        .catch((e) => log("storage_failure", { op: "checkpoint", error: (e as Error).message }));
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
    void this.persistResult();
  }

  private async persistResult(): Promise<void> {
    if (!this.result || this.finalizing || this.saveStatus === "saved") return;
    this.finalizing = true;
    this.saveStatus = "saving";
    this.saveAttempts = Math.min(10, this.saveAttempts + 1);
    const result = this.result;
    if (this.saveAttempts > 1) this.broadcast({ t: "save", matchId: result.matchId, save: "saving" });
    try {
      const saved = await this.db.call<{ duplicate: boolean }>("finalize", { result });
      this.saveStatus = "saved";
      log("match_saved", { match: result.matchId, duplicate: saved.duplicate });
    } catch (e) {
      this.saveStatus = "failed";
      this.nextSaveAttempt = Date.now() + Math.min(30_000, 1000 * 2 ** this.saveAttempts);
      log("storage_failure", { op: "finalize", match: result.matchId, error: (e as Error).message });
    } finally {
      this.finalizing = false;
      if (this.matchId === result.matchId) this.broadcast({ t: "save", matchId: result.matchId, save: this.saveStatus });
    }
  }

  private backToLobby(): void {
    if (this.nextSettings) { this.settings = this.nextSettings; this.nextSettings = null; }
    this.rebalanceTeams();
    this.state = "lobby";
    this.world = null;
    this.bots = [];
    this.hiddenBodies.clear();
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
    if (!this.result || this.saveStatus === "saved") this.manager.rooms.delete(this.code);
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
  readonly activeRoomLimit = process.env.ACTIVE_ROOM_LIMIT === "2" ? 2 : MAX_ACTIVE_ROOMS;

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
    for (const r of this.rooms.values()) if (r.state === "playing" || r.starting) n++;
    return n;
  }

  create(opts: { name?: string; isPublic?: boolean; settings?: unknown; password?: string }): Room | string {
    const waiting = [...this.rooms.values()].filter((r) => r.state !== "playing").length;
    if (waiting >= MAX_WAITING_ROOMS) return "The server has as many open rooms as it can hold. Join one from the list instead.";
    let code = "";
    do {
      code = Array.from({ length: 5 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
    } while (this.rooms.has(code));
    const settings = sanitizeSettings(opts.settings);
    const name = (typeof opts.name === "string" ? opts.name : "").replace(/[^\p{L}\p{N} _.'!-]/gu, "").trim().slice(0, 24) || `${MODE_NAMES[settings.mode]} room`;
    const room = new Room(this, code, { name, isPublic: opts.isPublic !== false && settings.mode !== "training", settings, password: typeof opts.password === "string" ? opts.password.slice(0, 64) : undefined });
    this.rooms.set(code, room);
    log("room_created", { room: code, mode: settings.mode, public: room.isPublic });
    return room;
  }

  listings(): RoomListing[] {
    return [...this.rooms.values()].filter((r) => r.isPublic && !r.closed).map((r) => r.listing());
  }

  quickJoin(): Room | string {
    const open = [...this.rooms.values()]
      .filter((r) => !r.hasPassword && !r.starting && r.isPublic && r.state !== "results" && r.listing().players < r.settings.capacity && r.listing().players > 0)
      .sort((a, b) => b.members.size - a.members.size);
    return open[0] ?? this.create({ isPublic: true });
  }

  welcome(client: Client): void {
    send(client.ws, { t: "welcome", v: PROTOCOL_VERSION, profile: client.profile });
  }
}
