export type Mode = "ffa" | "tdm" | "training" | "flag" | "survival";
export type Multiplier = 0.5 | 1 | 1.5 | 2;
export type Team = 0 | 1 | -1;
export type BotDifficulty = "easy" | "normal" | "hard";

export interface RoomSettings {
  map: string;
  mode: Mode;
  capacity: number;
  durationMin: 2 | 5 | 10 | 15;
  scoreLimit: number;
  flight: boolean;
  thrust: Multiplier;
  fuelCapacity: Multiplier;
  recharge: Multiplier;
  unlimitedFuel: boolean;
  gravity: Multiplier;
  moveSpeed: Multiplier;
  health: Multiplier;
  damage: Multiplier;
  respawnSec: number;
  weapons: string[];
  throwables: string[];
  loadout: [string, string | null];
  mapPickups: boolean;
  unlimitedAmmo: boolean;
  friendlyFire: boolean;
  bots: number;
  botDifficulty: BotDifficulty;
}

export const Btn = {
  LEFT: 1,
  RIGHT: 2,
  JUMP: 4,
  JET: 8,
  CROUCH: 16,
  FIRE: 32,
  RELOAD: 64,
  PICKUP: 128,
  DROP: 256,
  SWITCH: 512,
  THROW: 1024,
  MELEE: 2048,
  SLOT1: 4096,
  SLOT2: 8192,
  NEXT_THROWABLE: 16384,
  DUAL: 32768,
} as const;
export const ALL_BUTTONS = 65535;

export interface InputFrame {
  seq: number;
  b: number;
  aim: number;
  // server tick the client was viewing remote players at, for hitscan rewind
  view?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  team: Team;
}

export type PickupKind = "weapon" | "health" | "ammo" | "fuel" | "throwable";

export interface MapPickup {
  x: number;
  y: number;
  kind: PickupKind;
  item?: string;
  respawnSec: number;
}

export interface MapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  theme: { sky: number; rock: number; platform: number; accent: number };
  solids: Rect[];
  platforms: Rect[];
  spawns: SpawnPoint[];
  pickups: MapPickup[];
  goals: { team: 0 | 1; rect: Rect }[];
  flagHomes: { team: 0 | 1; x: number; y: number }[];
  navNodes: { x: number; y: number }[];
}

export type WeaponCategory =
  | "sidearm"
  | "smg"
  | "rifle"
  | "precision"
  | "shotgun"
  | "heavy"
  | "special"
  | "equipment";

export interface WeaponDefinition {
  id: string;
  name: string;
  category: WeaponCategory;
  damage: number;
  pellets: number;
  spread: number;
  cooldownMs: number;
  auto: boolean;
  mag: number;
  reserve: number;
  reloadMs: number;
  range: number;
  zoom: number;
  oneHanded: boolean;
  heavy: boolean;
  color: number;
  behavior: "hitscan" | "projectile" | "beam" | "flame" | "emp" | "melee" | "shield";
  projectileSpeed?: number;
  projectileGravity?: number;
  blastRadius?: number;
  bounce?: number;
  empMs?: number;
}

export interface ThrowableDefinition {
  id: string;
  name: string;
  fuseMs: number;
  radius: number;
  maxDamage: number;
  minDamage: number;
  throwSpeed: number;
  bounce: number;
  effect: "blast" | "gas" | "emp" | "mine";
  durationMs?: number;
  armMs?: number;
}

export interface FlagState {
  owner: 0 | 1;
  state: "home" | "carried" | "dropped" | "respawning";
  carrier: number | null;
  x: number;
  y: number;
  generation: number;
  vx: number;
  vy: number;
  availableTick: number;
}

export interface SlotState {
  weapon: string;
  mag: number;
  reserve: number;
  reloadEnd: number;
  cooldownUntil: number;
}

export interface WeaponStats { shots: number; hits: number; damage: number; kills: number }
export interface SurvivalState {
  wave: number;
  remaining: number;
  toSpawn: number;
  nextSpawnTick: number;
  nextWaveTick: number;
  cleared: number;
}
export interface AreaSnap { id: number; k: "gas"; x: number; y: number; r: number; until: number }

export interface ParticipantResult {
  key: string;
  profileId: string | null;
  name: string;
  team: Team;
  bot: boolean;
  kills: number;
  deaths: number;
  assists: number;
  deliveries: number;
  score: number;
  mvp: boolean;
  weaponStats?: Record<string, WeaponStats>;
}

export interface MatchResult {
  matchId: string;
  mode: Mode;
  map: string;
  reason: "time" | "limit" | "host" | "abandoned" | "defeat";
  draw: boolean;
  winnerTeam: Team | null;
  winnerKeys: string[];
  teamScores: [number, number];
  participants: ParticipantResult[];
  durationSec: number;
  endedAt: string;
  scoringNote: string;
  wavesCleared?: number;
}

export interface PlayerSnap {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aim: number;
  f: number;
  hp: number;
  maxHp: number;
  fuel: number;
  jc: number;
  dt: number;
  s: [string | null, string | null];
  a: 0 | 1;
  mag: number;
  res: number;
  rl: number;
  g: number;
  k: number;
  d: number;
  as: number;
  rs: number;
  slots: [SlotState | null, SlotState | null];
  dual: boolean;
  throwable: string;
  throwables: Record<string, number>;
  emp: number;
  deliveries: number;
}

export interface ProjectileSnap {
  id: number;
  k: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  armed: boolean;
}

export interface PickupSnap {
  id: number;
  k: PickupKind;
  i: string | null;
  x: number;
  y: number;
}

export type GameEvent =
  | { t: "shot"; by: number; w: string; x1: number; y1: number; x2: number; y2: number; hit: boolean }
  | { t: "kill"; killer: number | null; victim: number; w: string }
  | { t: "explode"; x: number; y: number; r: number }
  | { t: "melee"; by: number; x: number; y: number }
  | { t: "hurt"; id: number; amount: number }
  | { t: "spawn"; id: number }
  | { t: "pickup"; id: number; item: string }
  | { t: "reload"; id: number }
  | { t: "flag"; owner: 0 | 1; action: "pickup" | "drop" | "return" | "delivery"; by: number | null }
  | { t: "wave"; wave: number }
  | { t: "emp"; id: number; until: number }
  | { t: "shield"; id: number };

export interface WorldSnapshot {
  tick: number;
  ack: number;
  endTick: number;
  ts: [number, number];
  players: PlayerSnap[];
  projectiles: ProjectileSnap[];
  pickups: PickupSnap[];
  events: GameEvent[];
  flags: FlagState[];
  areas: AreaSnap[];
  survival: SurvivalState | null;
}

// player flag bits in PlayerSnap.f
export const PF = {
  ALIVE: 1,
  CROUCH: 2,
  GROUND: 4,
  PROTECTED: 8,
  JETTING: 16,
  CONNECTED: 32,
} as const;
