/**
 * Mythbound's screens, drawn over the 3D world: the home map, a realm's
 * path, binding encounters, guardian battles, the codex and the shop.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { heavyNext, startBattle, strike, type Battle } from "./engine/battle";
import { ELEMENT_COLORS, ELEMENT_NAMES, counterOf, type Element } from "./engine/elements";
import {
  EVOLVE_COST,
  TEAM_SIZE,
  badgesFor,
  boundCount,
  canTrain,
  chooseStarter,
  encounterAt,
  evolve,
  evolveState,
  finishBattle,
  grantSpirits,
  needFor,
  newSave,
  newerSave,
  realmDone,
  realmIndex,
  realmOpen,
  resolveBind,
  started,
  stopState,
  toggleTeam,
  train,
  trainCost,
  visitStop,
  type BindResult,
  type Save,
} from "./engine/journey";
import { REALMS, realm, type RealmDef, type StopKind } from "./engine/realms";
import {
  MAX_LEVEL,
  SPIRITS,
  STARTERS,
  spirit,
  stageOf,
  statsAt,
  xpToNext,
  type RealmId,
  type SpiritDef,
  type Text,
} from "./engine/spirits";
import { useDingn, useLocale } from "./dingn";
import { MINI_GAMES, MINI_NAMES, StrikeMeter } from "./minigames";
import { Badges, earnCoins, loadPrefs, loadSave, storePrefs, storeSave, type Prefs } from "./save";
import { CATALOG, INKS, SHELVES, buy, calledBy, loadOwned, perksFrom, type Shelf } from "./shop";
import { Sound, type SoundName } from "./sound";
import { ROBES } from "./spirit-models";
import { World, type Place } from "./world";

type Screen =
  | { name: "home" }
  | { name: "realm"; realm: RealmId }
  | { name: "encounter"; realm: RealmId; stop: number; spirit: string; attempt: number }
  | { name: "battle"; realm: RealmId }
  | { name: "codex"; page?: string; back?: Screen }
  | { name: "shop" };

/** What every screen shares. */
type Game = {
  save: Save;
  commit: (save: Save) => void;
  go: (screen: Screen) => void;
  owned: Set<string>;
  ink: string;
  world: () => World | null;
  portrait: (id: string, stage?: number, silhouette?: boolean) => string;
  play: (name: SoundName) => void;
  pay: (coins: number) => Promise<number>;
  toast: (text: string) => void;
  pick: (text: Text) => string;
  nameOf: (id: string, evolved?: boolean) => string;
};

const STOP_MARKS: Record<StopKind, string> = { wild: "灵", cache: "玉", shrine: "祠", boss: "守" };
const STOP_NAMES: Record<StopKind, string> = {
  wild: "Spirit trail",
  cache: "Jade cache",
  shrine: "Spirit shrine",
  boss: "Guardian's seat",
};

