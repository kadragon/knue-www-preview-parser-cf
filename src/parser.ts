import puppeteer, { Page } from '@cloudflare/puppeteer';
import { ParseResult } from './types';

export async function parseDocument(
  atchmnflNo: string,
  browser: Fetcher
): Promise<ParseResult> {
  console.log('[Parser] Starting parse for atchmnflNo:', atchmnflNo);
  
  const browserInstance = await puppeteer.launch(browser);
  const page = await browserInstance.newPage();

  try {
    const url = `https://www.knue.ac.kr/www/previewBbsFile.do?atchmnflNo=${atchmnflNo}`;
    console.log('[Parser] Navigating to:', url);

    // 페이지 진입 (자동으로 뷰어 페이지로 리다이렉트됨)
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    console.log('[Parser] Page loaded');

    // 콘텐츠 로딩 대기
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 페이지 구조 확인
    const bodyContent = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log('[Parser] Page HTML preview:', bodyContent);

    // 텍스트 추출
    console.log('[Parser] Extracting text');
    const textNodes = await extractTextFromPage(page);
    console.log('[Parser] Extracted', textNodes.length, 'text nodes');

    const { content, title } = convertToMarkdown(textNodes);
    console.log('[Parser] Converted to markdown, title:', title);

    return { content, title };
  } finally {
    await browserInstance.close();
    console.log('[Parser] Browser closed');
  }
}

async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(async () => {
    let prev = 0;
    let sameCount = 0;
    let totalHeight = 0;
    
    while (true) {
      window.scrollBy(0, 500);
      await new Promise(r => setTimeout(r, 100));
      
      const sh = document.body.scrollHeight;
      totalHeight += 500;
      
      if (sh === prev) {
        sameCount++;
      } else {
        sameCount = 0;
        prev = sh;
      }
      
      // 3번 연속 scrollHeight 변화 없으면 종료 (더 빠르게)
      if (sameCount >= 3) break;
      
      // 안전장치: 50000px 이상이면 탈출
      if (totalHeight > 50000) break;
    }
    
    // 마지막 대기
    await new Promise(r => setTimeout(r, 1000));
  });
}

async function extractTextFromPage(page: Page): Promise<string[]> {
  // iframe에서 직접 텍스트 추출
  const result = await page.evaluate(() => {
    const texts = [];

    // iframe 찾기
    const iframe = document.querySelector('iframe');
    if (!iframe || !iframe.contentDocument) {
      console.log('[Extract] No iframe found');
      return texts;
    }

    const doc = iframe.contentDocument;

    // 모든 텍스트 노드 추출
    const walker = doc.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || '').trim();
      if (text.length > 0) {
        texts.push(text);
      }
    }

    console.log('[Extract] Found', texts.length, 'text nodes in iframe');
    return texts;
  });

  return result as string[];
}

function convertToMarkdown(textNodes: string[]): ParseResult {
  const lines: string[] = [];
  let title = '';
  let previousWasBlank = false;

  for (let i = 0; i < textNodes.length; i++) {
    const text = textNodes[i].trim();
    if (!text) continue;

    if (/^【.*】$/.test(text)) {
      if (!title) title = text;
      lines.push(`# ${text}`);
      previousWasBlank = false;
    } else if (/^[１２３４５６７８９０]+\s+/.test(text)) {
      if (!previousWasBlank) lines.push('');
      lines.push(`## ${text}`);
      previousWasBlank = false;
    } else if (/^={3,}/.test(text)) {
      lines.push('');
      lines.push('---');
      lines.push('');
      previousWasBlank = true;
    } else if (/^[ㆍ‣○□]\s*/.test(text)) {
      const cleaned = text.replace(/^[ㆍ‣○□]\s*/, '');
      lines.push(`- ${cleaned}`);
      previousWasBlank = false;
    } else if (/^\s*-\s+/.test(text)) {
      lines.push(text);
      previousWasBlank = false;
    } else if (text.length < 50 && /^[0-9]+\.\s+/.test(text)) {
      lines.push(text);
      previousWasBlank = false;
    } else {
      lines.push(text);
      previousWasBlank = false;
    }
  }

  const content = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { content, title: title || 'Untitled Document' };
}
