// One JSON line per event, which is what `flyctl logs` shows. Callers never
// pass session tokens; profile ids are opaque and safe to log.
export function log(event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.LOG_QUIET === "1") return;
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...fields }));
}
