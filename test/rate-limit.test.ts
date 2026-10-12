import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { admitMessage } from "../src/server/rate-limit.ts";

afterEach(() => vi.restoreAllMocks());
describe("monotonic WebSocket admission", () => {
  it("keeps compliant 30Hz messages accepted through backwards wall-clock corrections", () => {
    const state = { windowStart: 0, windowCount: 0, strikes: 0 };
    const monotonic = vi.spyOn(performance, "now");
    const wall = vi.spyOn(Date, "now");
    for (let frame = 0; frame < 360; frame++) {
      const elapsed = frame * 1000 / 30;
      monotonic.mockReturnValue(elapsed);
      wall.mockReturnValue(100000 + elapsed - (frame >= 120 ? 5000 : 0));
      expect(admitMessage(state, false)).toBe("accept");
    }
    expect(state.strikes).toBe(0);
  });
  it("still drops flood traffic and closes after the original twenty-strike allowance", () => {
    const state = { windowStart: 0, windowCount: 0, strikes: 0 };
    for (let i = 0; i < 90; i++) expect(admitMessage(state, false, 500)).toBe("accept");
    for (let i = 0; i < 20; i++) expect(admitMessage(state, false, 500)).toBe("drop");
    expect(admitMessage(state, false, 500)).toBe("close");
    const binary = { windowStart: 0, windowCount: 0, strikes: 0 };
    expect(admitMessage(binary, true, 500)).toBe("drop");
  });
  it("forward wall-clock jumps cannot replenish a flooding sender's allowance", () => {
    const state = { windowStart: 0, windowCount: 0, strikes: 0 };
    vi.spyOn(performance, "now").mockReturnValue(500);
    const wall = vi.spyOn(Date, "now");
    for (let i = 0; i < 90; i++) {
      wall.mockReturnValue(100000 + i * 2000);
      expect(admitMessage(state, false)).toBe("accept");
    }
    wall.mockReturnValue(999999);
    expect(admitMessage(state, false)).toBe("drop");
  });
});
