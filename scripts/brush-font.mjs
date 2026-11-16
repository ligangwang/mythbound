// Rebuilds src/fonts/brush.woff2: Ma Shan Zheng (SIL Open Font License) cut
// down to the characters the game shows. Run it after adding Chinese text:
//   node scripts/brush-font.mjs path/to/MaShanZheng-Regular.ttf
// It needs fonttools (pip install fonttools brotli). The full font is at
// https://github.com/google/fonts/tree/main/ofl/mashanzheng
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/brush-font.mjs MaShanZheng-Regular.ttf");
  process.exit(1);
}
const chars = new Set();
for (let c = 32; c < 127; c++) chars.add(String.fromCharCode(c));
function read(file) {
  for (const char of readFileSync(file, "utf8")) if (char > "\u007f") chars.add(char);
}
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx?|json)$/.test(name)) read(full);
  }
}
walk("src");
read("game.json");
const list = path.join(tmpdir(), "mythbound-chars.txt");
writeFileSync(list, [...chars].join(""));
execFileSync(
  "pyftsubset",
  [source, `--text-file=${list}`, "--flavor=woff2", "--output-file=src/fonts/brush.woff2"],
  { stdio: "inherit" },
);
console.log(`src/fonts/brush.woff2: ${chars.size} characters, ${statSync("src/fonts/brush.woff2").size} bytes`);
