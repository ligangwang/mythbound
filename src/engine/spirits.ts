/**
 * The twelve spirits of Mythbound: four in each realm, the last of each a
 * legendary that guards the realm. Every design, name and story here is
 * original to this game.
 */
import type { Element } from "./elements";

export type Text = { en: string; zh: string };
export type RealmId = "shores" | "city" | "wood";
/** The 3D model each spirit is built from (see src/spirit-models.ts). */
export type Form =
  | "hound"
  | "crane"
  | "turtle"
  | "whale"
  | "lantern"
  | "monkey"
  | "moth"
  | "lion"
  | "deer"
  | "fox"
  | "serpent"
  | "dragon";
/** The capture mini-game a spirit is bound with. */
export type CaptureGame = "trace" | "rhythm" | "bind";
export type Rarity = 1 | 2 | 3;

export type SpiritDef = {
  id: string;
  realm: RealmId;
  element: Element;
  rarity: Rarity;
  form: Form;
  /** Body, accent and glow colours. */
  colors: [string, string, string];
  /** The spirit's names: its first form, then its evolved form (if any). */
  names: Text[];
  /** The level at which it can evolve, when it has a second form. */
  evolveAt?: number;
  /** Stats at level 1. */
  hp: number;
  atk: number;
  skill: Text;
  game: CaptureGame;
  origin: Text;
  story: Text;
};

