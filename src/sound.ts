/** Little synthesised sounds, so no audio files are downloaded. */
type Note = [freq: number, to: number, dur: number, delay?: number];
const SOUNDS: Record<string, { type: OscillatorType; notes: Note[]; vol?: number }> = {
  tap: { type: "triangle", notes: [[520, 700, 0.08]] },
  step: { type: "triangle", notes: [[392, 392, 0.1], [523, 523, 0.14, 0.1]] },
  appear: { type: "sine", notes: [[220, 660, 0.35]] },
  good: { type: "sine", notes: [[784, 784, 0.1]] },
  perfect: { type: "sine", notes: [[988, 988, 0.08], [1319, 1319, 0.14, 0.07]] },
  miss: { type: "sine", notes: [[330, 220, 0.25]] },
  bound: { type: "triangle", notes: [[523, 523, 0.14], [659, 659, 0.14, 0.13], [784, 784, 0.14, 0.26], [1047, 1047, 0.4, 0.39]] },
  flee: { type: "sine", notes: [[600, 200, 0.4]] },
  strike: { type: "square", notes: [[180, 90, 0.14]], vol: 0.1 },
  hurt: { type: "sawtooth", notes: [[140, 70, 0.2]], vol: 0.08 },
  win: { type: "triangle", notes: [[523, 523, 0.12], [659, 659, 0.12, 0.12], [784, 784, 0.12, 0.24], [1047, 1047, 0.14, 0.36], [1319, 1319, 0.4, 0.5]] },
  coin: { type: "square", notes: [[988, 988, 0.07], [1319, 1319, 0.2, 0.07]], vol: 0.07 },
  jade: { type: "sine", notes: [[1175, 1175, 0.08], [1568, 1568, 0.18, 0.08]] },
};

export type SoundName = keyof typeof SOUNDS;

export class Sound {
  on = true;
  private ctx?: AudioContext;
  private ensure() {
    if (this.ctx) return this.ctx;
    const Ctor = typeof window !== "undefined" ? window.AudioContext : undefined;
    if (!Ctor) return undefined;
    try {
      this.ctx = new Ctor();
    } catch {
      return undefined;
    }
    return this.ctx;
  }
  play(name: keyof typeof SOUNDS) {
    if (!this.on) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const s = SOUNDS[name];
    for (const [freq, to, dur, delay = 0] of s.notes) {
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      o.type = s.type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(s.vol ?? 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }
}
