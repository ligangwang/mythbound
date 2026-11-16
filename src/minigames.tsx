/**
 * The three binding mini-games, drawn over the 3D stage. Each calls
 * onDone(score) once with a score from 0 to 1; the rules are in
 * src/engine/capture.ts.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  BEATS,
  BIND_TIME,
  SEAL_POINTS,
  bindScore,
  gradeTap,
  rhythmBeats,
  rhythmScore,
  sealPoints,
  traceAdvance,
  traceGlyph,
  traceScore,
  type Grade,
  type Point,
} from "./engine/capture";
import type { CaptureGame } from "./engine/spirits";
import { useLocale } from "./dingn";

type Props = {
  seed: string;
  ink: string;
  onDone: (score: number) => void;
  onSound?: (name: "good" | "perfect" | "miss" | "tap") => void;
};

/** Calls `finish` once, however many times it is asked. */
function useOnce(onDone: (score: number) => void) {
  const done = useRef(false);
  return (score: number) => {
    if (done.current) return;
    done.current = true;
    onDone(score);
  };
}

/** Where a pointer is inside the square board, from 0 to 1. */
function at(event: PointerEvent<Element>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  const w = rect.width || 1;
  const h = rect.height || 1;
  return { x: (event.clientX - rect.left) / w, y: (event.clientY - rect.top) / h };
}

const TRACE_TIME = 12000;

/** Draw the talisman: follow its stroke with a finger from the seal dot. */
export function TraceGame({ seed, ink, onDone, onSound }: Props) {
  const { t } = useLocale();
  const glyph = useMemo(() => traceGlyph(seed), [seed]);
  const [done, setDone] = useState(0);
  const reached = useRef(0);
  const drawing = useRef(false);
  const finish = useOnce(onDone);
  useEffect(() => {
    const timer = setTimeout(
      () => finish(traceScore(reached.current, glyph.length)),
      TRACE_TIME,
    );
    return () => clearTimeout(timer);
  }, [glyph]);
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return;
    const next = traceAdvance(glyph, reached.current, at(event));
    if (next === reached.current) return;
    reached.current = next;
    setDone(next);
    if (next >= glyph.length) {
      onSound?.("perfect");
      setTimeout(() => finish(1), 250);
    }
  };
  const path = (points: Point[]) =>
    points.map((p, i) => `${i ? "L" : "M"}${p.x * 100} ${p.y * 100}`).join(" ");
  const next = glyph[Math.min(done, glyph.length - 1)];
  return (
    <div className="mini">
      <p className="mini-hint">{t("Draw the talisman: follow the stroke from the red dot.")}</p>
      <svg
        className="mini-board"
        data-testid="trace-board"
        viewBox="0 0 100 100"
        onPointerDown={(event) => {
          drawing.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          move(event);
        }}
        onPointerMove={move}
        onPointerUp={() => (drawing.current = false)}
      >
        <path d={path(glyph)} className="trace-guide" />
        {done > 1 && <path d={path(glyph.slice(0, done))} className="trace-ink" style={{ stroke: ink }} />}
        <circle cx={next.x * 100} cy={next.y * 100} r="4.5" className="trace-dot" style={{ fill: ink }} />
      </svg>
      <div className="mini-timer"><i style={{ animationDuration: `${TRACE_TIME}ms` }} /></div>
    </div>
  );
}

/** How long a ring takes to close on the seal. */
const RING_TIME = 1000;

