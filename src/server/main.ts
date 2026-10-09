import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { WebSocketServer } from "ws";
import { MAX_CONNECTED_CLIENTS, MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from "../shared/constants.ts";
import { MAPS } from "../shared/maps.ts";
import type { ClientMessage, HistoryEntry, Profile } from "../shared/protocol.ts";
import { AVAILABLE_MODES, defaultSettings, DURATIONS, MODE_NAMES, MULTIPLIERS, sanitizeSettings } from "../shared/settings.ts";
import { THROWABLES, WEAPONS } from "../shared/weapons.ts";
import { objectBody, sanitizePrefs } from "./validation.ts";
import { Db } from "./db.ts";
import { log } from "./log.ts";
import { renderReadme } from "./readme.ts";
import { type Client, RoomManager, send } from "./rooms.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const PORT = Number(process.env.PORT ?? 8080);
const CLIENT_DIR = join(ROOT, "dist/client");
const DOCS_DIR = join(ROOT, "docs");
const README = join(ROOT, "README.md");
const DB_PATH = process.env.DB_PATH ?? (existsSync("/data") ? "/data/jet-skirmish.db" : join(ROOT, ".data/dev.db"));
const COOKIE = "js_sid";

const db = new Db(DB_PATH);
await db.ready;
const interrupted = await db.call<number>("interruptLive");
log("boot", { port: PORT, db: DB_PATH, interruptedMatches: interrupted, node: process.version });

const rooms = new RoomManager(db);
rooms.start();

// ---------- sessions ----------

const hash = (token: string): string => createHash("sha256").update(token).digest("hex");

function cookieToken(req: IncomingMessage): string | null {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === COOKIE && v && /^[A-Za-z0-9_-]{43}$/.test(v)) return v;
  }
  return null;
}

function toProfile(row: Record<string, unknown>): Profile {
  let prefs: Record<string, unknown> = {};
  try {
    prefs = sanitizePrefs(JSON.parse(String(row.prefs ?? "{}")));
  } catch {
    // corrupt prefs fall back to defaults
  }
  return {
    id: String(row.id),
    name: String(row.name),
    color: Number(row.color),
    prefs,
    matches: Number(row.matches),
    wins: Number(row.wins),
    kills: Number(row.kills),
    deaths: Number(row.deaths),
    mvps: Number(row.mvps),
  };
}

async function sessionProfile(req: IncomingMessage): Promise<Profile | null> {
  const token = cookieToken(req);
  if (!token) return null;
  const row = await db.call<Record<string, unknown> | null>("sessionProfile", { tokenHash: hash(token) });
  return row ? toProfile(row) : null;
}

const PALETTE = [0xe0603c, 0x3c8de0, 0x4caf50, 0xc9a227, 0x9b59b6, 0x1abc9c, 0xe91e63, 0xff9800];

async function ensureSession(req: IncomingMessage, res: ServerResponse): Promise<Profile> {
  const existing = await sessionProfile(req);
  if (existing) return existing;
  const token = randomBytes(32).toString("base64url");
  const row = await db.call<Record<string, unknown>>("createGuest", {
    tokenHash: hash(token),
    id: randomUUID(),
    name: `Pilot-${randomBytes(2).toString("hex").toUpperCase()}`,
    color: PALETTE[randomBytes(1)[0] % PALETTE.length],
  });
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
  const profile = toProfile(row);
  log("guest_created", { profile: profile.id });
  return profile;
}

const cleanName = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/[^\p{L}\p{N} _.'-]/gu, "").replace(/\s+/g, " ").trim();
  return s.length >= 1 && s.length <= 16 ? s : null;
};

// ---------- http helpers ----------

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients; browsers always send Origin on these requests
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host === req.headers.host;
  } catch {
    return false;
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!(req.headers["content-type"] ?? "").startsWith("application/json")) throw new Error("expected application/json");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 16 * 1024) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return objectBody(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".webmanifest": "application/manifest+json",
};

