import type { ClientMessage, ServerMessage } from "../shared/protocol.ts";

export type NetStatus = "connecting" | "open" | "reconnecting";

// One WebSocket for the whole app. If it drops, it reconnects with backoff and
// rejoins the room it was in; the server holds the seat for 30 seconds.
export class Net {
  private ws: WebSocket | null = null;
  private listeners: ((m: ServerMessage) => void)[] = [];
  private statusListeners: ((s: NetStatus) => void)[] = [];
  private attempt = 0;
  private stopped = false;
  roomCode: string | null = null;

  connect(): void {
    this.stopped = false;
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    this.emitStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    ws.onopen = () => {
      this.attempt = 0;
      this.emitStatus("open");
      if (this.roomCode) this.send({ t: "join", code: this.roomCode });
    };
    ws.onmessage = (e) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }
      for (const l of this.listeners) l(msg);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws || this.stopped) return;
      if (e.code === 4000) {
        // replaced by another tab: don't fight it
        this.roomCode = null;
      }
      this.attempt++;
      this.emitStatus("reconnecting");
      setTimeout(() => this.connect(), Math.min(8000, 500 * 2 ** Math.min(this.attempt, 4)));
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  on(fn: (m: ServerMessage) => void): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  onStatus(fn: (s: NetStatus) => void): void {
    this.statusListeners.push(fn);
  }

  private emitStatus(s: NetStatus): void {
    for (const l of this.statusListeners) l(s);
  }
}
