import { Game } from './game.ed2a071ef9cc.js';
import { CpuBrain, cpuStep } from './ai.e69a70522891.js';
import { PausableTimer } from './timer.d6465aa9f453.js';
import { SIDE, PHASE, DIFFICULTIES, DEFAULTS, VERSION, PHASE_LABELS } from './config.d83a6b7446e4.js';

const icon = (id, classes = '') => `<svg class="${classes}" aria-hidden="true"><use href="#icon-${id}"></use></svg>`;
const normalPhases = [PHASE.EXPLORE, PHASE.MINE, PHASE.END];
export class GameUI {
  #game; #brain; #mode = 'explore'; #difficulty = 'normal'; #starting = true; #modal = true; #timer;
  #feedback = '시작할 칸을 선택하세요. 첫 칸은 안전하게 공개됩니다.'; #focusBeforeHelp;
  constructor(root = document) {
    this.root = root;
    this.dom = Object.fromEntries(['app','board','turn','phase','difficulty','mine-counts','marker-budget','feedback','version','help','end-turn','rules-dialog','rules-action','rules-scroll','difficulty-picker','result-dialog','result-title','result-reason','result-turns','restart','result-help'].map(id => [id, root.getElementById(id)]));
    this.controls = [...root.querySelectorAll('[data-mode]')];
    this.cells = Array.from({ length: DEFAULTS.width * DEFAULTS.height }, (_, i) => {
      const b = root.createElement('button'); b.className = 'cell'; b.dataset.index = i; b.type = 'button';
      b.addEventListener('click', () => this.tap(i)); this.dom.board.append(b); return b;
    });
    this.#timer = new PausableTimer(() => this.#cpuAction());
    this.controls.forEach(b => b.addEventListener('click', () => this.selectMode(b.dataset.mode)));
    this.dom['end-turn'].addEventListener('click', () => this.endTurn());
    this.dom.help.addEventListener('click', () => this.openHelp());
    this.dom['result-help'].addEventListener('click', () => this.openHelp());
    this.dom.restart.addEventListener('click', () => this.newGame());
    this.dom['rules-action'].addEventListener('click', () => this.closeRules());
    // Both press and release must occur on the backdrop. Dragging out of the card does not close it.
    let outsideDown = false;
    const dialog = this.dom['rules-dialog'];
    const outside = e => { const r = dialog.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
    dialog.addEventListener('pointerdown', e => { outsideDown = e.target === dialog && outside(e); });
    dialog.addEventListener('click', e => { if (outsideDown && e.target === dialog && outside(e)) this.closeRules(true); outsideDown = false; });
    dialog.addEventListener('cancel', e => { e.preventDefault(); this.closeRules(true); });
    this.dom['result-dialog'].addEventListener('cancel', e => e.preventDefault());
    root.querySelectorAll('input[name=difficulty]').forEach(input => input.addEventListener('change', () => {
      if (this.#starting && this.#modal) this.#difficulty = input.value;
    }));
    root.addEventListener('visibilitychange', () => { if (root.hidden) this.#timer.pause(); else if (!this.#modal) this.#timer.resume(); });
    const viewport = () => { root.documentElement.style.setProperty('--viewport-height', `${Math.round(window.visualViewport?.height || window.innerHeight)}px`); this.#fitBoard(); };
    window.visualViewport?.addEventListener('resize', viewport); window.addEventListener('resize', viewport); viewport();
    this.dom.version.textContent = `v${VERSION}`;
    this.newGame();
  }
  newGame() {
    this.#timer.clear(); this.#timer.pause(); this.#game = new Game(); this.#brain = null;
    this.#difficulty = 'normal'; this.#mode = 'explore'; this.#starting = true; this.#modal = true;
    this.#feedback = '시작할 칸을 선택하세요. 첫 칸은 안전하게 공개됩니다.';
    this.dom['result-dialog'].close();
    this.root.querySelectorAll('input[name=difficulty]').forEach(i => { i.checked = i.value === 'normal'; i.disabled = false; });
    this.#showRules(); this.render();
  }
  #showRules() {
    this.dom['rules-action'].textContent = this.#starting ? '게임 시작' : '닫기';
    this.dom['difficulty-picker'].hidden = !this.#starting;
    this.dom['difficulty-picker'].disabled = !this.#starting;
    if (!this.dom['rules-dialog'].open) this.dom['rules-dialog'].showModal();
    this.dom['rules-scroll'].scrollTop = 0;
    this.dom['rules-action'].focus();
  }
  openHelp() {
    if (this.#modal) return;
    this.#focusBeforeHelp = this.root.activeElement;
    this.#starting = false; this.#modal = true; this.#timer.pause(); this.#showRules(); this.render();
  }
  closeRules(fromOutside = false) {
    if (!this.#modal || (this.#starting && fromOutside)) return;
    if (this.#starting) this.#brain = new CpuBrain(DIFFICULTIES[this.#difficulty].mistake);
    this.#starting = false; this.#modal = false; this.dom['rules-dialog'].close(); this.render();
    if (!this.root.hidden) this.#timer.resume();
    if (this.#focusBeforeHelp?.isConnected) this.#focusBeforeHelp.focus();
    this.#focusBeforeHelp = null;
  }
  #allowInput() { return !this.#modal && this.#game.current === SIDE.PLAYER && this.#game.phase !== PHASE.FINISHED; }
  #fitBoard() {
    const app = this.dom.app, css = getComputedStyle(app);
    const paddingX = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
    const paddingY = parseFloat(css.paddingTop) + parseFloat(css.paddingBottom);
    const children = [...app.children].filter(c => !c.classList.contains('board-section'));
    const used = children.reduce((sum,c) => sum + c.getBoundingClientRect().height,0) + parseFloat(css.gap) * children.length + paddingY;
    const available = (window.visualViewport?.height || window.innerHeight) - used - 2;
    this.dom.board.style.setProperty('--size', `${Math.max(224,Math.min(app.clientWidth - paddingX,available,452))}px`);
  }
  selectMode(mode) {
    if (!this.#allowInput() || this.controls.find(b => b.dataset.mode === mode)?.disabled) return;
    this.#mode = mode;
    this.#feedback = { explore: '마커가 없는 미공개 칸을 탐색하세요. 내 지뢰도 위험합니다.', mine: '마커가 없는 미공개 칸에 지뢰를 설치하세요.', marker: '미공개 칸에 마커를 설치하세요. 지뢰 위에도 설치할 수 있습니다.', remove: '제거할 내 마커를 선택하세요.' }[mode];
    this.render();
  }
  tap(index) {
    if (!this.#allowInput()) return;
    const action = { explore: 'explore', mine: 'placeMine', marker: 'addMarker', remove: 'removeMarker' }[this.#mode];
    const previous = this.#game.phase;
    const reply = this.#game[action](SIDE.PLAYER, index); this.#feedback = reply.message;
    if (reply.ok && previous !== this.#game.phase) this.#autoMode();
    this.render(); this.#scheduleCpu();
  }
  endTurn() {
    if (!this.#allowInput()) return;
    this.#feedback = this.#game.endTurn(SIDE.PLAYER).message; this.#autoMode(); this.render(); this.#scheduleCpu();
  }
  #autoMode() {
    if ([PHASE.EXPLORE, PHASE.OPEN_REVEAL].includes(this.#game.phase)) this.#mode = 'explore';
    else if ([PHASE.MINE, PHASE.OPEN_MINE].includes(this.#game.phase)) this.#mode = 'mine';
  }
  #scheduleCpu() {
    if (this.#game.current === SIDE.CPU && this.#game.phase !== PHASE.FINISHED && this.#timer.remaining === null) this.#timer.start(DEFAULTS.cpuDelay);
  }
  #cpuAction() {
    if (this.#modal || !this.#brain || this.#game.current !== SIDE.CPU || this.#game.phase === PHASE.FINISHED) return;
    this.#feedback = cpuStep(this.#game, this.#brain).message; this.#autoMode(); this.render(); this.#scheduleCpu();
  }
  render() {
    const board = this.#game.observe(SIDE.PLAYER), input = this.#allowInput(), normal = normalPhases.includes(board.phase);
    this.dom.turn.textContent = `${String(board.turn).padStart(2,'0')}턴 · ${board.current === SIDE.PLAYER ? '내 차례' : 'CPU 차례'}`;
    this.dom.turn.classList.toggle('cpu-turn', board.current === SIDE.CPU);
    this.dom.phase.textContent = PHASE_LABELS[board.phase];
    this.dom.difficulty.textContent = `난이도 · ${DIFFICULTIES[this.#difficulty].label}`;
    this.dom['mine-counts'].textContent = `내 지뢰 ${board.playerMines} · CPU 지뢰 ${board.cpuMines}`;
    this.dom['marker-budget'].textContent = normal ? `남은 마커 ${board.markerLimit - board.markersUsed}/${board.markerLimit}` : board.result ? '게임 종료' : '마커 설치 불가';
    board.cells.forEach((c, i) => {
      const b = this.cells[i]; b.disabled = !input;
      b.className = 'cell' + (c.revealed ? ` revealed-${c.revealedBy}` : c.ownMine ? ' own-mine' : '') + (board.exploded === i ? ' exploded' : '');
      b.innerHTML = board.exploded === i ? '!' : c.revealed ? String(c.number) : `${c.ownMine ? icon('mine') : ''}${c.marker ? icon('flag', `cell-flag ${c.marker === SIDE.CPU ? 'cpu' : ''}`) : ''}`;
      const details = board.exploded === i ? '지뢰 폭발' : c.revealed ? `${c.revealedBy === SIDE.PLAYER ? '내' : 'CPU'} 탐색, 숫자 ${c.number}` : [c.ownMine ? '내 지뢰' : '미공개', c.marker ? (c.marker === SIDE.PLAYER ? '내 마커' : 'CPU 마커') : ''].filter(Boolean).join(', ');
      b.setAttribute('aria-label', `${Math.floor(i / board.width) + 1}행 ${i % board.width + 1}열, ${details}`);
    });
    const enabled = { explore: [PHASE.EXPLORE, PHASE.OPEN_REVEAL].includes(board.phase), mine: [PHASE.MINE, PHASE.OPEN_MINE].includes(board.phase), marker: normal && board.markersUsed < board.markerLimit, remove: normal && board.cells.some(c => c.marker === SIDE.PLAYER) };
    this.controls.forEach(b => { b.disabled = !input || !enabled[b.dataset.mode]; const selected = b.dataset.mode === this.#mode; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
    this.dom['end-turn'].disabled = !input || board.phase !== PHASE.END;
    this.dom.help.disabled = this.#modal; this.dom.feedback.textContent = this.#feedback;
    if (board.result) {
      this.#timer.clear();
      this.dom['result-title'].textContent = { win:'승리!', loss:'패배!', draw:'무승부' }[board.result];
      this.dom['result-reason'].textContent = board.reason; this.dom['result-turns'].textContent = `진행한 턴 · ${board.turn}`;
      if (!this.dom['result-dialog'].open && !this.#modal) this.dom['result-dialog'].showModal();
    }
    this.#fitBoard();
  }
}
