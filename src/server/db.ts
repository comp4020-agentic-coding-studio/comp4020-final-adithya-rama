import { Worker } from "node:worker_threads";
import { log } from "./log.ts";

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
type Job = { id: number; op: string; args: unknown; listeners: Pending[] };
const MAX_QUEUE = 128;

// Only one job crosses the worker boundary; checkpoints coalesce before cloning.
export class Db {
  private worker: Worker;
  private queue: Job[] = [];
  private active: Job | null = null;
  private nextId = 1;
  private failure: Error | null = null;
  private closing = false;
  readonly ready: Promise<void>;

  constructor(path: string) {
    this.worker = new Worker(new URL("./db-worker.ts", import.meta.url), {
      workerData: { path }, resourceLimits: { maxOldGenerationSizeMb: 32 },
    });
    this.ready = new Promise((resolve, reject) => {
      const onMsg = (m: { ready?: boolean }) => {
        if (m.ready) { this.worker.off("message", onMsg); resolve(); }
      };
      this.worker.on("message", onMsg);
      this.worker.once("error", reject);
      this.worker.once("exit", (code) => { if (code !== 0) reject(new Error("Database worker exited")); });
    });
    this.worker.on("message", (m: { id?: number; ok?: boolean; value?: unknown; error?: string }) => {
      if (m.id === undefined || this.active?.id !== m.id) return;
      const job = this.active;
      this.active = null;
      for (const p of job.listeners) {
        if (m.ok) p.resolve(m.value); else p.reject(new Error(m.error ?? "Storage failure"));
      }
      this.pump();
    });
    this.worker.on("error", (e) => this.fail(e));
    this.worker.on("exit", (code) => {
      if (!this.closing) this.fail(new Error("Database worker stopped"));
    });
  }

  get queueDepth(): number { return this.queue.length + (this.active ? 1 : 0); }

  private fail(error: Error): void {
    this.failure = error;
    log("storage_failure", { error: error.message });
    for (const job of [...(this.active ? [this.active] : []), ...this.queue]) {
      for (const p of job.listeners) p.reject(error);
    }
    this.active = null;
    this.queue = [];
  }

  private pump(): void {
    if (this.active || this.failure) return;
    this.active = this.queue.shift() ?? null;
    if (this.active) {
      const { id, op, args } = this.active;
      this.worker.postMessage({ id, op, args });
    }
  }

  call<T>(op: string, args: unknown = {}): Promise<T> {
    if (this.failure || this.closing) return Promise.reject(this.failure ?? new Error("Storage is closing"));
    const matchId = (args as { matchId?: string })?.matchId;
    if (op === "checkpoint") {
      const prior = this.queue.find((j) => j.op === op && (j.args as { matchId?: string }).matchId === matchId);
      if (prior) { prior.args = args; return Promise.resolve(false as T); }
    }
    if (op === "finalize") {
      const id = (args as { result: { matchId: string } }).result.matchId;
      this.queue = this.queue.filter((j) => {
        if (j.op !== "checkpoint" || (j.args as { matchId: string }).matchId !== id) return true;
        for (const p of j.listeners) p.resolve(false);
        return false;
      });
    }
    if (this.queueDepth >= MAX_QUEUE) return Promise.reject(new Error("Storage queue is busy; retry shortly"));
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ id: this.nextId++, op, args, listeners: [{ resolve: resolve as (v: unknown) => void, reject }] });
      this.pump();
    });
  }

  async close(): Promise<number> {
    if (this.closing) return 0;
    try { await this.call("close"); } finally { this.closing = true; }
    return this.worker.terminate();
  }
}