export const SPIRITS: SpiritDef[] = [
  // Cloudpeak Shores
  {
    id: "tidepup",
    realm: "shores",
    element: "water",
    rarity: 1,
    form: "hound",
    colors: ["#cfe3ec", "#3a6f9a", "#7fd0ff"],
    names: [
      { en: "Tidepup", zh: "潮犬" },
      { en: "Stormhound", zh: "雷潮犬" },
    ],
    evolveAt: 5,
    hp: 50,
    atk: 11,
    skill: { en: "Foam Rush", zh: "浪沫冲" },
    game: "rhythm",
    origin: { en: "Tide pools below Cloudpeak", zh: "云峰脚下的潮池" },
    story: {
      en: "It chases every wave back out to sea, then wonders why the sea keeps coming back. Grown up, it carries a small storm in its fur.",
      zh: "它总把浪花追回海里，又纳闷大海为什么总会回来。长大后，它的毛里藏着一场小小的风暴。",
    },
  },
  {
    id: "emberwing",
    realm: "shores",
    element: "fire",
    rarity: 1,
    form: "crane",
    colors: ["#f4e6d6", "#c8442f", "#ffb35c"],
    names: [
      { en: "Emberwing", zh: "烬羽" },
      { en: "Sunplume Crane", zh: "日羽鹤" },
    ],
    evolveAt: 5,
    hp: 42,
    atk: 13,
    skill: { en: "Cinder Dive", zh: "烬火俯冲" },
    game: "trace",
    origin: { en: "The cliffs where the sun first lands", zh: "太阳最先落脚的海崖" },
    story: {
      en: "Each morning it dips one feather in the sunrise and paints the clouds. Fishermen say a red sky means it was in a hurry.",
      zh: "每天清晨，它用一根羽毛蘸着朝霞给云上色。渔夫们说，满天红霞，是它那天赶时间。",
    },
  },
  {
    id: "shellsage",
    realm: "shores",
    element: "earth",
    rarity: 2,
    form: "turtle",
    colors: ["#d9cdb4", "#8a6a3b", "#e7c47a"],
    names: [
      { en: "Shellsage", zh: "壳翁" },
      { en: "Mountainback", zh: "负山翁" },
    ],
    evolveAt: 6,
    hp: 66,
    atk: 9,
    skill: { en: "Stone Shell", zh: "石壳撞" },
    game: "bind",
    origin: { en: "The old lighthouse rocks", zh: "古灯塔下的礁石" },
    story: {
      en: "Older than the lighthouse and slower than the tide, it remembers every ship that ever passed. In time a small mountain grows on its back.",
      zh: "它比灯塔还老，比潮水还慢，记得每一艘经过的船。日子久了，背上会长出一座小山。",
    },
  },
  {
    id: "tidewhale",
    realm: "shores",
    element: "water",
    rarity: 3,
    form: "whale",
    colors: ["#9fb9cc", "#1f3f5c", "#8fe3ff"],
    names: [{ en: "Abyssal Tidewhale", zh: "沧溟鲸" }],
    hp: 82,
    atk: 17,
    skill: { en: "Abyss Tide", zh: "沧溟潮" },
    game: "rhythm",
    origin: { en: "Beneath the Cloudpeak sea", zh: "云峰海的最深处" },
    story: {
      en: "When it breathes, the tide comes in; when it sleeps, the sea goes still. Bind it and the whole coast will sing.",
      zh: "它吸气时潮水上涨，它沉睡时大海平静。与它结契，整片海岸都会歌唱。",
    },
  },
  // Lantern City
  {
    id: "lanternwisp",
    realm: "city",
    element: "fire",
    rarity: 1,
    form: "lantern",
    colors: ["#f6d7a7", "#b8322a", "#ffcf6b"],
    names: [
      { en: "Lanternwisp", zh: "灯魄" },
      { en: "Lantern Lord", zh: "宫灯君" },
    ],
    evolveAt: 5,
    hp: 44,
    atk: 13,
    skill: { en: "Paper Flame", zh: "纸焰" },
    game: "rhythm",
    origin: { en: "The night market of Lantern City", zh: "灯影古城的夜市" },
    story: {
      en: "A lantern that was never lit learned to light itself. Now it leads lost children home and asks for nothing but a story.",
      zh: "一盏从没点过的灯笼，学会了自己发光。如今它领迷路的孩子回家，只要一个故事作报酬。",
    },
  },
  {
    id: "inkmonkey",
    realm: "city",
    element: "wood",
    rarity: 1,
    form: "monkey",
    colors: ["#e8e0d0", "#2b2a28", "#9be08e"],
    names: [
      { en: "Inkmonkey", zh: "墨猴" },
      { en: "Scroll Sage", zh: "卷圣猿" },
    ],
    evolveAt: 5,
    hp: 46,
    atk: 12,
    skill: { en: "Brush Flick", zh: "甩墨" },
    game: "trace",
    origin: { en: "The scholars' hall", zh: "书院的藏书阁" },
    story: {
      en: "It steals calligraphy brushes and leaves perfect poems in return. Nobody has ever caught it writing.",
      zh: "它偷走书法家的毛笔，却留下一首首好诗。从来没人见过它提笔。",
    },
  },
  {
    id: "bellmoth",
    realm: "city",
    element: "metal",
    rarity: 2,
    form: "moth",
    colors: ["#e6dcc0", "#8a7a4a", "#f5e08a"],
    names: [
      { en: "Bellmoth", zh: "钟蛾" },
      { en: "Bronze Bell Queen", zh: "铜钟蛾后" },
    ],
    evolveAt: 6,
    hp: 40,
    atk: 15,
    skill: { en: "Tolling Wings", zh: "钟鸣羽" },
    game: "bind",
    origin: { en: "The great bell tower", zh: "古城大钟楼" },
    story: {
      en: "Its wings ring like tiny bells. The city's clocks keep time by it, not the other way round.",
      zh: "它的翅膀像小铃铛一样叮当作响。城里的钟都跟着它报时，而不是反过来。",
    },
  },
  {
    id: "warden",
    realm: "city",
    element: "fire",
    rarity: 3,
    form: "lion",
    colors: ["#e9d2b0", "#a3241c", "#ffcf6b"],
    names: [{ en: "Vermilion Warden", zh: "朱门守灵" }],
    hp: 88,
    atk: 18,
    skill: { en: "Vermilion Roar", zh: "朱焰吼" },
    game: "bind",
    origin: { en: "The red gate of the old palace", zh: "旧宫的朱红大门" },
    story: {
      en: "For a thousand years it has guarded a gate that no longer has a wall. It is still waiting for someone worthy to pass.",
      zh: "千百年来，它守着一扇早已没有城墙的门，一直在等一个配得上通过的人。",
    },
  },
  // Whispering Wood
  {
    id: "mossling",
    realm: "wood",
    element: "wood",
    rarity: 1,
    form: "deer",
    colors: ["#dfe6cf", "#4f8a5b", "#b8f08a"],
    names: [
      { en: "Mossling", zh: "苔灵" },
      { en: "Antler Elder", zh: "古角鹿" },
    ],
    evolveAt: 5,
    hp: 48,
    atk: 12,
    skill: { en: "Root Snare", zh: "根缚" },
    game: "bind",
    origin: { en: "The mossy floor of the Whispering Wood", zh: "幽语林的苔藓地" },
    story: {
      en: "Flowers open wherever it naps. Its antlers grow a new branch for every friend it makes.",
      zh: "它在哪儿打盹，哪儿就开花。每交到一个朋友，它的角就多长一根枝杈。",
    },
  },
  {
    id: "moonfox",
    realm: "wood",
    element: "metal",
    rarity: 2,
    form: "fox",
    colors: ["#eef0f4", "#6f7c8f", "#cfe4ff"],
    names: [
      { en: "Moonfox", zh: "月狐" },
      { en: "Silvermoon Fox", zh: "银月狐" },
    ],
    evolveAt: 6,
    hp: 44,
    atk: 15,
    skill: { en: "Moonblade Tails", zh: "月刃尾" },
    game: "trace",
    origin: { en: "Moonlit clearings", zh: "月光照亮的林间空地" },
    story: {
      en: "It only walks where moonlight falls, so on cloudy nights it simply waits. Each tail holds a different phase of the moon.",
      zh: "它只走在月光照到的地方，所以阴天就耐心等待。它的每条尾巴里都藏着一种月相。",
    },
  },
  {
    id: "shadeserpent",
    realm: "wood",
    element: "water",
    rarity: 2,
    form: "serpent",
    colors: ["#cdd8d6", "#24434a", "#7ff0d8"],
    names: [
      { en: "Shadeserpent", zh: "影蛇" },
      { en: "Umbral Drake", zh: "玄影蛟" },
    ],
    evolveAt: 6,
    hp: 50,
    atk: 14,
    skill: { en: "Mist Coil", zh: "雾缠" },
    game: "rhythm",
    origin: { en: "The misty brook", zh: "林中雾溪" },
    story: {
      en: "It swims through shadows as if they were water. Shy, but it will guard your reflection while you sleep.",
      zh: "它在影子里游动，就像在水里一样。它很害羞，但会在你睡着时守护你的倒影。",
    },
  },
  {
    id: "elderwood",
    realm: "wood",
    element: "wood",
    rarity: 3,
    form: "dragon",
    colors: ["#cfe0c4", "#2f5e3a", "#c4ff8a"],
    names: [{ en: "Elderwood Dragon", zh: "青木龙" }],
    hp: 92,
    atk: 19,
    skill: { en: "Thousand-Year Bloom", zh: "千年花开" },
    game: "trace",
    origin: { en: "The heart of the oldest tree", zh: "最古老的那棵树的树心" },
    story: {
      en: "The forest grew up around it while it slept. When it wakes, every leaf in the wood turns to listen.",
      zh: "它沉睡时，整片森林在它身边长成。当它醒来，林中的每一片叶子都会转身倾听。",
    },
  },
];

export const spiritById = (id: string) => SPIRITS.find((s) => s.id === id);

export function spirit(id: string): SpiritDef {
  const s = spiritById(id);
  if (!s) throw new Error(`No spirit ${id}`);
  return s;
}

export const MAX_LEVEL = 20;

/** Which form (0 or 1) a spirit shows. */
export const stageOf = (def: SpiritDef, evolved: boolean) =>
  evolved && def.names.length > 1 ? 1 : 0;

/** Stats grow 15% a level, and evolving adds 20%. */
export function statsAt(def: SpiritDef, level: number, evolved = false) {
  const grow = (1 + 0.15 * (level - 1)) * (evolved ? 1.2 : 1);
  return {
    hp: Math.round(def.hp * grow),
    atk: Math.round(def.atk * grow),
  };
}

/** XP needed to go from `level` to the next one. */
export const xpToNext = (level: number) => 10 + level * 5;

/** The three companions a new binder picks from. */
export const STARTERS = ["tidepup", "emberwing", "mossling"];
