# Mythbound (灵契藏鉴)

A painted xianxia creature-collection adventure for [dingn](https://dingn.com).
You are a young binder with an empty codex: explore three mythic realms, bind
the spirits you meet, raise a team and face each realm's guardian. Play it at
<https://dingn.com/play/mythbound/>.

- **Three realms**: Cloudpeak Shores, Lantern City and the Whispering Wood.
  Each is a path of seven stops: spirit trails, a jade cache, a shrine and the
  guardian's seat. Beating a guardian opens the next realm.
- **Twelve spirits**, four a realm, each with a codex page (portrait, element,
  origin and a short story). Spirits you haven't bound show as silhouettes.
  Nine of them evolve into a second form; the three guardians are legendary
  and can be bound once they are beaten.
- **Binding** is a short mini-game, a different one for each spirit: draw a
  talisman by tracing its stroke, tap a seal to the rhythm of closing rings,
  or link seven seals in order. A good enough score seals the bond with a
  burst of runes; a spirit that slips away can always be tried again.
- **Raising a team**: spirit jade found on the way trains spirits a level at
  a time and evolves them. Up to three spirits fight a guardian.
- **Guardian battles**: pick a spirit, tap as the brush crosses the seal to
  strike harder, and mind the five elements (wood, earth, water, fire and
  metal each overcome the next). Every third blow from a guardian is a heavy
  one, announced a turn ahead.
- English and Chinese.

Every spirit, name and story is original to this game, and every creature and
the binder are built in code from three.js shapes, so the game ships no model
files.

## Coins, badges and the shop

Mythbound earns and spends dingn coins:

- Binding a new spirit pays 3 to 5 coins by rarity, a spirit you already have
  pays 1, a guardian beaten for the first time pays 10, and a lost battle
  still pays 1 (`src/engine/journey.ts`), through `sdk.rewards.earn`. dingn
  caps what a game pays a player each day.
- 11 badges: a first bond, 3, 6, 9 and all 12 spirits, each guardian, a first
  evolution, a perfect binding and a legendary spirit.
- The **Talisman shop** sells 12 things, each bought once (`game.json`'s
  `shop`): three talismans (more forgiving bindings, +50% jade, +25% XP), two
  inks and three robes for the binder, and four summoning charms that bring a
  rarer spirit straight to you. Nothing is random, there are no loot boxes,
  legendary spirits are never sold, and every spirit a charm calls can also be
  found in its realm. dingn asks the player to confirm each purchase.

## Develop

```sh
npm install
npm run dev     # http://localhost:5173/
npm test        # typecheck, rules tests, screen tests
```

To play it inside dingn while developing, open the
[playground](https://dingn.com/developers/playground/) and load
`http://localhost:5173/`.

## What's where

- `src/engine/spirits.ts`: the twelve spirits: names, elements, stats and
  stories.
- `src/engine/realms.ts`: the realms, their stops and guardians.
- `src/engine/journey.ts`: the save and every rule that changes it: binding,
  caches and shrines, training, evolving, the team, badges.
- `src/engine/battle.ts`, `src/engine/elements.ts`: guardian battles and the
  five elements.
- `src/engine/capture.ts`: the rules of the three binding mini-games.
- `src/spirit-models.ts`: every spirit and the binder as three.js shapes with
  toon shading and an ink outline.
- `src/art.ts`: the paintings of the binder, spirits and places.
- `src/world.ts`: the 3D stage: painted backdrops and figures, animation, the
  rune burst and the codex portraits.
- `src/game.tsx`, `src/minigames.tsx`: the screens and the mini-games.
- `src/save.ts`, `src/shop.ts`: saving (on the device with `sdk.storage`, and
  to the player's account with `sdk.progress` when signed in), coins, badges
  and the shop.
- `src/sound.ts`: synthesised sound effects.

## Release a new version

1. In a pull request, raise `version` in `game.json`. Every release needs a
   new version.
2. Merge it to `main`. The **Build and publish** Action tests the game,
   builds `release/mythbound-<version>.zip` and uploads it to dingn with the
   `DINGN_UPLOAD_KEY` secret.
3. The new version waits in dingn's review queue and goes live once it is
   approved.

A merge that doesn't raise the version builds and tests but uploads nothing.
Every run also keeps the zip as a workflow artifact.

To upload by hand instead: `npm run pack`, then upload the zip on
<https://dingn.com/developers/games/>, or run
`DINGN_UPLOAD_KEY=... npm run upload`.

### The upload key

Create a key on <https://dingn.com/developers/games/> (signed in as the
account that owns the game), then add it to this repository under
**Settings → Secrets and variables → Actions** as `DINGN_UPLOAD_KEY`. dingn
shows the key once; if it is lost, revoke it and create another.

## The dingn SDK

`sdk/` is a copy of the dingn game SDK (`https://dingn.com/sdk/v1/`), bundled
into the game. Run `npm run update-sdk` to refresh it. The full guide is at
<https://dingn.com/developers/>.

## Credits

Written by Ligang Wang. Built with [three.js](https://threejs.org/) and
[React](https://react.dev/). Every spirit is a three.js shape and every sound
is synthesised in the browser.

The brush lettering is [Ma Shan Zheng](https://github.com/googlefonts/mashanzheng)
by the Ma Shan Zheng Project Authors, under the SIL Open Font License 1.1
(`src/fonts/OFL.txt`). The game ships a copy cut down to the characters it
shows; rebuild it with `node scripts/brush-font.mjs <MaShanZheng-Regular.ttf>`
after adding Chinese text.
