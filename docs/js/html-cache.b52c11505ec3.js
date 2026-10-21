import { VERSION } from './config.13ca0e62b8fe.js';

// A versioned navigation does not replace an older, fresh entry for the bare URL.
// Refresh that entry only after landing on this exact release's update URL.
// This cannot run in legacy HTML that never loads the new script, nor evict BFCache.
export class BaseHtmlCacheRefresher {
  constructor({ current = VERSION, href = globalThis.location?.href,
    projectBase = new URL('../', import.meta.url), fetcher = (...args) => globalThis.fetch(...args),
    online = () => globalThis.navigator?.onLine !== false, timeout = 5000 } = {}) {
    this.current = current; this.href = href; this.projectBase = projectBase;
    this.fetcher = fetcher; this.online = online; this.timeout = timeout; this.attempted = false;
  }
  async refresh() {
    if (this.attempted || !this.online()) return false;
    let target;
    try {
      const page = new URL(this.href), base = new URL(this.projectBase);
      if (!/^https?:$/.test(base.protocol) || page.origin !== base.origin
        || ![base.pathname, base.pathname + 'index.html'].includes(page.pathname)
        || page.searchParams.get('v') !== this.current) return false;
      target = new URL(base); target.search = ''; target.hash = '';
    } catch { return false; }
    this.attempted = true;
    const controller = new AbortController(), timer = globalThis.setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetcher(target.href, { cache: 'reload', mode: 'same-origin', redirect: 'error', signal: controller.signal });
      if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('text/html')) return false;
      await response.arrayBuffer(); // Consume the response before reporting the cache refresh complete.
      return true;
    } catch { return false; }
    finally { globalThis.clearTimeout(timer); }
  }
}
