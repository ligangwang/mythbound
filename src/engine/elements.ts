/**
 * The five elements. Each one overcomes the next in the cycle
 * wood → earth → water → fire → metal → wood: an attack against the element
 * it overcomes does 1.5× damage, and against the element that overcomes it 0.7×.
 */
export type Element = "wood" | "fire" | "earth" | "metal" | "water";
export const ELEMENTS: Element[] = ["wood", "fire", "earth", "metal", "water"];

const OVERCOMES: Record<Element, Element> = {
  wood: "earth",
  earth: "water",
  water: "fire",
  fire: "metal",
  metal: "wood",
};

export const overcomes = (a: Element, b: Element) => OVERCOMES[a] === b;

export function elementMultiplier(attacker: Element, defender: Element) {
  if (overcomes(attacker, defender)) return 1.5;
  if (overcomes(defender, attacker)) return 0.7;
  return 1;
}

/** The element that overcomes `e`. */
export const counterOf = (e: Element) =>
  ELEMENTS.find((x) => OVERCOMES[x] === e)!;

export const ELEMENT_NAMES: Record<Element, { en: string; zh: string }> = {
  wood: { en: "Wood", zh: "木" },
  fire: { en: "Fire", zh: "火" },
  earth: { en: "Earth", zh: "土" },
  metal: { en: "Metal", zh: "金" },
  water: { en: "Water", zh: "水" },
};

export const ELEMENT_COLORS: Record<Element, string> = {
  wood: "#4f8a5b",
  fire: "#c8442f",
  earth: "#a77b3f",
  metal: "#8e98a6",
  water: "#3a6f9a",
};
