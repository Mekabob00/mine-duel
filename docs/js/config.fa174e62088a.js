export const VERSION = '0.2.1-web';
export const SIDE = Object.freeze({ PLAYER: 'player', CPU: 'cpu' });
export const PHASE = Object.freeze({ OPEN_REVEAL: 'opening-reveal', OPEN_MINE: 'opening-mine', EXPLORE: 'explore', MINE: 'place-mine', END: 'end-turn', FINISHED: 'finished' });
export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ mistake: 0.40 }),
  normal: Object.freeze({ mistake: 0.20 }),
  hard: Object.freeze({ mistake: 0.05 }),
});
export const DEFAULTS = Object.freeze({ width: 8, height: 8, initialMines: 1, minesPerTurn: 1, markersPerTurn: 1, cpuDelay: 650, cpuMarkerChance: 0.4 });
export const MINE_STRATEGIES = Object.freeze({ random: 0.60, recent: 0.25, revealed: 0.15 });
