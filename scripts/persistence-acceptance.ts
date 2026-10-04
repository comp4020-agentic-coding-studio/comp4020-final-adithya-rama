// Isolated, repeatable production-container persistence acceptance.
// Requires Docker and the prebuilt image; never points at a deployed database.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { TestPlayer, sleep } from "../spec/lib/client.ts";
import { Btn } from "../src/shared/types.ts";

const imageTag = process.env.PERSISTENCE_IMAGE ?? "jet-skirmish:acceptance";
const port = Number(process.env.PERSISTENCE_PORT ?? 8085);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error("Invalid isolated test port");
const runId = randomUUID().slice(0, 8);
const container = "jet-persistence-" + runId;
const volume = container + "-data";
const label = "codex.persistence";
const base = "http://127.0.0.1:" + port;
const started = new Date();
const evidence: { check: string; detail: string }[] = [];
const clients: TestPlayer[] = [];
let imageId = "";
let failure: string | null = null;
let elapsedSec = 0;

function docker(args: string[], timeout = 60_000): string {
  return execFileSync("docker", args, { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function record(check: string, detail: string) {
  evidence.push({ check, detail });
  console.log(JSON.stringify({ check, detail }));
}
async function health(): Promise<any> {
  const until = Date.now() + 25_000;
  while (Date.now() < until) {
    try {
      const response = await fetch(base + "/healthz");
      if (response.ok) return await response.json();
    } catch {}
    await sleep(200);
  }
  throw Error("Isolated container did not become healthy");
}
async function launch() {
  docker(["run", "--detach", "--name", container, "--label", label + "=" + runId,
    "--memory=256m", "--cpus=1", "--publish", "127.0.0.1:" + port + ":8080",
    "--env", "ACTIVE_ROOM_LIMIT=1", "--mount", "type=volume,src=" + volume + ",dst=/data", imageId]);
  await health();
}
function owned(kind: "container" | "volume", name: string): boolean {
  try { return docker([kind, "inspect", "--format", "{{index .Labels \"" + label + "\"}}", name]) === runId; }
  catch {
    if (kind === "container") {
      try { return docker(["inspect", "--format", "{{index .Config.Labels \"" + label + "\"}}", name]) === runId; } catch {}
    }
    return false;
  }
}
function removeContainer() {
  if (owned("container", container)) docker(["rm", "--force", container]);
}
async function pilot(name: string) {
  const p = new TestPlayer(base);
  clients.push(p);
  await p.visit();
  const updated = await p.http("/api/me", { method: "PATCH", body: {
    name, color: 0x24aacc, prefs: { muted: true, volume: 0.3, reducedShake: true,
      avatar: { helmet: "visor", face: "robot", emblem: "bolt" } },
  } });
  assert.equal(updated.status, 200);
  return p;
}
async function room(host: TestPlayer, guest: TestPlayer) {
  const created = await host.http<{ code: string }>("/api/rooms", { method: "POST", body: {
    isPublic: false, name: "Persistence acceptance", settings: {
      mode: "ffa", map: "crosscurrent", capacity: 2, durationMin: 2, bots: 0,
      flight: false, mapPickups: false, loadout: ["mini-eagle", "uzi"],
    },
  } });
  assert.equal(created.status, 201);
  for (const p of [host, guest]) { p.drain(); await p.connect(); p.send({ t: "join", code: created.body.code }); await p.waitFor("room"); }
  guest.send({ t: "ready", ready: true });
  await guest.waitFor("room", (m) => m.room.members.some((p) => p.key === guest.profile.id && p.ready));
  host.send({ t: "start" });
  const [a, b] = await Promise.all([host.waitFor("match"), guest.waitFor("match")]);
  assert.equal(a.matchId, b.matchId);
  return { code: created.body.code, id: a.matchId, hostId: a.you!, guestId: b.you! };
}
async function freshSnap(p: TestPlayer) {
  p.inbox = p.inbox.filter((m) => m.t !== "snap");
  return await p.waitFor("snap");
}
async function inputs(p: TestPlayer, milliseconds: number, buttons: number, seq = 0) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) {
    p.send({ t: "input", frames: [0, 1].map(() => ({ seq: ++seq, b: buttons, aim: -Math.PI / 2 })) });
    await sleep(34);
  }
  return seq;
}
function checkpoint(matchId: string) {
  const source = 'const {DatabaseSync}=require("node:sqlite");const db=new DatabaseSync("/data/jet-skirmish.db",{readOnly:true});' +
    'const row=db.prepare("SELECT status,checkpoint_at FROM matches WHERE id=?").get(process.argv[1]);' +
    'const players=db.prepare("SELECT kills,deaths,mvp,won,weapon_stats FROM participants WHERE match_id=?").all(process.argv[1]);' +
    'console.log(JSON.stringify({row,players}));db.close();';
  return JSON.parse(docker(["exec", container, "node", "-e", source, matchId]));
}
try {
  imageId = docker(["image", "inspect", "--format", "{{.Id}}", imageTag]);
  docker(["volume", "create", "--label", label + "=" + runId, volume]);
  await launch();
  record("Isolated production constraints", "Pinned image; one CPU; 256 MiB memory; dedicated persistent volume; localhost only.");

  const host = await pilot("Persist-A"), guest = await pilot("Persist-B");
  const match = await room(host, guest);
  await sleep(600);
  const initialAmmo = (await freshSnap(host)).players.find((p) => p.id === match.hostId)!.mag;
  let seq = await inputs(host, 100, Btn.FIRE);
  await inputs(host, 100, 0, seq);
  const before = (await freshSnap(host)).players.find((p) => p.id === match.hostId)!;
  assert.ok(before.mag < initialAmmo, "Real input consumed ammunition");
  const expectedHealth = before.hp, expectedAmmo = before.mag;

  host.send({ t: "damage", target: match.guestId, amount: 999999 });
  host.send({ t: "score", team: 0, amount: 999999 });
  await sleep(150);
  const untrusted = await freshSnap(host);
  assert.deepEqual(untrusted.ts, [0, 0]);
  assert.ok(untrusted.players.every((p) => p.hp === 100));
  assert.ok(untrusted.players.every((p) => p.k === 0));
  record("Server authority", "Fabricated damage/score messages left both health values at 100 and scores/kills at zero.");

  for (const delay of [350, 10_500]) {
    host.close(); await sleep(delay); host.drain(); await host.connect();
    host.send({ t: "join", code: match.code });
    const resumed = await host.waitFor("match");
    assert.equal(resumed.matchId, match.id); assert.equal(resumed.you, match.hostId);
    const state = (await freshSnap(host)).players.find((p) => p.id === match.hostId)!;
    assert.equal(state.hp, expectedHealth); assert.equal(state.mag, expectedAmmo);
    assert.equal((await freshSnap(host)).players.filter((p) => p.id === match.hostId).length, 1);
    await inputs(host, 100, 0);
    const acknowledged = await freshSnap(host);
    assert.ok(acknowledged.ack > 0, "Fresh input sequence was accepted after reconnect");
  }
  record("Real WebSocket reconnection", "350 ms and 10.5 s disconnects restored the same participant, health and ammunition; fresh input acknowledged; no duplicate player.");

  // Guest became host immediately after the first disconnect.
  guest.send({ t: "end" });
  const result = await guest.waitFor("results");
  assert.equal(result.result.matchId, match.id);
  await guest.waitFor("save", (m) => m.matchId === match.id && m.save === "saved");
  const savedProfile = (await host.http<any>("/api/me")).body.profile;
  const savedDetail = (await host.http<any>("/api/matches/" + match.id)).body.match;
  assert.equal(savedProfile.matches, 1);
  assert.equal(savedDetail.status, "completed");
  for (let i = 0; i < 3; i++) { guest.send({ t: "end" }); guest.send({ t: "retry-save" }); }
  await sleep(250);
  assert.deepEqual((await host.http<any>("/api/me")).body.profile, savedProfile);
  const history = (await host.http<any>("/api/me/matches")).body.matches;
  assert.equal(history.filter((m: any) => m.id === match.id).length, 1);
  record("Completed result and idempotence", "Real-input PvP round saved once; repeated end/retry-save commands preserved one history row and one profile match.");
  host.quit(); guest.quit(); await sleep(150);

  docker(["restart", "--time", "5", container]);
  await health();
  assert.deepEqual((await host.http<any>("/api/me")).body.profile, savedProfile);
  assert.deepEqual((await host.http<any>("/api/matches/" + match.id)).body.match, savedDetail);
  record("Container restart persistence", "Same opaque session restored profile, cosmetics/preferences, aggregates and exact completed match detail.");

  removeContainer(); await launch();
  assert.deepEqual((await host.http<any>("/api/me")).body.profile, savedProfile);
  assert.deepEqual((await host.http<any>("/api/matches/" + match.id)).body.match, savedDetail);
  record("Container recreation persistence", "Removed/recreated application container using the same dedicated volume; saved profile and exact completed result remained unchanged.");

  for (let i = 0; i < 4; i++) {
    const create = await host.http<{ code: string }>("/api/rooms", { method: "POST", body: { isPublic: false, settings: { mode: "training", bots: 0 } } });
    assert.equal(create.status, 201);
    host.drain(); await host.connect(); host.send({ t: "join", code: create.body.code }); await host.waitFor("room");
    host.send({ t: "leave" }); await host.waitFor("left"); host.close(); await sleep(100);
  }
  assert.equal((await health()).rooms, 0);
  record("Room churn", "Four create/join/leave cycles released all rooms without exhausting waiting-room capacity.");

  const partial = await room(host, guest);
  await inputs(host, 400, Btn.FIRE);
  await sleep(5700);
  const savedCheckpoint = checkpoint(partial.id);
  assert.equal(savedCheckpoint.row.status, "live");
  assert.ok(savedCheckpoint.row.checkpoint_at);
  assert.equal(savedCheckpoint.players.length, 2);
  const shots = savedCheckpoint.players.reduce((total: number, p: any) => total +
    Object.values(JSON.parse(p.weapon_stats)).reduce((n: number, s: any) => n + s.shots, 0), 0);
  assert.ok(shots > 0, "Checkpoint included real weapon-use progress");
  docker(["restart", "--time", "5", container]);
  await health();
  const interrupted = (await host.http<any>("/api/me/matches")).body.matches.find((m: any) => m.id === partial.id);
  assert.equal(interrupted.status, "interrupted");
  assert.equal(interrupted.mvp, 0); assert.equal(interrupted.won, 0);
  assert.equal(interrupted.endedAt, savedCheckpoint.row.checkpoint_at);
  assert.deepEqual((await host.http<any>("/api/me")).body.profile, savedProfile);
  const retained = checkpoint(partial.id);
  assert.deepEqual(retained.players, savedCheckpoint.players);
  record("Interrupted checkpoint recovery", "Unfinished round became interrupted at its last five-second checkpoint; nonzero weapon-use progress preserved; no MVP/win or completed-match aggregate awarded.");

  const limits = JSON.parse(docker(["inspect", "--format", "{{json .HostConfig}}", container]));
  assert.equal(limits.Memory, 268435456); assert.equal(limits.NanoCpus, 1000000000);
  record("Constraint verification", "Docker inspect confirmed Memory=268435456 bytes and NanoCpus=1000000000.");
} catch (error) {
  failure = (error as Error).stack ?? String(error);
  console.error("Persistence acceptance failed: " + (error as Error).message);
} finally {
  for (const p of clients) p.close();
  try { removeContainer(); } catch (e) { failure ??= "Test container cleanup failed: " + (e as Error).message; }
  try { if (owned("volume", volume)) docker(["volume", "rm", volume]); } catch (e) { failure ??= "Test volume cleanup failed: " + (e as Error).message; }
  elapsedSec = Math.round((Date.now() - started.getTime()) / 1000);
  const report = { startedAt: started.toISOString(), elapsedSec, imageId, memoryMiB: 256, cpuCount: 1, evidence, failure };
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/persistence-acceptance.json", JSON.stringify(report, null, 2) + "\n");
  const lines = [
    "# Persistence and connection acceptance evidence", "",
    "- Run: " + started.toISOString() + " (UTC).",
    "- Result: **" + (failure ? "FAILED" : "PASSED") + "**; elapsed " + elapsedSec + " seconds.",
    "- Image: `" + imageId + "`.",
    "- Environment: isolated local Docker container, 1 CPU, 256 MiB memory, dedicated volume, localhost port " + port + ".",
    "- Scope: local production-image verification; this does not establish Fly deployment or human playtest results.", "",
    "| Check | Observed result |", "|---|---|",
    ...evidence.map((row) => "| " + row.check + " | " + row.detail.replaceAll("|", "/") + " |"),
    "", "The script created only uniquely named/labeled test resources and removed its container and volume after the run. Session credentials and cookies were never written to this evidence.",
    "", "Reproduce with `mise exec -- node scripts/persistence-acceptance.ts` after building `jet-skirmish:acceptance`. The script creates its own isolated container and does not accept a production app URL.",
  ];
  if (failure) lines.push("", "Failure: `" + failure.split("\n")[0].replaceAll("`", "'") + "`.");
  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/PERSISTENCE_EVIDENCE.md", lines.join("\n").replaceAll("`", String.fromCharCode(96)) + "\n");
  console.log(JSON.stringify({ passed: !failure, checks: evidence.length, elapsedSec, report: "test-results/persistence-acceptance.json" }));
  if (failure) process.exitCode = 1;
}
