import { ONLINE_ENDPOINT, ONLINE_PROTOCOL } from './online-config.5fb59807297b.js';
const KEY = 'mineDuel.online.session.v1';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function credential() { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function roomCode() { return [...crypto.getRandomValues(new Uint8Array(10))].map(n => alphabet[n & 31]).join(''); }
export class OnlineClient {
  constructor(onChange, { endpoint = ONLINE_ENDPOINT || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://127.0.0.1:8787' : '') } = {}) {
    this.onChange = onChange; this.endpoint = endpoint.replace(/\/$/, ''); this.state = null; this.socket = null;
    this.session = null; this.pending = null; this.status = 'disconnected'; this.error = ''; this.attempt = 0; this.generation = 0;
    try { const raw = localStorage.getItem(KEY); const saved = raw && JSON.parse(raw);
      if (saved?.endpoint === this.endpoint && /^[A-Z2-9]{10}$/.test(saved.code) && /^[\w-]{43}$/.test(saved.token)) { this.session = saved; this.pending = saved.pending || null; }
      localStorage.setItem(KEY + '.test', '1'); localStorage.removeItem(KEY + '.test'); this.storage = true;
    } catch { this.storage = false; }
    addEventListener('online', () => { if (this.session && !this.stopped) this.connect(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) {
      if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'sync' }));
      else if (this.session && !this.stopped) this.connect();
    } });
  }
  notify() { this.onChange(this); }
  save() { if (!this.storage) throw Error('STORAGE_REQUIRED'); localStorage.setItem(KEY, JSON.stringify({ ...this.session, pending: this.pending })); }
  async enter(kind, code) {
    if (!this.endpoint) throw Error('NOT_CONFIGURED');
    const url = new URL(this.endpoint); if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('NOT_CONFIGURED');
    if (!this.storage) throw Error('STORAGE_REQUIRED');
    this.stop(); this.state = null; this.pending = null; this.error = '';
    this.session = { endpoint: this.endpoint, code: kind === 'create' ? roomCode() : code.toUpperCase().trim(), token: credential(), bootstrap: kind };
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(this.session.code)) throw Error('BAD_CODE');
    this.save(); await this.bootstrap();
  }
  async bootstrap() {
    const s = this.session; if (!s.bootstrap) { this.connect(); return; }
    this.status = 'connecting'; this.notify();
    const response = await fetch(`${this.endpoint}/rooms/${s.code}/${s.bootstrap}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s.token }), signal: AbortSignal.timeout(10000) });
    const result = await response.json(); if (!response.ok) throw Error(result.code || 'SERVER_UNAVAILABLE');
    if (this.session !== s) return;
    delete s.bootstrap; this.save(); this.connect();
  }
  connect() {
    if (!this.session || !navigator.onLine) return;
    this.stopped = false; clearTimeout(this.retry); clearInterval(this.heartbeat);
    const generation = ++this.generation; this.socket?.close();
    const url = new URL(`${this.endpoint}/rooms/${this.session.code}/socket`); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = this.socket = new WebSocket(url); this.status = 'connecting'; this.notify(); let authenticated = false;
    ws.onopen = () => { if (generation === this.generation) ws.send(JSON.stringify({ type: 'auth', protocol: ONLINE_PROTOCOL, token: this.session.token })); };
    ws.onmessage = event => {
      if (generation !== this.generation) return;
      let m; try { m = JSON.parse(event.data); } catch { return; }
      if (m.type === 'snapshot') {
        if (m.protocol !== ONLINE_PROTOCOL) { this.error = 'UNSUPPORTED_PROTOCOL'; this.stop(); this.notify(); return; }
        if (this.state && m.revision < this.state.revision) return;
        this.state = m; this.offset = m.serverNow - Date.now(); this.status = 'connected'; this.attempt = 0;
        if (!authenticated) {
          authenticated = true;
          if (this.pending) ws.send(JSON.stringify(this.pending));
          this.heartbeat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 10000);
        }
      } else if (m.type === 'ack' && m.requestId === this.pending?.requestId) {
        this.pending = null; this.error = m.accepted ? '' : m.code;
        try { this.save(); } catch { this.storage = false; this.error = 'STORAGE_REQUIRED'; }
      } else if (m.type === 'error') { this.error = m.code; if (['AUTH_FAILED', 'RECONNECT_EXPIRED', 'ROOM_NOT_FOUND', 'REPLACED'].includes(m.code)) this.stop(); }
      this.notify();
    };
    ws.onclose = event => {
      if (generation !== this.generation) return;
      clearInterval(this.heartbeat); this.status = 'disconnected';
      if (event.code === 4001) { this.stopped = true; this.error = 'REPLACED'; }
      if (event.reason === 'ROOM_EXPIRED') { this.stopped = true; this.error = 'ROOM_EXPIRED'; }
      this.notify();
      if (!this.stopped) this.retry = setTimeout(() => this.connect(), Math.min(15000, 500 * 2 ** Math.min(this.attempt++, 5)) + Math.random() * 250);
    };
    ws.onerror = () => { this.error = 'SERVER_UNAVAILABLE'; this.notify(); };
  }
  send(type, kind, index) {
    if (!this.storage) { this.error = 'STORAGE_REQUIRED'; this.notify(); return; }
    if (!this.state || this.pending || this.status !== 'connected' || this.socket?.readyState !== WebSocket.OPEN) return;
    this.pending = { type, kind, index, gameId: this.state.game?.id ?? null, turnId: this.state.game?.turnId,
      revision: this.state.revision, requestId: crypto.randomUUID(), seq: this.state.seq + 1 };
    try { this.save(); } catch { this.pending = null; this.storage = false; this.error = 'STORAGE_REQUIRED'; this.notify(); return; }
    this.socket.send(JSON.stringify(this.pending)); this.notify();
  }
  stop() { this.stopped = true; this.generation++; clearTimeout(this.retry); clearInterval(this.heartbeat); this.socket?.close(); this.status = 'disconnected'; }
  forget() { this.stop(); this.session = null; this.state = null; this.pending = null; localStorage.removeItem(KEY); this.notify(); }
}
