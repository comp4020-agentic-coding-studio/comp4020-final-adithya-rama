// Isolated acceptance helper: ordered, bidirectional WebSocket delay including
// heartbeat frames. HTTP remains undelayed. This is synthetic latency, not WAN evidence.
import { createServer, request } from "node:http";
import WebSocket, { WebSocketServer, type RawData } from "ws";

export async function startLatencyProxy(target: string, rtt: number, jitter: number) {
  const upstream = new URL(target);
  const sockets = new Set<WebSocket>();
  const pending = new Set<ReturnType<typeof setTimeout>>();
  let packet = 0;
  const stats = { forwarded: 0, maxPending: 0 };
  const server = createServer((req, res) => {
    const remote = request(new URL(req.url ?? "/", upstream), {
      method: req.method,
      headers: { ...req.headers, host: upstream.host, origin: upstream.origin },
    }, reply => {
      res.writeHead(reply.statusCode ?? 502, reply.headers);
      reply.pipe(res);
    });
    remote.on("error", e => { res.writeHead(502); res.end(e.message); });
    req.pipe(remote);
  });
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, autoPong: false });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/ws", upstream);
    url.protocol = upstream.protocol === "https:" ? "wss:" : "ws:";
    const remote = new WebSocket(url, {
      headers: { Cookie: req.headers.cookie ?? "", Origin: upstream.origin },
      perMessageDeflate: false, autoPong: false,
    });
    sockets.add(remote);
    remote.once("error", () => socket.destroy());
    remote.once("open", () => wss.handleUpgrade(req, socket, head, local => {
      sockets.add(local);
      const relay = (source: WebSocket, destination: WebSocket) => {
        let lastDelivery = 0;
        const enqueue = (kind: "message" | "ping" | "pong", data: RawData, binary = false) => {
          const now = Date.now();
          const intended = now + Math.max(0, rtt / 2 + Math.sin(++packet * 1.7) * jitter);
          const delivery = lastDelivery = Math.max(lastDelivery, intended);
          const timer = setTimeout(() => {
            pending.delete(timer);
            if (destination.readyState !== WebSocket.OPEN) return;
            if (kind === "message") destination.send(data, { binary });
            else if (kind === "ping") destination.ping(data);
            else destination.pong(data);
            stats.forwarded++;
          }, Math.max(0, delivery - now));
          pending.add(timer);
          stats.maxPending = Math.max(stats.maxPending, pending.size);
        };
        source.on("message", (data, binary) => enqueue("message", data, binary));
        source.on("ping", data => enqueue("ping", data));
        source.on("pong", data => enqueue("pong", data));
        source.on("close", () => {
          sockets.delete(source);
          if (destination.readyState === WebSocket.OPEN) destination.close(1000);
        });
        source.on("error", () => destination.terminate());
      };
      relay(local, remote);
      relay(remote, local);
    }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  return {
    origin: "http://127.0.0.1:" + address.port,
    stats,
    async close() {
      for (const t of pending) clearTimeout(t);
      for (const ws of sockets) ws.terminate();
      wss.close();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}
