import assert from "node:assert/strict";
import test from "node:test";
import { heavyNext, startBattle, strike } from "../src/engine/battle";
import {
  BEATS,
  SEAL_POINTS,
  gradeTap,
  rhythmBeats,
  rhythmScore,
  sealPoints,
  traceAdvance,
  traceGlyph,
} from "../src/engine/capture";
import { ELEMENTS, counterOf, elementMultiplier } from "../src/engine/elements";
import {
  EVOLVE_COST,
  NO_PERKS,
  badgesFor,
  chooseStarter,
  encounterAt,
  evolve,
  evolveState,
  finishBattle,
  grantSpirits,
  needFor,
  newSave,
  newerSave,
  readSave,
  realmOpen,
  resolveBind,
  stopState,
  toggleTeam,
  train,
  trainCost,
  visitStop,
  type Save,
} from "../src/engine/journey";
import { REALMS, exploreSpirit, wildOf } from "../src/engine/realms";
import { SPIRITS, STARTERS, spirit, statsAt } from "../src/engine/spirits";
import manifest from "../game.json" with { type: "json" };
import zh from "../src/zh-CN.json" with { type: "json" };
import { readFileSync } from "node:fs";

const begin = () => chooseStarter(newSave(), "tidepup");

/** Plays a realm's path up to its guardian, binding everything perfectly. */
function walk(save: Save, id: (typeof REALMS)[number]["id"]): Save {
  const def = REALMS.find((r) => r.id === id)!;
  def.stops.forEach((stop, i) => {
    if (stop.kind === "wild")
      save = resolveBind(save, id, i, encounterAt(save, id, i)!, 1).save;
    else if (stop.kind !== "boss") save = visitStop(save, id, i)!.save;
  });
  return save;
}
function fight(save: Save, id: (typeof REALMS)[number]["id"], quality: number) {
  let battle = startBattle(save, id);
  let guard = 0;
  while (!battle.over && guard++ < 500) {
    // Strike with the strongest spirit still standing against this guardian.
    const by = battle.team
      .map((f, i) => ({
        i,
        power: f.hp > 0 ? f.atk * elementMultiplier(f.element, battle.boss.element) : -1,
      }))
      .sort((a, b) => b.power - a.power)[0].i;
    battle = strike(battle, by, quality).battle;
  }
  return battle;
}

test("the roster: 12 spirits, 4 a realm, one legendary each", () => {
  assert.equal(SPIRITS.length, 12);
  assert.equal(new Set(SPIRITS.map((s) => s.id)).size, 12);
  for (const r of REALMS) {
    const here = SPIRITS.filter((s) => s.realm === r.id);
    assert.equal(here.length, 4);
    assert.equal(here.filter((s) => s.rarity === 3).length, 1);
    assert.equal(spirit(r.boss.spirit).rarity, 3);
    assert.equal(r.stops.at(-1)!.kind, "boss");
    // Every roaming spirit of the realm is met on its path.
    for (const id of wildOf(r.id))
      assert.ok(r.stops.some((s) => s.spirit === id), id);
  }
  for (const s of SPIRITS) {
    assert.equal(!!s.evolveAt, s.names.length === 2, s.id);
    for (const text of [...s.names, s.skill, s.origin, s.story])
      assert.ok(text.en && text.zh, s.id);
  }
  for (const id of STARTERS) assert.equal(spirit(id).rarity, 1);
});

test("elements overcome each other in a cycle", () => {
  for (const e of ELEMENTS) {
    assert.equal(elementMultiplier(counterOf(e), e), 1.5);
    assert.equal(elementMultiplier(e, counterOf(e)), 0.7);
    assert.equal(elementMultiplier(e, e), 1);
  }
});

test("a new binder picks one starter", () => {
  const save = begin();
  assert.deepEqual(save.team, ["tidepup"]);
  assert.equal(chooseStarter(save, "emberwing"), save);
  assert.equal(chooseStarter(newSave(), "tidewhale").team.length, 0);
});

test("stops open in order and realms open behind their guardians", () => {
  let save = begin();
  assert.equal(stopState(save, "shores", 0), "next");
  assert.equal(stopState(save, "shores", 1), "locked");
  assert.equal(realmOpen(save, "city"), false);
  assert.equal(encounterAt(save, "shores", 1), null);
  save = walk(save, "shores");
  assert.equal(stopState(save, "shores", 6), "next");
  assert.equal(encounterAt(save, "shores", 6), null);
  const won = finishBattle(save, "shores", true);
  assert.equal(won.first, true);
  assert.equal(won.coins, 10);
  assert.equal(realmOpen(won.save, "city"), true);
  // The beaten guardian waits to be bound, then the stop is explored like any other.
  assert.equal(encounterAt(won.save, "shores", 6), "tidewhale");
  const bound = resolveBind(won.save, "shores", 6, "tidewhale", 1);
  assert.equal(bound.isNew, true);
  assert.equal(bound.save.spirits.tidewhale.level, 3);
  assert.notEqual(encounterAt(bound.save, "shores", 6), "tidewhale");
  assert.equal(finishBattle(won.save, "shores", true).first, false);
});

