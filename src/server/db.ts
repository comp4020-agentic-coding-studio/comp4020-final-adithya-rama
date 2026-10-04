import { Worker } from "node:worker_threads";
import { log } from "./log.ts";

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class Db {
  private worker: Worker;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  readonly ready: Promise<void>;

  constructor(path: string) {
    this.worker = new Worker(new URL("./db-worker.ts", import.meta.url), { workerData: { path } });
    this.ready = new Promise((resolve, reject) => {
      const onMsg = (m: { ready?: boolean }) => {
        if (m.ready) {
          this.worker.off("message", onMsg);
          resolve();
        }
      };
      this.worker.on("message", onMsg);
      this.worker.once("error", reject);
    });
    this.worker.on("message", (m: { id?: number; ok?: boolean; value?: unknown; error?: string }) => {
      if (m.id === undefined) return;
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (m.ok) p.resolve(m.value);
      else p.reject(new Error(m.error));
    });
    this.worker.on("error", (e) => {
      log("storage_failure", { error: e.message });
      for (const p of this.pending.values()) p.reject(e);
      this.pending.clear();
    });
  }

  call<T>(op: string, args: unknown = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ id, op, args });
    });
  }

  close(): Promise<number> {
    return this.worker.terminate();
  }
}
