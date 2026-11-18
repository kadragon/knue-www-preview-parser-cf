import { describe, it, expect } from 'vitest';
import { checkTableSupport, toTsv, isRawTable } from './tables';
import type { RawTable } from './types';

const simple = (rows: string[][]): RawTable => ({ rows, hasSpan: false, hasNested: false });

describe('toTsv', () => {
  it('preserves empty middle cell so the last value stays in column 3', () => {
    const { tsv } = toTsv([
      ['구분', '일정', '비고'],
      ['서류 접수', '', '방문 접수'],
    ]);

    const lines = tsv.split('\r\n');
    expect(lines).toHaveLength(2);
    const fields = lines[1].split('\t');
    expect(fields).toEqual(['서류 접수', '', '방문 접수']);
    expect(fields[2]).toBe('방문 접수');
  });

  it('collapses tabs and newlines inside cells to single spaces', () => {
    const { tsv } = toTsv([['RISE\n\n사업운영', 'a\tb', '  c  ']]);
    expect(tsv).toBe('RISE 사업운영\ta b\tc');
  });

  it('escapes cells that spreadsheets would execute as formulas and counts them', () => {
    const { tsv, escapedCells } = toTsv([['=SUM(A1)', '+1', '-1', '@cmd', '안전', '1-2']]);
    expect(tsv).toBe("'=SUM(A1)\t'+1\t'-1\t'@cmd\t안전\t1-2");
    expect(escapedCells).toBe(4);
  });

  it('keeps "- 항목" list bullets as-is without a quote prefix', () => {
    const { tsv, escapedCells } = toTsv([
      ['- 명절휴가비, 4대보험 본인부담금(별도)', '-\n 근무시간 조정'],
    ]);
    expect(tsv).toBe('- 명절휴가비, 4대보험 본인부담금(별도)\t- 근무시간 조정');
    expect(escapedCells).toBe(0);
  });

  it.each([
    '- 2+3',
    '-  =1+1',
    "- cmd|' /C calc'!A0",
    '- 참고 HYPERLINK("http://x")',
    '-명절휴가비',
  ])('still escapes hyphen cell that could act as a formula: %s', cell => {
    const { tsv, escapedCells } = toTsv([[cell]]);
    expect(tsv.startsWith("'")).toBe(true);
    expect(escapedCells).toBe(1);
  });

  it('reports zero escaped cells for plain text', () => {
    expect(toTsv([['a', 'b']]).escapedCells).toBe(0);
  });
});

describe('checkTableSupport', () => {
  it('accepts a rectangular table without merges', () => {
    expect(checkTableSupport(simple([['a', 'b'], ['', 'd']]))).toEqual({ supported: true });
  });

  it('rejects merged cells', () => {
    const result = checkTableSupport({ rows: [['a', 'b'], ['c']], hasSpan: true, hasNested: false });
    expect(result.supported).toBe(false);
    if (!result.supported) expect(result.reason).toMatch(/merged/i);
  });

  it('rejects nested tables', () => {
    const result = checkTableSupport({ rows: [['a']], hasSpan: false, hasNested: true });
    expect(result.supported).toBe(false);
    if (!result.supported) expect(result.reason).toMatch(/nested/i);
  });

  it('rejects ragged rows instead of guessing column positions', () => {
    const result = checkTableSupport(simple([['a', 'b', 'c'], ['d', 'e']]));
    expect(result.supported).toBe(false);
    if (!result.supported) expect(result.reason).toMatch(/column/i);
  });

  it('rejects an empty table', () => {
    expect(checkTableSupport(simple([])).supported).toBe(false);
  });
});

describe('isRawTable', () => {
  it('validates cached table shape', () => {
    expect(isRawTable(simple([['a']]))).toBe(true);
    expect(isRawTable({ rows: [[1]], hasSpan: false, hasNested: false })).toBe(false);
    expect(isRawTable({ rows: [['a']] })).toBe(false);
    expect(isRawTable(null)).toBe(false);
  });
});
