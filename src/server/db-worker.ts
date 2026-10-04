// All SQLite work happens on this worker thread, because DatabaseSync blocks
// and the game loop must not. node:sqlite is release-candidate in Node 24
// (see docs/decisions/0001-stack.md); the Node version is pinned in mise.toml.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import type { MatchResult } from "../shared/types.ts";

const path: string = workerData.path;
if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
const db = new DatabaseSync(path);
db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 2000;");

const MIGRATIONS: string[] = [
  `CREATE TABLE profiles (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     color INTEGER NOT NULL,
     prefs TEXT NOT NULL DEFAULT '{}',
     created_at TEXT NOT NULL,
     matches INTEGER NOT NULL DEFAULT 0,
     wins INTEGER NOT NULL DEFAULT 0,
     kills INTEGER NOT NULL DEFAULT 0,
     deaths INTEGER NOT NULL DEFAULT 0,
     mvps INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     profile_id TEXT NOT NULL REFERENCES profiles(id),
     created_at TEXT NOT NULL,
     last_seen TEXT NOT NULL
   );
   CREATE TABLE matches (
     id TEXT PRIMARY KEY,
     room_code TEXT NOT NULL,
     mode TEXT NOT NULL,
     map TEXT NOT NULL,
     status TEXT NOT NULL,
     started_at TEXT NOT NULL,
     ended_at TEXT,
     settings TEXT NOT NULL,
     result TEXT,
     checkpoint_at TEXT
   );
   CREATE TABLE participants (
     match_id TEXT NOT NULL REFERENCES matches(id),
     key TEXT NOT NULL,
     profile_id TEXT,
     name TEXT NOT NULL,
     team INTEGER NOT NULL,
     bot INTEGER NOT NULL,
     kills INTEGER NOT NULL DEFAULT 0,
     deaths INTEGER NOT NULL DEFAULT 0,
     assists INTEGER NOT NULL DEFAULT 0,
     deliveries INTEGER NOT NULL DEFAULT 0,
     score INTEGER NOT NULL DEFAULT 0,
     mvp INTEGER NOT NULL DEFAULT 0,
     won INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (match_id, key)
   );
   CREATE INDEX participants_profile ON participants(profile_id);
   CREATE TABLE presets (
     id TEXT PRIMARY KEY,
     profile_id TEXT NOT NULL REFERENCES profiles(id),
     name TEXT NOT NULL,
     settings TEXT NOT NULL,
     created_at TEXT NOT NULL
   );`,
];

