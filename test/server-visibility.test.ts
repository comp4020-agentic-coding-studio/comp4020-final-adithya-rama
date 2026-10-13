import { describe, expect, it } from "vitest";
import { snapshotForViewer } from "../src/server/visibility.ts";
import { snapshot } from "../src/shared/sim.ts";
import { PF, type GameEvent } from "../src/shared/types.ts";
import { player, world } from "./helpers.ts";

function fixture(mode: "ffa" | "tdm" | "flag" | "survival" = "tdm") {
  const w = world({ mode });
  w.tick = 100;
  w.map = { ...w.map, concealment: [{ x: 300, y: 850, w: 400, h: 50 }] };
  const viewer = player(w, 0, { x: 100, y: 900 });
  const hidden = player(w, 1, { x: 400, y: 900 });
  const ally = player(w, 0, { x: 600, y: 900 });
  for (const p of [hidden, ally]) { p.crouch = true; p.onGround = true; p.revealUntil = 0; }
  const state = () => snapshot(w, []);
  return { w, viewer, hidden, ally, state };
}

describe("server concealment serialization", () => {
  it("omits the complete hidden enemy state and exposes only public scoreboard fields", () => {
    const { w, viewer, hidden, ally, state } = fixture();
    hidden.jetting = true; hidden.protectUntil = 200;
    const visible = snapshotForViewer(w, state(), viewer.id, null, 8);
    expect(visible.ack).toBe(8); expect(visible.following).toBeNull();
    expect(visible.players.map(p => p.id)).toEqual([viewer.id, ally.id]);
    const score = visible.scores!.find(p => p.id === hidden.id)!;
    expect(Object.keys(score).sort()).toEqual(["as", "d", "deliveries", "f", "id", "k"]);
    expect(score.f).toBe(PF.ALIVE | PF.CONNECTED);
    expect(JSON.stringify(score)).not.toMatch(/x|y|aim|fuel|slots|revealUntil/);
    // Snapshot tailoring must not strip the next recipient's shared snapshot.
    const unfiltered = state();
    snapshotForViewer(w, unfiltered, viewer.id, null, 0);
    expect(unfiltered.players).toHaveLength(3);
  });
  it("filters hidden actor events including positional shot/melee events while preserving public effects", () => {
    const { w, viewer, hidden, state } = fixture();
    const events: GameEvent[] = [
      { t: "shot", by: hidden.id, w: "uzi", x1: 400, y1: 870, x2: 100, y2: 870, hit: false },
      { t: "melee", by: hidden.id, x: 400, y: 870 },
      { t: "reload", id: hidden.id },
      { t: "shield", id: hidden.id },
      { t: "emp", id: hidden.id, until: 200 },
      { t: "hurt", id: hidden.id, amount: 10 },
      { t: "pickup", id: hidden.id, item: "frag" },
      { t: "flash", id: hidden.id, until: 200, strength: 1 },
      { t: "kill", killer: hidden.id, attacker: hidden.id, victim: viewer.id, w: "uzi" },
      { t: "explode", x: 900, y: 700, r: 90 },
      { t: "flashbang", x: 900, y: 700, r: 100 },
      { t: "wave", wave: 2 },
      { t: "flag", owner: 1, action: "drop", by: hidden.id },
    ];
    const result = snapshotForViewer(w, { ...state(), events }, viewer.id, null, 0);
    expect(result.events.map(e => e.t)).toEqual(["kill", "explode", "flashbang", "wave", "flag"]);
  });
  it("does not treat same-number teams as allies in FFA, but explicitly allows spectators", () => {
    const { w, viewer, hidden, ally, state } = fixture("ffa");
    expect(snapshotForViewer(w, state(), viewer.id, null, 0).players.map(p => p.id)).toEqual([viewer.id]);
    expect(snapshotForViewer(w, state(), null, null, 0).players.map(p => p.id)).toEqual([viewer.id, hidden.id, ally.id]);
  });
  it("reveals close, attacking and flag-carrying enemies without changing their hitboxes", () => {
    const { w, viewer, hidden, state } = fixture("flag");
    viewer.x = 330;
    expect(snapshotForViewer(w, state(), viewer.id, null, 0).players.some(p => p.id === hidden.id)).toBe(true);
    viewer.x = 100; hidden.revealUntil = 101;
    expect(snapshotForViewer(w, state(), viewer.id, null, 0).players.some(p => p.id === hidden.id)).toBe(true);
    hidden.revealUntil = 100;
    expect(snapshotForViewer(w, state(), viewer.id, null, 0).players.some(p => p.id === hidden.id)).toBe(false);
    const flag = w.flags.find(f => f.owner === 1)!;
    flag.state = "carried"; flag.carrier = hidden.id;
    expect(snapshotForViewer(w, state(), viewer.id, null, 0).players.some(p => p.id === hidden.id)).toBe(true);
    expect(w.players.get(hidden.id)).toBe(hidden); expect(hidden.alive).toBe(true);
  });
  it("grants a dead fighter only its authorized killer exception, including reconnect snapshots", () => {
    const { w, viewer, hidden, ally, state } = fixture();
    const killerAlly = player(w, 1, { x: 500, y: 900 });
    killerAlly.crouch = true; killerAlly.onGround = true;
    viewer.alive = false;
    const personal = snapshotForViewer(w, state(), viewer.id, hidden.id, 93);
    expect(personal.following).toBe(hidden.id); expect(personal.ack).toBe(93);
    expect(personal.players.map(p => p.id)).toEqual([viewer.id, hidden.id, ally.id]);
    // The killer exception is not a replacement viewer origin that reveals its neighbors.
    expect(personal.players.some(p => p.id === killerAlly.id)).toBe(false);
    expect(snapshotForViewer(w, state(), viewer.id, null, 94).players.some(p => p.id === hidden.id)).toBe(false);
  });
  it("never applies follow exceptions to living fighters, self kills or unavailable killers", () => {
    const { w, viewer, hidden, state } = fixture();
    expect(snapshotForViewer(w, state(), viewer.id, hidden.id, 0).following).toBeNull();
    viewer.alive = false;
    expect(snapshotForViewer(w, state(), viewer.id, viewer.id, 0).following).toBeNull();
    hidden.connected = false;
    expect(snapshotForViewer(w, state(), viewer.id, hidden.id, 0).following).toBeNull();
    hidden.connected = true; hidden.alive = false;
    expect(snapshotForViewer(w, state(), viewer.id, hidden.id, 0).following).toBeNull();
  });
  it("uses the living viewer's position for nearby detection, never a dead victim position", () => {
    const { w, viewer, hidden, state } = fixture();
    viewer.x = 350;
    expect(snapshotForViewer(w, state(), viewer.id, null, 0).players.some(p => p.id === hidden.id)).toBe(true);
    viewer.alive = false;
    expect(snapshotForViewer(w, state(), viewer.id, null, 0).players.some(p => p.id === hidden.id)).toBe(false);
  });
});
