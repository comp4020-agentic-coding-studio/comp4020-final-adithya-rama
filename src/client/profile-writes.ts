import type { Profile } from "../shared/protocol.ts";

export interface ProfilePatch {
  name?: string;
  color?: number;
  prefs?: Record<string, unknown>;
}

/** One request at a time: the server merges each patch with the preceding save. */
export class ProfileWrites {
  private tail: Promise<unknown> = Promise.resolve();
  private identity: string | null = null;
  private saved: ProfilePatch = {};
  private request: (patch: ProfilePatch) => Promise<Profile>;
  private apply: (profile: Profile) => void;
  constructor(request: (patch: ProfilePatch) => Promise<Profile>, apply: (profile: Profile) => void) {
    this.request = request;
    this.apply = apply;
  }

  /** A reconnect welcome may have been read before an in-flight HTTP save. */
  receive(profile: Profile): Profile {
    if (this.identity !== profile.id) { this.identity = profile.id; this.saved = {}; }
    const current = { ...profile, ...this.saved, prefs: { ...profile.prefs, ...this.saved.prefs } };
    this.apply(current);
    return current;
  }

  write(patch: ProfilePatch): Promise<Profile> {
    const owned = structuredClone(patch);
    const next = this.tail.then(async () => {
      const profile = await this.request(owned);
      if (this.identity !== profile.id) { this.identity = profile.id; this.saved = {}; }
      // Remember only successfully saved, server-normalized fields, never stale
      // fields incidentally included in a complete profile response.
      if (owned.name !== undefined) this.saved.name = profile.name;
      if (owned.color !== undefined) this.saved.color = profile.color;
      if (owned.prefs) {
        this.saved.prefs ??= {};
        for (const key of Object.keys(owned.prefs)) this.saved.prefs[key] = profile.prefs[key];
      }
      return this.receive(profile);
    });
    // A failed save rejects its caller but does not block later edits.
    this.tail = next.catch(() => undefined);
    return next;
  }
}
