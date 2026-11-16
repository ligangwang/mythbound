/**
 * The shop: everything in game.json's `shop`, sorted into shelves by the
 * start of its id. Every item is bought once with dingn coins and kept.
 * Nothing is random, and everything a charm gives can be found by playing.
 */
import manifest from "../game.json";
import type { DingnGame } from "../sdk/dingn-sdk.js";
import type { Perks } from "./engine/journey";

export type Shelf = "talismans" | "looks" | "charms";
export type ShopEntry = {
  id: string;
  price: number;
  title: { en: string; zh: string };
  shelf: Shelf;
};

export function shelfOf(id: string): Shelf {
  if (id.startsWith("talisman-")) return "talismans";
  if (id.startsWith("call-")) return "charms";
  return "looks";
}
export const CATALOG: ShopEntry[] = manifest.shop.map((item) => ({
  ...item,
  shelf: shelfOf(item.id),
}));
export const SHELVES: Shelf[] = ["talismans", "looks", "charms"];

export function perksFrom(owned: ReadonlySet<string>): Perks {
  return {
    steady: owned.has("talisman-steady"),
    jade: owned.has("talisman-jade"),
    wisdom: owned.has("talisman-wisdom"),
  };
}
/** The spirits that owned summoning charms have called. */
export const calledBy = (owned: ReadonlySet<string>) =>
  [...owned].filter((id) => id.startsWith("call-")).map((id) => id.slice(5));

export const INKS: Record<string, string> = {
  "": "#b8322a",
  "ink-gold": "#d9a520",
  "ink-azure": "#2f7fb8",
};

/** What the signed-in player owns, or an empty set. */
export async function loadOwned(sdk: DingnGame): Promise<Set<string>> {
  if (!sdk.player.signedIn) return new Set();
  try {
    const items = await sdk.rewards.shop();
    return new Set(items.filter((i) => i.owned).map((i) => i.id));
  } catch {
    return new Set();
  }
}

export type BuyResult = "bought" | "cancelled" | "poor" | "signin" | "failed";

/** Buys an item. dingn asks the player to confirm before any coins move. */
export async function buy(sdk: DingnGame, id: string): Promise<BuyResult> {
  if (!sdk.player.signedIn) return "signin";
  try {
    await sdk.rewards.spend(id);
    return "bought";
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "cancelled") return "cancelled";
    if (code === "not_enough_coins") return "poor";
    if (code === "signed_out") return "signin";
    return "failed";
  }
}
