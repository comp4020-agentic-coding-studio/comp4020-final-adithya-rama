import { GRAVITY, JUMP_SPEED } from "../shared/constants.ts";
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
  private route: { x: number; y: number }[] = [];
  private nextPlan = 0;
  private lastX = 0;
  private stuckTicks = 0;

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

    if (w.settings.mode === "flag" && me.team !== -1) {
      const flag = w.flags.find((f) => f.owner === me.team);
      if (flag?.carrier === me.id) {
        const goal = w.map.goals.find((g) => g.team !== me.team);
        if (goal) { goalX = goal.rect.x + goal.rect.w / 2; goalY = goal.rect.y + goal.rect.h; }
      } else if (flag && flag.state !== "carried" && flag.state !== "respawning") {
        goalX = flag.x; goalY = flag.y;
      } else if (flag?.carrier) {
        const carrier = w.players.get(flag.carrier);
        if (carrier) { goalX = carrier.x + this.strafe * 90; goalY = carrier.y; }
      }
    }
    const goal = this.navigate(w, me, goalX, goalY);
    goalX = goal.x; goalY = goal.y;
    const dx = goalX - me.x;
    if (Math.abs(dx) > 30) b |= dx > 0 ? Btn.RIGHT : Btn.LEFT;
    const dir = dx > 0 ? 1 : -1;
    const wallAhead = raycastMap(w.map, me.x, me.y - 20, dir, 0, 40) < 40;
    if (wallAhead && me.onGround) b |= Btn.JUMP;
    const needRise = goalY < me.y - 50 || (wallAhead && !me.onGround);
    if (needRise && me.fuel > 8) b |= Btn.JET;
    if (goalY > me.y + 80 && me.onGround) b |= Btn.CROUCH;
    if (Math.abs(me.x - this.lastX) < 0.4 && Math.abs(dx) > 30) this.stuckTicks++; else this.stuckTicks = 0;
    this.lastX = me.x;
    if (this.stuckTicks > 35) { b |= Btn.JUMP; if (w.settings.flight && me.fuel > 20) b |= Btn.JET; }
    if (this.stuckTicks > 120) { this.route = []; this.nextPlan = 0; this.stuckTicks = 0; }
    if (me.onGround && goalY < me.y - 15) b |= Btn.JUMP;
    if (w.tick % 30 === 0) b |= Btn.PICKUP;

    frame.b = b;
    frame.aim = this.aim;
    this.prev = b;
    return frame;
  }

  private navigate(w: World, me: Player, x: number, y: number): { x: number; y: number } {
    if (w.tick >= this.nextPlan) {
      this.nextPlan = w.tick + 15;
      const nodes = [{ x: me.x, y: me.y }, ...w.map.navNodes, { x, y }];
      const costs = new Array<number>(nodes.length).fill(Infinity);
      const previous = new Array<number>(nodes.length).fill(-1);
      const seen = new Set<number>();
      costs[0] = 0;
      const jumpRise = JUMP_SPEED ** 2 / (2 * GRAVITY * w.settings.gravity);
      for (let n = 0; n < nodes.length; n++) {
        let at = -1;
        for (let i = 0; i < nodes.length; i++) if (!seen.has(i) && (at < 0 || costs[i] < costs[at])) at = i;
        if (at < 0 || !Number.isFinite(costs[at])) break;
        if (at === nodes.length - 1) break;
        seen.add(at);
        const a = nodes[at];
        for (let i = 1; i < nodes.length; i++) {
          if (seen.has(i) || i === at) continue;
          const b = nodes[i];
          const dx = Math.abs(b.x - a.x);
          const rise = a.y - b.y;
          if (dx > 640 || rise > (w.settings.flight ? 420 : jumpRise * 0.9)) continue;
          if (!lineOfSight(w.map, a.x, a.y - 24, b.x, b.y - 24)) continue;
          // Reject paths whose head/body would cross static rock.
          if (!lineOfSight(w.map, a.x, a.y - 40, b.x, b.y - 40)) continue;
          const cost = costs[at] + Math.hypot(dx, rise) + Math.max(0, rise) * 0.5;
          if (cost < costs[i]) { costs[i] = cost; previous[i] = at; }
        }
      }
      this.route = [];
      let at = nodes.length - 1;
      while (previous[at] !== -1) { this.route.unshift(nodes[at]); at = previous[at]; }
    }
    while (this.route.length && Math.hypot(this.route[0].x - me.x, this.route[0].y - me.y) < 45) this.route.shift();
    return this.route[0] ?? { x, y };
  }

  private pickTarget(w: World, me: Player): Player | null {
    let best: Player | null = null;
    let bestD = Infinity;
    for (const o of w.players.values()) {
      if (o === me || !o.alive) continue;
      if ((isTeamMode(w.settings) || w.settings.mode === "survival") && o.team === me.team) continue;
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
