import { newGame, finish, timeout, applyAction, observe, GRACE_MS, DAY_MS, randomInt } from './game.js';
export const PROTOCOL = 1, RULESET = 'pvp-1', LIVENESS_MS = 30_000;
export const makeRoom = (code, hash, now) => ({ schema: 1, code, createdAt: now, revision: 0, status: 'waiting',
  seats: [makeSeat(hash, now), null], game: null, pastResults: [] });
const makeSeat = (hash, now) => ({ hash, ready: false, rematch: false, epoch: 0, lastSeen: now,
  disconnectedAt: now, seq: 0, replies: [] });
export function join(r, hash, now) {
  const existing = r.seats.findIndex(s => s?.hash === hash);
  if (existing >= 0) return existing;
  if (r.status !== 'waiting' || r.seats[1]) throw Error('ROOM_FULL');
  r.seats[1] = makeSeat(hash, now); r.revision++; return 1;
}
export function start(r, now, rng = randomInt) {
  const first = r.game ? 1 - r.game.first : rng(2);
  r.pastResults ||= [];
  if (r.game?.result) r.pastResults.push({ id: r.game.id, until: r.game.endedAt + DAY_MS });
  r.game = newGame(first, now); r.status = 'playing';
  for (const s of r.seats) { s.ready = false; s.rematch = false; }
}
export function settle(r, now, rng = randomInt) {
  if (r.status === 'expired') return false;
  let changed = false;
  const kept = (r.pastResults || []).filter(g => now < g.until);
  if (kept.length !== (r.pastResults || []).length) changed = true;
  r.pastResults = kept;
  for (const s of r.seats) if (s && s.disconnectedAt === null && now >= s.lastSeen + LIVENESS_MS) {
    s.disconnectedAt = s.lastSeen + LIVENESS_MS; changed = true;
  }
  if ((r.status === 'waiting' && now >= r.createdAt + DAY_MS) || (r.status === 'finished' && now >= r.game.endedAt + DAY_MS)) {
    r.status = 'expired'; return true;
  }
  if (r.status === 'playing') {
    // Process the earliest deadline first, never retroactively undo an already-final KO.
    // If both are absent, wait for both grace periods before voiding the match.
    let steps = 0;
    while (!r.game.result && steps++ < 500) {
      const absent = r.seats.map((s, i) => ({ i, at: s.disconnectedAt })).filter(s => s.at !== null);
      const disconnectAt = absent.length === 2 ? Math.max(...absent.map(s => s.at + GRACE_MS)) : absent.length ? absent[0].at + GRACE_MS : Infinity;
      const eventAt = Math.min(disconnectAt, r.game.deadline);
      if (eventAt > now) break;
      if (disconnectAt <= r.game.deadline) {
        finish(r.game, absent.length === 2 ? 'bothDisconnected' : 'disconnectLoss', absent.length === 2 ? null : 1 - absent[0].i, eventAt);
      } else timeout(r.game, eventAt, rng);
      changed = true;
    }
    if (r.game.result) r.status = 'finished';
    if (r.status === 'finished' && now >= r.game.endedAt + DAY_MS) r.status = 'expired';
  }
  if (changed) r.revision++;
  return changed;
}
export function connect(r, seat, now) {
  // Settle before granting a reconnect. A late reconnect must never rescue an expired seat.
  settle(r, now);
  const s = r.seats[seat];
  if (r.status === 'playing' && s.disconnectedAt !== null && now >= s.disconnectedAt + GRACE_MS) throw Error('RECONNECT_EXPIRED');
  s.epoch++; s.lastSeen = now; s.disconnectedAt = null;
  if (r.seats.every(p => p && p.disconnectedAt === null)) {
    if (r.status === 'waiting' && r.seats.every(p => p.ready)) start(r, now);
    else if (r.status === 'finished' && r.seats.every(p => p.rematch) && r.pastResults.length < 1000) start(r, now);
  }
  r.revision++; return s.epoch;
}
export function command(r, seat, msg, now, rng = randomInt) {
  const s = r.seats[seat];
  if (!Number.isSafeInteger(msg.seq) || msg.seq < 1 || typeof msg.requestId !== 'string' || !/^[\w-]{1,80}$/.test(msg.requestId)) return { accepted: false, code: 'BAD_MESSAGE' };
  const signature = JSON.stringify([msg.type, msg.gameId, msg.turnId, msg.revision, msg.kind, msg.index]);
  const cached = s.replies.find(x => x.id === msg.requestId);
  if (cached) return cached.signature === signature && cached.seq === msg.seq ? cached.reply : { accepted: false, code: 'REQUEST_CONFLICT' };
  if (msg.seq <= s.seq) return { accepted: false, code: 'STALE_REQUEST' };
  settle(r, now, rng);
  let code = null;
  if (msg.seq !== s.seq + 1) return { accepted: false, code: 'SEQUENCE_GAP' };
  if (msg.gameId !== (r.game?.id ?? null)) code = 'STALE_GAME';
  else if (msg.revision !== r.revision) code = 'STALE_STATE';
  else if (msg.type === 'ready' && r.status === 'waiting') {
    s.ready = true;
    if (r.seats.every(p => p && p.ready && p.disconnectedAt === null)) start(r, now, rng);
  } else if (msg.type === 'rematch' && r.status === 'finished') {
    if ((r.pastResults || []).length >= 1000) code = 'ROOM_LIMIT';
    else { s.rematch = true;
      if (r.seats.every(p => p.rematch && p.disconnectedAt === null)) start(r, now, rng);
    }
  } else if (msg.type === 'resign' && r.status === 'playing') {
    finish(r.game, 'resigned', 1 - seat, now); r.status = 'finished';
  } else if (msg.type === 'action' && r.status === 'playing') {
    if (msg.turnId !== r.game.turnId) code = 'STALE_TURN';
    else code = applyAction(r.game, seat, msg.kind, msg.index, now);
    if (r.game.result) r.status = 'finished';
  } else code = 'INVALID_STATE';
  s.seq = msg.seq; r.revision++;
  const reply = { type: 'ack', requestId: msg.requestId, seq: msg.seq, accepted: !code, code, revision: r.revision };
  s.replies.push({ id: msg.requestId, seq: msg.seq, signature, reply });
  if (s.replies.length > 64) s.replies.shift();
  return reply;
}
export function snapshot(r, seat, now) {
  return { type: 'snapshot', protocol: PROTOCOL, ruleset: RULESET, code: r.code, status: r.status,
    revision: r.revision, seat, serverNow: now, seq: r.seats[seat].seq,
    seats: r.seats.map(s => s ? { ready: s.ready, rematch: s.rematch, connected: s.disconnectedAt === null,
      reconnectUntil: s.disconnectedAt === null ? null : s.disconnectedAt + GRACE_MS } : null),
    game: observe(r.game, seat) };
}
export function nextAlarm(r, now) {
  const dates = [];
  for (const result of r.pastResults || []) dates.push(result.until);
  if (r.status === 'waiting') dates.push(r.createdAt + DAY_MS);
  if (r.status === 'finished') dates.push(r.game.endedAt + DAY_MS);
  if (r.status === 'playing') {
    dates.push(r.game.deadline);
    const gone = r.seats.filter(s => s.disconnectedAt !== null);
    if (gone.length) dates.push(gone.length === 2 ? Math.max(...gone.map(s => s.disconnectedAt + GRACE_MS)) : gone[0].disconnectedAt + GRACE_MS);
  }
  for (const s of r.seats) if (s?.disconnectedAt === null) dates.push(s.lastSeen + LIVENESS_MS);
  return Math.max(now + 1, Math.min(...dates));
}
