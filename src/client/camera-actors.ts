import { PF, type PlayerSnap, type WorldSnapshot } from "../shared/types.ts";

/** Current server permission outranks the interpolation buffer's older absence. */
export function includeAuthorizedKiller(actors: Map<number, PlayerSnap>,
  latest: Pick<WorldSnapshot, "players" | "following">, viewerId: number | null): void {
  if (viewerId === null || latest.following == null) return;
  const viewer = latest.players.find(p => p.id === viewerId);
  if (!viewer || viewer.f & PF.ALIVE) return;
  const killer = latest.players.find(p => p.id === latest.following);
  if (!killer || !(killer.f & PF.ALIVE) || !(killer.f & PF.CONNECTED)) return;
  const old = actors.get(killer.id);
  if (!old || !(old.f & PF.ALIVE) || !(old.f & PF.CONNECTED)) actors.set(killer.id, killer);
}
