/**
 * The binder's journey: what is saved, and every rule that changes it.
 * Exploring stops, binding spirits, training, evolving and the team. Pure
 * functions: each takes a save and returns a new one.
 */
import { REALMS, exploreSpirit, realm, wildOf, type RealmDef } from "./realms";
import {
  MAX_LEVEL,
  SPIRITS,
  STARTERS,
  spirit,
  spiritById,
  xpToNext,
  type RealmId,
  type Rarity,
} from "./spirits";

export type Owned = { level: number; xp: number; evolved: boolean };
export type Save = {
  v: 1;
  /** When it was last changed, to pick the newer of two saves. */
  at: number;
  spirits: Record<string, Owned>;
  /** Up to three spirits that fight the realm guardians. */
  team: string[];
  /** Spirit jade: found while exploring, spent on training and evolving. */
  jade: number;
  /** How many stops of each realm are cleared. */
  cleared: Record<RealmId, number>;
  /** Counts encounters, so exploring again meets different spirits. */
  visits: number;
  stats: { binds: number; perfects: number; evolves: number; bossWins: number };
};

/** What the talismans a player owns change. */
export type Perks = { steady: boolean; jade: boolean; wisdom: boolean };
export const NO_PERKS: Perks = { steady: false, jade: false, wisdom: false };

export const TEAM_SIZE = 3;
export const EVOLVE_COST = 60;

export function newSave(): Save {
  return {
    v: 1,
    at: 0,
    spirits: {},
    team: [],
    jade: 0,
    cleared: { shores: 0, city: 0, wood: 0 },
    visits: 0,
    stats: { binds: 0, perfects: 0, evolves: 0, bossWins: 0 },
  };
}

const whole = (n: unknown, max = 1e9) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(max, Math.max(0, Math.floor(n)))
    : 0;

/** Reads a stored save, dropping anything that isn't valid. */
export function readSave(raw: unknown): Save | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, any>;
  if (data.v !== 1 || typeof data.spirits !== "object" || !data.spirits)
    return null;
  const save = newSave();
  save.at = whole(data.at, Number.MAX_SAFE_INTEGER);
  for (const [id, o] of Object.entries<any>(data.spirits)) {
    const def = spiritById(id);
    if (!def || !o) continue;
    save.spirits[id] = {
      level: Math.max(1, whole(o.level, MAX_LEVEL)),
      xp: whole(o.xp),
      evolved: o.evolved === true && def.names.length > 1,
    };
  }
  if (Array.isArray(data.team))
    for (const id of data.team)
      if (
        save.spirits[id] &&
        !save.team.includes(id) &&
        save.team.length < TEAM_SIZE
      )
        save.team.push(id);
  save.jade = whole(data.jade);
  for (const r of REALMS)
    save.cleared[r.id] = whole(data.cleared?.[r.id], r.stops.length);
  save.visits = whole(data.visits);
  for (const key of ["binds", "perfects", "evolves", "bossWins"] as const)
    save.stats[key] = whole(data.stats?.[key]);
  return save;
}

export function newerSave(a: Save | null, b: Save | null): Save | null {
  if (!a) return b;
  if (!b) return a;
  return b.at > a.at ? b : a;
}

const copy = (save: Save): Save => JSON.parse(JSON.stringify(save));

export const started = (save: Save) => Object.keys(save.spirits).length > 0;
export const boundCount = (save: Save) => Object.keys(save.spirits).length;

/** Adds a spirit to the codex (and to the team while it has room). */
function join(save: Save, id: string, level: number) {
  if (save.spirits[id]) return;
  save.spirits[id] = { level, xp: 0, evolved: false };
  if (save.team.length < TEAM_SIZE) save.team.push(id);
}

export function chooseStarter(save: Save, id: string): Save {
  if (started(save) || !STARTERS.includes(id)) return save;
  const next = copy(save);
  join(next, id, 1);
  return next;
}

/** Spirits given by summoning charms from the shop join at level 1. */
export function grantSpirits(save: Save, ids: string[]): Save {
  const fresh = ids.filter((id) => spiritById(id) && !save.spirits[id]);
  if (!fresh.length || !started(save)) return save;
  const next = copy(save);
  for (const id of fresh) join(next, id, 1);
  return next;
}

/** Adds XP, levelling up as far as it reaches. Returns the levels gained. */
function addXp(owned: Owned, xp: number): number {
  let gained = 0;
  owned.xp += xp;
  while (owned.level < MAX_LEVEL && owned.xp >= xpToNext(owned.level)) {
    owned.xp -= xpToNext(owned.level);
    owned.level++;
    gained++;
  }
  if (owned.level >= MAX_LEVEL) owned.xp = 0;
  return gained;
}

