/**
 * The game's painted art: who has a picture, its shape and how big it stands.
 * The pictures were generated for this game from our own prompts (see
 * art-src/ for the originals and the cut-out scripts).
 */
import type { RealmId } from "./engine/spirits";
import shoresArt from "./art/shores.webp";
import shoresTall from "./art/shores-tall.webp";
import homeArt from "./art/home.webp";
import homeTall from "./art/home-tall.webp";
import cityArt from "./art/city.webp";
import cityTall from "./art/city-tall.webp";
import woodArt from "./art/wood.webp";
import woodTall from "./art/wood-tall.webp";
import stormhound from "./art/stormhound.webp";
import sunplume from "./art/sunplume.webp";
import mountainback from "./art/mountainback.webp";
import tidewhale from "./art/tidewhale.webp";
import lanternlord from "./art/lanternlord.webp";
import scrollsage from "./art/scrollsage.webp";
import bellqueen from "./art/bellqueen.webp";
import wardenArt from "./art/warden.webp";
import antlerelder from "./art/antlerelder.webp";
import silvermoon from "./art/silvermoon.webp";
import tidepupArt from "./art/tidepup.webp";
import emberwingArt from "./art/emberwing.webp";
import shellsageArt from "./art/shellsage.webp";
import lanternwispArt from "./art/lanternwisp.webp";
import inkmonkeyArt from "./art/inkmonkey.webp";
import bellmothArt from "./art/bellmoth.webp";
import mosslingArt from "./art/mossling.webp";
import moonfoxArt from "./art/moonfox.webp";
import shadeserpentArt from "./art/shadeserpent.webp";
import umbraldrake from "./art/umbraldrake.webp";
import elderwoodArt from "./art/elderwood.webp";

/** The painted look is the game's look; `?classic` brings back the shapes built in code. */
export const PAINTED = typeof location === "undefined" || !new URLSearchParams(location.search).has("classic");

export type Place = RealmId | "home";
/** A place's painting, wide for a computer and tall for a phone: picture and its shape. */
export type Backdrop = { wide: [string, number]; tall?: [string, number] };
export const BACKDROPS: Partial<Record<Place, Backdrop>> = {
  shores: { wide: [shoresArt, 1672 / 941], tall: [shoresTall, 941 / 1672] },
  home: { wide: [homeArt, 1672 / 941], tall: [homeTall, 941 / 1672] },
  city: { wide: [cityArt, 1672 / 941], tall: [cityTall, 941 / 1672] },
  wood: { wide: [woodArt, 1672 / 941], tall: [woodTall, 941 / 1672] },
};

export type Art = [picture: string, shape: number, height: number, lift?: number];
/** Spirits' paintings, young then grown: picture, its shape, its height, how high it floats. */
const PAINTED_ART: Record<string, [young: Art | null, grown: Art | null]> = {
  tidepup: [[tidepupArt, 887 / 1100, 1.5], [stormhound, 895 / 1100, 2.5]],
  emberwing: [[emberwingArt, 522 / 1100, 1.8], [sunplume, 721 / 1100, 2.9]],
  shellsage: [[shellsageArt, 1177 / 1100, 1.4], [mountainback, 885 / 1100, 2.7]],
  tidewhale: [null, [tidewhale, 1956 / 1100, 2.3, 0.9]],
  lanternwisp: [[lanternwispArt, 553 / 1100, 1.5, 0.8], [lanternlord, 749 / 1100, 2.2, 0.7]],
  inkmonkey: [[inkmonkeyArt, 826 / 1100, 1.6], [scrollsage, 742 / 1100, 2.6]],
  bellmoth: [[bellmothArt, 1102 / 1100, 1.5, 0.7], [bellqueen, 933 / 1100, 2.5, 0.6]],
  warden: [null, [wardenArt, 1074 / 1100, 3]],
  mossling: [[mosslingArt, 685 / 1100, 1.8], [antlerelder, 1266 / 1100, 2.9]],
  shadeserpent: [[shadeserpentArt, 739 / 1100, 1.7], [umbraldrake, 718 / 1100, 2.9]],
  elderwood: [null, [elderwoodArt, 867 / 1100, 3.1]],
  moonfox: [[moonfoxArt, 942 / 1100, 1.7], [silvermoon, 1440 / 1100, 2.6]],
};
/** The painting for a spirit at this stage, or its other stage's while that one is still to come. */
export const painted = (id: string | null, stage: number): Art | undefined => {
  const pair = PAINTED && id ? PAINTED_ART[id] : undefined;
  return (pair && (pair[stage > 0 ? 1 : 0] ?? pair[0] ?? pair[1])) || undefined;
};