function migrate(): void {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

function tx<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

interface ParticipantRow {
  key: string;
  profileId: string | null;
  name: string;
  team: number;
  bot: boolean;
  kills: number;
  deaths: number;
  assists: number;
  deliveries: number;
  score: number;
}

migrate();

const upsertParticipant = db.prepare(`
  INSERT INTO participants (match_id, key, profile_id, name, team, bot, kills, deaths, assists, deliveries, score, mvp, won)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (match_id, key) DO UPDATE SET
    name = excluded.name, team = excluded.team, kills = excluded.kills, deaths = excluded.deaths,
    assists = excluded.assists, deliveries = excluded.deliveries, score = excluded.score,
    mvp = excluded.mvp, won = excluded.won`);

const PVP = new Set(["ffa", "tdm", "flag"]);

const ops: Record<string, (args: any) => unknown> = {
  interruptLive() {
    return db.prepare("UPDATE matches SET status = 'interrupted', ended_at = COALESCE(checkpoint_at, started_at) WHERE status = 'live'").run().changes;
  },
  sessionProfile({ tokenHash }: { tokenHash: string }) {
    const row = db
      .prepare("SELECT p.* FROM sessions s JOIN profiles p ON p.id = s.profile_id WHERE s.token_hash = ?")
      .get(tokenHash);
    if (row) db.prepare("UPDATE sessions SET last_seen = ? WHERE token_hash = ?").run(new Date().toISOString(), tokenHash);
    return row ?? null;
  },
  createGuest({ tokenHash, id, name, color }: { tokenHash: string; id: string; name: string; color: number }) {
    const now = new Date().toISOString();
    return tx(() => {
      db.prepare("INSERT INTO profiles (id, name, color, created_at) VALUES (?, ?, ?, ?)").run(id, name, color, now);
      db.prepare("INSERT INTO sessions (token_hash, profile_id, created_at, last_seen) VALUES (?, ?, ?, ?)").run(tokenHash, id, now, now);
      return db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
    });
  },
  updateProfile({ id, name, color, prefs }: { id: string; name?: string; color?: number; prefs?: string }) {
    if (name !== undefined) db.prepare("UPDATE profiles SET name = ? WHERE id = ?").run(name, id);
    if (color !== undefined) db.prepare("UPDATE profiles SET color = ? WHERE id = ?").run(color, id);
    if (prefs !== undefined) db.prepare("UPDATE profiles SET prefs = ? WHERE id = ?").run(prefs, id);
    return db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
  },
  createMatch({ id, roomCode, mode, map, settings }: { id: string; roomCode: string; mode: string; map: string; settings: string }) {
    db.prepare("INSERT INTO matches (id, room_code, mode, map, status, started_at, settings) VALUES (?, ?, ?, ?, 'live', ?, ?)").run(
      id,
      roomCode,
      mode,
      map,
      new Date().toISOString(),
      settings,
    );
    return true;
  },
  checkpoint({ matchId, participants }: { matchId: string; participants: ParticipantRow[] }) {
    return tx(() => {
      const m = db.prepare("SELECT status FROM matches WHERE id = ?").get(matchId) as { status: string } | undefined;
      if (!m || m.status !== "live") return false;
      for (const p of participants) {
        upsertParticipant.run(matchId, p.key, p.profileId, p.name, p.team, p.bot ? 1 : 0, p.kills, p.deaths, p.assists, p.deliveries, p.score, 0, 0);
      }
      db.prepare("UPDATE matches SET checkpoint_at = ? WHERE id = ?").run(new Date().toISOString(), matchId);
      return true;
    });
  },
  // Idempotent: a second finalize for the same match changes nothing.
  finalize({ result }: { result: MatchResult }) {
    return tx(() => {
      const m = db.prepare("SELECT status FROM matches WHERE id = ?").get(result.matchId) as { status: string } | undefined;
      if (!m) throw new Error("unknown match");
      if (m.status !== "live") return { duplicate: true };
      const status = result.reason === "abandoned" ? "abandoned" : "completed";
      db.prepare("UPDATE matches SET status = ?, ended_at = ?, result = ? WHERE id = ?").run(status, result.endedAt, JSON.stringify(result), result.matchId);
      const counts = PVP.has(result.mode) && status === "completed";
      for (const p of result.participants) {
        const won = result.winnerKeys.includes(p.key);
        upsertParticipant.run(result.matchId, p.key, p.profileId, p.name, p.team, p.bot ? 1 : 0, p.kills, p.deaths, p.assists, p.deliveries, p.score, p.mvp ? 1 : 0, won ? 1 : 0);
        if (counts && p.profileId) {
          db.prepare(
            "UPDATE profiles SET matches = matches + 1, wins = wins + ?, kills = kills + ?, deaths = deaths + ?, mvps = mvps + ? WHERE id = ?",
          ).run(won ? 1 : 0, p.kills, p.deaths, p.mvp ? 1 : 0, p.profileId);
        }
      }
      return { duplicate: false };
    });
  },
  history({ profileId, before, limit }: { profileId: string; before: string | null; limit: number }) {
    return db
      .prepare(
        `SELECT m.id, m.mode, m.map, m.status, m.started_at AS startedAt, m.ended_at AS endedAt,
                p.team, p.kills, p.deaths, p.assists, p.deliveries, p.score, p.mvp, p.won
         FROM participants p JOIN matches m ON m.id = p.match_id
         WHERE p.profile_id = ? AND (? IS NULL OR m.started_at < ?)
         ORDER BY m.started_at DESC LIMIT ?`,
      )
      .all(profileId, before, before, limit);
  },
  match({ id }: { id: string }) {
    const m = db.prepare("SELECT id, room_code AS roomCode, mode, map, status, started_at AS startedAt, ended_at AS endedAt, result FROM matches WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!m) return null;
    const participants = db
      .prepare("SELECT key, profile_id AS profileId, name, team, bot, kills, deaths, assists, deliveries, score, mvp, won FROM participants WHERE match_id = ? ORDER BY score DESC")
      .all(id);
    return { ...m, result: m.result ? JSON.parse(m.result as string) : null, participants };
  },
};

parentPort!.on("message", (msg: { id: number; op: string; args: unknown }) => {
  try {
    const fn = ops[msg.op];
    if (!fn) throw new Error(`unknown op ${msg.op}`);
    parentPort!.postMessage({ id: msg.id, ok: true, value: fn(msg.args) });
  } catch (e) {
    parentPort!.postMessage({ id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
parentPort!.postMessage({ ready: true });