function teamXp(save: Save, xp: number, perks: Perks): string[] {
  const amount = Math.round(xp * (perks.wisdom ? 1.25 : 1));
  const levelled: string[] = [];
  for (const id of save.team)
    if (addXp(save.spirits[id], amount) > 0) levelled.push(id);
  return levelled;
}

const jadeGain = (jade: number, perks: Perks) =>
  Math.round(jade * (perks.jade ? 1.5 : 1));

// Realms and stops

export const realmIndex = (id: RealmId) => REALMS.findIndex((r) => r.id === id);
export const realmDone = (save: Save, r: RealmDef) =>
  save.cleared[r.id] >= r.stops.length;

/** The first realm is open; each next one opens when the guardian before it falls. */
export function realmOpen(save: Save, id: RealmId) {
  const i = realmIndex(id);
  return i === 0 || realmDone(save, REALMS[i - 1]);
}

export type StopState = "done" | "next" | "locked";
export function stopState(save: Save, id: RealmId, stop: number): StopState {
  if (!realmOpen(save, id)) return "locked";
  const cleared = save.cleared[id];
  return stop < cleared ? "done" : stop === cleared ? "next" : "locked";
}

/** The level wild spirits of a realm are met (and join) at. */
export const wildLevel = (id: RealmId) => Math.max(1, realm(id).suggested - 2);

/**
 * The spirit waiting at a stop, or null when there is none (a cache, shrine
 * or guardian not yet visited). Cleared stops can be explored again; a
 * beaten guardian waits at its stop until it is bound.
 */
export function encounterAt(save: Save, id: RealmId, stop: number): string | null {
  const def = realm(id);
  const here = def.stops[stop];
  const state = stopState(save, id, stop);
  if (!here || state === "locked") return null;
  if (state === "next") {
    if (here.kind !== "wild" || !here.spirit) return null;
    // A first visit should meet someone new: if this stop's spirit is
    // already in the codex, another of the realm steps out instead.
    if (!save.spirits[here.spirit]) return here.spirit;
    return wildOf(id).find((s) => !save.spirits[s]) ?? here.spirit;
  }
  if (here.kind === "boss" && !save.spirits[def.boss.spirit])
    return def.boss.spirit;
  return exploreSpirit(id, stop, save.visits);
}

// Binding

/** The mini-game score (0 to 1) a binding needs. */
export function needFor(rarity: Rarity, perks: Perks) {
  return [0.5, 0.6, 0.7][rarity - 1] - (perks.steady ? 0.1 : 0);
}
export const PERFECT = 0.95;

export type BindResult = {
  save: Save;
  bound: boolean;
  /** A spirit new to the codex (not one bound before). */
  isNew: boolean;
  perfect: boolean;
  jade: number;
  levelled: string[];
  /** dingn coins this is worth. */
  coins: number;
};

/** Settles a binding attempt at a stop with the mini-game's score. */
export function resolveBind(
  save: Save,
  id: RealmId,
  stop: number,
  spiritId: string,
  score: number,
  perks: Perks = NO_PERKS,
): BindResult {
  const def = spirit(spiritId);
  const next = copy(save);
  next.visits++;
  const bound = score >= needFor(def.rarity, perks);
  if (!bound)
    return {
      save: next,
      bound,
      isNew: false,
      perfect: false,
      jade: 0,
      levelled: [],
      coins: 0,
    };
  const isNew = !next.spirits[spiritId];
  const perfect = score >= PERFECT;
  next.stats.binds++;
  if (perfect) next.stats.perfects++;
  let jade: number;
  const levelled: string[] = [];
  if (isNew) {
    join(next, spiritId, def.rarity === 3 ? realm(id).boss.level : wildLevel(id));
    jade = jadeGain(10 * def.rarity, perks);
    levelled.push(...teamXp(next, 6 * def.rarity, perks));
  } else {
    // A spirit you already have shares its strength with its bound twin.
    jade = jadeGain(8 * def.rarity, perks);
    const xp = Math.round(10 * def.rarity * (perks.wisdom ? 1.25 : 1));
    if (addXp(next.spirits[spiritId], xp) > 0) levelled.push(spiritId);
  }
  if (perfect) jade += 5;
  next.jade += jade;
  if (stopState(next, id, stop) === "next") next.cleared[id]++;
  return {
    save: next,
    bound,
    isNew,
    perfect,
    jade,
    levelled,
    coins: isNew ? 2 + def.rarity : 1,
  };
}

