/**
 * The rules of the three binding mini-games, apart from drawing them:
 * the talisman shapes to trace, the rhythm beats and how taps are graded,
 * and the seal points to link. All positions are in a 0 to 1 square.
 */
import { hash, rng } from "./random";

export type Point = { x: number; y: number };

// Trace: follow the talisman's stroke from start to end.

const GLYPHS: Point[][] = (
  [
  // A lightning stroke.
  [
    [0.25, 0.15], [0.7, 0.15], [0.35, 0.45], [0.72, 0.45], [0.3, 0.85],
  ],
  // A spiral.
  [
    [0.5, 0.5], [0.6, 0.42], [0.62, 0.58], [0.45, 0.66], [0.32, 0.5],
    [0.42, 0.28], [0.68, 0.26], [0.8, 0.5], [0.68, 0.78], [0.4, 0.84],
  ],
  // A mountain with a tail.
  [
    [0.15, 0.75], [0.35, 0.3], [0.5, 0.6], [0.65, 0.2], [0.85, 0.75],
    [0.5, 0.88],
  ],
  // A knot.
  [
    [0.2, 0.25], [0.8, 0.25], [0.8, 0.7], [0.3, 0.7], [0.3, 0.42],
    [0.62, 0.42], [0.62, 0.88],
  ],
  // A wave.
  [
    [0.12, 0.5], [0.25, 0.28], [0.4, 0.5], [0.55, 0.72], [0.7, 0.5],
    [0.82, 0.28], [0.9, 0.5],
  ],
  ] as [number, number][][]
).map((glyph) => glyph.map(([x, y]) => ({ x, y })));

/** The talisman for an encounter: checkpoints spaced evenly along its stroke. */
export function traceGlyph(seed: string, checkpoints = 28): Point[] {
  const glyph = GLYPHS[hash(seed) % GLYPHS.length];
  const lengths = glyph
    .slice(1)
    .map((p, i) => Math.hypot(p.x - glyph[i].x, p.y - glyph[i].y));
  const total = lengths.reduce((a, b) => a + b, 0);
  const points: Point[] = [];
  for (let n = 0; n < checkpoints; n++) {
    let d = (n / (checkpoints - 1)) * total;
    let i = 0;
    while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
    const f = lengths[i] ? Math.min(1, d / lengths[i]) : 0;
    points.push({
      x: glyph[i].x + (glyph[i + 1].x - glyph[i].x) * f,
      y: glyph[i].y + (glyph[i + 1].y - glyph[i].y) * f,
    });
  }
  return points;
}

export const TRACE_REACH = 0.075;
/**
 * Moves the brush: returns how many checkpoints are done once the brush is at
 * `at`. Checkpoints are taken in order, each when the brush comes close.
 */
export function traceAdvance(glyph: Point[], done: number, at: Point): number {
  while (
    done < glyph.length &&
    Math.hypot(glyph[done].x - at.x, glyph[done].y - at.y) <= TRACE_REACH
  )
    done++;
  return done;
}
export const traceScore = (done: number, total: number) =>
  total ? done / total : 0;

// Rhythm: tap as each ring closes on the seal.

export const BEATS = 6;
/** When each ring closes, in milliseconds from the start. */
export function rhythmBeats(seed: string): number[] {
  const random = rng(hash(seed));
  const beats: number[] = [];
  let at = 1400;
  for (let i = 0; i < BEATS; i++) {
    beats.push(Math.round(at));
    at += 700 + Math.floor(random() * 3) * 250;
  }
  return beats;
}
export type Grade = "perfect" | "good" | "miss";
export function gradeTap(offsetMs: number): Grade {
  const off = Math.abs(offsetMs);
  return off <= 90 ? "perfect" : off <= 220 ? "good" : "miss";
}
export const GRADE_SCORE: Record<Grade, number> = {
  perfect: 1,
  good: 0.7,
  miss: 0,
};
export const rhythmScore = (grades: Grade[]) =>
  grades.reduce((sum, g) => sum + GRADE_SCORE[g], 0) / BEATS;

// Bind: link the seal points in order before the time runs out.

export const SEAL_POINTS = 7;
export const BIND_TIME = 9000;
export function sealPoints(seed: string): Point[] {
  const random = rng(hash(seed));
  const points: Point[] = [];
  let guard = 0;
  while (points.length < SEAL_POINTS && guard++ < 500) {
    const p = { x: 0.14 + random() * 0.72, y: 0.14 + random() * 0.72 };
    if (points.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 0.2))
      points.push(p);
  }
  // A crowded roll falls back to a ring, so there are always seven.
  for (let i = points.length; i < SEAL_POINTS; i++) {
    const a = (i / SEAL_POINTS) * Math.PI * 2;
    points.push({ x: 0.5 + Math.cos(a) * 0.36, y: 0.5 + Math.sin(a) * 0.36 });
  }
  return points;
}
/** Every point linked scores full marks; time left adds nothing but pride. */
export const bindScore = (linked: number) => linked / SEAL_POINTS;