function serveFile(res: ServerResponse, base: string, rel: string, immutable = false): boolean {
  const path = normalize(join(base, rel));
  if (!path.startsWith(base + sep)) return false;
  try {
    if (!statSync(path).isFile() || !realpathSync(path).startsWith(realpathSync(base) + sep)) return false;
  } catch {
    return false;
  }
  res.writeHead(200, {
    "Content-Type": MIME[extname(path)] ?? "application/octet-stream",
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  res.end(readFileSync(path));
  return true;
}

function serveMarkdown(res: ServerResponse, path: string, base: string): boolean {
  try {
    if (!path.startsWith(base + sep) || !statSync(path).isFile() || !realpathSync(path).startsWith(realpathSync(base) + sep)) return false;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(renderReadme(path));
    return true;
  } catch { return false; }
}

function serveIndex(res: ServerResponse): void {
  if (serveFile(res, CLIENT_DIR, "index.html")) return;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end("<!doctype html><title>Jet Skirmish</title><p>The client hasn't been built. Run <code>pnpm build</code>.</p>");
}

// ---------- routes ----------

const mutationWindows = new Map<string, { start: number; count: number }>();
function allowMutation(req: IncomingMessage): boolean {
  const key = req.headers["fly-client-ip"]?.toString() ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  let entry = mutationWindows.get(key);
  if (!entry || now - entry.start > 60_000) {
    if (mutationWindows.size >= 1024) mutationWindows.delete(mutationWindows.keys().next().value!);
    entry = { start: now, count: 0 }; mutationWindows.set(key, entry);
  }
  return ++entry.count <= 120;
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const method = req.method ?? "GET";
  const path = url.pathname;
  if (method !== "GET" && !allowMutation(req)) return json(res, 429, { error: "Too many requests; try again shortly" });
  if (method !== "GET" && !sameOrigin(req)) return json(res, 403, { error: "cross-origin request refused" });

  if (path === "/api/session" && method === "POST") {
    return json(res, 200, { profile: await ensureSession(req, res) });
  }
  if (path === "/api/content" && method === "GET") {
    return json(res, 200, {
      version: PROTOCOL_VERSION,
      maps: Object.values(MAPS).map((m) => ({ id: m.id, name: m.name })),
      weapons: Object.values(WEAPONS),
      throwables: Object.values(THROWABLES),
      modes: AVAILABLE_MODES.map((id) => ({ id, name: MODE_NAMES[id] })),
      durations: DURATIONS,
      multipliers: MULTIPLIERS,
      defaults: defaultSettings(),
    });
  }
  if (path === "/api/rooms" && method === "GET") return json(res, 200, { rooms: rooms.listings() });

  const profile = await sessionProfile(req);
  if (!profile) return json(res, 401, { error: "no session: POST /api/session first" });

  if (path === "/api/me" && method === "GET") return json(res, 200, { profile });
  if (path === "/api/me" && method === "PATCH") {
    let body: Record<string, unknown>;
    try {
      body = (await readJson(req)) as Record<string, unknown>;
    } catch (e) {
      return json(res, 400, { error: (e as Error).message });
    }
    const update: { id: string; name?: string; color?: number; prefs?: string } = { id: profile.id };
    if (body.name !== undefined) {
      const name = cleanName(body.name);
      if (!name) return json(res, 400, { error: "Names are 1–16 letters, digits, spaces, or _ . ' -" });
      update.name = name;
    }
    if (body.color !== undefined) {
      if (!Number.isInteger(body.color) || (body.color as number) < 0 || (body.color as number) > 0xffffff) {
        return json(res, 400, { error: "color must be a 24-bit integer" });
      }
      update.color = body.color as number;
    }
    if (body.prefs !== undefined) {
      try { update.prefs = JSON.stringify(sanitizePrefs(body.prefs, profile.prefs)); }
      catch (e) { return json(res, 400, { error: (e as Error).message }); }
    }
    const row = await db.call<Record<string, unknown>>("updateProfile", update);
    const updated = toProfile(row);
    for (const room of rooms.rooms.values()) room.updateProfile(updated);
    return json(res, 200, { profile: updated });
  }
  if (path === "/api/me/weapons" && method === "GET") return json(res, 200, { weapons: await db.call("weaponStats", { profileId: profile.id }) });
  if (path === "/api/presets" && method === "GET") {
    const presets = await db.call<Array<{ settings: unknown }>>("presets", { profileId: profile.id });
    // Normalize older two-slot presets at the boundary without rewriting history.
    return json(res, 200, { presets: presets.map((preset) => ({ ...preset, settings: sanitizeSettings(preset.settings) })) });
  }
  if (path === "/api/presets" && method === "POST") {
    try {
      const body = objectBody(await readJson(req));
      const name = typeof body.name === "string" ? body.name.replace(/[<>]/g, "").trim().slice(0, 32) : "";
      if (!name) return json(res, 400, { error: "Preset name is required" });
      const preset = await db.call("savePreset", { id: randomUUID(), profileId: profile.id, name, settings: JSON.stringify(sanitizeSettings(body.settings)) });
      return json(res, 201, { preset });
    } catch (e) { return json(res, 400, { error: (e as Error).message }); }
  }
  const presetRoute = path.match(/^\/api\/presets\/([0-9a-f-]{36})$/);
  if (presetRoute && method === "DELETE") {
    const deleted = await db.call("deletePreset", { id: presetRoute[1], profileId: profile.id });
    return json(res, deleted ? 200 : 404, { deleted });
  }
  if (path === "/api/me/matches" && method === "GET") {
    const before = url.searchParams.get("before");
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const matches = await db.call<HistoryEntry[]>("history", { profileId: profile.id, before: before || null, limit });
    const next = matches.length === limit ? matches[matches.length - 1].startedAt : null;
    return json(res, 200, { matches, next });
  }
  const matchRoute = path.match(/^\/api\/matches\/([0-9a-f-]{36})$/);
  if (matchRoute && method === "GET") {
    const match = await db.call("match", { id: matchRoute[1], profileId: profile.id });
    return match ? json(res, 200, { match }) : json(res, 404, { error: "no such match" });
  }
  if (path === "/api/rooms" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await readJson(req)) as Record<string, unknown>;
    } catch (e) {
      return json(res, 400, { error: (e as Error).message });
    }
    if (body.password !== undefined && (typeof body.password !== "string" || body.password.length > 64)) return json(res, 400, { error: "Password must be at most 64 characters" });
    const room = rooms.create({ name: body.name as string | undefined, isPublic: body.isPublic !== false, settings: body.settings, password: body.password as string | undefined });
    if (typeof room === "string") return json(res, 503, { error: room });
    return json(res, 201, { code: room.code });
  }
  if (path === "/api/quickjoin" && method === "POST") {
    const room = rooms.quickJoin();
    if (typeof room === "string") return json(res, 503, { error: room });
    return json(res, 200, { code: room.code });
  }
  return json(res, 404, { error: "not found" });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (url.pathname === "/healthz") {
      const mem = process.memoryUsage();
      const activeWorlds = [...rooms.rooms.values()].filter((r) => r.state === "playing" && r.world).map((r) => r.world!);
      const actors = activeWorlds.flatMap((w) => [...w.players.values()]).filter((p) => p.alive);
      return json(res, 200, {
        ok: true,
        rooms: rooms.rooms.size,
        active: rooms.activeCount(),
        clients: wss.clients.size,
        rssMb: Math.round(mem.rss / 1048576),
        stepP95Ms: rooms.stepP95(),
        dbQueueDepth: db.queueDepth,
        activeRoomLimit: rooms.activeRoomLimit,
        livingHumans: actors.filter((p) => !p.bot).length,
        livingBots: actors.filter((p) => p.bot).length,
        maxSurvivalWave: Math.max(0, ...activeWorlds.map((w) => w.survival?.wave ?? 0)),
      });
    }
    if (url.pathname === "/readme") {
      res.writeHead(301, { Location: "/readme/" });
      return res.end();
    }
    if (url.pathname === "/readme/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      return res.end(renderReadme(README));
    }
    if (url.pathname === "/readme/reflections/crit-8.md" && serveMarkdown(res, join(ROOT, "reflections/crit-8.md"), ROOT)) return;
    if (url.pathname === "/readme/PROCESS.md" && serveMarkdown(res, join(ROOT, "PROCESS.md"), ROOT)) return;
    if (url.pathname.startsWith("/readme/docs/") && url.pathname.endsWith(".md") &&
        serveMarkdown(res, normalize(join(DOCS_DIR, url.pathname.slice("/readme/docs/".length))), DOCS_DIR)) return;
    if (url.pathname.startsWith("/readme/docs/") && serveFile(res, DOCS_DIR, url.pathname.slice("/readme/docs/".length))) return;
    if (url.pathname === "/" || /^\/r\/[A-Z0-9]{5}$/.test(url.pathname)) return serveIndex(res);
    if (serveFile(res, CLIENT_DIR, url.pathname.slice(1), url.pathname.startsWith("/assets/"))) return;
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (e) {
    log("http_error", { path: url.pathname, error: (e as Error).message });
    if (!res.headersSent) json(res, 500, { error: "server error" });
    else res.end();
  }
});

