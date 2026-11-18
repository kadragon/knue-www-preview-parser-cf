import type { RawTable } from './types';

export type TableSupport = { supported: true } | { supported: false; reason: string };

// Leading characters that make Excel/Sheets treat a cell as a formula (OWASP CSV injection).
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
// Korean notices use "- 항목" as a list bullet; prefixing those with ' shows a stray quote in Excel.
const LIST_BULLET = /^-\s+[^\d\s=+\-@.,(]/;
// Anything that could still execute: a DDE pipe or an ASCII function call such as HYPERLINK(.
const FORMULA_SIGNAL = /\||[A-Za-z_][A-Za-z0-9_.]*\s*\(/;

function needsFormulaEscape(cell: string): boolean {
  if (!FORMULA_PREFIX.test(cell)) return false;
  return !(LIST_BULLET.test(cell) && !FORMULA_SIGNAL.test(cell));
}

export function checkTableSupport(table: RawTable): TableSupport {
  if (table.hasNested) {
    return { supported: false, reason: 'Table contains a nested table' };
  }
  if (table.hasSpan) {
    return { supported: false, reason: 'Table contains merged cells (rowspan/colspan)' };
  }
  if (table.rows.length === 0) {
    return { supported: false, reason: 'Table has no rows' };
  }
  const width = table.rows[0].length;
  if (width === 0 || table.rows.some(row => row.length !== width)) {
    return { supported: false, reason: 'Table rows have inconsistent column counts' };
  }
  return { supported: true };
}

export function toTsv(rows: string[][]): { tsv: string; escapedCells: number } {
  let escapedCells = 0;
  const lines = rows.map(row =>
    row
      .map(raw => {
        const cell = raw.replace(/\s+/g, ' ').trim();
        if (needsFormulaEscape(cell)) {
          escapedCells += 1;
          return `'${cell}`;
        }
        return cell;
      })
      .join('\t')
  );
  return { tsv: lines.join('\r\n'), escapedCells };
}

export function isRawTable(candidate: unknown): candidate is RawTable {
  if (!candidate || typeof candidate !== 'object') return false;
  const t = candidate as Partial<RawTable>;
  return (
    typeof t.hasSpan === 'boolean' &&
    typeof t.hasNested === 'boolean' &&
    Array.isArray(t.rows) &&
    t.rows.every(row => Array.isArray(row) && row.every(cell => typeof cell === 'string'))
  );
}
