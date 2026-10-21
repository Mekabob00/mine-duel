import { DurableObject } from 'cloudflare:workers';
import { makeRoom, join, connect, command, settle, snapshot, nextAlarm, PROTOCOL } from './state.js';
import { observe } from './game.js';
const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const digest = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(n => n.toString(16).padStart(2, '0')).join('');
async function readJson(req) {
  const reader = req.body?.getReader(); if (!reader) throw Error('BAD_MESSAGE');
  let size = 0, text = '', decoder = new TextDecoder();
  while (true) { const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > 4096) { await reader.cancel(); throw Error('BAD_MESSAGE'); }
    text += decoder.decode(value, { stream: true }); }
  return JSON.parse(text + decoder.decode());
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin'), origins = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim());
    if (!origin || !origins.includes(origin)) return json({ code: 'ORIGIN_DENIED' }, 403);
    const cors = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname.match(/^\/rooms\/([A-Z0-9]{10})\/(create|join|socket)$/);
    if (!path || !CODE.test(path[1])) return json({ code: 'NOT_FOUND' }, 404, cors);
    try {
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      const gate = env.GATES.get(env.GATES.idFromName(await digest(ip)));
      const allowed = await gate.fetch('https://rate/check');
      if (allowed.status !== 200) return json({ code: 'RATE_LIMITED' }, 429, cors);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(path[1]));
      const response = await stub.fetch(request);
      if (response.status === 101) return response;
      const headers = new Headers(response.headers); for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    } catch { return json({ code: 'SERVER_UNAVAILABLE' }, 503, cors); }
  }
};

