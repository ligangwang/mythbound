/**
 * Saving the journey and paying rewards through the dingn SDK. The journey
 * is kept on the device (sdk.storage) and, for a signed-in player, on their
 * account (sdk.progress), so it follows them to another device. Badges a
 * signed-out player earns are remembered and sent once they sign in.
 */
import type { DingnGame } from "../sdk/dingn-sdk.js";
import { newerSave, readSave, type Save } from "./engine/journey";

const SAVE_KEY = "journey";
const BADGE_KEY = "badges";
const PREFS_KEY = "prefs";

export async function loadSave(sdk: DingnGame): Promise<Save | null> {
  const device = await sdk.storage.get(SAVE_KEY).catch(() => null);
  let account: unknown = null;
  if (sdk.player.signedIn) {
    const data = (await sdk.progress.load().catch(() => null)) as {
      journey?: unknown;
    } | null;
    account = data?.journey ?? null;
  }
  return newerSave(readSave(device), readSave(account));
}

export async function storeSave(sdk: DingnGame, save: Save) {
  const json = JSON.parse(JSON.stringify(save));
  await sdk.storage.set(SAVE_KEY, json).catch(() => {});
  if (sdk.player.signedIn)
    await sdk.progress.save({ journey: json }).catch(() => {});
}

/** Choices kept on the device: sound, the ink and robe being worn, and whether the binder is a girl or a boy. */
export type Prefs = { sound: boolean; ink: string; robe: string; binder: "f" | "m" };
export async function loadPrefs(sdk: DingnGame): Promise<Prefs> {
  const data = (await sdk.storage.get(PREFS_KEY).catch(() => null)) as
    | Partial<Prefs>
    | null;
  return {
    sound: data?.sound !== false,
    ink: typeof data?.ink === "string" ? data.ink : "",
    robe: typeof data?.robe === "string" ? data.robe : "",
    binder: data?.binder === "m" ? "m" : "f",
  };
}
export function storePrefs(sdk: DingnGame, prefs: Prefs) {
  void sdk.storage.set(PREFS_KEY, prefs).catch(() => {});
}

/** Badges earned on this device, sent to dingn or waiting for a sign-in. */
export class Badges {
  private earned = new Set<string>();
  private sent = new Set<string>();
  /** The current SDK: the game swaps it in when the player signs in or out. */
  constructor(public sdk: DingnGame) {}
  async load() {
    const data = (await this.sdk.storage.get(BADGE_KEY).catch(() => null)) as {
      earned?: string[];
      sent?: string[];
    } | null;
    for (const id of data?.earned ?? []) this.earned.add(id);
    for (const id of data?.sent ?? []) this.sent.add(id);
  }
  private store() {
    void this.sdk.storage
      .set(BADGE_KEY, { earned: [...this.earned], sent: [...this.sent] })
      .catch(() => {});
  }
  /** Marks badges as earned and sends any that dingn hasn't had yet. */
  async earn(ids: string[]) {
    let changed = false;
    for (const id of ids)
      if (!this.earned.has(id)) {
        this.earned.add(id);
        changed = true;
      }
    if (changed) this.store();
    await this.flush();
  }
  /** Sends earned badges once the player is signed in. */
  async flush() {
    if (!this.sdk.player.signedIn) return;
    for (const id of this.earned) {
      if (this.sent.has(id)) continue;
      try {
        const result = await this.sdk.rewards.unlock(id);
        if (!result.test) this.sent.add(id);
      } catch {
        return;
      }
    }
    this.store();
  }
}

/** Pays dingn coins for play. Returns the coins paid (0 when signed out or done for today). */
export async function earnCoins(sdk: DingnGame, coins: number): Promise<number> {
  if (!sdk.player.signedIn || coins <= 0) return 0;
  try {
    const result = await sdk.rewards.earn(
      Math.min(10, Math.max(1, Math.round(coins))),
    );
    return result.coins;
  } catch {
    return 0;
  }
}
