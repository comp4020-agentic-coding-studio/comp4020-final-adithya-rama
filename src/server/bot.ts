import { GRAVITY, JUMP_SPEED, SPACE_ACCEL } from "../shared/constants.ts";
import { lineOfSight, maxFuel, raycastMap } from "../shared/physics.ts";
import { dualPartner, isTeamMode, muzzleOf, type Player, rng, type World } from "../shared/sim.ts";
import { Btn, type BotDifficulty, type InputFrame } from "../shared/types.ts";
import { WEAPONS } from "../shared/weapons.ts";
import { canSeePlayer } from "../shared/visibility.ts";
import { botDestinations, planBotRoute } from "./bot-navigation.ts";

// Errors persist across a burst instead of averaging away every tick. Values
// are authored practice tuning, with limited sight and turning at every level.
export const BOT_TUNING: Record<BotDifficulty, {
  reaction: number; turn: number; error: number; burst: number; pause: number; sight: number;
}> = {
  easy: { reaction: 60, turn: 1.4, error: .34, burst: 24, pause: 84, sight: 650 },
  normal: { reaction: 42, turn: 2.3, error: .19, burst: 39, pause: 57, sight: 850 },
  hard: { reaction: 24, turn: 3.3, error: .09, burst: 57, pause: 36, sight: 1100 },
};

// A simple practice opponent. It reads the authoritative world directly and
// produces the same InputFrame a human client would, so it obeys every rule.
export class Bot {
  private seq = 0;
  private aim = 0;
  private seenSince = -1;
  private targetId: number | null = null;
  private burstEnd = 0;
  private nextBurst = 0;
  private aimError = 0;
  private wanderTarget = 0;
  private strafe = 1;
  private route: { x: number; y: number }[] = [];
  private nextPlan = 0;
  private groundRoute = false;
  private refuelling = false;
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
    if (!me || !me.alive) {
      this.targetId = null;
      this.seenSince = -1;
      this.burstEnd = 0;
      return frame;
    }

    const tuning = BOT_TUNING[this.difficulty];
    const blinded = w.tick < me.flashUntil;
    const target = blinded ? null : this.pickTarget(w, me);
    let b = 0;
    let goalX: number;
    let goalY: number;
    const muzzle = muzzleOf(me);

