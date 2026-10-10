// Pausing preserves unfinished CPU delay. No callbacks survive restart.
export class PausableTimer {
  constructor(callback, { now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
    this.callback = callback; this.now = now; this.schedule = schedule; this.cancel = cancel;
    this.id = null; this.remaining = null; this.started = 0; this.paused = false;
  }
  start(ms) { this.clear(); this.remaining = ms; if (!this.paused) this.resume(); }
  pause() {
    this.paused = true;
    if (this.id !== null) {
      this.cancel(this.id); this.id = null; this.remaining = Math.max(0, this.remaining - (this.now() - this.started));
    }
  }
  resume() {
    this.paused = false;
    if (this.remaining === null || this.id !== null) return;
    this.started = this.now();
    this.id = this.schedule(() => { this.id = null; this.remaining = null; if (!this.paused) this.callback(); }, this.remaining);
  }
  clear() { if (this.id !== null) this.cancel(this.id); this.id = null; this.remaining = null; }
}
