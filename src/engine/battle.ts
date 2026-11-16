/**
 * A guardian battle. Each turn the player picks one of their team to strike
 * (a timing tap decides how hard), then the guardian strikes that spirit
 * back. Every third turn the guardian's blow is a heavy one, announced a
 * turn ahead. No randomness: the same choices give the same battle.
 */
import { elementMultiplier, type Element } from "./elements";
import type { Save } from "./journey";
import { realm } from "./realms";
import { spirit, statsAt, type RealmId } from "./spirits";

export type Fighter = {
  id: string;
  element: Element;
  hp: number;
  maxHp: number;
  atk: number;
};
export type Battle = {
  realm: RealmId;
  boss: Fighter;
  team: Fighter[];
  turn: number;
  over: null | "won" | "lost";
};
export type BattleEvent =
  | { type: "strike"; by: number; damage: number; multiplier: number }
  | { type: "bossStrike"; target: number; damage: number; heavy: boolean }
  | { type: "faint"; target: number }
  | { type: "over"; won: boolean };

export function startBattle(save: Save, id: RealmId): Battle {
  const { boss } = realm(id);
  return {
    realm: id,
    boss: {
      id: boss.spirit,
      element: spirit(boss.spirit).element,
      hp: boss.hp,
      maxHp: boss.hp,
      atk: boss.atk,
    },
    team: save.team.map((sid) => {
      const def = spirit(sid);
      const owned = save.spirits[sid];
      const stats = statsAt(def, owned.level, owned.evolved);
      return {
        id: sid,
        element: def.element,
        hp: stats.hp,
        maxHp: stats.hp,
        atk: stats.atk,
      };
    }),
    turn: 0,
    over: null,
  };
}

/** True when the guardian's next blow is a heavy one. */
export const heavyNext = (battle: Battle) => battle.turn % 3 === 2;

/** How hard a strike lands for a timing tap graded 0 (missed) to 1 (perfect). */
export const strikePower = (quality: number) =>
  0.6 + 0.8 * Math.min(1, Math.max(0, quality));

export function strike(
  battle: Battle,
  by: number,
  quality: number,
): { battle: Battle; events: BattleEvent[] } {
  const events: BattleEvent[] = [];
  const attacker = battle.team[by];
  if (battle.over || !attacker || attacker.hp <= 0) return { battle, events };
  const next: Battle = {
    ...battle,
    boss: { ...battle.boss },
    team: battle.team.map((f) => ({ ...f })),
  };
  const me = next.team[by];
  const multiplier = elementMultiplier(me.element, next.boss.element);
  const damage = Math.max(1, Math.round(me.atk * strikePower(quality) * multiplier));
  next.boss.hp = Math.max(0, next.boss.hp - damage);
  events.push({ type: "strike", by, damage, multiplier });
  if (next.boss.hp === 0) {
    next.over = "won";
    events.push({ type: "over", won: true });
    return { battle: next, events };
  }
  const heavy = heavyNext(next);
  const blow = Math.max(
    1,
    Math.round(
      next.boss.atk *
        (heavy ? 1.6 : 1) *
        elementMultiplier(next.boss.element, me.element),
    ),
  );
  me.hp = Math.max(0, me.hp - blow);
  events.push({ type: "bossStrike", target: by, damage: blow, heavy });
  if (me.hp === 0) events.push({ type: "faint", target: by });
  next.turn++;
  if (next.team.every((f) => f.hp === 0)) {
    next.over = "lost";
    events.push({ type: "over", won: false });
  }
  return { battle: next, events };
}
