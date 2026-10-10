import { Board } from './board.js';
import { DEFAULTS, SIDE, PHASE } from './config.js';

export class Game {
  #board; #config; #counts = [0, 0]; #opening = [0, 0]; #placed = 0;
  #current = SIDE.PLAYER; #phase = PHASE.OPEN_REVEAL; #turn = 1; #markersUsed = 0;
  #lastPlayerReveal = -1; #exploded = -1; #result = null; #reason = '';
  constructor(settings = {}) {
    this.#config = Object.freeze({ ...DEFAULTS, ...settings });
    const c = this.#config;
    if (![c.width, c.height, c.initialMines, c.minesPerTurn, c.markersPerTurn].every(Number.isInteger)
      || c.width < 2 || c.height < 2 || c.width > 16 || c.height > 16 || c.initialMines < 0 || c.minesPerTurn < 1 || c.markersPerTurn < 0) throw new Error('잘못된 게임 설정');
    this.#board = new Board(c.width, c.height);
  }
  get current() { return this.#current; } get phase() { return this.#phase; }
  get turn() { return this.#turn; } get result() { return this.#result; }
  get reason() { return this.#reason; } get settings() { return this.#config; }
  #index(side) { return side === SIDE.PLAYER ? 0 : 1; }
  #active(side) { return (side === SIDE.PLAYER || side === SIDE.CPU) && side === this.#current && this.#phase !== PHASE.FINISHED; }
  #normal() { return [PHASE.EXPLORE, PHASE.MINE, PHASE.END].includes(this.#phase); }
  #cell(index) { return Number.isInteger(index) ? this.#board.cells[index] : null; }
  #canMine(cell, side) { return !this.#board.owns(cell, side) && (this.#phase !== PHASE.OPEN_MINE || !cell.owners); }
  #reply(ok, message) { return { ok, message }; }
  #finish(result, reason) { this.#result = result; this.#reason = reason; this.#phase = PHASE.FINISHED; }
  explore(side, index) {
    const c = this.#cell(index);
    if (!this.#active(side) || ![PHASE.EXPLORE, PHASE.OPEN_REVEAL].includes(this.#phase) || !c || c.revealed || c.marker)
      return this.#reply(false, '마커가 없는 미공개 칸을 선택하세요.');
    if (c.owners) {
      this.#exploded = index;
      this.#finish(side === SIDE.PLAYER ? 'loss' : 'win', side === SIDE.PLAYER ? '플레이어가 지뢰를 밟았습니다.' : 'CPU가 지뢰를 밟았습니다.');
      return this.#reply(true, this.#reason);
    }
    c.revealed = true; c.revealedBy = side;
    if (side === SIDE.PLAYER) this.#lastPlayerReveal = index;
    if (this.#phase === PHASE.OPEN_REVEAL) {
      if (side === SIDE.PLAYER) this.#current = SIDE.CPU;
      else { this.#current = SIDE.PLAYER; this.#phase = this.#config.initialMines ? PHASE.OPEN_MINE : PHASE.EXPLORE; }
    } else this.#phase = PHASE.MINE;
    this.#checkProgress();
    return this.#reply(true, '안전합니다! 한 칸을 공개했습니다.');
  }
  placeMine(side, index) {
    const c = this.#cell(index);
    if (!this.#active(side) || ![PHASE.MINE, PHASE.OPEN_MINE].includes(this.#phase) || !c || c.revealed || c.marker || !this.#canMine(c, side))
      return this.#reply(false, '여기에는 지뢰를 설치할 수 없습니다. 다른 칸을 선택하세요.');
    this.#board.addMine(c, side); this.#counts[this.#index(side)]++;
    this.#board.refreshNumbers();
    if (this.#phase === PHASE.OPEN_MINE) {
      this.#opening[this.#index(side)]++;
      if (this.#opening.every(n => n >= this.#config.initialMines)) { this.#current = SIDE.PLAYER; this.#phase = PHASE.EXPLORE; }
      else this.#current = side === SIDE.PLAYER ? SIDE.CPU : SIDE.PLAYER;
    } else if (++this.#placed >= this.#config.minesPerTurn) this.#phase = PHASE.END;
    this.#checkProgress();
    return this.#reply(true, '지뢰를 설치했습니다. 공개된 숫자를 갱신했습니다.');
  }
  addMarker(side, index) {
    const c = this.#cell(index);
    if (!this.#active(side) || !this.#normal() || !c || c.revealed || c.marker || this.#markersUsed >= this.#config.markersPerTurn)
      return this.#reply(false, '마커를 설치할 수 없습니다. 남은 횟수와 선택한 칸을 확인하세요.');
    c.marker = side; this.#markersUsed++; this.#checkProgress();
    return this.#reply(true, '마커를 설치했습니다. 이 칸은 탐색과 새 지뢰 설치가 차단됩니다.');
  }
  removeMarker(side, index) {
    const c = this.#cell(index);
    if (!this.#active(side) || !this.#normal() || !c || c.marker !== side) return this.#reply(false, '자신의 마커만 제거할 수 있습니다.');
    c.marker = null; this.#checkProgress();
    return this.#reply(true, '마커를 제거했습니다. 이번 턴의 설치 횟수는 복구되지 않습니다.');
  }
  endTurn(side) {
    if (!this.#active(side) || this.#phase !== PHASE.END) return this.#reply(false, '탐색과 지뢰 설치를 완료한 뒤 턴을 종료하세요.');
    this.#current = side === SIDE.PLAYER ? SIDE.CPU : SIDE.PLAYER;
    this.#phase = PHASE.EXPLORE; this.#markersUsed = 0; this.#placed = 0; this.#turn++;
    this.#checkProgress();
    return this.#reply(true, this.#current === SIDE.CPU ? 'CPU가 생각 중입니다…' : '내 차례입니다. 한 칸을 탐색하세요.');
  }
  #checkProgress() {
    if (this.#phase === PHASE.FINISHED) return;
    const hidden = this.#board.cells.filter(c => !c.revealed);
    if (!hidden.some(c => !c.marker)) return this.#finish('draw', '마커가 없는 미공개 칸이 더 이상 없습니다.');
    const restorable = hidden.filter(c => !c.marker || c.marker === this.#current);
    if ([PHASE.MINE, PHASE.OPEN_MINE].includes(this.#phase) && !restorable.some(c => this.#canMine(c, this.#current)))
      this.#finish('draw', '지뢰를 설치할 수 있는 칸이 더 이상 없습니다.');
  }
  resolveCpuNoExploration() {
    if (this.#current !== SIDE.CPU || this.#phase !== PHASE.EXPLORE) return false;
    if (this.#board.cells.some(c => !c.revealed && !this.#board.owns(c, SIDE.CPU) && (!c.marker || c.marker === SIDE.CPU))) return false;
    this.#finish('draw', 'CPU가 자신의 지뢰를 피해 탐색할 수 있는 칸이 없습니다.'); return true;
  }
  observe(viewer) {
    if (viewer !== SIDE.PLAYER && viewer !== SIDE.CPU) throw new Error('잘못된 관측자');
    return Object.freeze({ width: this.#config.width, height: this.#config.height, viewer,
      current: this.#current, phase: this.#phase, turn: this.#turn, result: this.#result, reason: this.#reason, exploded: this.#exploded,
      cells: this.#board.observe(viewer), playerMines: this.#counts[0], cpuMines: this.#counts[1],
      lastPlayerReveal: this.#lastPlayerReveal, markersUsed: this.#markersUsed, markerLimit: this.#config.markersPerTurn });
  }
}