function ElementChip({ element }: { element: Element }) {
  const { locale } = useLocale();
  const name = ELEMENT_NAMES[element];
  return (
    <span className="chip" style={{ background: ELEMENT_COLORS[element] }}>
      {locale === "en" ? name.en : name.zh}
    </span>
  );
}
const Stars = ({ n }: { n: number }) => (
  <span className="stars" aria-label={`${n}/3`}>
    {"★".repeat(n)}
    <i>{"★".repeat(3 - n)}</i>
  </span>
);
function Bar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  return (
    <span className={`bar ${className}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </span>
  );
}
/** Portraits are painted one at a time between frames, so a full codex opens without a hitch. */
let painting: Promise<void> = Promise.resolve();
function Portrait({ game, id, evolved = false, hidden = false }: { game: Game; id: string; evolved?: boolean; hidden?: boolean }) {
  const stage = stageOf(spirit(id), evolved);
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    painting = painting.then(
      () =>
        new Promise<void>((done) =>
          setTimeout(() => {
            if (live) setSrc(game.portrait(id, stage, hidden));
            done();
          }, 0),
        ),
    );
    return () => {
      live = false;
    };
  }, [id, stage, hidden]);
  return (
    <span className={`portrait${hidden ? " hidden" : ""}`}>
      {src ? <img src={src} alt="" draggable={false} /> : null}
    </span>
  );
}

export function MythboundGame() {
  const sdk = useDingn();
  const { t, locale } = useLocale();
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const [save, setSave] = useState<Save | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [prefs, setPrefs] = useState<Prefs>({ sound: true, ink: "", robe: "" });
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const badges = useMemo(() => new Badges(sdk), []);
  const sound = useMemo(() => new Sound(), []);
  const signedIn = sdk.player.signedIn;

  useEffect(() => {
    if (!canvas.current) return;
    const w = new World(canvas.current);
    world.current = w;
    const resize = () => w.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      w.dispose();
      world.current = null;
    };
  }, []);

  // Load the journey, and again when the player signs in or out.
  useEffect(() => {
    let live = true;
    void (async () => {
      const [stored, mine, look] = await Promise.all([loadSave(sdk), loadOwned(sdk), loadPrefs(sdk)]);
      await badges.load();
      if (!live) return;
      setOwned(mine);
      setPrefs(look);
      setSave((now) => grantSpirits(newerSave(now, stored) ?? newSave(), calledBy(mine)));
      void badges.flush();
    })();
    return () => {
      live = false;
    };
  }, [signedIn]);

  const commit = useCallback(
    (next: Save) => {
      const stamped = { ...next, at: Date.now() };
      setSave(stamped);
      void storeSave(sdk, stamped);
      void badges.earn(badgesFor(stamped));
    },
    [sdk],
  );

  // In development only: lets a script jump to any point of the journey.
  useEffect(() => {
    if (import.meta.env.DEV)
      Object.assign(window, { mythbound: { commit, go: setScreen, own: setOwned, look: setPrefs } });
  }, [commit]);

  const ink = INKS[owned.has(prefs.ink) ? prefs.ink : ""];
  const robe = owned.has(prefs.robe) ? prefs.robe : "";
  sound.on = prefs.sound;
  useEffect(() => world.current?.setInk(ink), [ink]);
  useEffect(() => world.current?.setBinder(robe), [robe]);

  // Keep the 3D stage in step with the screen.
  const place: Place = "realm" in screen ? screen.realm : "home";
  const paged = screen.name === "codex" && screen.page && save?.spirits[screen.page] ? screen.page : null;
  const mainKey =
    screen.name === "encounter"
      ? `${screen.spirit}|0|${screen.attempt}`
      : screen.name === "battle"
        ? `${realm(screen.realm).boss.spirit}|0|big`
        : paged
          ? `${paged}|${stageOf(spirit(paged), save!.spirits[paged].evolved)}|page`
          : "";
  const [allyIndex, setAllyIndex] = useState(0);
  const lead = save?.team[screen.name === "battle" ? allyIndex : 0] ?? save?.team[0];
  const allyKey =
    save && lead && "realm" in screen ? `${lead}|${stageOf(spirit(lead), save.spirits[lead].evolved)}` : "";
  const lineupKey =
    !save || "realm" in screen || paged
      ? ""
      : (started(save)
          ? [...save.team, ...Object.keys(save.spirits).filter((id) => !save.team.includes(id))]
          : STARTERS
        )
          .slice(0, 6)
          .map((id) => `${id}|${stageOf(spirit(id), !!save.spirits[id]?.evolved)}`)
          .join(",");
  useEffect(() => world.current?.setPlace(place), [place]);
  useEffect(() => {
    const [id, stage, flag] = mainKey.split("|");
    world.current?.showSpirit(id || null, Number(stage) || 0, flag === "big");
    if (id && flag !== "page") sound.play("appear");
  }, [mainKey]);
  useEffect(() => {
    const [id, stage] = allyKey.split("|");
    world.current?.showAlly(id || null, Number(stage) || 0);
  }, [allyKey]);
  useEffect(() => {
    world.current?.showLineup(
      lineupKey
        ? lineupKey.split(",").map((entry) => {
            const [id, stage] = entry.split("|");
            return { id, stage: Number(stage) };
          })
        : [],
    );
  }, [lineupKey]);

  const pick = (text: Text) => (locale === "en" ? text.en : text.zh);
  if (!save)
    return (
      <div className="mythbound">
        <canvas ref={canvas} className="stage" />
        <p className="loading">{t("Grinding the ink…")}</p>
      </div>
    );

  const game: Game = {
    save,
    commit,
    go: (next) => {
      sound.play("tap");
      setAllyIndex(0);
      setScreen(next);
    },
    owned,
    ink,
    world: () => world.current,
    portrait: (id, stage = 0, silhouette = false) => world.current?.portrait(id, stage, silhouette) ?? "",
    play: (name) => sound.play(name),
    pay: (coins) => earnCoins(sdk, coins),
    toast: (text) => setToast({ text, id: Date.now() }),
    pick,
    nameOf: (id, evolved) => {
      const def = spirit(id);
      return pick(def.names[stageOf(def, evolved ?? !!save.spirits[id]?.evolved)]);
    },
  };
  const back: Screen | null =
    screen.name === "home"
      ? null
      : screen.name === "codex"
        ? screen.page
          ? { name: "codex", back: screen.back }
          : (screen.back ?? { name: "home" })
        : screen.name === "encounter" || screen.name === "battle"
          ? { name: "realm", realm: screen.realm }
          : { name: "home" };

  return (
    <div className={`mythbound screen-${screen.name}`}>
      <canvas ref={canvas} className="stage" />
      <div className="paper-grain" />
      <header className="hud">
        {back ? (
          <button className="hud-btn" onClick={() => game.go(back)} aria-label={t("Back")}>
            ‹
          </button>
        ) : (
          <span />
        )}
        <span className="hud-right">
          {started(save) && (
            <span className="jade" title={t("Spirit jade")}>
              <i />
              {save.jade}
            </span>
          )}
          <button
            className="hud-btn"
            onClick={() => {
              const next = { ...prefs, sound: !prefs.sound };
              setPrefs(next);
              storePrefs(sdk, next);
            }}
            aria-label={t(prefs.sound ? "Sound on" : "Sound off")}
          >
            {prefs.sound ? "♪" : "×"}
          </button>
        </span>
      </header>
      {toast && (
        <p key={toast.id} className="toast" onAnimationEnd={() => setToast(null)}>
          {toast.text}
        </p>
      )}
      {screen.name === "home" && <Home game={game} />}
      {screen.name === "realm" && <RealmView game={game} id={screen.realm} />}
      {screen.name === "encounter" && (
        <Encounter key={`${screen.spirit}:${screen.attempt}`} game={game} screen={screen} />
      )}
      {screen.name === "battle" && <BattleView game={game} id={screen.realm} onAlly={setAllyIndex} />}
      {screen.name === "codex" && <Codex game={game} screen={screen} />}
      {screen.name === "shop" && (
        <Shop
          game={game}
          prefs={prefs}
          onPrefs={(next) => {
            setPrefs(next);
            storePrefs(sdk, next);
          }}
          onOwned={(mine) => {
            setOwned(mine);
            const granted = grantSpirits(save, calledBy(mine));
            if (granted !== save) commit(granted);
          }}
        />
      )}
    </div>
  );
}

function SignInHint() {
  const sdk = useDingn();
  const { t } = useLocale();
  if (sdk.player.signedIn) return null;
  return (
    <button className="link" onClick={() => sdk.requestSignIn()}>
      {t("Sign in to earn dingn coins and badges")}
    </button>
  );
}

function Home({ game }: { game: Game }) {
  const { t } = useLocale();
  const { save, pick } = game;
  if (!started(save))
    return (
      <section className="panel">
        <h1 className="title">
          <b>灵契藏鉴</b>
          <span>Mythbound</span>
        </h1>
        <p className="lead">
          {t("The old codex is empty and the spirits have scattered. Choose your first companion, binder.")}
        </p>
        <div className="starters">
          {STARTERS.map((id) => {
            const def = spirit(id);
            return (
              <button
                key={id}
                className="card starter"
                onClick={() => {
                  game.play("bound");
                  game.commit(chooseStarter(save, id));
                }}
              >
                <Portrait game={game} id={id} />
                <b>{pick(def.names[0])}</b>
                <ElementChip element={def.element} />
              </button>
            );
          })}
        </div>
      </section>
    );
  return (
    <section className="panel">
      <h1 className="title small">
        <b>灵契藏鉴</b>
        <span>Mythbound</span>
      </h1>
      <div className="realms">
        {REALMS.map((r, i) => {
          const open = realmOpen(save, r.id);
          return (
            <button
              key={r.id}
              className={`card realm realm-${r.id}`}
              disabled={!open}
              onClick={() => game.go({ name: "realm", realm: r.id })}
            >
              <b>{pick(r.name)}</b>
              <small>
                {open
                  ? pick(r.blurb)
                  : t("Opens when the guardian of {0} yields.", pick(REALMS[i - 1].name))}
              </small>
              {open && (
                <span className="progress">
                  <Bar value={save.cleared[r.id]} max={r.stops.length} />
                  {realmDone(save, r) ? t("Guardian calmed") : `${save.cleared[r.id]}/${r.stops.length}`}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="row">
        <button className="btn" onClick={() => game.go({ name: "codex" })}>
          {t("Codex")} {boundCount(save)}/{SPIRITS.length}
        </button>
        <button className="btn" onClick={() => game.go({ name: "shop" })}>
          {t("Talisman shop")}
        </button>
      </div>
      <SignInHint />
    </section>
  );
}

function RealmView({ game, id }: { game: Game; id: RealmId }) {
  const { t } = useLocale();
  const { save, pick } = game;
  const def = realm(id);
  const perks = perksFrom(game.owned);
  const [chosen, setChosen] = useState(Math.min(save.cleared[id], def.stops.length - 1));
  const stop = def.stops[chosen];
  const state = stopState(save, id, chosen);
  const boss = spirit(def.boss.spirit);
  const meet = (spiritId: string | null) =>
    spiritId && game.go({ name: "encounter", realm: id, stop: chosen, spirit: spiritId, attempt: 0 });

  let action: ReactNode;
  if (state === "locked") action = <p className="note">{t("Clear the stops before this one first.")}</p>;
  else if (state === "next" && stop.kind === "wild")
    action = (
      <button className="btn primary" onClick={() => meet(encounterAt(save, id, chosen))}>
        {t("Explore")}
      </button>
    );
  else if (state === "next" && (stop.kind === "cache" || stop.kind === "shrine"))
    action = (
      <button
        className="btn primary"
        onClick={() => {
          const result = visitStop(save, id, chosen, perks);
          if (!result) return;
          game.play("jade");
          game.commit(result.save);
          game.toast(
            stop.kind === "cache"
              ? t("You found {0} spirit jade!", result.jade)
              : t("Your team rests and gains {0} XP.", result.xp),
          );
          setChosen(Math.min(chosen + 1, def.stops.length - 1));
        }}
      >
        {t(stop.kind === "cache" ? "Open the cache" : "Rest at the shrine")}
      </button>
    );
  else
    action = (
      <span className="row">
        {(state === "done" || stop.kind !== "boss") && (
          <button className="btn" onClick={() => meet(encounterAt(save, id, chosen))}>
            {stop.kind === "boss" && !save.spirits[boss.id]
              ? t("Bind {0}", pick(boss.names[0]))
              : t("Explore again")}
          </button>
        )}
        {stop.kind === "boss" && (
          <button className="btn primary" onClick={() => game.go({ name: "battle", realm: id })}>
            {t(state === "done" ? "Rematch" : "Challenge the guardian")}
          </button>
        )}
      </span>
    );

  return (
    <section className="panel">
      <h2 className="brush">{pick(def.name)}</h2>
      <ol className="path">
        {def.stops.map((s, i) => {
          const st = stopState(save, id, i);
          return (
            <li key={i}>
              <button
                className={`stop ${s.kind} ${st}${i === chosen ? " chosen" : ""}`}
                onClick={() => {
                  game.play("step");
                  setChosen(i);
                }}
                aria-label={`${i + 1}. ${t(STOP_NAMES[s.kind])}`}
              >
                {STOP_MARKS[s.kind]}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="stop-info">
        <b>
          {chosen + 1}. {t(STOP_NAMES[stop.kind])}
        </b>
        {stop.kind === "boss" ? (
          <p>
            {pick(boss.names[0])} <ElementChip element={boss.element} />{" "}
            {t("Bring spirits of {0} at level {1} or higher.", pick(ELEMENT_NAMES[counterOf(boss.element)]), def.suggested)}
          </p>
        ) : (
          <p>
            {t(
              stop.kind === "wild"
                ? "A spirit is near. Bind it to add it to your codex."
                : stop.kind === "cache"
                  ? "Spirit jade trains and evolves your spirits."
                  : "A quiet shrine where your team grows stronger.",
            )}
          </p>
        )}
        {action}
      </div>
    </section>
  );
}

function Rewards({ jade, coins, levelled, game }: { jade: number; coins: number; levelled: string[]; game: Game }) {
  const { t } = useLocale();
  return (
    <ul className="rewards">
      {jade > 0 && <li className="jade"><i />+{jade}</li>}
      {coins > 0 && <li className="coins">{t("+{0} dingn coins", coins)}</li>}
      {levelled.map((id) => (
        <li key={id}>{t("{0} reached level {1}!", game.nameOf(id), game.save.spirits[id].level)}</li>
      ))}
    </ul>
  );
}

function Encounter({ game, screen }: { game: Game; screen: Extract<Screen, { name: "encounter" }> }) {
  const { t } = useLocale();
  const { save, pick } = game;
  const def = spirit(screen.spirit);
  const perks = perksFrom(game.owned);
  const [phase, setPhase] = useState<"meet" | "game" | "bound" | "fled">("meet");
  const [result, setResult] = useState<BindResult | null>(null);
  const [paid, setPaid] = useState(0);
  // Whether the codex knew this spirit before the binding.
  const known = useRef(!!save.spirits[def.id]).current;
  const Mini = MINI_GAMES[def.game];
  const home: Screen = { name: "realm", realm: screen.realm };

  const settle = (score: number) => {
    const outcome = resolveBind(save, screen.realm, screen.stop, def.id, score, perks);
    game.commit(outcome.save);
    setResult(outcome);
    if (outcome.bound) {
      game.world()?.act("bound");
      game.play("bound");
      void game.pay(outcome.coins).then(setPaid);
      setPhase("bound");
    } else {
      game.world()?.act("flee");
      game.play("flee");
      setPhase("fled");
    }
  };

  if (phase === "game")
    return (
      <section className="panel mini-panel">
        <Mini seed={`${def.id}:${save.visits}`} ink={game.ink} onDone={settle} onSound={game.play} />
      </section>
    );
  if (phase === "bound" && result)
    return (
      <section className="panel result">
        <h2 className="brush seal">{t(result.perfect ? "A perfect bond!" : "Bound!")}</h2>
        <p>
          {result.isNew
            ? t("{0} joins your codex.", pick(def.names[0]))
            : t("{0} shares its strength with the one you have.", pick(def.names[0]))}
        </p>
        <Rewards jade={result.jade} coins={paid} levelled={result.levelled} game={game} />
        <SignInHint />
        <span className="row">
          {result.isNew && (
            <button className="btn" onClick={() => game.go({ name: "codex", page: def.id, back: home })}>
              {t("Read its page")}
            </button>
          )}
          <button className="btn primary" onClick={() => game.go(home)}>
            {t("Continue")}
          </button>
        </span>
      </section>
    );
  if (phase === "fled")
    return (
      <section className="panel result">
        <h2 className="brush">{t("It slipped away…")}</h2>
        <p>{t("The seal was not strong enough this time. Spirits always come back.")}</p>
        <span className="row">
          <button className="btn" onClick={() => game.go(home)}>
            {t("Leave")}
          </button>
          <button className="btn primary" onClick={() => game.go({ ...screen, attempt: screen.attempt + 1 })}>
            {t("Try again")}
          </button>
        </span>
      </section>
    );
  return (
    <section className="panel">
      <h2 className="brush">{known ? pick(def.names[0]) : t("An unknown spirit!")}</h2>
      <p className="tags">
        <ElementChip element={def.element} /> <Stars n={def.rarity} />
        <span className="tag">{t(MINI_NAMES[def.game])}</span>
      </p>
      <p>
        {t("Score {0}% or more in the binding to seal the bond.", Math.round(needFor(def.rarity, perks) * 100))}
      </p>
      <span className="row">
        <button className="btn" onClick={() => game.go(home)}>
          {t("Leave")}
        </button>
        <button
          className="btn primary"
          onClick={() => {
            game.play("tap");
            setPhase("game");
          }}
        >
          {t("Begin the binding")}
        </button>
      </span>
    </section>
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function BattleView({ game, id, onAlly }: { game: Game; id: RealmId; onAlly: (index: number) => void }) {
  const { t } = useLocale();
  const { save, pick } = game;
  const def = realm(id);
  const perks = perksFrom(game.owned);
  const [battle, setBattle] = useState<Battle>(() => startBattle(save, id));
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState("");
  const [outcome, setOutcome] = useState<(ReturnType<typeof finishBattle> & { won: boolean; paid: number }) | null>(null);
  const boss = spirit(battle.boss.id);
  const live = useRef(true);
  useEffect(() => () => void (live.current = false), []);

  const choose = (i: number) => {
    if (busy || battle.over || battle.team[i].hp <= 0) return;
    game.play("tap");
    setPicked(i);
    onAlly(i);
  };
  const land = async (quality: number) => {
    if (picked == null || busy) return;
    setBusy(true);
    const { battle: next, events } = strike(battle, picked, quality);
    const world = game.world();
    for (const event of events) {
      if (!live.current) return;
      if (event.type === "strike") {
        world?.act("attack", "ally");
        await wait(280);
        world?.act("hurt");
        game.play("strike");
        setBattle((b) => ({ ...b, boss: next.boss }));
        setLine(
          t(
            event.multiplier > 1 ? "{0} hits for {1}. A strong match!" : event.multiplier < 1 ? "{0} hits for {1}. A weak match." : "{0} hits for {1}.",
            game.nameOf(battle.team[event.by].id),
            event.damage,
          ),
        );
        await wait(520);
      } else if (event.type === "bossStrike") {
        world?.act("attack");
        await wait(280);
        world?.act("hurt", "ally");
        game.play("hurt");
        setBattle((b) => ({ ...b, team: next.team }));
        setLine(
          t(event.heavy ? "{0} lands a heavy blow for {1}!" : "{0} strikes back for {1}.", pick(boss.names[0]), event.damage),
        );
        await wait(520);
      }
    }
    if (!live.current) return;
    setBattle(next);
    setPicked(null);
    setBusy(false);
    if (next.over) {
      const won = next.over === "won";
      const settled = finishBattle(save, id, won, perks);
      game.commit(settled.save);
      if (won) game.world()?.act("evolve");
      game.play(won ? "win" : "flee");
      const paid = await game.pay(settled.coins);
      if (live.current) setOutcome({ ...settled, won, paid });
    } else {
      const standing = next.team.findIndex((f) => f.hp > 0);
      if (next.team[picked].hp <= 0) onAlly(standing);
    }
  };

  if (outcome)
    return (
      <section className="panel result">
        <h2 className={`brush${outcome.won ? " seal" : ""}`}>
          {outcome.won ? t("{0} yields!", pick(boss.names[0])) : t("Your spirits need rest")}
        </h2>
        <p>
          {outcome.won
            ? outcome.first
              ? realmIndex(id) < REALMS.length - 1
                ? t("The way to {0} is open.", pick(REALMS[realmIndex(id) + 1].name))
                : t("Every guardian is calmed. The codex awaits its last pages.")
              : t("The guardian nods. A fine rematch.")
            : t("Train your team in the codex, or bring spirits whose element is strong here.")}
        </p>
        <Rewards jade={outcome.jade} coins={outcome.paid} levelled={outcome.levelled} game={game} />
        <SignInHint />
        <span className="row">
          {outcome.won && !save.spirits[boss.id] ? (
            <button
              className="btn primary"
              onClick={() => game.go({ name: "encounter", realm: id, stop: def.stops.length - 1, spirit: boss.id, attempt: 0 })}
            >
              {t("Bind {0}", pick(boss.names[0]))}
            </button>
          ) : null}
          {!outcome.won && (
            <button className="btn primary" onClick={() => game.go({ name: "codex", back: { name: "realm", realm: id } })}>
              {t("Train spirits")}
            </button>
          )}
          <button className="btn" onClick={() => game.go({ name: "realm", realm: id })}>
            {t("Continue")}
          </button>
        </span>
      </section>
    );

  return (
    <>
      <div className="boss-bar">
        <b>
          {pick(boss.names[0])} <ElementChip element={boss.element} />
        </b>
        <Bar value={battle.boss.hp} max={battle.boss.maxHp} className="hp boss" />
        {heavyNext(battle) && !battle.over && <em>{t("A heavy blow is coming!")}</em>}
      </div>
      <section className="panel battle">
        <p className="battle-line">{line || t("Choose a spirit to strike.")}</p>
        {picked != null && !busy ? (
          <StrikeMeter key={battle.turn} ink={game.ink} onStrike={land} />
        ) : null}
        <div className="fighters">
          {battle.team.map((f, i) => (
            <button
              key={f.id}
              className={`card fighter${picked === i ? " chosen" : ""}${f.hp <= 0 ? " down" : ""}`}
              disabled={busy || f.hp <= 0}
              onClick={() => choose(i)}
            >
              <Portrait game={game} id={f.id} evolved={save.spirits[f.id].evolved} />
              <b>{game.nameOf(f.id)}</b>
              <ElementChip element={f.element} />
              <Bar value={f.hp} max={f.maxHp} className="hp" />
              <small>
                {f.hp}/{f.maxHp}
              </small>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function Codex({ game, screen }: { game: Game; screen: Extract<Screen, { name: "codex" }> }) {
  const { t } = useLocale();
  const { save, pick } = game;
  if (screen.page) return <Page game={game} id={screen.page} />;
  return (
    <section className="panel tall">
      <h2 className="brush">
        {t("Codex")} <small>{boundCount(save)}/{SPIRITS.length}</small>
      </h2>
      {REALMS.map((r) => (
        <div key={r.id}>
          <h3>{pick(r.name)}</h3>
          <div className="codex">
            {SPIRITS.filter((s) => s.realm === r.id).map((def) => {
              const owned = save.spirits[def.id];
              return (
                <button
                  key={def.id}
                  className={`card entry${owned ? "" : " unknown"}`}
                  onClick={() => game.go({ name: "codex", page: def.id, back: screen.back })}
                >
                  <Portrait game={game} id={def.id} evolved={owned?.evolved} hidden={!owned} />
                  <b>{owned ? game.nameOf(def.id) : "？？？"}</b>
                  {owned ? (
                    <small>
                      {t("Lv {0}", owned.level)}
                      {save.team.includes(def.id) ? ` · ${t("Team")}` : ""}
                    </small>
                  ) : (
                    <Stars n={def.rarity} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function Page({ game, id }: { game: Game; id: string }) {
  const { t } = useLocale();
  const { save, pick } = game;
  const def: SpiritDef = spirit(id);
  const owned = save.spirits[id];
  const home = REALMS.find((r) => r.id === def.realm) as RealmDef;
  if (!owned)
    return (
      <section className="panel page">
        <Portrait game={game} id={id} hidden />
        <h2 className="brush">？？？</h2>
        <p className="tags">
          <ElementChip element={def.element} /> <Stars n={def.rarity} />
        </p>
        <p>{t("Not yet bound. Look for it in {0}.", pick(home.name))}</p>
        <p className="origin">{pick(def.origin)}</p>
      </section>
    );
  const stats = statsAt(def, owned.level, owned.evolved);
  const evo = evolveState(save, id);
  const inTeam = save.team.includes(id);
  return (
    <section className="panel page">
      <h2 className="brush">{game.nameOf(id)}</h2>
      <p className="tags">
        <ElementChip element={def.element} /> <Stars n={def.rarity} />
        <span className="tag">{t("Lv {0}", owned.level)}</span>
      </p>
      {owned.level < MAX_LEVEL && <Bar value={owned.xp} max={xpToNext(owned.level)} className="xp" />}
      <p className="stats">
        {t("HP {0}", stats.hp)} · {t("Attack {0}", stats.atk)} · {pick(def.skill)}
      </p>
      <p className="origin">{pick(def.origin)}</p>
      <p className="story">{pick(def.story)}</p>
      <span className="row">
        <button
          className="btn"
          disabled={!canTrain(save, id)}
          onClick={() => {
            game.play("jade");
            game.commit(train(save, id));
          }}
        >
          {owned.level >= MAX_LEVEL ? t("Top level") : t("Train ({0} jade)", trainCost(owned.level))}
        </button>
        {evo !== "none" && (
          <button
            className="btn primary"
            disabled={evo !== "ready"}
            onClick={() => {
              game.commit(evolve(save, id));
              game.play("win");
              game.toast(t("{0} evolved into {1}!", pick(def.names[0]), pick(def.names[1])));
              setTimeout(() => game.world()?.act("evolve"), 60);
            }}
          >
            {evo === "evolved"
              ? t("Evolved")
              : evo === "level"
                ? t("Evolves at Lv {0}", def.evolveAt!)
                : t("Evolve ({0} jade)", EVOLVE_COST)}
          </button>
        )}
        <button
          className="btn"
          disabled={inTeam ? save.team.length <= 1 : save.team.length >= TEAM_SIZE}
          onClick={() => game.commit(toggleTeam(save, id))}
        >
          {inTeam ? t("Leave the team") : save.team.length >= TEAM_SIZE ? t("Team is full") : t("Join the team")}
        </button>
      </span>
    </section>
  );
}

const SHELF_NAMES: Record<Shelf, string> = {
  talismans: "Talismans",
  looks: "Ink and robes",
  charms: "Summoning charms",
};

function Shop({
  game,
  prefs,
  onPrefs,
  onOwned,
}: {
  game: Game;
  prefs: Prefs;
  onPrefs: (prefs: Prefs) => void;
  onOwned: (owned: Set<string>) => void;
}) {
  const sdk = useDingn();
  const { t } = useLocale();
  const { pick } = game;
  const purchase = async (id: string) => {
    const result = await buy(sdk, id);
    if (result === "signin") return sdk.requestSignIn();
    if (result === "bought") {
      game.play("coin");
      // In a test version nothing is charged or kept, so show it as owned here.
      const mine = await loadOwned(sdk);
      mine.add(id);
      onOwned(mine);
      if (id.startsWith("ink-")) onPrefs({ ...prefs, ink: id });
      if (id.startsWith("robe-")) onPrefs({ ...prefs, robe: id });
      game.toast(t("It's yours!"));
    } else if (result === "poor") game.toast(t("Not enough dingn coins yet. Bind spirits to earn more."));
    else if (result === "failed") game.toast(t("That didn't work. Please try again."));
  };
  return (
    <section className="panel tall">
      <h2 className="brush">{t("Talisman shop")}</h2>
      <p className="note">
        {t("Paid with dingn coins. Every spirit a charm calls can also be found in the realms, and nothing here is random.")}
      </p>
      <SignInHint />
      {SHELVES.map((shelf) => (
        <div key={shelf}>
          <h3>{t(SHELF_NAMES[shelf])}</h3>
          <ul className="shop">
            {CATALOG.filter((item) => item.shelf === shelf).map((item) => {
              const mine = game.owned.has(item.id);
              const look = item.id.startsWith("ink-") ? "ink" : item.id.startsWith("robe-") ? "robe" : null;
              const called = shelf === "charms" && !!game.save.spirits[item.id.slice(5)];
              const worn = look && prefs[look] === item.id;
              return (
                <li key={item.id}>
                  {look === "ink" && <i className="swatch" style={{ background: INKS[item.id] }} />}
                  {look === "robe" && <i className="swatch" style={{ background: ROBES[item.id][0] }} />}
                  <span>{pick(item.title)}</span>
                  {mine && look ? (
                    <button className="btn" onClick={() => onPrefs({ ...prefs, [look]: worn ? "" : item.id })}>
                      {worn ? t("Take off") : t("Use")}
                    </button>
                  ) : mine || called ? (
                    <em>{t(mine ? "Owned" : "Already bound")}</em>
                  ) : (
                    <button className="btn primary" onClick={() => void purchase(item.id)}>
                      {item.price} <i className="coin" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
