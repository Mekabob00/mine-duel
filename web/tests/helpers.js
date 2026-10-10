import { Game } from '../js/game.js';
import { SIDE } from '../js/config.js';
export function started(settings = {}) {
  const game = new Game(settings), last = game.settings.width * game.settings.height - 1;
  game.explore(SIDE.PLAYER,0); game.explore(SIDE.CPU,last);
  if (game.settings.initialMines) { game.placeMine(SIDE.PLAYER,1); game.placeMine(SIDE.CPU,last-1); }
  return game;
}
export function seeded(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
