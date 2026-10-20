export const PROTOCOL_VERSION = 4;

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20;
export const INPUT_SEND_RATE = 30;
export const INTERP_MS = 100;
export const LAG_COMP_MAX_TICKS = 9; // 150 ms at 60 Hz

export const MAX_ROOM_PLAYERS = 8;
export const MAX_CONNECTED_CLIENTS = 24;
export const MAX_ACTIVE_ROOMS = 1;
export const MAX_WAITING_ROOMS = 4;
export const MAX_INPUT_QUEUE = 8;
export const MAX_MESSAGE_BYTES = 4096;

export const PLAYER_W = 22;
export const PLAYER_H = 44;
export const PLAYER_CROUCH_H = 28;
export const STEP_UP_HEIGHT = 24;
export const BASE_HEALTH = 100;
export const BASE_FUEL = 100;

export const GRAVITY = 1500;
export const RUN_SPEED = 230;
export const GROUND_ACCEL = 2600;
export const AIR_ACCEL = 1400;
export const JUMP_SPEED = 520;
// net upward acceleration while jetting, applied on top of cancelling gravity
export const JET_LIFT = 1350;
export const JET_MAX_RISE = 430;
export const MAX_FALL = 900;
export const FUEL_DRAIN = 38;
export const FUEL_REGEN_GROUND = 45;
export const FUEL_REGEN_AIR = 14;
export const FUEL_REGEN_DELAY_TICKS = 36;
export const DROP_THROUGH_TICKS = 14;

export const SPAWN_PROTECT_TICKS = 2 * TICK_RATE;
export const ASSIST_WINDOW_TICKS = 8 * TICK_RATE;
export const ASSIST_MIN_FRACTION = 0.2;
export const PICKUP_RADIUS = 42;
export const DROPPED_WEAPON_TTL_TICKS = 20 * TICK_RATE;
// Projectile culling retains this extra cushion beyond the actor travel envelope.
export const OUT_OF_BOUNDS_MARGIN = 240;
export const PLAYER_TRAVEL_MARGIN = 1000;
export const FALL_EXPOSURE_GRACE_TICKS = TICK_RATE;
export const FALL_DAMAGE_INTERVAL_TICKS = TICK_RATE / 4;
export const FALL_DAMAGE_PER_INTERVAL = 5; // 20 HP/s, independent of combat damage multiplier

export const MAX_THROWABLES = 6;
export const DEFAULT_FRAGS = 2;

export const MELEE_DAMAGE = 40;
export const MELEE_RANGE = 46;
export const MELEE_COOLDOWN_TICKS = 36;

export const SEAT_RESERVE_MS = 30_000;
export const CHECKPOINT_MS = 5_000;

// Combat postpones discrete healing; hidden reconnect bodies never heal.
export const HEALTH_REGEN_DELAY_TICKS = 6 * TICK_RATE;
export const HEALTH_REGEN_INTERVAL_TICKS = TICK_RATE / 4;

// Authored Classic PC movement/combat profile; persisted with new results.
export const GAMEPLAY_VERSION = "classic-pc-2026-10-21";
export const SPACE_ACCEL = 700;
export const SPACE_SPEED = 430;
export const CONCEAL_REVEAL_TICKS = 60;
export const CONCEAL_DETECT_RADIUS = 80;
