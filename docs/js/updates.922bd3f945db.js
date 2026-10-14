import { VERSION } from './config.fa174e62088a.js';

// No worker/cache dependency. Failure to check a release must never interrupt a game.
export class UpdateChecker {
  constructor(onUpdate, { fetcher = (...args) => globalThis.fetch(...args), current = VERSION, base = globalThis.location?.href, timeout = 5000 } = {}) {
    this.onUpdate = onUpdate; this.fetcher = fetcher; this.current = current; this.base = base; this.timeout = timeout;
    this.busy = false; this.dismissed = new Set();
  }
  dismiss(version) { this.dismissed.add(version); }
  async check() {
    if (this.busy) return;
    this.busy = true;
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), this.timeout);
    try {
      const url = new URL('./version.json', this.base); url.searchParams.set('check', Date.now());
      const response = await this.fetcher(url.href, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return;
      const { version } = await response.json();
      if (typeof version === 'string' && /^\d+\.\d+\.\d+-web$/.test(version) && version !== this.current && !this.dismissed.has(version)) this.onUpdate(version);
    } catch { /* Offline, timeouts and invalid release data leave gameplay intact. */ }
    finally { globalThis.clearTimeout(timer); this.busy = false; }
  }
}
