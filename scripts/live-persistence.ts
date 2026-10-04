// Seed a dedicated acceptance guest, then verify it after operator-controlled
// restart/redeploy. This script never restarts services or joins other rooms.
// APP_URL=https://app.fly.dev mise exec -- node scripts/live-persistence.ts seed
// APP_URL=https://app.fly.dev mise exec -- node scripts/live-persistence.ts verify restart
// APP_URL=https://app.fly.dev mise exec -- node scripts/live-persistence.ts verify redeploy
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { TestPlayer, sleep } from "../spec/lib/client.ts";
import { Btn } from "../src/shared/types.ts";

interface SeedState {
  version: 1;
  origin: string;
  seededAt: string;
  cookie: string;
  profile: Record<string, unknown>;
  matchId: string;
  history: Record<string, unknown>;
  match: Record<string, unknown>;
}
const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, ".data");
const statePath = resolve(root, process.env.LIVE_PERSISTENCE_STATE ?? ".data/live-persistence.json");
const phase = process.argv[2];
const label = process.argv[3] ?? "";
if (phase !== "seed" && phase !== "verify") throw Error("Usage: live-persistence.ts seed|verify [evidence-label]");
if (label && !/^[a-z0-9-]{1,32}$/.test(label)) throw Error("Evidence label must use lowercase letters, digits or hyphens");
if (!statePath.startsWith(dataDir + sep)) throw Error("Private acceptance state must stay inside ignored .data/");
if (!process.env.APP_URL) throw Error("APP_URL is required; no deployment is selected implicitly");
const url = new URL(process.env.APP_URL);
if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
    (url.pathname !== "/" && url.pathname !== "")) throw Error("APP_URL must be a plain HTTP(S) origin without credentials");
