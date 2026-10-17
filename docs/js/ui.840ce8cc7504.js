import { Game } from './game.8965f85c273a.js';
import { CpuBrain, cpuStep } from './ai.e5b291648bb6.js';
import { PausableTimer } from './timer.7a02f26e49c1.js';
import { SIDE, PHASE, DIFFICULTIES, DEFAULTS, VERSION } from './config.db7e0b3280fe.js';
import { LANGUAGES, RULE_SECTIONS, loadLanguage, saveLanguage, translate } from './i18n.5c20141813de.js';
import { UpdateChecker } from './updates.325f13001c32.js';
const icon = (id, classes = '') => `<svg class="${classes}" aria-hidden="true"><use href="#icon-${id}"></use></svg>`;
const normalPhases = [PHASE.EXPLORE, PHASE.MINE, PHASE.END];
export class GameUI {
  #game; #brain; #mode = 'explore'; #difficulty = 'normal'; #starting = true; #modal = null; #timer;
  #feedback = 'initial'; #language = 'ko'; #needsLanguage = false; #storage; #focusBeforeModal; #updates; #pendingUpdate = null;
  constructor(root = document) {
    this.root = root;
    this.dom = Object.fromEntries(['app','board','turn','phase','difficulty','mine-counts','marker-budget','feedback','version','help','end-turn','rules-dialog','rules-action','rules-scroll','difficulty-picker','result-dialog','result-title','result-reason','result-turns','restart','result-help','menu-dialog','language-dialog','confirm-dialog','update-dialog','language-close','confirm-restart','update-now','update-later'].map(id => [id, root.getElementById(id)]));
    try { this.#storage = window.localStorage; } catch { this.#storage = null; }
    const saved = loadLanguage(this.#storage); this.#needsLanguage = !saved; this.#language = saved || 'ko';
    this.controls = [...root.querySelectorAll('[data-mode]')];
    this.cells = Array.from({ length: DEFAULTS.width * DEFAULTS.height }, (_, i) => {
      const b = root.createElement('button'); b.className = 'cell'; b.dataset.index = i; b.type = 'button';
      b.addEventListener('click', () => this.tap(i)); this.dom.board.append(b); return b;
    });
    this.#timer = new PausableTimer(() => this.#cpuAction());
    this.controls.forEach(b => b.addEventListener('click', () => this.selectMode(b.dataset.mode)));
    this.dom['end-turn'].addEventListener('click', () => this.endTurn());
    this.dom.help.addEventListener('click', () => this.openMenu());
    this.dom['result-help'].addEventListener('click', () => this.openMenu());
    this.dom.restart.addEventListener('click', () => { this.#open('confirm'); this.render(); });
    this.dom['confirm-restart'].addEventListener('click', () => this.newGame());
    this.dom['rules-action'].addEventListener('click', () => this.closeRules());
    root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.#dismiss()));
    root.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => {
      if (this.#modal !== 'menu') return;
      if (b.dataset.menu === 'rules') this.#showRules(); else this.#open(b.dataset.menu);
      this.render();
    }));
    root.querySelectorAll('[data-language]').forEach(b => b.addEventListener('click', () => this.#selectLanguage(b.dataset.language)));
    this.dom['update-later'].addEventListener('click', () => this.#dismiss());
    this.dom['update-now'].addEventListener('click', () => {
      const url = new URL(window.location.href); url.searchParams.set('v', this.#pendingUpdate || VERSION); window.location.replace(url.href);
    });
    // Both ends of a backdrop gesture must be outside the card. No click reaches the board.
    for (const name of ['rules','menu','language','confirm','update','result']) {
      const dialog = this.dom[`${name}-dialog`]; let outsideDown = false;
      const outside = e => { const r = dialog.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
      dialog.addEventListener('pointerdown', e => { outsideDown = e.target === dialog && outside(e); });
      dialog.addEventListener('click', e => { if (outsideDown && e.target === dialog && outside(e)) this.#dismiss(); outsideDown = false; });
      dialog.addEventListener('cancel', e => { e.preventDefault(); this.#dismiss(); });
    }
    root.querySelectorAll('input[name=difficulty]').forEach(input => input.addEventListener('change', () => {
      if (this.#starting && this.#modal === 'rules') this.#difficulty = input.value;
    }));
    this.#updates = new UpdateChecker(version => { this.#pendingUpdate = version; if (!this.#modal) { this.#open('update'); this.render(); } });
    root.addEventListener('visibilitychange', () => {
      if (root.hidden) this.#timer.pause(); else { if (!this.#modal) this.#timer.resume(); void this.#updates.check(); }
    });
    window.setInterval(() => { if (!root.hidden) void this.#updates.check(); }, 60000);
    const viewport = () => { root.documentElement.style.setProperty('--viewport-height', `${Math.round(window.visualViewport?.height || window.innerHeight)}px`); this.#fitBoard(); };
    window.visualViewport?.addEventListener('resize', viewport); window.addEventListener('resize', viewport); viewport();
    this.dom.version.textContent = `v${VERSION}`; this.newGame(); void this.#updates.check();
  }
  t(key, params) { return translate(this.#language, key, params, /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)); }
  #localize() {
    this.root.documentElement.lang = this.#language; this.root.title = 'Mine Duel';
    this.dom['rules-action'].dataset.i18n = this.#starting ? 'start' : 'close';
    if (!this.dom['rules-scroll'].children.length) RULE_SECTIONS.forEach((count, section) => {
      const title = this.root.createElement('h3'); title.dataset.i18n = `rules.${section}.title`; this.dom['rules-scroll'].append(title);
      const list = this.root.createElement('ol');
      for (let item = 0; item < count; item++) { const li = this.root.createElement('li'); li.dataset.i18n = `rules.${section}.${item}`; list.append(li); }
      this.dom['rules-scroll'].append(list);
    });
    // Retranslate existing nodes without duplicating listeners or resetting scroll.
    for (const e of this.root.querySelectorAll('[data-i18n]')) e.textContent = this.t(e.dataset.i18n);
    for (const e of this.root.querySelectorAll('[data-i18n-aria]')) e.setAttribute('aria-label', this.t(e.dataset.i18nAria));
    this.dom.help.title = this.t('menu'); this.dom['language-close'].hidden = this.#needsLanguage;
    this.root.getElementById('language-title').textContent = this.#needsLanguage ? 'Select Language' : this.t('language');
    this.root.querySelectorAll('[data-language]').forEach(b => b.setAttribute('aria-pressed', String(!this.#needsLanguage && b.dataset.language === this.#language)));
    this.root.querySelectorAll('[data-rate]').forEach(e => { e.textContent = this.t('mistake', { rate: Math.round(DIFFICULTIES[e.dataset.rate].mistake * 100) }); });
    this.dom['rules-action'].textContent = this.t(this.#starting ? 'start' : 'close');
  }
  #open(name) {
    if (!this.#modal) this.#focusBeforeModal = this.root.activeElement;
    this.#timer.pause();
    for (const dialog of this.root.querySelectorAll('dialog[open]')) dialog.close();
    this.#modal = name; this.#localize();
    for (const button of this.dom.app.querySelectorAll('button')) button.disabled = true;
    this.dom[`${name}-dialog`].showModal();
  }
  #dismiss() {
    if ((this.#modal === 'rules' && this.#starting) || (this.#modal === 'language' && this.#needsLanguage) || this.#modal === 'result') return;
    if (this.#modal === 'update') { this.#updates.dismiss(this.#pendingUpdate); this.#pendingUpdate = null; }
    for (const dialog of this.root.querySelectorAll('dialog[open]')) dialog.close();
    this.#modal = null; this.render();
    if (!this.#modal && !this.root.hidden) this.#timer.resume();
    if (!this.#modal && this.#focusBeforeModal?.isConnected) this.#focusBeforeModal.focus();
    this.#focusBeforeModal = null;
  }
  #selectLanguage(lang) {
    if (this.#modal !== 'language' || !Object.hasOwn(LANGUAGES, lang)) return;
    this.#language = lang; saveLanguage(this.#storage, lang);
    if (this.#needsLanguage) { this.#needsLanguage = false; this.#showRules(); }
    this.render();
  }
  newGame() {
    this.#timer.clear(); this.#timer.pause(); this.#game = new Game(); this.#brain = null;
    this.#difficulty = 'normal'; this.#mode = 'explore'; this.#starting = true; this.#feedback = 'initial';
    this.root.querySelectorAll('input[name=difficulty]').forEach(i => { i.checked = i.value === 'normal'; i.disabled = false; });
    if (this.#needsLanguage) this.#open('language'); else this.#showRules(); this.render();
  }
  #showRules() {
    this.dom['difficulty-picker'].hidden = !this.#starting; this.dom['difficulty-picker'].disabled = !this.#starting;
    this.#open('rules'); this.dom['rules-scroll'].scrollTop = 0; this.dom['rules-action'].focus();
  }
  openMenu() { if (this.#modal && this.#modal !== 'result') return; this.#open('menu'); this.render(); }
  closeRules() {
    if (this.#modal !== 'rules') return;
    if (this.#starting) { this.#brain = new CpuBrain(DIFFICULTIES[this.#difficulty].mistake); this.#starting = false; }
    this.#dismiss();
  }
  #allowInput() { return !this.#modal && this.#game.current === SIDE.PLAYER && this.#game.phase !== PHASE.FINISHED; }
  #fitBoard() {
    const app = this.dom.app, css = getComputedStyle(app);
    const paddingX = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight), paddingY = parseFloat(css.paddingTop) + parseFloat(css.paddingBottom);
    const children = [...app.children].filter(c => !c.classList.contains('board-section'));
    const used = children.reduce((sum,c) => sum + c.getBoundingClientRect().height,0) + parseFloat(css.gap) * children.length + paddingY;
    const available = (window.visualViewport?.height || window.innerHeight) - used - 2;
    this.dom.board.style.setProperty('--size', `${Math.max(224,Math.min(app.clientWidth - paddingX,available,452))}px`);
  }
  selectMode(mode) {
    if (!this.#allowInput() || this.controls.find(b => b.dataset.mode === mode)?.disabled) return;
    this.#mode = mode; this.#feedback = `mode.${mode}`; this.render();
  }
  tap(index) {
    if (!this.#allowInput()) return;
    const action = { explore:'explore', mine:'placeMine', marker:'addMarker', remove:'removeMarker' }[this.#mode], previous = this.#game.phase;
    const reply = this.#game[action](SIDE.PLAYER,index); this.#feedback = reply.message;
    if (reply.ok && previous !== this.#game.phase) this.#autoMode(); this.render(); this.#scheduleCpu();
  }
  endTurn() {
    if (!this.#allowInput()) return;
    this.#feedback = this.#game.endTurn(SIDE.PLAYER).message; this.#autoMode(); this.render(); this.#scheduleCpu();
  }
  #autoMode() {
    if ([PHASE.EXPLORE,PHASE.OPEN_REVEAL].includes(this.#game.phase)) this.#mode = 'explore';
    else if ([PHASE.MINE,PHASE.OPEN_MINE].includes(this.#game.phase)) this.#mode = 'mine';
  }
  #scheduleCpu() { if (this.#game.current === SIDE.CPU && this.#game.phase !== PHASE.FINISHED && this.#timer.remaining === null) this.#timer.start(DEFAULTS.cpuDelay); }
  #cpuAction() {
    if (this.#modal || !this.#brain || this.#game.current !== SIDE.CPU || this.#game.phase === PHASE.FINISHED) return;
    try { this.#feedback = cpuStep(this.#game,this.#brain).message || this.#feedback; }
    catch (error) {
      if (error.message !== 'inferenceContradiction') throw error;
      // An invalid inference is an explicit error, never an invented win/draw rule.
      this.#timer.clear(); this.#timer.pause(); this.#feedback = 'inferenceContradiction'; this.render(); return;
    }
    this.#autoMode(); this.render(); this.#scheduleCpu();
  }
  render() {
    this.#localize();
    const board = this.#game.observe(SIDE.PLAYER), input = this.#allowInput(), normal = normalPhases.includes(board.phase);
    this.dom.turn.textContent = this.t('turn',{turn:String(board.turn).padStart(2,'0'),side:this.t(board.current===SIDE.CPU?'cpuTurn':'myTurn')});
    this.dom.turn.classList.toggle('cpu-turn',board.current===SIDE.CPU); this.dom.phase.textContent = this.t(`phase.${board.phase}`);
    this.dom.difficulty.textContent = this.t(this.#difficulty);
    this.dom['mine-counts'].textContent = this.t('counts',{player:board.playerMines,cpu:board.cpuMines});
    this.dom['marker-budget'].textContent = normal ? this.t('budget',{remaining:board.markerLimit-board.markersUsed,limit:board.markerLimit}) : this.t('noMarker');
    this.cells.forEach((b,i) => {
      const c = board.cells[i]; b.disabled = !input;
      b.className = 'cell' + (c.revealed ? ` revealed-${c.revealedBy}` : c.ownMine ? ' own-mine' : '') + (board.exploded===i?' exploded':'');
      b.innerHTML = board.exploded===i ? '!' : c.revealed ? String(c.number) : `${c.ownMine?icon('mine'):''}${c.marker?icon('flag',`cell-flag ${c.marker===SIDE.CPU?'cpu':''}`):''}`;
      const details = board.exploded===i ? this.t('explosion') : c.revealed ? this.t('revealed',{owner:this.t(c.revealedBy===SIDE.PLAYER?'myExplore':'cpuExplore'),number:c.number}) : [this.t(c.ownMine?'ownMine':'hidden'),c.marker?this.t(c.marker===SIDE.PLAYER?'ownMarker':'cpuMarker'):''].filter(Boolean).join(', ');
      b.setAttribute('aria-label',this.t('cell',{row:Math.floor(i/board.width)+1,column:i%board.width+1,details}));
    });
    const enabled = { explore:[PHASE.EXPLORE,PHASE.OPEN_REVEAL].includes(board.phase), mine:[PHASE.MINE,PHASE.OPEN_MINE].includes(board.phase), marker:normal&&board.markersUsed<board.markerLimit, remove:normal&&board.cells.some(c=>c.marker===SIDE.PLAYER) };
    this.controls.forEach(b => { b.disabled = !input||!enabled[b.dataset.mode]; b.classList.toggle('selected',b.dataset.mode===this.#mode); b.setAttribute('aria-pressed',String(b.dataset.mode===this.#mode)); });
    this.dom['end-turn'].disabled = !input||board.phase!==PHASE.END; this.dom.help.disabled = Boolean(this.#modal); this.dom.feedback.textContent = this.t(this.#feedback);
    if (board.result) {
      this.#timer.clear(); this.dom['result-title'].textContent = this.t(board.result); this.dom['result-reason'].textContent = this.t(board.reason); this.dom['result-turns'].textContent = this.t('turnsPlayed',{turn:board.turn});
    }
    if (!this.#modal&&this.#pendingUpdate) this.#open('update');
    if (!this.#modal&&board.result) this.#open('result'); this.#fitBoard();
  }
}