export class Gate extends DurableObject {
  async fetch() {
    const now = Date.now();
    const allowed = await this.ctx.storage.transaction(async tx => {
      let b = await tx.get('bucket'); if (!b || now >= b.until) b = { n: 0, until: now + 60_000 };
      b.n++; await tx.put('bucket', b); return b.n <= 60;
    });
    await this.ctx.storage.setAlarm(now + 60_001);
    return new Response(null, { status: allowed ? 200 : 429 });
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.queue = Promise.resolve(); this.data = null;
    ctx.blockConcurrencyWhile(async () => { this.data = await ctx.storage.get('room') || null; });
  }
  serial(work) {
    const task = this.queue.then(work); this.queue = task.catch(() => {}); return task;
  }
  async save(r) {
    if (r.status === 'expired') {
      this.broadcast(r); for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'ROOM_EXPIRED');
      await this.ctx.storage.deleteAll(); this.data = null; return;
    }
    let at = nextAlarm(r, Date.now());
    for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (!a?.authenticated) at = Math.min(at, a.authUntil); }
    const previous = this.data?.game;
    const archive = previous?.result && previous.id !== r.game?.id ? previous : null;
    const removed = (this.data?.pastResults || []).filter(old => !r.pastResults?.some(g => g.id === old.id));
    await this.ctx.storage.transaction(async tx => {
      if (archive) await tx.put('result/' + archive.id, archive);
      for (const old of removed) await tx.delete('result/' + old.id);
      await tx.put('room', r); await tx.setAlarm(at);
    });
    this.data = r;
  }
  broadcast(r) {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a?.authenticated && r.seats[a.seat]?.epoch === a.epoch) {
        try { ws.send(JSON.stringify(snapshot(r, a.seat, Date.now()))); } catch { /* close handler or heartbeat detects loss */ }
      }
    }
  }
  async fetch(request) {
    return this.serial(async () => {
      const url = new URL(request.url), action = url.pathname.split('/').at(-1), code = url.pathname.split('/')[2];
      let r = this.data ? structuredClone(this.data) : null;
      if (r) { settle(r, Date.now()); if (r.status === 'expired') { await this.save(r); r = null; } }
      if (action === 'socket' && request.method === 'GET' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
        if (!r) return json({ code: 'ROOM_NOT_FOUND' }, 404);
        if (this.ctx.getWebSockets().length >= 6) return json({ code: 'TOO_MANY_CONNECTIONS' }, 429);
        await this.save(r);
        const pair = new WebSocketPair(), [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ authenticated: false, authUntil: Date.now() + 10_000 });
        await this.ctx.storage.setAlarm(Math.min(nextAlarm(r, Date.now()), Date.now() + 10_000));
        return new Response(null, { status: 101, webSocket: client });
      }
      if (request.method !== 'POST' || !['create', 'join'].includes(action)) return json({ code: 'NOT_FOUND' }, 404);
      try {
        const body = await readJson(request); if (!body || !TOKEN.test(body.token)) throw Error('BAD_MESSAGE');
        const hash = await digest(body.token); let seat;
        if (action === 'create') {
          if (r && r.seats[0].hash !== hash) throw Error('CODE_IN_USE');
          if (!r) r = makeRoom(code, hash, Date.now()); seat = 0;
        } else { if (!r) throw Error('ROOM_NOT_FOUND'); seat = join(r, hash, Date.now()); }
        await this.save(r); this.broadcast(r);
        return json({ code, seat, protocol: PROTOCOL });
      } catch (e) { return json({ code: ['CODE_IN_USE', 'ROOM_FULL', 'ROOM_NOT_FOUND'].includes(e.message) ? e.message : 'BAD_MESSAGE' }, 400); }
    });
  }
  async webSocketMessage(ws, raw) {
    return this.serial(async () => {
      let a = ws.deserializeAttachment();
      try {
        if (a?.authenticated) {
          const now = Date.now();
          if (now - a.windowAt >= 1000) { a.windowAt = now; a.messages = 0; }
          if (++a.messages > 12) throw Error('RATE_LIMITED');
          ws.serializeAttachment(a);
        }
        if (typeof raw !== 'string' || raw.length > 4096) throw Error('BAD_MESSAGE');
        const msg = JSON.parse(raw); if (!msg || typeof msg !== 'object' || Array.isArray(msg)) throw Error('BAD_MESSAGE');
        let r = this.data && structuredClone(this.data); if (!r) throw Error('ROOM_NOT_FOUND');
        const now = Date.now(); settle(r, now);
        if (r.status === 'expired') { await this.save(r); return; }
        if (!a.authenticated) {
          if (msg.type !== 'auth' || msg.protocol !== PROTOCOL || now >= a.authUntil || !TOKEN.test(msg.token)) throw Error('AUTH_FAILED');
          const hash = await digest(msg.token), seat = r.seats.findIndex(s => s?.hash === hash); if (seat < 0) throw Error('AUTH_FAILED');
          const epoch = connect(r, seat, now);
          a = { authenticated: true, seat, epoch, windowAt: now, messages: 0 };
          // Persist auth state first; no hidden snapshot is sent before authentication succeeds.
          await this.save(r); ws.serializeAttachment(a);
          for (const old of this.ctx.getWebSockets()) if (old !== ws && old.deserializeAttachment()?.seat === seat) old.close(4001, 'REPLACED');
          this.broadcast(r); return;
        }
        if (r.seats[a.seat].epoch !== a.epoch) throw Error('REPLACED');
        if (r.status === 'playing' && r.seats[a.seat].disconnectedAt !== null) throw Error('RECONNECT_REQUIRED');
        r.seats[a.seat].lastSeen = now;
        let reply;
        if (msg.type === 'history') {
          const ref = r.pastResults?.find(g => g.id === msg.gameId);
          const old = ref ? await this.ctx.storage.get('result/' + ref.id) : null;
          reply = { type: 'history', gameId: msg.gameId, game: old ? observe(old, a.seat) : null };
        } else if (msg.type === 'ping' || msg.type === 'sync') reply = { type: 'pong', serverNow: now };
        else reply = { type: 'ack', requestId: msg.requestId, seq: msg.seq, ...command(r, a.seat, msg, now) };
        await this.save(r); ws.send(JSON.stringify(reply)); this.broadcast(r);
      } catch (e) {
        const code = ['AUTH_FAILED', 'REPLACED', 'RATE_LIMITED', 'RECONNECT_REQUIRED', 'RECONNECT_EXPIRED', 'ROOM_NOT_FOUND'].includes(e.message) ? e.message : 'BAD_MESSAGE';
        try { ws.send(JSON.stringify({ type: 'error', code })); } catch {}
        if (!a?.authenticated || ['REPLACED', 'RATE_LIMITED', 'RECONNECT_REQUIRED', 'RECONNECT_EXPIRED'].includes(code)) ws.close(4003, code);
      }
    });
  }
  async webSocketClose(ws) { return this.disconnect(ws); }
  async webSocketError(ws) { return this.disconnect(ws); }
  async disconnect(ws) {
    return this.serial(async () => {
      const a = ws.deserializeAttachment(); if (!a?.authenticated || !this.data) return;
      const r = structuredClone(this.data), s = r.seats[a.seat]; if (s.epoch !== a.epoch || s.disconnectedAt !== null) return;
      const now = Date.now(); settle(r, now); if (s.disconnectedAt === null) s.disconnectedAt = now; r.revision++;
      await this.save(r); this.broadcast(r);
    });
  }
  async alarm() {
    return this.serial(async () => {
      if (!this.data) return;
      const r = structuredClone(this.data), now = Date.now(); settle(r, now);
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment();
        if (!a?.authenticated && now >= a.authUntil) ws.close(4003, 'AUTH_TIMEOUT');
        else if (a?.authenticated && r.seats[a.seat]?.disconnectedAt !== null) ws.close(4000, 'HEARTBEAT_TIMEOUT');
      }
      await this.save(r); this.broadcast(r);
    });
  }
}
