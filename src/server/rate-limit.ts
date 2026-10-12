import { performance } from "node:perf_hooks";

interface MessageWindow {
  windowStart: number;
  windowCount: number;
  strikes: number;
}

// Wall-clock corrections must neither extend this window nor reset its budget.
export function admitMessage(state: MessageWindow, binary: boolean, now = performance.now()): "accept" | "drop" | "close" {
  if (now - state.windowStart > 1000) {
    state.windowStart = now;
    state.windowCount = 0;
  }
  if (++state.windowCount > 90 || binary) return ++state.strikes > 20 ? "close" : "drop";
  return "accept";
}