    if (target) {
      const ty = target.y - 26;
      if (this.targetId !== target.id) {
        this.targetId = target.id;
        this.seenSince = w.tick;
        this.nextBurst = w.tick + tuning.reaction;
        this.burstEnd = 0;
        this.aimError = (rng(w) < .5 ? -1 : 1) * tuning.error * (.6 + rng(w) * .4);
      }
      const reacted = w.tick - this.seenSince >= tuning.reaction;
      if (reacted && w.tick >= this.nextBurst) {
        const selected=me.slots[me.active];
        const charge=selected?Math.ceil((WEAPONS[selected.weapon].chargeMs??0)*60/1000):0;
        this.burstEnd = w.tick + charge + tuning.burst;
        this.nextBurst = this.burstEnd + tuning.pause;
        this.aimError = (rng(w) < .5 ? -1 : 1) * tuning.error * (.6 + rng(w) * .4);
      }
      const want = Math.atan2(ty - muzzle.y, target.x - muzzle.x);
      this.aim = turnTowards(this.aim, want + this.aimError, tuning.turn / 60);
      goalX = target.x + this.strafe * 160;
      goalY = target.y;
      if (w.tick % 120 === 0) this.strafe = rng(w) < .5 ? -1 : 1;

      const slot = me.slots[me.active];
      const partner = me.dual ? dualPartner(me) : null;
      const attackingSlot = slot?.weapon === "riot-shield" && partner !== null ? me.slots[partner] : slot;
      const weapon = attackingSlot ? WEAPONS[attackingSlot.weapon] : undefined;
      const dist = Math.hypot(target.x - me.x, target.y - me.y);
      const meleeReady = weapon?.behavior === "melee";
      const usableGun = (index: number): boolean => {
        const held = me.slots[index];
        return !!held && WEAPONS[held.weapon].category !== "equipment" &&
          (held.mag > 0 || held.reserve > 0 || w.settings.unlimitedAmmo);
      };
      if (!usableGun(me.active) && (!meleeReady || dist > 120)) {
        const ready = me.slots.findIndex((_, index) => index !== me.active && usableGun(index));
        // Direct slot selection cannot get stuck holding SWITCH on an empty
        // intermediate slot. Keep shield+machete when already in melee range.
        if (ready >= 0) b |= [Btn.SLOT1, Btn.SLOT2, Btn.SLOT3][ready];
      }
      if (meleeReady) goalX = target.x + (me.x < target.x ? -30 : 30);
      const aligned = Math.abs(angleDelta(this.aim, want)) < .5;
      if (weapon && reacted && aligned && w.tick < this.burstEnd && dist < weapon.range * .9) {
        b |= Btn.FIRE | Btn.CONTINUOUS_FIRE;
      }
      if (slot && WEAPONS[slot.weapon].category !== "equipment" && slot.mag === 0) b |= Btn.RELOAD;
      if (reacted && dist < 320 && dist > 120 && (me.throwables.frag ?? 0) > 0 &&
          rng(w) < (this.difficulty === "easy" ? .0005 : this.difficulty === "normal" ? .001 : .002)) b |= Btn.THROW;
    } else {
      this.seenSince = -1;
      this.targetId = null;
      this.burstEnd = 0;
      const nodes = botDestinations(w.map);
      if (nodes.length === 0) return frame;
      let node = nodes[this.wanderTarget % nodes.length];
      if (Math.hypot(node.x - me.x,node.y-me.y) < 40) {
        this.wanderTarget = Math.floor(rng(w) * nodes.length);
        node = nodes[this.wanderTarget];
      }
      goalX = node.x;
      goalY = node.y;
      // With no visible target, turn only toward navigation, never its hidden position.
      this.aim = turnTowards(this.aim, node.x > me.x ? 0 : Math.PI, tuning.turn / 60);
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
    if(w.map.physics!=="space"&&w.settings.flight&&!w.settings.unlimitedFuel){
      if(me.fuel<maxFuel(w.settings)*.16)this.refuelling=true;
      if(me.fuel>maxFuel(w.settings)*.8)this.refuelling=false;
      if(this.refuelling){
        const landing=w.map.navNodes.filter(p=>p.y>=me.y-20&&Math.abs(p.x-me.x)<350&&
          w.map.solids.some(r=>Math.abs(r.y-p.y)<.1&&p.x>r.x+11&&p.x<r.x+r.w-11)&&
          lineOfSight(w.map,me.x,me.y-24,p.x,p.y-24))
          .sort((a,b)=>Math.abs(a.x-me.x)+Math.abs(a.y-me.y)*.4-Math.abs(b.x-me.x)-Math.abs(b.y-me.y)*.4)[0];
        if(landing){goalX=landing.x;goalY=landing.y;}
      }
    }
    const goal = this.navigate(w, me, goalX, goalY);
    goalX = goal.x; goalY = goal.y;
    const dx = goalX - me.x,dy=goalY-me.y;
    if(w.map.physics==="space"){
      // Opposite thrust brakes inertia; coasting is not terrestrial friction.
      // Desired speed shrinks before a junction so we do not cut rock corners.
      const acceleration=SPACE_ACCEL*w.settings.thrust;
      const desired=(distance:number)=>Math.sign(distance)*Math.min(300,Math.sqrt(2*acceleration*Math.max(0,Math.abs(distance)-6))*.72);
      const ex=desired(dx)-me.vx,ey=desired(dy)-me.vy;
      if(Math.abs(ex)>10)b|=ex>0?Btn.RIGHT:Btn.LEFT;
      if(Math.abs(ey)>10)b|=ey>0?Btn.CROUCH:Btn.JET;
    }else{
      if (Math.abs(dx) > 18) b |= dx > 0 ? Btn.RIGHT : Btn.LEFT;
      const dir = dx > 0 ? 1 : -1;
      const wallAhead = raycastMap(w.map, me.x, me.y - 20, dir, 0, 34) < 34;
      if (wallAhead && me.onGround && !this.refuelling) b |= Btn.JUMP;
      const needRise = goalY < me.y - (me.onGround?12:-12) || (wallAhead && !me.onGround);
      if (needRise && me.fuel > 8 && w.settings.flight && !this.groundRoute && !this.refuelling) b |= Btn.JET;
      if (goalY > me.y + 65 && me.onGround) b |= Btn.DESCEND;
      if (Math.abs(me.x - this.lastX) < .4 && Math.abs(dx) > 18) this.stuckTicks++; else this.stuckTicks = 0;
      this.lastX = me.x;
      if (this.stuckTicks > 35 && !this.refuelling) { b |= Btn.JUMP; if (w.settings.flight && me.fuel > 20 && !this.groundRoute) b |= Btn.JET; }
      if (this.stuckTicks > 120) { this.route = []; this.nextPlan = 0; this.stuckTicks = 0; this.wanderTarget=Math.floor(rng(w)*botDestinations(w.map).length); }
      if (me.onGround && goalY < me.y - 12 && !this.refuelling) b |= Btn.JUMP;
    }
    // Do not immediately pick the just-dropped shield back up, or replace a
    // usable combat weapon with whatever happens to lie underfoot.
    const hasLoadedGun = me.slots.some((slot) => slot && WEAPONS[slot.weapon].category !== "equipment" &&
      (slot.mag > 0 || slot.reserve > 0 || w.settings.unlimitedAmmo));
    if (w.tick % 30 === 0 && !(b & (Btn.SLOT1 | Btn.SLOT2 | Btn.SLOT3)) && (!target || !hasLoadedGun)) b |= Btn.PICKUP;

    frame.b = b;
    frame.aim = this.aim;
    return frame;
  }

  private navigate(w: World, me: Player, x: number, y: number): { x: number; y: number } {
    if (w.map.version) {
      if(w.tick>=this.nextPlan){
        this.nextPlan=w.tick+30;
        // A walkable route is fuel-independent and safer through low doorways.
        const ground=w.map.physics!=="space"?planBotRoute(w.map,{...w.settings,flight:false},me,{x,y}):[];
        this.groundRoute=ground.length>0;
        this.route=this.groundRoute?ground:planBotRoute(w.map,w.settings,me,{x,y});
      }
      const threshold=w.map.physics==="space"?22:28;
      while(this.route.length&&Math.hypot(this.route[0].x-me.x,this.route[0].y-me.y)<threshold)this.route.shift();
      return this.route[0]??{x,y};
    }
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
      if ((isTeamMode(w.settings) || w.settings.mode === "survival" || w.settings.mode === "training") && o.team === me.team) continue;
      if(!canSeePlayer(me,o,w.map,w.tick,{teamMode:isTeamMode(w.settings)||w.settings.mode==="survival"||w.settings.mode==="training",carryingFlag:w.flags.some(f=>f.carrier===o.id)}))continue;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      const muzzle = muzzleOf(me);
      if (d > BOT_TUNING[this.difficulty].sight || !lineOfSight(w.map, muzzle.x, muzzle.y, o.x, o.y - 26)) continue;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }
}

function angleDelta(a: number, b: number): number { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
function turnTowards(a: number, b: number, maximum: number): number {
  const d = angleDelta(a, b);
  return a + Math.max(-maximum, Math.min(maximum, d));
}
