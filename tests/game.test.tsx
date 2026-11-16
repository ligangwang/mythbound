import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DingnGame, Locale } from "../sdk/dingn-sdk.js";
import { MythboundGame } from "../src/game";
import { DingnProvider } from "../src/dingn";
import { traceGlyph } from "../src/engine/capture";
import manifest from "../game.json";

const mocks = vi.hoisted(() => ({ acts: [] as string[], shown: [] as (string | null)[] }));
// A stand-in for the three.js world (jsdom has no WebGL).
vi.mock("../src/world", () => ({
  World: class {
    resize() {}
    setInk() {}
    setPlace() {}
    setBinder() {}
    showSpirit(id: string | null) {
      mocks.shown.push(id);
    }
    showAlly() {}
    showLineup() {}
    act(kind: string) {
      mocks.acts.push(kind);
    }
    portrait = () => "";
    dispose() {}
  },
}));

let stored: Map<string, unknown>;
let owned: Set<string>;
const calls = { save: vi.fn(), spend: vi.fn(), earn: vi.fn(), unlock: vi.fn(), signIn: vi.fn() };
function fakeSdk(signedIn: boolean, locale: Locale = "en"): DingnGame {
  return {
    gameId: "mythbound",
    version: "1.0.0",
    locale,
    player: { signedIn, name: signedIn ? "Ada" : "", avatar: "" },
    embedded: true,
    onPlayer: () => () => {},
    storage: {
      get: async (k) => (stored.get(k) as never) ?? null,
      set: async (k, v) => void stored.set(k, v),
    },
    progress: { load: async () => null, save: calls.save },
    rewards: {
      unlock: calls.unlock,
      list: async () => [],
      spend: calls.spend,
      shop: async () =>
        manifest.shop.map((i) => ({ id: i.id, price: i.price, title: i.title.en, owned: owned.has(i.id) })),
      earn: calls.earn,
    },
    requestSignIn: calls.signIn,
    navigate() {},
    ready() {},
  };
}
const play = (sdk: DingnGame) =>
  render(
    <DingnProvider sdk={sdk}>
      <MythboundGame />
    </DingnProvider>,
  );
const journey = (extra: object = {}) => ({
  v: 1,
  at: 5,
  spirits: {
    tidepup: { level: 6, xp: 0, evolved: true },
    emberwing: { level: 5, xp: 0, evolved: false },
    shellsage: { level: 5, xp: 0, evolved: false },
  },
  team: ["tidepup", "emberwing", "shellsage"],
  jade: 100,
  cleared: { shores: 6, city: 0, wood: 0 },
  visits: 4,
  stats: { binds: 5, perfects: 0, evolves: 1, bossWins: 0 },
  ...extra,
});
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  stored = new Map();
  owned = new Set();
  mocks.acts.length = 0;
  mocks.shown.length = 0;
  for (const fn of Object.values(calls)) fn.mockReset();
  calls.save.mockResolvedValue(undefined);
  calls.earn.mockImplementation(async (coins: number) => ({ coins, left: 100 }));
  calls.unlock.mockResolvedValue({ new: true, coins: 10 });
  calls.spend.mockResolvedValue({ new: true, coins: 100 });
});
afterEach(cleanup);

test("a new binder picks a starter, then binds a new spirit by drawing a talisman", async () => {
  play(fakeSdk(true));
  click(await screen.findByText("Tidepup").then(() => /Tidepup/));
  click(/^Cloudpeak Shores/);
  click("Explore");
  // The starter is already bound, so the first trail meets someone new.
  expect(await screen.findByText("An unknown spirit!")).toBeTruthy();
  expect(mocks.shown.at(-1)).toBe("emberwing");
  click("Begin the binding");
  const board = screen.getByTestId("trace-board");
  const glyph = traceGlyph("emberwing:0");
  fireEvent.pointerDown(board, { clientX: glyph[0].x, clientY: glyph[0].y });
  for (const p of glyph) fireEvent.pointerMove(board, { clientX: p.x, clientY: p.y });
  expect(await screen.findByText("A perfect bond!", {}, { timeout: 3000 })).toBeTruthy();
  expect(screen.getByText("Emberwing joins your codex.")).toBeTruthy();
  expect(mocks.acts).toContain("bound");
  expect(calls.earn).toHaveBeenCalledWith(3);
  await waitFor(() => expect(calls.unlock).toHaveBeenCalledWith("first-bond"));
  expect(calls.unlock).toHaveBeenCalledWith("perfect");
  await waitFor(() => expect(screen.getByText("+3 dingn coins")).toBeTruthy());
  const saved = stored.get("journey") as { spirits: object; cleared: { shores: number } };
  expect(Object.keys(saved.spirits)).toEqual(["tidepup", "emberwing"]);
  expect(saved.cleared.shores).toBe(1);
  expect(calls.save).toHaveBeenCalled();
  click("Read its page");
  expect(screen.getByText("The cliffs where the sun first lands")).toBeTruthy();
});

