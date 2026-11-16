/**
 * The three realms. Each is a path of stops: wild spirits to bind, a cache of
 * spirit jade, a shrine, and at the end the realm's legendary as its boss.
 * Beating the boss opens the next realm and lets you bind the legendary.
 */
import { hash, rng } from "./random";
import { SPIRITS, type RealmId, type Text } from "./spirits";

export type StopKind = "wild" | "cache" | "shrine" | "boss";
export type Stop = { kind: StopKind; /** The spirit met on a first visit. */ spirit?: string };

export type RealmDef = {
  id: RealmId;
  name: Text;
  blurb: Text;
  stops: Stop[];
  boss: { spirit: string; level: number; hp: number; atk: number };
  /** The level the team should be to face the boss. */
  suggested: number;
};

export const REALMS: RealmDef[] = [
  {
    id: "shores",
    name: { en: "Cloudpeak Shores", zh: "云峰海岸" },
    blurb: {
      en: "Misty peaks above a singing sea.",
      zh: "雾中的山峰，歌唱的大海。",
    },
    stops: [
      { kind: "wild", spirit: "tidepup" },
      { kind: "wild", spirit: "emberwing" },
      { kind: "cache" },
      { kind: "wild", spirit: "shellsage" },
      { kind: "shrine" },
      { kind: "wild", spirit: "emberwing" },
      { kind: "boss" },
    ],
    boss: { spirit: "tidewhale", level: 3, hp: 200, atk: 11 },
    suggested: 3,
  },
  {
    id: "city",
    name: { en: "Lantern City", zh: "灯影古城" },
    blurb: {
      en: "Red gates, paper lanterns and old secrets.",
      zh: "朱门、纸灯笼和古老的秘密。",
    },
    stops: [
      { kind: "wild", spirit: "lanternwisp" },
      { kind: "wild", spirit: "inkmonkey" },
      { kind: "cache" },
      { kind: "wild", spirit: "bellmoth" },
      { kind: "shrine" },
      { kind: "wild", spirit: "lanternwisp" },
      { kind: "boss" },
    ],
    boss: { spirit: "warden", level: 7, hp: 340, atk: 16 },
    suggested: 6,
  },
  {
    id: "wood",
    name: { en: "Whispering Wood", zh: "幽语林" },
    blurb: {
      en: "Ancient trees that hum in the dark.",
      zh: "在黑暗中低语的古树。",
    },
    stops: [
      { kind: "wild", spirit: "mossling" },
      { kind: "wild", spirit: "moonfox" },
      { kind: "cache" },
      { kind: "wild", spirit: "shadeserpent" },
      { kind: "shrine" },
      { kind: "wild", spirit: "moonfox" },
      { kind: "boss" },
    ],
    boss: { spirit: "elderwood", level: 11, hp: 430, atk: 19 },
    suggested: 9,
  },
];

export const realm = (id: RealmId) => REALMS.find((r) => r.id === id)!;

/** The spirits that roam a realm (not its legendary). */
export const wildOf = (id: RealmId) =>
  SPIRITS.filter((s) => s.realm === id && s.rarity < 3).map((s) => s.id);

/**
 * The spirit met when exploring a stop again: commons three times as often as
 * rares. The same realm, stop and visit always give the same spirit.
 */
export function exploreSpirit(id: RealmId, stop: number, visit: number): string {
  const pool = SPIRITS.filter((s) => s.realm === id && s.rarity < 3);
  const weights = pool.map((s) => (s.rarity === 1 ? 3 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng(hash(`${id}:${stop}:${visit}`))() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll < 0) return pool[i].id;
  }
  return pool[pool.length - 1].id;
}
