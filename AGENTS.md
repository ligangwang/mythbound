# AGENTS.md

Notes for AI coding agents working on Mythbound (灵契藏鉴).

- This is a dingn game published like any outside developer's game: the
  dingn website (repo `ligangwang/dingn`) runs it in a sandboxed frame and the
  game talks to it only through the SDK in `sdk/`. Don't import from the
  dingn repo. Refresh `sdk/` with `npm run update-sdk`.
- Run `npm test` before committing. `npm run pack` builds the upload zip.
- Merging to `main` publishes on dingn (`.github/workflows/release.yml`)
  when `version` in `game.json` is new.
- Bump `version` in `game.json` for every release; dingn refuses a version it
  already has.
- Save with `sdk.storage` / `sdk.progress`, never `localStorage` or cookies,
  which the sandbox blocks. Keep every URL relative (`base: "./"`).
- UI strings go through `t()` with translations in `src/zh-CN.json` (a test
  checks none is missing). Spirit and realm text carries its own `en` and
  `zh` in `src/engine/spirits.ts` and `src/engine/realms.ts`.
- `src/engine/` is the rules (spirits, realms, binding, training, battles).
  Keep it free of three.js and the DOM so the tests can run it in Node, and
  keep it deterministic: nothing in it rolls dice outside the seeded
  generator.
- Mythbound is an original game: every spirit, name, story and design is our
  own. Don't copy names, characters, plots or looks from shows, books or
  other games.
- The binder, every spirit and every place is a painting (`src/art/*.webp`,
  listed in `src/art.ts`). Each picture is generated from our own prompts
  and we cut the figure off its grey ground: `art-src/add.sh <picture> <name>`
  for a figure (`HOLES=1` when it encloses bare ground, like a halo or a
  coil), `art-src/backdrop.sh <picture> <name>` for a place. A place needs a
  wide picture and a tall one for phones. Keep the originals in `art-src/`.
- `?classic` shows the older look, built in code from three.js shapes
  (`src/spirit-models.ts`). Keep it working; it is the fallback for a spirit
  with no painting yet.
- The only third-party asset besides the generated pictures is the brush font, Ma Shan Zheng (SIL Open Font
  License), cut down to the characters the game shows. After adding Chinese
  text, rebuild it with `node scripts/brush-font.mjs <MaShanZheng-Regular.ttf>`.
- `game.json`'s `shop`: ids start with `talisman-`, `ink-`, `robe-` or
  `call-` (a summoning charm for the spirit named after it). Keep it kind to
  kids: nothing is random, no loot boxes, legendary spirits are never sold,
  and everything a charm gives can be found by playing.
- `game.json` names a `cover` (`public/cover.jpg`, 1200×750, no text on it); dingn needs
  one in every upload.