test("a binding that runs out of time lets the spirit slip away, with nothing lost", async () => {
  stored.set("journey", journey({ cleared: { shores: 3, city: 0, wood: 0 }, spirits: { tidepup: { level: 2, xp: 0, evolved: false } }, team: ["tidepup"] }));
  play(fakeSdk(false));
  click(await screen.findByRole("button", { name: /^Cloudpeak Shores/ }).then(() => /^Cloudpeak Shores/));
  click("Explore");
  vi.useFakeTimers();
  try {
    click("Begin the binding");
    // Shellsage is bound by linking seals: link only two of the seven.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Seal 1" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Seal 2" }));
    await act(() => vi.advanceTimersByTimeAsync(9500));
  } finally {
    vi.useRealTimers();
  }
  expect(screen.getByText("It slipped away…")).toBeTruthy();
  expect(mocks.acts).toContain("flee");
  expect(calls.earn).not.toHaveBeenCalled();
  click("Try again");
  expect(screen.getByRole("button", { name: "Begin the binding" })).toBeTruthy();
});

test("a guardian battle: pick a spirit, strike, and the guardian strikes back", async () => {
  stored.set("journey", journey());
  play(fakeSdk(true));
  click(await screen.findByRole("button", { name: /^Cloudpeak Shores/ }).then(() => /^Cloudpeak Shores/));
  click("Challenge the guardian");
  expect(mocks.shown.at(-1)).toBe("tidewhale");
  expect(screen.getByText("Choose a spirit to strike.")).toBeTruthy();
  click(/Mountainback|Shellsage/);
  fireEvent.pointerDown(screen.getByTestId("strike"));
  // Earth overcomes water.
  expect(await screen.findByText(/Shellsage hits for \d+\. A strong match!/, {}, { timeout: 3000 })).toBeTruthy();
  expect(await screen.findByText(/Abyssal Tidewhale strikes back for \d+\./, {}, { timeout: 3000 })).toBeTruthy();
  expect(mocks.acts).toEqual(expect.arrayContaining(["attack", "hurt"]));
  // Then it is the player's turn again.
  await waitFor(
    () => expect((screen.getByRole("button", { name: /Stormhound/ }) as HTMLButtonElement).disabled).toBe(false),
    { timeout: 3000 },
  );
});

test("the codex trains, evolves and shows unknown spirits as silhouettes", async () => {
  stored.set("journey", journey());
  play(fakeSdk(false));
  click(await screen.findByRole("button", { name: /Codex 3\/12/ }).then(() => /Codex 3\/12/));
  expect(screen.getAllByText("？？？").length).toBe(9);
  click(/Emberwing/);
  click("Train (40 jade)");
  expect(screen.getByText("Lv 6")).toBeTruthy();
  click("Evolve (60 jade)");
  expect(screen.getByRole("heading", { name: "Sunplume Crane" })).toBeTruthy();
  expect((stored.get("journey") as { jade: number }).jade).toBe(0);
  expect((screen.getByRole("button", { name: /Train/ }) as HTMLButtonElement).disabled).toBe(true);
});

test("the shop buys with dingn coins, and a charm calls its spirit", async () => {
  stored.set("journey", journey());
  play(fakeSdk(true));
  click(await screen.findByRole("button", { name: "Talisman shop" }).then(() => "Talisman shop"));
  const row = screen.getByText("Summoning charm: Moonfox joins you").closest("li")!;
  fireEvent.click(row.querySelector("button")!);
  await waitFor(() => expect(calls.spend).toHaveBeenCalledWith("call-moonfox"));
  await waitFor(() => expect(row.textContent).toContain("Owned"));
  expect((stored.get("journey") as { spirits: object }).spirits).toHaveProperty("moonfox");
});

test("a signed-out player is asked to sign in before buying", async () => {
  stored.set("journey", journey());
  play(fakeSdk(false));
  click(await screen.findByRole("button", { name: "Talisman shop" }).then(() => "Talisman shop"));
  fireEvent.click(screen.getByText("Golden ink for your brush").closest("li")!.querySelector("button")!);
  await waitFor(() => expect(calls.signIn).toHaveBeenCalled());
  expect(calls.spend).not.toHaveBeenCalled();
});

test("Chinese players get Chinese text", async () => {
  stored.set("journey", journey());
  play(fakeSdk(false, "zh-CN"));
  click(await screen.findByRole("button", { name: /^云峰海岸/ }).then(() => /^云峰海岸/));
  expect(screen.getByText("7. 守护灵之座")).toBeTruthy();
  expect(screen.getByRole("button", { name: "挑战守护灵" })).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/Guardian|Explore|Spirit/);
});
