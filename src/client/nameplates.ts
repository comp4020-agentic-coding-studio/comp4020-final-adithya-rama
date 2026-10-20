import type { Team } from "../shared/types.ts";

export interface NamedActor {
  team: Team;
  local: boolean;
  alive: boolean;
  concealed?: boolean;
}

/** Relations belong to the viewer, not to the fixed Ember/Tide map colours. */
export function nameplateIdentity(player: NamedActor, viewer?: Pick<NamedActor, "team">) {
  const ally = !!viewer && viewer.team !== -1 && player.team === viewer.team;
  const friendly = player.local || ally;
  const marker = player.local ? "YOU" : ally ? "ALLY" : viewer ? "ENEMY"
    : player.team === 0 ? "EMBER" : player.team === 1 ? "TIDE" : "PLAYER";
  const color = friendly ? 0x8ff0ac : viewer ? 0xff8b91
    : player.team === 0 ? 0xffb17e : player.team === 1 ? 0x91c8ff : 0xf3f6fa;
  return { marker, color, friendly, visible: player.alive && (!player.concealed || friendly) };
}

export function nameplateText(marker: string, name: string): string {
  const letters = Array.from(name);
  return `${marker} · ${letters.length > 18 ? letters.slice(0, 17).join("") + "…" : name}`;
}

export interface PlateBounds { id:number; x:number; y:number; width:number; height:number }
/** Screen-space packing avoids zoomed-out names covering one another. */
export function placeNameplates(plates:PlateBounds[],area:{width:number;top:number;bottom:number}):PlateBounds[] {
  const placed:PlateBounds[]=[];
  for(const plate of [...plates].sort((a,b)=>a.y-b.y||a.id-b.id)){
    const x=Math.max(4+plate.width/2,Math.min(area.width-4-plate.width/2,plate.x));
    const fits=(p:PlateBounds)=>p.y-p.height>=area.top+4&&p.y<=area.bottom-4&&
      placed.every(q=>Math.abs(p.x-q.x)>(p.width+q.width)/2+4||p.y+4<q.y-q.height||p.y-p.height>q.y+4);
    // Prefer all available rows above the actors before placing a tag below.
    // Alternating above/below can cover a nearby pilot's head at far zoom.
    for(let step=0;step<plates.length*2+2;step++){
      const row=step<=plates.length?-step:step-plates.length;
      const offset=row*(plate.height+6);
      const candidate={...plate,x,y:plate.y+offset};
      if(fits(candidate)){placed.push(candidate);break;}
    }
  }
  return placed;
}