/** Tap the seal as each ring closes on it. */
export function RhythmGame({ seed, ink, onDone, onSound }: Props) {
  const { t } = useLocale();
  const beats = useMemo(() => rhythmBeats(seed), [seed]);
  const start = useRef(performance.now());
  const [grades, setGrades] = useState<Grade[]>([]);
  const graded = useRef<Grade[]>([]);
  const finish = useOnce(onDone);
  const grade = (g: Grade) => {
    graded.current = [...graded.current, g];
    setGrades(graded.current);
    onSound?.(g);
    if (graded.current.length >= BEATS)
      setTimeout(() => finish(rhythmScore(graded.current)), 450);
  };
  useEffect(() => {
    // A beat nobody tapped is a miss once it is well past.
    const timer = setInterval(() => {
      const beat = beats[graded.current.length];
      if (beat != null && performance.now() - start.current - beat > 220)
        grade("miss");
    }, 50);
    return () => clearInterval(timer);
  }, [beats]);
  const tap = () => {
    const beat = beats[graded.current.length];
    if (beat == null) return;
    const offset = performance.now() - start.current - beat;
    // A tap long before the ring arrives is ignored, not punished.
    if (offset < -450) return;
    grade(gradeTap(offset));
  };
  const last = grades[grades.length - 1];
  return (
    <div className="mini">
      <p className="mini-hint">{t("Tap the seal as each ring closes on it.")}</p>
      <button className="mini-board rhythm" data-testid="rhythm-seal" onPointerDown={tap}>
        {beats.map((beat, i) =>
          i >= grades.length ? (
            <i
              key={i}
              className="rhythm-ring"
              style={{ borderColor: ink, animationDelay: `${beat - RING_TIME}ms`, animationDuration: `${RING_TIME}ms` }}
            />
          ) : null,
        )}
        <b className="rhythm-seal" style={{ borderColor: ink, color: ink }}>契</b>
        {last && (
          <em key={grades.length} className={`rhythm-grade ${last}`}>
            {t(last === "perfect" ? "Perfect!" : last === "good" ? "Good" : "Miss")}
          </em>
        )}
      </button>
      <div className="mini-pips">
        {beats.map((_, i) => (
          <i key={i} className={grades[i] ?? ""} />
        ))}
      </div>
    </div>
  );
}

/** Link the seal points in order, 1 to 7, before the time runs out. */
export function BindGame({ seed, ink, onDone, onSound }: Props) {
  const { t } = useLocale();
  const points = useMemo(() => sealPoints(seed), [seed]);
  const [linked, setLinked] = useState(0);
  const [wrong, setWrong] = useState(-1);
  const count = useRef(0);
  const finish = useOnce(onDone);
  useEffect(() => {
    const timer = setTimeout(() => finish(bindScore(count.current)), BIND_TIME);
    return () => clearTimeout(timer);
  }, [points]);
  const tap = (i: number) => {
    if (i < count.current) return;
    if (i !== count.current) {
      setWrong(i);
      onSound?.("miss");
      setTimeout(() => setWrong(-1), 300);
      return;
    }
    count.current++;
    setLinked(count.current);
    onSound?.(count.current === SEAL_POINTS ? "perfect" : "good");
    if (count.current === SEAL_POINTS) setTimeout(() => finish(1), 250);
  };
  return (
    <div className="mini">
      <p className="mini-hint">{t("Link the seals in order, from 1 to {0}.", SEAL_POINTS)}</p>
      <div className="mini-board">
        <svg viewBox="0 0 100 100" className="bind-lines">
          {linked > 1 && (
            <polyline
              points={points.slice(0, linked).map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
              style={{ stroke: ink }}
            />
          )}
        </svg>
        {points.map((p, i) => (
          <button
            key={i}
            className={`bind-point${i < linked ? " done" : ""}${i === wrong ? " wrong" : ""}`}
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              ...(i < linked ? { background: ink, borderColor: ink } : {}),
            }}
            onPointerDown={() => tap(i)}
            aria-label={t("Seal {0}", i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="mini-timer"><i style={{ animationDuration: `${BIND_TIME}ms` }} /></div>
    </div>
  );
}

export const MINI_GAMES: Record<CaptureGame, (props: Props) => React.JSX.Element> = {
  trace: TraceGame,
  rhythm: RhythmGame,
  bind: BindGame,
};
export const MINI_NAMES: Record<CaptureGame, string> = {
  trace: "Draw a talisman",
  rhythm: "Rhythm seal",
  bind: "Link the seals",
};

const SWEEP = 1100;
/**
 * The strike meter of a guardian battle: a brush sweeps back and forth and
 * the player taps as it crosses the middle. Calls onStrike with 0 to 1.
 */
export function StrikeMeter({ ink, onStrike }: { ink: string; onStrike: (quality: number) => void }) {
  const { t } = useLocale();
  const start = useRef(performance.now());
  const strike = useOnce(onStrike);
  const tap = () => {
    const phase = ((performance.now() - start.current) % (SWEEP * 2)) / SWEEP;
    const position = phase <= 1 ? phase : 2 - phase;
    // Dead centre is 1; the ends of the bar are 0.
    strike(Math.max(0, 1 - Math.abs(position - 0.5) * 2.4));
  };
  return (
    <button className="strike" data-testid="strike" onPointerDown={tap}>
      <span className="strike-bar">
        <i className="strike-sweet" style={{ background: ink }} />
        <i className="strike-brush" style={{ animationDuration: `${SWEEP}ms` }} />
      </span>
      <b>{t("Tap when the brush is on the seal!")}</b>
    </button>
  );
}