test("binding needs a good enough score, more for rarer spirits", () => {
  const save = begin();
  const miss = resolveBind(save, "shores", 0, "tidepup", 0.3);
  assert.equal(miss.bound, false);
  assert.equal(miss.save.cleared.shores, 0);
  assert.equal(miss.coins, 0);
  assert.equal(needFor(1, NO_PERKS), 0.5);
  assert.equal(needFor(3, NO_PERKS), 0.7);
  assert.equal(needFor(3, { ...NO_PERKS, steady: true }), 0.6);
  // A spirit already bound gives jade and XP instead of a second copy.
  const again = resolveBind(save, "shores", 0, "tidepup", 0.6);
  assert.equal(again.bound, true);
  assert.equal(again.isNew, false);
  assert.equal(again.coins, 1);
  assert.equal(again.save.cleared.shores, 1);
  assert.equal(Object.keys(again.save.spirits).length, 1);
  const fresh = resolveBind(again.save, "shores", 1, "emberwing", 1);
  assert.equal(fresh.isNew, true);
  assert.equal(fresh.perfect, true);
  assert.equal(fresh.coins, 3);
  assert.deepEqual(fresh.save.team, ["tidepup", "emberwing"]);
});

test("talismans raise jade and XP", () => {
  const save = resolveBind(resolveBind(begin(), "shores", 0, "tidepup", 0.6).save, "shores", 1, "emberwing", 0.6).save;
  const plain = visitStop(save, "shores", 2)!;
  const rich = visitStop(save, "shores", 2, { ...NO_PERKS, jade: true })!;
  assert.equal(plain.jade, 30);
  assert.equal(rich.jade, 45);
  assert.equal(visitStop(plain.save, "shores", 2), null);
});

test("training and evolving spend jade", () => {
  let save = begin();
  save.jade = 500;
  assert.equal(evolveState(save, "tidepup"), "level");
  for (let i = 0; i < 4; i++) save = train(save, "tidepup");
  assert.equal(save.spirits.tidepup.level, 5);
  assert.equal(save.jade, 500 - [1, 2, 3, 4].reduce((s, l) => s + trainCost(l), 0));
  assert.equal(evolveState(save, "tidepup"), "ready");
  const before = save.jade;
  save = evolve(save, "tidepup");
  assert.equal(save.spirits.tidepup.evolved, true);
  assert.equal(save.jade, before - EVOLVE_COST);
  assert.equal(evolveState(save, "tidepup"), "evolved");
  assert.ok(statsAt(spirit("tidepup"), 5, true).atk > statsAt(spirit("tidepup"), 5).atk);
  const poor = { ...begin(), jade: 0 };
  assert.equal(train(poor, "tidepup"), poor);
});

test("the team holds one to three spirits", () => {
  let save = walk(begin(), "shores");
  assert.equal(save.team.length, 3);
  assert.equal(toggleTeam(save, "tidepup").team.length, 2);
  save = grantSpirits(save, ["moonfox", "nope", "tidepup"]);
  assert.ok(save.spirits.moonfox);
  assert.equal(toggleTeam(save, "moonfox"), save);
  const solo = begin();
  assert.deepEqual(toggleTeam(solo, "tidepup").team, ["tidepup"]);
});

test("a guardian battle is fair at the suggested strength", () => {
  let save = begin();
  for (const r of REALMS) {
    save = walk(save, r.id);
    // Spend the jade found on the way: evolve who can, train the weakest.
    for (let i = 0; i < 200; i++) {
      const ready = save.team.find((t) => evolveState(save, t) === "ready");
      const low = [...save.team].sort((a, b) => save.spirits[a].level - save.spirits[b].level)[0];
      const next = ready ? evolve(save, ready) : train(save, low);
      if (next === save) break;
      save = next;
    }
    const battle = fight(save, r.id, 0.7);
    assert.equal(battle.over, "won", `${r.id} at ${JSON.stringify(save.team.map((t) => save.spirits[t].level))}`);
    assert.ok(battle.turn >= 4, `${r.id} is over too fast (${battle.turn})`);
    save = finishBattle(save, r.id, true).save;
  }
  // A lone level 1 starter cannot beat the first guardian.
  assert.equal(fight(begin(), "shores", 1).over, "lost");
});

test("battles: heavy blows every third turn, fainted spirits can't strike", () => {
  const save = walk(begin(), "shores");
  let battle = startBattle(save, "shores");
  assert.equal(heavyNext(battle), false);
  const first = strike(battle, 0, 1);
  assert.equal(first.events[0].type, "strike");
  battle = strike(first.battle, 0, 1).battle;
  assert.equal(heavyNext(battle), true);
  const heavy = strike(battle, 1, 0).events.find((e) => e.type === "bossStrike");
  assert.ok(heavy && heavy.type === "bossStrike" && heavy.heavy);
  const down = { ...battle, team: battle.team.map((f, i) => (i === 0 ? { ...f, hp: 0 } : f)) };
  assert.equal(strike(down, 0, 1).events.length, 0);
});

