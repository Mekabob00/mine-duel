// Pausing preserves unfinished CPU delay. No callbacks survive restart.
export class PausableTimer {
  constructor(callback, { now = () => performance.now(), schedule = (cb, ms) => globalThis.setTimeout(cb, ms), cancel = id => globalThis.clearTimeout(id) } = {}) {
    this.callback = callback; this.now = now; this.schedule = schedule; this.cancel = cancel;
    this.id = null; this.remaining = null; this.started = 0; this.paused = false; this.generation = 0;
  }
  start(ms) { this.clear(); this.remaining = ms; if (!this.paused) this.resume(); }
  pause() {
    this.generation++;
    this.paused = true;
    if (this.id !== null) {
      this.cancel(this.id); this.id = null; this.remaining = Math.max(0, this.remaining - (this.now() - this.started));
    }
  }
  resume() {
    this.paused = false;
    if (this.remaining === null || this.id !== null) return;
    this.started = this.now();
    const generation = ++this.generation;
    this.id = this.schedule(() => { if (generation !== this.generation) return; this.id = null; this.remaining = null; if (!this.paused) this.callback(); }, this.remaining);
  }
  clear() { this.generation++; if (this.id !== null) this.cancel(this.id); this.id = null; this.remaining = null; }
}
