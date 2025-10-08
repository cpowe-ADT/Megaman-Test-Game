import { BossId } from '../types';

const GRID: BossId[][] = [
  ['PyroMaw', 'TideReaver', 'VoltHopper'],
  ['BasaltTitan', 'Rook', 'FerroBlade'],
  ['MireWraith', 'GaleVixen', 'GlacierRonin']
];

export function gridToBossId(col: number, row: number): BossId {
  return GRID[row][col];
}

export function iterateGrid(): { id: BossId; col: number; row: number }[] {
  const result: { id: BossId; col: number; row: number }[] = [];
  GRID.forEach((row, rowIndex) => {
    row.forEach((id, colIndex) => {
      result.push({ id, col: colIndex, row: rowIndex });
    });
  });
  return result;
}
