import WebSocket from "ws";
import type { ClientMessage, Profile, ServerMessage } from "../../src/shared/protocol.ts";

// A scripted player: an HTTP session plus a WebSocket, the same way a browser
// gets them, so the spec exercises the deployed contract end to end.
export class TestPlayer {
  cookie = "";
  profile!: Profile;
  ws: WebSocket | null = null;
  inbox: ServerMessage[] = [];
  private waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  get origin(): string {
    return new URL(this.baseUrl).origin;
  }

  async http<T = any>(path: string, init: { method?: string; body?: unknown; cookie?: boolean } = {}): Promise<{ status: number; body: T; headers: Headers }> {
    const headers: Record<string, string> = { Origin: this.origin };
    if (init.cookie !== false && this.cookie) headers.Cookie = this.cookie;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(new URL(path, this.baseUrl), {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await res.text();
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON
    }
    return { status: res.status, body, headers: res.headers };
  }

  async visit(): Promise<Profile> {
    const res = await this.http<{ profile: Profile }>("/api/session", { method: "POST" });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    this.profile = res.body.profile;
    return this.profile;
  }

  connect(): Promise<void> {
    const url = new URL("/ws", this.baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url, { headers: { Cookie: this.cookie, Origin: this.origin } });
    this.ws = ws;
    ws.on("message", (data) => {
      const m = JSON.parse(data.toString()) as ServerMessage;
      const i = this.waiters.findIndex((w) => w.pred(m));
      if (i >= 0) this.waiters.splice(i, 1)[0].resolve(m);
      else this.inbox.push(m);
      if (this.inbox.length > 500) this.inbox.shift();
    });
    return new Promise((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
  }

  send(m: ClientMessage | Record<string, unknown>): void {
    this.ws!.send(JSON.stringify(m));
  }

  waitFor<T extends ServerMessage["t"]>(
    t: T,
    pred: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true,
    timeoutMs = 10_000,
  ): Promise<Extract<ServerMessage, { t: T }>> {
    const match = (m: ServerMessage) => m.t === t && pred(m as Extract<ServerMessage, { t: T }>);
    const i = this.inbox.findIndex(match);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0] as Extract<ServerMessage, { t: T }>);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${t}`)), timeoutMs);
      this.waiters.push({
        pred: match,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as Extract<ServerMessage, { t: T }>);
        },
      });
    });
  }

  drain(): void {
    this.inbox = [];
  }

  close(): void {
    this.ws?.close();
  }

  quit(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.send({ t: "leave" });
    this.close();
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
