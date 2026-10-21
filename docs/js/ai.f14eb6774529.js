import { neighbors } from './board.ae7529dbc73a.js';
import { PHASE, SIDE, MINE_STRATEGIES } from './config.13ca0e62b8fe.js';

const pick = (items, rng) => items.length ? items[Math.floor(rng() * items.length)] : -1;
export class CpuBrain {
  constructor(mistakeChance = 0.20, random = Math.random, mistakeRandom = Math.random) {
    this.chance = mistakeChance; this.random = random; this.mistakeRandom = mistakeRandom;
  }
  deduce(board) {
    const safe = new Set(), dangerous = new Set();
    board.cells.forEach((c, i) => { if (c.ownMine) dangerous.add(i); });
    let changed;
    do {
      changed = false;
      board.cells.forEach((c, i) => {
        if (!c.revealed) return;
        let known = 0; const unknown = [];
        for (const n of neighbors(i, board.width, board.height)) {
          if (dangerous.has(n)) known++;
          else if (!board.cells[n].revealed && !safe.has(n)) unknown.push(n);
        }
        const remaining = c.number - known;
        if (remaining < 0 || remaining > unknown.length) throw new Error('inferenceContradiction');
        const destination = remaining === 0 ? safe : remaining === unknown.length ? dangerous : null;
        if (destination) for (const n of unknown) if (!destination.has(n)) { destination.add(n); changed = true; }
      });
    } while (changed);
    return { safe, dangerous };
  }
  chooseExplore(board) {
    const { safe, dangerous } = this.deduce(board);
    for (const index of safe) if (dangerous.has(index)) throw new Error('inferenceContradiction');
    const all = board.cells.flatMap((c, i) => !c.revealed && !c.ownMine && !c.marker ? [i] : []);
    const candidates = all.filter(i => !dangerous.has(i));
    if (board.phase === PHASE.EXPLORE && this.mistakeRandom() < this.chance) {
      const uncertain = candidates.filter(i => !safe.has(i));
      if (uncertain.length) return pick(uncertain, this.mistakeRandom);
    }
    const certain = candidates.filter(i => safe.has(i));
    return pick(certain.length ? certain : candidates.length ? candidates : all, this.random);
  }
  mineProposals(board) {
    // Only own mines are excluded. Enemy-only mines are invisible and eligible.
    const all = board.cells.flatMap((c, i) => !c.revealed && !c.ownMine && !c.marker ? [i] : []);
    const roll = this.random();
    let preferred = all;
    if (roll >= MINE_STRATEGIES.random && roll < MINE_STRATEGIES.random + MINE_STRATEGIES.recent) {
      const near = new Set(neighbors(board.lastPlayerReveal, board.width, board.height));
      preferred = board.lastPlayerReveal >= 0 ? all.filter(i => near.has(i)) : [];
    } else if (roll >= MINE_STRATEGIES.random + MINE_STRATEGIES.recent) {
      const near = new Set(board.cells.flatMap((c, i) => c.revealed ? neighbors(i, board.width, board.height) : []));
      preferred = all.filter(i => near.has(i));
    }
    const first = pick(preferred.length ? preferred : all, this.random);
    if (first < 0) return [];
    const rest = all.filter(i => i !== first);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [first, ...rest];
  }
  chooseMarker(board, chance) {
    if (board.markersUsed >= board.markerLimit || this.random() >= chance) return -1;
    const { dangerous } = this.deduce(board);
    return pick([...dangerous].filter(i => !board.cells[i].ownMine && !board.cells[i].revealed && !board.cells[i].marker), this.random);
  }
  ownMarkerToRemove(board) { return board.cells.findIndex(c => c.marker === board.viewer && !c.ownMine); }
}

// System arbitration is separate from decision making. No hidden board goes to AI.
export function cpuStep(game, brain) {
  if (game.current !== SIDE.CPU || game.phase === PHASE.FINISHED) return { ok: false, message: '' };
  const board = game.observe(SIDE.CPU);
  if ([PHASE.OPEN_REVEAL, PHASE.EXPLORE].includes(game.phase)) {
    const target = brain.chooseExplore(board);
    if (target >= 0) {
      // Forced-mine position: use the remaining marker allowance before exploring.
      // This recovery is deterministic; the end-turn marker probability is separate.
      if (game.phase === PHASE.EXPLORE && board.markersUsed < board.markerLimit && brain.deduce(board).dangerous.has(target))
        return game.addMarker(SIDE.CPU, target);
      return game.explore(SIDE.CPU, target);
    }
    const marker = brain.ownMarkerToRemove(board);
    if (marker >= 0) return game.removeMarker(SIDE.CPU, marker);
    return { ok: false, message: 'invalidExplore' };
  }
  if ([PHASE.OPEN_MINE, PHASE.MINE].includes(game.phase)) {
    for (const target of brain.mineProposals(board)) {
      const reply = game.placeMine(SIDE.CPU, target);
      if (reply.ok) return { ...reply, message: 'cpuMinePlaced' };
    }
    const marker = brain.ownMarkerToRemove(board);
    if (marker >= 0) return game.removeMarker(SIDE.CPU, marker);
  }
  if (game.phase === PHASE.END) {
    const marker = brain.chooseMarker(board, game.settings.cpuMarkerChance);
    if (marker >= 0) game.addMarker(SIDE.CPU, marker);
    if (game.phase !== PHASE.FINISHED) return game.endTurn(SIDE.CPU);
  }
  return { ok: true, message: game.reason };
}
