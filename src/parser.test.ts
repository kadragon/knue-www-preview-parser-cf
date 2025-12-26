import { describe, it, expect } from 'vitest';
import { extractTextFromIframe, convertToMarkdown } from './parser';

// Trace:
//   spec_id: SPEC-PARSER-001
//   task_id: TASK-PARSER-TABLE-001

describe('extractTextFromIframe', () => {
  it('should extract text from iframe #content_body', async () => {
    // This test will fail initially because we need to refactor parser.ts
    // to export extractTextFromIframe and use #innerWrap and #content_body

    // Mock page.evaluate result
    const mockText = `【한국교원대학교 공고 제2025-202호】

2025학년도 한국교원대학교 지역혁신중심 대학지원체계(RISE) 사업
전담직원(기간제) 채용 공고문(안)

１ 채용분야 및 담당업무

ㆍ한국교원대학교 RISE 사업 운영 관리
  - RISE 사업 관리, 운영 전반`;

    // We expect extractTextFromIframe to be a pure function
    // that processes the result from page.evaluate
    const result = extractTextFromIframe(mockText);

    expect(result).toContain('【한국교원대학교 공고 제2025-202호】');
    expect(result).toContain('RISE');
  });
});

describe('convertToMarkdown', () => {
  it('should convert 【...】 to H1', () => {
    const textNodes = ['【한국교원대학교 공고 제2025-202호】'];
    const { content, title } = convertToMarkdown(textNodes);

    expect(content).toContain('# 【한국교원대학교 공고 제2025-202호】');
    expect(title).toBe('【한국교원대학교 공고 제2025-202호】');
  });

  it('should convert ㆍ bullets to markdown list', () => {
    const textNodes = ['ㆍ한국교원대학교 RISE 사업 운영 관리'];
    const { content } = convertToMarkdown(textNodes);

    expect(content).toContain('- 한국교원대학교 RISE 사업 운영 관리');
  });

  it('should convert section headings with ১', () => {
    const textNodes = ['１ 채용분야 및 담당업무'];
    const { content } = convertToMarkdown(textNodes);

    expect(content).toContain('## １ 채용분야 및 담당업무');
  });

  it('should handle empty input', () => {
    const textNodes: string[] = [];
    const { content, title } = convertToMarkdown(textNodes);

    expect(content).toBe('');
    expect(title).toBe('Untitled Document');
  });

  it('should convert table-like rows into markdown table', () => {
    const textNodes = [
      '직종  채용인원  채용분야',
      '사무원  1명  RISE사업운영',
    ];

    const { content } = convertToMarkdown(textNodes);

    expect(content).toContain('| 직종 | 채용인원 | 채용분야 |');
    expect(content).toContain('| --- | --- | --- |');
    expect(content).toContain('| 사무원 | 1명 | RISE사업운영 |');
  });
});
