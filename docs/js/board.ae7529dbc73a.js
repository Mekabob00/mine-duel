import { SIDE } from './config.13ca0e62b8fe.js';

export function neighbors(index, width, height) {
  const result = [], x = index % width, y = Math.floor(index / width);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if ((dx || dy) && nx >= 0 && nx < width && ny >= 0 && ny < height) result.push(ny * width + nx);
  }
  return result;
}

// Only the rule engine owns a Board instance. The AI receives detached snapshots.
export class Board {
  constructor(width, height) {
    this.width = width; this.height = height;
    this.cells = Array.from({ length: width * height }, () => ({ revealed: false, revealedBy: null, owners: 0, marker: null, number: 0 }));
  }
  owns(cell, side) { return Boolean(cell.owners & (side === SIDE.PLAYER ? 1 : 2)); }
  addMine(cell, side) { cell.owners |= side === SIDE.PLAYER ? 1 : 2; }
  refreshNumbers() {
    this.cells.forEach((cell, i) => { cell.number = neighbors(i, this.width, this.height).filter(n => this.cells[n].owners !== 0).length; });
  }
  observe(viewer) {
    return Object.freeze(this.cells.map(c => Object.freeze({
      revealed: c.revealed, revealedBy: c.revealedBy, number: c.revealed ? c.number : -1,
      ownMine: this.owns(c, viewer), marker: c.marker,
    })));
  }
}