// ---------- websocket ----------

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: MAX_MESSAGE_BYTES });

server.on("upgrade", async (req, socket, head) => {
  const refuse = (code: number, why: string) => {
    socket.write(`HTTP/1.1 ${code} ${why}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  };
  if (new URL(req.url ?? "/", "http://localhost").pathname !== "/ws") return refuse(404, "Not Found");
  if (!sameOrigin(req)) return refuse(403, "Forbidden");
  if (wss.clients.size >= MAX_CONNECTED_CLIENTS) return refuse(503, "Service Unavailable");
  let profile: Profile | null;
  try {
    profile = await sessionProfile(req);
  } catch {
    return refuse(503, "Service Unavailable");
  }
  if (!profile) return refuse(401, "Unauthorized");
  if (wss.clients.size >= MAX_CONNECTED_CLIENTS || socket.destroyed) return refuse(503, "Service Unavailable");
  const p = profile;
  wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, p));
});

function onConnection(ws: import("ws").WebSocket, profile: Profile): void {
  const client: Client = { ws, profile, room: null, windowStart: Date.now(), windowCount: 0, strikes: 0 };
  let alive = true;
  let pingAt = 0;
  ws.on("pong", () => { alive = true; if (pingAt) client.roundTripMs = Math.min(1000, Date.now() - pingAt); });
  const heartbeat = setInterval(() => {
    if (!alive) {
      log("stalled", { profile: profile.id });
      ws.terminate();
      return;
    }
    alive = false;
    pingAt = Date.now();
    ws.ping();
  }, 10_000);

  rooms.welcome(client);

  ws.on("message", (data, isBinary) => {
    const now = Date.now();
    if (now - client.windowStart > 1000) {
      client.windowStart = now;
      client.windowCount = 0;
    }
    if (++client.windowCount > 90 || isBinary) {
      if (++client.strikes > 20) ws.close(1008, "rate limit");
      return;
    }
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (typeof msg !== "object" || msg === null || typeof msg.t !== "string") return;
    if (msg.t === "ping") {
      send(ws, { t: "pong", c: Number(msg.c) || 0, tick: client.room?.world?.tick ?? 0 });
      return;
    }
    if (msg.t === "join") {
      if (typeof msg.code !== "string" || !/^[A-Z0-9]{5}$/i.test(msg.code) || (msg.password !== undefined && (typeof msg.password !== "string" || msg.password.length > 64))) return;
      const code = msg.code.toUpperCase();
      if (client.room && client.room.code !== code) client.room.leave(client);
      const room = rooms.rooms.get(code);
      if (!room || room.closed) return send(ws, { t: "error", message: "That room doesn't exist any more." });
      const err = room.join(client, msg.password, msg.spectate === true);
      if (err) send(ws, { t: "error", message: err });
      return;
    }
    if (msg.t === "leave") {
      client.room?.leave(client);
      return;
    }
    client.room?.handle(client, msg);
  });

  ws.on("close", () => {
    clearInterval(heartbeat);
    client.room?.disconnect(client);
  });
  ws.on("error", () => ws.terminate());
}

server.listen(PORT, "0.0.0.0", () => log("listening", { port: PORT }));

async function shutdown(signal: string): Promise<void> {
  log("shutdown", { signal });
  rooms.stop();
  server.close();
  for (const ws of wss.clients) ws.close(1012, "server restarting");
  await db.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
