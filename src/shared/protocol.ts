import type { InputFrame, MatchResult, RoomSettings, Team, WorldSnapshot } from "./types.ts";

export interface Profile {
  id: string;
  name: string;
  color: number;
  prefs: Record<string, unknown>;
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  mvps: number;
}

export interface MemberView {
  key: string;
  name: string;
  color: number;
  team: Team;
  ready: boolean;
  host: boolean;
  connected: boolean;
}

export type RoomState = "lobby" | "playing" | "results";
export type SaveStatus = "saving" | "saved" | "failed";

export interface RoomView {
  code: string;
  name: string;
  isPublic: boolean;
  state: RoomState;
  settings: RoomSettings;
  members: MemberView[];
  you: string;
}

export interface RosterEntry {
  id: number;
  key: string;
  name: string;
  team: Team;
  color: number;
  bot: boolean;
}

export type ClientMessage =
  | { t: "join"; code: string }
  | { t: "leave" }
  | { t: "ready"; ready: boolean }
  | { t: "team"; team: 0 | 1 }
  | { t: "settings"; settings: Partial<RoomSettings> }
  | { t: "start" }
  | { t: "end" }
  | { t: "rematch" }
  | { t: "input"; frames: InputFrame[] }
  | { t: "ping"; c: number };

export type ServerMessage =
  | { t: "welcome"; v: number; profile: Profile }
  | { t: "room"; room: RoomView }
  | { t: "left" }
  | { t: "match"; matchId: string; settings: RoomSettings; you: number | null; roster: RosterEntry[]; tick: number }
  | { t: "roster"; roster: RosterEntry[] }
  | ({ t: "snap" } & WorldSnapshot)
  | { t: "results"; result: MatchResult; save: SaveStatus }
  | { t: "save"; matchId: string; save: SaveStatus }
  | { t: "error"; message: string }
  | { t: "pong"; c: number; tick: number };

export interface RoomListing {
  code: string;
  name: string;
  state: RoomState;
  mode: RoomSettings["mode"];
  map: string;
  players: number;
  capacity: number;
}

export interface HistoryEntry {
  id: string;
  mode: string;
  map: string;
  status: "live" | "completed" | "interrupted" | "abandoned";
  startedAt: string;
  endedAt: string | null;
  team: number;
  kills: number;
  deaths: number;
  assists: number;
  deliveries: number;
  score: number;
  mvp: number;
  won: number;
}
