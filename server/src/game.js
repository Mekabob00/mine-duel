// Server-only state. Local Game and CPU rules are deliberately not modified.
import { Board, neighbors } from '../../web/js/board.js';
export const TURN_MS = 20_000, GRACE_MS = 120_000, DAY_MS = 86_400_000;
export function randomInt(n) {
  if (!Number.isInteger(n) || n < 1) throw Error('NO_CANDIDATE');
  const limit = Math.floor(0x100000000 / n) * n; let x;
  do { x = crypto.getRandomValues(new Uint32Array(1))[0]; } while (x >= limit);
  return x % n;
}
export function newGame(first, now, id = crypto.randomUUID()) {
  return { id, startedAt: now, first, current: first, phase: 'opening-reveal', openingStep: 0,
    turn: 1, turnId: 1, deadline: now + TURN_MS, markersUsed: 0,
    cells: new Board(8, 8).cells, counts: [0, 0], result: null, endedAt: null };
}
const bit = seat => 1 << seat;
const owns = (c, seat) => Boolean(c.owners & bit(seat));
export function finish(g, reason, winner, now, extra = {}) {
  if (g.result) return;
  g.result = { reason, winner, ...extra, record: resultRecord(g, now) }; g.phase = 'finished'; g.deadline = null; g.endedAt = now;
}
// Legacy games have no reliable start timestamp: never invent their duration.
export function resultRecord(g, endedAt = g.endedAt) {
  return { turns: g.openingStep >= 4 ? g.turn : 0,
    durationMs: Number.isFinite(g.startedAt) && Number.isFinite(endedAt) ? Math.max(0, endedAt - g.startedAt) : null };
}
export function score(g, seat) {
  let correct = 0, incorrect = 0;
  for (const c of g.cells) if (c.marker === seat) {
    if (owns(c, 1 - seat)) correct++; else incorrect++;
  }
  return { correct, incorrect, score: correct - incorrect };
}
export function checkProgress(g, now) {
  if (g.result || g.cells.some(c => !c.revealed && c.marker === null && c.owners === 0)) return;
  const scores = [score(g, 0), score(g, 1)];
  finish(g, 'noSafeCells', scores[0].score === scores[1].score ? null : scores[0].score > scores[1].score ? 0 : 1, now, { scores });
}
function next(g, now) {
  g.current = 1 - g.current; g.phase = 'explore'; g.markersUsed = 0;
  g.turn++; g.turnId++; g.deadline = now + TURN_MS;
}
function openingNext(g, now) {
  g.openingStep++; g.turnId++; g.markersUsed = 0;
  if (g.openingStep === 4) { g.current = g.first; g.phase = 'explore'; }
  else { g.current = g.openingStep % 2 ? 1 - g.first : g.first; g.phase = g.openingStep < 2 ? 'opening-reveal' : 'opening-mine'; }
  g.deadline = now + TURN_MS;
}
function refresh(g) {
  g.cells.forEach((c, i) => { c.number = neighbors(i, 8, 8).filter(j => g.cells[j].owners !== 0).length; });
}
export function applyAction(g, seat, kind, index, now) {
  if (g.result || seat !== g.current) return 'NOT_YOUR_TURN';
  const normal = ['explore', 'place-mine', 'end-turn'].includes(g.phase);
  const c = Number.isInteger(index) && index >= 0 && index < 64 ? g.cells[index] : null;
  if (kind === 'end') {
    if (g.phase !== 'end-turn') return 'INVALID_END';
    next(g, now);
  } else if (kind === 'explore') {
    if (!['explore', 'opening-reveal'].includes(g.phase) || !c || c.revealed || c.marker !== null || owns(c, seat)) return 'INVALID_EXPLORE';
    if (c.owners) { finish(g, 'mineHit', 1 - seat, now, { exploded: index }); return null; }
    c.revealed = true; c.revealedBy = seat;
    if (g.phase === 'opening-reveal') openingNext(g, now); else g.phase = 'place-mine';
  } else if (kind === 'mine') {
    if (!['place-mine', 'opening-mine'].includes(g.phase) || !c || c.revealed || c.marker !== null || owns(c, seat)) return 'INVALID_MINE';
    c.owners |= bit(seat); g.counts[seat]++; refresh(g);
    if (g.phase === 'opening-mine') openingNext(g, now); else g.phase = 'end-turn';
  } else if (kind === 'marker') {
    if (!normal || !c || c.revealed || c.marker !== null || g.markersUsed >= 1) return 'INVALID_MARKER';
    c.marker = seat; g.markersUsed++;
  } else if (kind === 'remove') {
    if (!normal || !c || c.marker !== seat) return 'INVALID_REMOVAL';
    c.marker = null;
  } else return 'INVALID_ACTION';
  checkProgress(g, now); return null;
}
export function timeout(g, at, rng = randomInt) {
  if (g.result || g.deadline > at) return false;
  const boundary = g.deadline;
  if (g.phase.startsWith('opening-')) {
    const reveal = g.phase === 'opening-reveal';
    const candidates = g.cells.flatMap((c, i) => !c.revealed && c.marker === null && (reveal ? !c.owners : !owns(c, g.current)) ? [i] : []);
    if (!candidates.length) { checkProgress(g, boundary); return false; }
    applyAction(g, g.current, reveal ? 'explore' : 'mine', candidates[rng(candidates.length)], boundary);
  } else { next(g, boundary); checkProgress(g, boundary); }
  return true;
}
export function observe(g, seat) {
  if (!g) return null;
  const ended = Boolean(g.result);
  return { id: g.id, first: g.first, current: g.current, phase: g.phase, turn: g.turn,
    turnId: g.turnId, deadline: g.deadline, markersUsed: g.markersUsed, counts: [...g.counts], result: ended ? { ...structuredClone(g.result), record: g.result.record || resultRecord(g) } : null,
    cells: g.cells.map(c => ({ revealed: c.revealed, revealedBy: c.revealedBy, number: c.revealed ? c.number : -1,
      ownMine: owns(c, seat), marker: c.marker,
      ...(ended ? { owners: c.owners, markerCorrect: c.marker === null ? null : owns(c, 1 - c.marker) } : {}) })) };
}
