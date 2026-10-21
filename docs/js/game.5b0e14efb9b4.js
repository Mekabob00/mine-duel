import { Board } from './board.cb9754db8256.js';
import { DEFAULTS, SIDE, PHASE } from './config.f0f84e1873a9.js';

export class Game {
  #board; #config; #counts = [0, 0]; #opening = [0, 0]; #placed = 0;
  #current = SIDE.PLAYER; #phase = PHASE.OPEN_REVEAL; #turn = 1; #markersUsed = 0;
  #lastPlayerReveal = -1; #exploded = -1; #result = null; #reason = '';
  constructor(settings = {}) {
    this.#config = Object.freeze({ ...DEFAULTS, ...settings });
    const c = this.#config;
    if (![c.width, c.height, c.initialMines, c.minesPerTurn, c.markersPerTurn].every(Number.isInteger)
      || c.width < 2 || c.height < 2 || c.width > 16 || c.height > 16 || c.initialMines < 0 || c.minesPerTurn < 1 || c.markersPerTurn < 0) throw new Error('invalidSettings');
    this.#board = new Board(c.width, c.height);
  }
  get current() { return this.#current; } get phase() { return this.#phase; }
  get turn() { return this.#turn; } get result() { return this.#result; }
  get reason() { return this.#reason; } get settings() { return this.#config; }
  #index(side) { return side === SIDE.PLAYER ? 0 : 1; }
  #active(side) { return (side === SIDE.PLAYER || side === SIDE.CPU) && side === this.#current && this.#phase !== PHASE.FINISHED; }
  #normal() { return [PHASE.EXPLORE, PHASE.MINE, PHASE.END].includes(this.#phase); }
  #cell(index) { return Number.isInteger(index) ? this.#board.cells[index] : null; }
  #canMine(cell, side) { return !this.#board.owns(cell, side); }
  #reply(ok, message) { return { ok, message }; }
  #finish(result, reason) { this.#result = result; this.#reason = reason; this.#phase = PHASE.FINISHED; }
  explore(side, index) {
    const c = this.#cell(index);
    if (!this.#active(side) || ![PHASE.EXPLORE, PHASE.OPEN_REVEAL].includes(this.#phase) || !c || c.revealed || c.marker || this.#board.owns(c, side))
      return this.#reply(false, 'invalidExplore');
    if (c.owners) {
      this.#exploded = index;
      this.#finish(side === SIDE.PLAYER ? 'loss' : 'win', side === SIDE.PLAYER ? 'playerHit' : 'cpuHit');
      return this.#reply(true, this.#reason);
    }
    c.revealed = true; c.revealedBy = side;
    if (side === SIDE.PLAYER) this.#lastPlayerReveal = index;
    if (this.#phase === PHASE.OPEN_REVEAL) {
      if (side === SIDE.PLAYER) this.#current = SIDE.CPU;
      else { this.#current = SIDE.PLAYER; this.#phase = this.#config.initialMines ? PHASE.OPEN_MINE : PHASE.EXPLORE; }
    } else this.#phase = PHASE.MINE;
    this.#checkProgress();
    return this.#reply(true, 'safe');
  }
  placeMine(side, index) {
    const c = this.#cell(index);
    if (!this.#active(side) || ![PHASE.MINE, PHASE.OPEN_MINE].includes(this.#phase) || !c || c.revealed || c.marker || !this.#canMine(c, side))
      return this.#reply(false, 'invalidMine');
    this.#board.addMine(c, side); this.#counts[this.#index(side)]++;
    this.#board.refreshNumbers();
    if (this.#phase === PHASE.OPEN_MINE) {
      this.#opening[this.#index(side)]++;
      if (this.#opening.every(n => n >= this.#config.initialMines)) { this.#current = SIDE.PLAYER; this.#phase = PHASE.EXPLORE; }
      else this.#current = side === SIDE.PLAYER ? SIDE.CPU : SIDE.PLAYER;
    } else if (++this.#placed >= this.#config.minesPerTurn) this.#phase = PHASE.END;
    this.#checkProgress();
    return this.#reply(true, 'minePlaced');
  }
  addMarker(side, index) {
    const c = this.#cell(index);
    if (!this.#active(side) || !this.#normal() || !c || c.revealed || c.marker || this.#markersUsed >= this.#config.markersPerTurn)
      return this.#reply(false, 'invalidMarker');
    c.marker = side; this.#markersUsed++; this.#checkProgress();
    return this.#reply(true, 'markerPlaced');
  }
  removeMarker(side, index) {
    const c = this.#cell(index);
    if (!this.#active(side) || !this.#normal() || !c || c.marker !== side) return this.#reply(false, 'invalidRemoval');
    c.marker = null; this.#checkProgress();
    return this.#reply(true, 'markerRemoved');
  }
  endTurn(side) {
    if (!this.#active(side) || this.#phase !== PHASE.END) return this.#reply(false, 'invalidEnd');
    this.#current = side === SIDE.PLAYER ? SIDE.CPU : SIDE.PLAYER;
    this.#phase = PHASE.EXPLORE; this.#markersUsed = 0; this.#placed = 0; this.#turn++;
    this.#checkProgress();
    return this.#reply(true, this.#current === SIDE.CPU ? 'thinking' : 'yourMove');
  }
  #checkProgress() {
    if (this.#phase === PHASE.FINISHED) return;
    const hidden = this.#board.cells.filter(c => !c.revealed);
    if (!hidden.some(c => !c.marker)) return this.#finish('draw', 'noExplore');
    if (this.#phase === PHASE.EXPLORE) {
      const { candidates, removableMarkers } = this.explorationOptions(this.#current);
      if (!candidates.length && !removableMarkers.length) return this.#finish('draw', 'explorationExhausted');
    }
    const restorable = hidden.filter(c => !c.marker || c.marker === this.#current);
    if ([PHASE.MINE, PHASE.OPEN_MINE].includes(this.#phase) && !restorable.some(c => this.#canMine(c, this.#current)))
      this.#finish('draw', 'noMine');
  }
  explorationOptions(side = this.#current) {
    if (side !== SIDE.PLAYER && side !== SIDE.CPU) throw new Error('invalidViewer');
    const candidates = [], removableMarkers = [];
    this.#board.cells.forEach((c, index) => {
      // Enemy ownership is deliberately irrelevant to progress eligibility.
      if (c.revealed || this.#board.owns(c, side)) return;
      if (!c.marker) candidates.push(index);
      else if (c.marker === side) removableMarkers.push(index);
    });
    return Object.freeze({ candidates: Object.freeze(candidates), removableMarkers: Object.freeze(removableMarkers) });
  }
  observe(viewer) {
    if (viewer !== SIDE.PLAYER && viewer !== SIDE.CPU) throw new Error('invalidViewer');
    return Object.freeze({ width: this.#config.width, height: this.#config.height, viewer,
      current: this.#current, phase: this.#phase, turn: this.#turn, result: this.#result, reason: this.#reason, exploded: this.#exploded,
      cells: this.#board.observe(viewer), playerMines: this.#counts[0], cpuMines: this.#counts[1],
      lastPlayerReveal: this.#lastPlayerReveal, markersUsed: this.#markersUsed, markerLimit: this.#config.markersPerTurn });
  }
}
