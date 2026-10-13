import { TEAM_MODES } from "../shared/settings.ts";
import type { World } from "../shared/sim.ts";
import { PF, type WorldSnapshot } from "../shared/types.ts";
import { canSeePlayer } from "../shared/visibility.ts";

/** Filter coordinates before serialization. Public scores contain no position. */
export function snapshotForViewer(world: World, state: Omit<WorldSnapshot,"ack">, viewerId: number | null,
  killerId: number | null, ack: number): WorldSnapshot {
  const viewer=viewerId===null?null:world.players.get(viewerId)??null;
  // Spectators are explicitly omniscient observers. A dead fighter gains only
  // the actual killer's actor, never the killer's team or an arbitrary target.
  const killer=killerId===null?null:world.players.get(killerId);
  const following=viewer&&!viewer.alive&&killer?.alive&&killer.connected&&killer.id!==viewer.id?killer.id:null;
  const teamMode=TEAM_MODES.includes(world.settings.mode)||world.settings.mode==="survival";
  const visible=new Set(state.players.filter(p=>viewerId===null||p.id===viewerId||p.id===following||
    (teamMode&&viewer?.team!==undefined&&viewer.team!==-1&&viewer.team===world.players.get(p.id)?.team)||canSeePlayer(viewer?.alive?viewer:null,
    {...p,team:world.players.get(p.id)?.team},world.map,world.tick,
    {teamMode,carryingFlag:state.flags.some(f=>f.state==="carried"&&f.carrier===p.id)})).map(p=>p.id));
  return {...state,ack,following,
    scores:state.players.map(p=>({id:p.id,k:p.k,d:p.d,as:p.as,deliveries:p.deliveries,f:p.f&(PF.ALIVE|PF.CONNECTED)})),
    players:state.players.filter(p=>visible.has(p.id)),
    events:state.events.filter(e=>"by" in e?(e.t==="flag"||e.by===null||visible.has(e.by)):
      "id" in e?visible.has(e.id):true),
  };
}
