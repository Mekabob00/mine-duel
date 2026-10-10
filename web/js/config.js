export const VERSION = '0.1.0-web';
export const SIDE = Object.freeze({ PLAYER: 'player', CPU: 'cpu' });
export const PHASE = Object.freeze({ OPEN_REVEAL: 'opening-reveal', OPEN_MINE: 'opening-mine', EXPLORE: 'explore', MINE: 'place-mine', END: 'end-turn', FINISHED: 'finished' });
export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ label: '쉬움', mistake: 0.40 }),
  normal: Object.freeze({ label: '보통', mistake: 0.20 }),
  hard: Object.freeze({ label: '어려움', mistake: 0.05 }),
});
export const DEFAULTS = Object.freeze({ width: 8, height: 8, initialMines: 1, minesPerTurn: 1, markersPerTurn: 1, cpuDelay: 650, cpuMarkerChance: 0.4 });
export const MINE_STRATEGIES = Object.freeze({ random: 0.60, recent: 0.25, revealed: 0.15 });
export const PHASE_LABELS = Object.freeze({
  [PHASE.OPEN_REVEAL]: '게임 준비 · 안전한 시작 칸 선택', [PHASE.OPEN_MINE]: '게임 준비 · 첫 지뢰 설치',
  [PHASE.EXPLORE]: '01 · 한 칸 탐색', [PHASE.MINE]: '02 · 지뢰 설치', [PHASE.END]: '03 · 마커 관리 또는 턴 종료', [PHASE.FINISHED]: '게임 종료',
});
