import { lineOfSight, raycastMap } from "../shared/physics.ts";
import { isTeamMode, muzzleOf, type Player, rng, type World } from "../shared/sim.ts";
import { Btn, type BotDifficulty, type InputFrame } from "../shared/types.ts";
import { WEAPONS } from "../shared/weapons.ts";

const AIM_ERROR: Record<BotDifficulty, number> = { easy: 0.3, normal: 0.14, hard: 0.06 };
const REACTION_TICKS: Record<BotDifficulty, number> = { easy: 40, normal: 22, hard: 10 };

// A simple practice opponent. It reads the authoritative world directly and
// produces the same InputFrame a human client would, so it obeys every rule.
export class Bot {
  private seq = 0;
  private aim = 0;
  private seenSince = -1;
  private wanderTarget = 0;
  private strafe = 1;
  private prev = 0;

  readonly playerId: number;
  readonly difficulty: BotDifficulty;

  constructor(playerId: number, difficulty: BotDifficulty) {
    this.playerId = playerId;
    this.difficulty = difficulty;
  }

  think(w: World): InputFrame {
    const me = w.players.get(this.playerId);
    const frame: InputFrame = { seq: ++this.seq, b: 0, aim: this.aim };
    if (!me || !me.alive) return frame;

    const target = this.pickTarget(w, me);
    let b = 0;
    let goalX: number;
    let goalY: number;
    const muzzle = muzzleOf(me);

    if (target) {
      const ty = target.y - 26;
      const visible = lineOfSight(w.map, muzzle.x, muzzle.y, target.x, ty);
      const want = Math.atan2(ty - muzzle.y, target.x - muzzle.x);
      const err = (rng(w) - 0.5) * AIM_ERROR[this.difficulty];
      this.aim = lerpAngle(this.aim, want + err, 0.25);
      goalX = target.x + this.strafe * 160;
      goalY = target.y;
      if (w.tick % 120 === 0) this.strafe = rng(w) < 0.5 ? -1 : 1;

      if (visible) {
        if (this.seenSince < 0) this.seenSince = w.tick;
      } else this.seenSince = -1;

      const slot = me.slots[me.active];
      const dist = Math.hypot(target.x - me.x, target.y - me.y);
      const reacted = this.seenSince >= 0 && w.tick - this.seenSince >= REACTION_TICKS[this.difficulty];
      if (slot && reacted && dist < WEAPONS[slot.weapon].range * 0.9) {
        const def = WEAPONS[slot.weapon];
        // semi-automatic weapons need a fresh press each shot
        if (def.auto || !(this.prev & Btn.FIRE)) b |= Btn.FIRE;
      }
      if (slot && slot.mag === 0) b |= Btn.RELOAD;
      if (reacted && dist < 320 && dist > 120 && (me.throwables.frag ?? 0) > 0 && rng(w) < 0.004) b |= Btn.THROW;
      if (slot && slot.mag === 0 && slot.reserve === 0 && me.slots[1 - me.active]) b |= Btn.SWITCH;
    } else {
      const nodes = w.map.navNodes;
      if (nodes.length === 0) return frame;
      let node = nodes[this.wanderTarget % nodes.length];
      if (Math.abs(node.x - me.x) < 40) {
        this.wanderTarget = Math.floor(rng(w) * nodes.length);
        node = nodes[this.wanderTarget];
      }
      goalX = node.x;
      goalY = node.y;
      this.aim = lerpAngle(this.aim, node.x > me.x ? 0 : Math.PI, 0.1);
      this.seenSince = -1;
    }

    const dx = goalX - me.x;
    if (Math.abs(dx) > 30) b |= dx > 0 ? Btn.RIGHT : Btn.LEFT;
    const dir = dx > 0 ? 1 : -1;
    const wallAhead = raycastMap(w.map, me.x, me.y - 20, dir, 0, 40) < 40;
    if (wallAhead && me.onGround) b |= Btn.JUMP;
    const needRise = goalY < me.y - 50 || (wallAhead && !me.onGround);
    if (needRise && me.fuel > 8) b |= Btn.JET;
    if (goalY > me.y + 80 && me.onGround) b |= Btn.CROUCH;

    frame.b = b;
    frame.aim = this.aim;
    this.prev = b;
    return frame;
  }

  private pickTarget(w: World, me: Player): Player | null {
    let best: Player | null = null;
    let bestD = Infinity;
    for (const o of w.players.values()) {
      if (o === me || !o.alive) continue;
      if (isTeamMode(w.settings) && o.team === me.team) continue;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}