if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw Error("Remote acceptance requires HTTPS");
const origin = url.origin;
const reportPath = resolve(root, "test-results", "live-persistence-" + phase + (label ? "-" + label : "") + ".json");
const startedAt = new Date().toISOString();
const checks: string[] = [];
let failure: string | null = null;
let matchId: string | null = null;
let profileId: string | null = null;
let detailHash: string | null = null;
let client: TestPlayer | null = null;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function loadState(): SeedState {
  let state: SeedState;
  try { state = JSON.parse(readFileSync(statePath, "utf8")); }
  catch { throw Error("Private seed state is missing or invalid; its contents have not been printed"); }
  if (state.version !== 1 || typeof state.origin !== "string" || typeof state.cookie !== "string" ||
      !/^js_sid=[A-Za-z0-9_-]{43}$/.test(state.cookie) || typeof state.matchId !== "string" ||
      !state.profile || !state.match || !state.history) throw Error("Private seed state has an invalid shape");
  if (state.origin !== origin) throw Error("APP_URL differs from the seed origin; use separate private state per environment");
  return state;
}
function saveState(state: SeedState) {
  mkdirSync(dirname(statePath), { recursive: true });
  // Prevent credential storage in a tracked/unignored path even with overrides.
  try { execFileSync("git", ["check-ignore", "--quiet", statePath], { cwd: root, stdio: "ignore" }); }
  catch { throw Error("Private state path is not gitignored; refusing to store the session"); }
  const temporary = statePath + "." + randomUUID() + ".tmp";
  writeFileSync(temporary, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, statePath);
  chmodSync(statePath, 0o600);
}
async function request<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await client!.http<T>(path, init);
  if (response.status < 200 || response.status >= 300) throw Error("HTTP " + response.status + " for " + path);
  return response.body;
}
try {
  if (phase === "seed") {
    if (existsSync(statePath)) loadState(); // Never overwrite a different environment's session.
    client = new TestPlayer(origin);
    const profile = await client.visit();
    if (!profile?.id || !/^js_sid=[A-Za-z0-9_-]{43}$/.test(client.cookie)) throw Error("Test guest creation failed");
    profileId = profile.id;
    await request("/api/me", { method: "PATCH", body: {
      name: "PersistenceTest", color: 0x24aacc,
      prefs: { muted: true, volume: 0.3, reducedShake: true, avatar: { helmet: "visor", face: "robot", emblem: "bolt" } },
    } });
    checks.push("Created a dedicated guest and saved its customization/preferences");
    const created = await request<{ code: string }>("/api/rooms", { method: "POST", body: {
      isPublic: false, name: "Persistence test", settings: { mode: "training", bots: 1, durationMin: 2, map: "outpost-yard" },
    } });
    await client.connect();
    client.send({ t: "join", code: created.code });
    await client.waitFor("room", (m) => m.room.code === created.code);
    client.send({ t: "start" });
    const match = await client.waitFor("match");
    assert.notEqual(match.you, null, "Test guest entered its own training round");
    matchId = match.matchId;
    const start = Date.now();
    let seq = 0;
    while (Date.now() - start < 1200) {
      client.send({ t: "input", frames: [0, 1].map(() => ({ seq: ++seq, b: Btn.RIGHT | Btn.JET | Btn.FIRE, aim: -Math.PI / 4 })) });
      await sleep(34);
    }
    client.inbox = client.inbox.filter((m) => m.t !== "snap");
    const snap = await client.waitFor("snap");
    assert.ok(snap.ack > 0, "Server acknowledged actual gameplay input");
    assert.ok(snap.players.some((p) => p.id === match.you), "Test guest is present in simulation");
    client.send({ t: "end" });
    const result = await client.waitFor("results", (m) => m.result.matchId === matchId);
    await client.waitFor("save", (m) => m.matchId === matchId && m.save === "saved", 20_000);
    assert.equal(result.result.mode, "training");
    checks.push("Played through authoritative WebSocket input and waited for the training result to be saved");
    const current = await request<{ profile: Record<string, unknown> }>("/api/me");
    const history = await request<{ matches: Record<string, unknown>[] }>("/api/me/matches");
    const entry = history.matches.find((m) => m.id === matchId);
    assert.ok(entry && entry.status === "completed", "Saved training result appears in the test guest history");
    const detail = await request<{ match: Record<string, unknown> }>("/api/matches/" + matchId);
    assert.equal(detail.match.status, "completed");
    detailHash = digest(detail.match);
    saveState({ version: 1, origin, seededAt: startedAt, cookie: client.cookie, profile: current.profile,
      matchId, history: entry, match: detail.match });
    checks.push("Saved expected profile/history/detail and private session in gitignored owner-only state");
  } else {
    const state = loadState();
    matchId = state.matchId;
    profileId = String(state.profile.id);
    client = new TestPlayer(origin);
    client.cookie = state.cookie;
    const current = await request<{ profile: Record<string, unknown> }>("/api/me");
    assert.deepEqual(current.profile, state.profile, "Profile identity, preferences and aggregates survived");
    checks.push("The same session restored the exact profile, preferences and aggregates");
    const history = await request<{ matches: Record<string, unknown>[] }>("/api/me/matches");
    const matches = history.matches.filter((m) => m.id === state.matchId);
    assert.equal(matches.length, 1, "Exactly one saved history record survived");
    assert.deepEqual(matches[0], state.history, "Completed history record is unchanged");
    checks.push("One unchanged completed training result remains in personal history");
    const detail = await request<{ match: Record<string, unknown> }>("/api/matches/" + state.matchId);
    assert.deepEqual(detail.match, state.match, "Exact match details survived");
    detailHash = digest(detail.match);
    checks.push("Exact persisted match detail matches the seed");
    checks.push("Verification used only authenticated GET requests and did not mutate game state");
  }
} catch (error) {
  // Compare failures can include our non-secret profile/results, but never print
  // loaded state or the client object that contains the session cookie.
  failure = (error as Error).message.split("\n")[0];
} finally {
  if (phase === "seed") client?.quit();
  else client?.close();
  await sleep(100);
  const report = {
    phase, label: label || null, origin, startedAt, finishedAt: new Date().toISOString(),
    passed: failure === null, profileId, matchId, matchDetailSha256: detailHash, checks, failure,
    scope: phase === "seed" ? "Dedicated test guest and private training room only" : "Read-only verification of the seeded guest",
    restartOrRedeployPerformedByScript: false,
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
  if (failure) process.exitCode = 1;
}