test("saves survive a round trip and reject rubbish", () => {
  const save = walk(begin(), "shores");
  save.at = 5;
  assert.deepEqual(readSave(JSON.parse(JSON.stringify(save))), save);
  assert.equal(readSave(null), null);
  assert.equal(readSave({ v: 2 }), null);
  const odd = readSave({ v: 1, spirits: { ghost: { level: 3 }, tidepup: { level: 99, evolved: true } }, team: ["ghost", "tidepup", "tidepup"], jade: -4, cleared: { shores: 99 } })!;
  assert.deepEqual(Object.keys(odd.spirits), ["tidepup"]);
  assert.equal(odd.spirits.tidepup.level, 20);
  assert.deepEqual(odd.team, ["tidepup"]);
  assert.equal(odd.jade, 0);
  assert.equal(odd.cleared.shores, 7);
  assert.equal(newerSave({ ...save, at: 1 }, { ...save, at: 2 })!.at, 2);
});

test("exploring again is the same for the same visit and favours commons", () => {
  assert.equal(exploreSpirit("wood", 1, 7), exploreSpirit("wood", 1, 7));
  const met = new Set<string>();
  for (let v = 0; v < 200; v++) met.add(exploreSpirit("city", 0, v));
  assert.deepEqual([...met].sort(), wildOf("city").sort());
});

test("mini-game rules", () => {
  const glyph = traceGlyph("tidepup:1");
  assert.equal(glyph.length, 28);
  for (const p of glyph) assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1);
  assert.ok(traceAdvance(glyph, 0, glyph[0]) >= 1);
  assert.equal(traceAdvance(glyph, 0, glyph.at(-1)!), 0);
  let done = 0;
  for (const p of glyph) done = traceAdvance(glyph, done, p);
  assert.equal(done, glyph.length);

  const beats = rhythmBeats("x");
  assert.equal(beats.length, BEATS);
  assert.deepEqual(beats, rhythmBeats("x"));
  for (let i = 1; i < beats.length; i++) assert.ok(beats[i] - beats[i - 1] >= 700);
  assert.equal(gradeTap(-60), "perfect");
  assert.equal(gradeTap(200), "good");
  assert.equal(gradeTap(400), "miss");
  assert.equal(rhythmScore(Array(BEATS).fill("perfect")), 1);

  const points = sealPoints("y");
  assert.equal(points.length, SEAL_POINTS);
  for (let i = 0; i < points.length; i++)
    for (let j = 0; j < i; j++)
      assert.ok(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) > 0.15);
});

test("badges and the shop match game.json", () => {
  let save = begin();
  assert.deepEqual(badgesFor(save), []);
  for (const r of REALMS) {
    save = walk(save, r.id);
    save = finishBattle(save, r.id, true).save;
    save = resolveBind(save, r.id, 6, r.boss.spirit, 1).save;
  }
  save.jade = 999;
  save = evolve(train(train(train(train(save, "tidepup"), "tidepup"), "tidepup"), "tidepup"), "tidepup");
  const earned = badgesFor(save);
  const listed = manifest.badges.map((b) => b.id);
  assert.deepEqual([...earned].sort(), [...listed].sort());
  for (const item of manifest.shop) {
    assert.match(item.id, /^(talisman|ink|robe|call)-/);
    if (item.id.startsWith("call-")) {
      const s = spirit(item.id.slice(5));
      assert.ok(s.rarity < 3, "legendaries are never sold");
    }
  }
  assert.ok(manifest.shop.length <= 30);
});

test("a first visit meets a spirit that isn't in the codex yet", () => {
  // The starter is the spirit of the first trail, so another steps out.
  const save = begin();
  assert.equal(encounterAt(save, "shores", 0), "emberwing");
  assert.equal(encounterAt(chooseStarter(newSave(), "mossling"), "shores", 0), "tidepup");
});

test("every screen string has a Chinese translation", () => {
  const catalog: Record<string, string> = zh;
  const used = new Set<string>();
  for (const file of ["src/game.tsx", "src/minigames.tsx"])
    for (const match of readFileSync(file, "utf8").matchAll(/"((?:[A-Z+]|\{0\})[^"\n]*)"/g))
      used.add(match[1]);
  // SVG path letters and DOM keyboard key identifiers are not UI text.
  for (const skip of ["L", "M", "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Enter"]) used.delete(skip);
  for (const text of used) assert.ok(catalog[text], `no Chinese for: ${text}`);
  for (const key of Object.keys(catalog)) assert.ok(used.has(key), `unused translation: ${key}`);
});