/** Opens a jade cache or rests at a shrine (each once). */
export function visitStop(
  save: Save,
  id: RealmId,
  stop: number,
  perks: Perks = NO_PERKS,
): { save: Save; jade: number; xp: number; levelled: string[] } | null {
  const here = realm(id).stops[stop];
  if (stopState(save, id, stop) !== "next") return null;
  if (here.kind !== "cache" && here.kind !== "shrine") return null;
  const next = copy(save);
  const tier = realmIndex(id);
  let jade = 0;
  let xp = 0;
  let levelled: string[] = [];
  if (here.kind === "cache") {
    jade = jadeGain(30 + 20 * tier, perks);
    next.jade += jade;
  } else {
    xp = 15 + 10 * tier;
    levelled = teamXp(next, xp, perks);
  }
  next.cleared[id]++;
  return { save: next, jade, xp, levelled };
}

// Training, evolving and the team

export const trainCost = (level: number) => 10 + 6 * level;

export function canTrain(save: Save, id: string) {
  const owned = save.spirits[id];
  return (
    !!owned && owned.level < MAX_LEVEL && save.jade >= trainCost(owned.level)
  );
}
/** Spends jade to raise a spirit one level. */
export function train(save: Save, id: string): Save {
  if (!canTrain(save, id)) return save;
  const next = copy(save);
  const owned = next.spirits[id];
  next.jade -= trainCost(owned.level);
  owned.level++;
  owned.xp = 0;
  return next;
}

export type EvolveState = "none" | "evolved" | "level" | "jade" | "ready";
export function evolveState(save: Save, id: string): EvolveState {
  const def = spirit(id);
  const owned = save.spirits[id];
  if (!owned || !def.evolveAt) return "none";
  if (owned.evolved) return "evolved";
  if (owned.level < def.evolveAt) return "level";
  return save.jade >= EVOLVE_COST ? "ready" : "jade";
}
export function evolve(save: Save, id: string): Save {
  if (evolveState(save, id) !== "ready") return save;
  const next = copy(save);
  next.jade -= EVOLVE_COST;
  next.spirits[id].evolved = true;
  next.stats.evolves++;
  return next;
}

/** Puts a spirit on the team or takes it off. The team never goes empty. */
export function toggleTeam(save: Save, id: string): Save {
  if (!save.spirits[id]) return save;
  const next = copy(save);
  if (next.team.includes(id)) {
    if (next.team.length > 1) next.team = next.team.filter((x) => x !== id);
  } else if (next.team.length < TEAM_SIZE) next.team.push(id);
  else return save;
  return next;
}

/** Settles a guardian battle. Winning clears the realm's last stop. */
export function finishBattle(
  save: Save,
  id: RealmId,
  won: boolean,
  perks: Perks = NO_PERKS,
): { save: Save; jade: number; levelled: string[]; coins: number; first: boolean } {
  const def = realm(id);
  const next = copy(save);
  const tier = realmIndex(id);
  const bossStop = def.stops.length - 1;
  if (!won) {
    // Even a lost battle teaches the team something.
    const levelled = teamXp(next, 5 + 3 * tier, perks);
    return { save: next, jade: 0, levelled, coins: 1, first: false };
  }
  const first = stopState(next, id, bossStop) === "next";
  const jade = jadeGain(first ? 50 + 25 * tier : 15 + 5 * tier, perks);
  next.jade += jade;
  const levelled = teamXp(next, first ? 20 + 10 * tier : 8 + 4 * tier, perks);
  if (first) {
    next.cleared[id] = def.stops.length;
    next.stats.bossWins++;
  }
  return { save: next, jade, levelled, coins: first ? 10 : 2, first };
}

// Badges

/** The ids of every badge this save has earned (see game.json). */
export function badgesFor(save: Save): string[] {
  const ids: string[] = [];
  const count = boundCount(save);
  if (save.stats.binds > 0) ids.push("first-bond");
  for (const n of [3, 6, 9, 12]) if (count >= n) ids.push(`spirits-${n}`);
  for (const r of REALMS) if (realmDone(save, r)) ids.push(`guardian-${r.id}`);
  if (save.stats.evolves > 0) ids.push("evolved");
  if (save.stats.perfects > 0) ids.push("perfect");
  if (SPIRITS.some((s) => s.rarity === 3 && save.spirits[s.id]))
    ids.push("legend");
  return ids;
}
