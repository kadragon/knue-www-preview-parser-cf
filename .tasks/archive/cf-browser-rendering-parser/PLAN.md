# Implementation Plan: Cloudflare Browser Rendering Parser

**Task**: cf-browser-rendering-parser
**Date**: 2025-10-18
**Status**: Active
**Approach**: TDD (Test-Driven Development)

---

## Overview

Implement browser-based parser for KNUE preview URLs using Cloudflare Browser Rendering API with TDD methodology.

---

## Prerequisites

### Dependencies Check

```bash
# Check if @cloudflare/puppeteer is installed
npm list @cloudflare/puppeteer

# Check wrangler version
npx wrangler --version
```

### Expected State

- [x] `@cloudflare/puppeteer` in package.json
- [ ] Browser binding in wrangler.toml
- [ ] BEARER_TOKEN configured
- [ ] Test framework (Vitest) configured

---

## Implementation Steps (TDD)

### Phase 1: Project Setup

#### Step 1.1: Add Browser Rendering Binding

**File**: `wrangler.toml`

```toml
# Add browser binding
[browser]
binding = "MYBROWSER"
```

**Test**: Verify binding exists
```bash
npx wrangler dev --remote
# Should not error about missing binding
```

**Commit**: `[Structural] (config) Add browser rendering binding [cf-browser-rendering-parser]`

---

#### Step 1.2: Install Dependencies

**Command**:
```bash
npm install @cloudflare/puppeteer@^1.0.4
npm install -D vitest @cloudflare/vitest-pool-workers
```

**Test**: Import succeeds
```typescript
import puppeteer from "@cloudflare/puppeteer";
// No TypeScript errors
```

**Commit**: `[Structural] (deps) Add Puppeteer and Vitest dependencies [cf-browser-rendering-parser]`

---

#### Step 1.3: Configure Test Environment

**File**: `vitest.config.ts` (create if not exists)

```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
```

**Test**: Run `npx vitest --version`

**Commit**: `[Structural] (test) Configure Vitest for Workers [cf-browser-rendering-parser]`

---

### Phase 2: Core Parser Implementation (TDD)

#### Step 2.1: Write Failing Test - Extract Text

**File**: `src/parser.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { extractPreviewContent } from './parser';

describe('extractPreviewContent', () => {
  it('should extract text from iframe #content_body', async () => {
    // This will fail initially
    const mockBrowser = createMockBrowser({
      pageEvaluate: () => ({
        text: '【Test Document】\n\nSample content',
        title: '【Test Document】'
      })
    });

    const result = await extractPreviewContent('78541', mockBrowser);

    expect(result.text).toContain('【Test Document】');
    expect(result.title).toBe('【Test Document】');
  });
});
```

**Run**: `npx vitest`
**Expected**: ❌ FAIL (extractPreviewContent not defined)

---

#### Step 2.2: Implement Minimal Parser

**File**: `src/parser.ts`

```typescript
import type { Browser } from "@cloudflare/puppeteer";

export interface ExtractResult {
  text: string;
  title: string;
}

export async function extractPreviewContent(
  atchmnflNo: string,
  browser: Browser
): Promise<ExtractResult> {
  const page = await browser.newPage();

  try {
    const url = `https://www.knue.ac.kr/www/previewBbsFile.do?atchmnflNo=${atchmnflNo}`;

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 10000
    });

    await page.waitForSelector('iframe#innerWrap', { timeout: 5000 });

    await page.waitForFunction(() => {
      const iframe = document.getElementById('innerWrap') as HTMLIFrameElement;
      return iframe?.contentDocument?.getElementById('content_body') !== null;
    }, { timeout: 5000 });

    const { text, title } = await page.evaluate(() => {
      const iframe = document.getElementById('innerWrap') as HTMLIFrameElement;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow!.document;
      const contentBody = iframeDoc.getElementById('content_body');

      if (!contentBody) {
        throw new Error('content_body element not found');
      }

      const fullText = contentBody.innerText;
      const titleMatch = fullText.match(/【[^】]+】/);
      const title = titleMatch ? titleMatch[0] : 'Untitled Document';

      return { text: fullText, title };
    });

    if (!text || text.trim().length === 0) {
      throw new Error('Document is empty');
    }

    return { text, title };

  } finally {
    await page.close();
  }
}
```

**Run**: `npx vitest`
**Expected**: ✅ PASS (with mock browser)

**Commit**: `[Behavioral] (parser) Implement iframe text extraction [cf-browser-rendering-parser]`

---

#### Step 2.3: Write Failing Test - Error Handling

**File**: `src/parser.test.ts`

```typescript
it('should throw error if iframe not found', async () => {
  const mockBrowser = createMockBrowser({
    waitForSelector: () => {
      throw new Error('Timeout waiting for iframe#innerWrap');
    }
  });

  await expect(
    extractPreviewContent('78541', mockBrowser)
  ).rejects.toThrow('Timeout waiting for iframe#innerWrap');
});

it('should throw error if content is empty', async () => {
  const mockBrowser = createMockBrowser({
    pageEvaluate: () => ({ text: '', title: '' })
  });

  await expect(
    extractPreviewContent('78541', mockBrowser)
  ).rejects.toThrow('Document is empty');
});
```

**Run**: `npx vitest`
**Expected**: ✅ PASS (error handling already in place)

---

### Phase 3: API Integration

#### Step 3.1: Write Failing Test - Worker Handler

**File**: `src/index.test.ts`

```typescript
import { describe, it, expect, env } from 'vitest';
import worker from './index';

describe('Worker API', () => {
  it('should return 401 without Authorization header', async () => {
    const request = new Request('https://worker.dev/?atchmnflNo=78541');
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 400 without atchmnflNo param', async () => {
    const request = new Request('https://worker.dev/', {
      headers: { 'Authorization': 'Bearer test-token' }
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Bad Request');
  });
});
```

**Run**: `npx vitest`
**Expected**: ❌ FAIL (worker not implemented)

---

#### Step 3.2: Implement Worker Handler

**File**: `src/index.ts`

```typescript
import puppeteer from "@cloudflare/puppeteer";
import { extractPreviewContent } from "./parser";

export interface Env {
  MYBROWSER: any;
  BEARER_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Validate Authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or missing bearer token'
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    if (token !== env.BEARER_TOKEN) {
      return Response.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or missing bearer token'
        },
        { status: 401 }
      );
    }

    // Validate query parameters
    const url = new URL(request.url);
    const atchmnflNo = url.searchParams.get('atchmnflNo');

    if (!atchmnflNo) {
      return Response.json(
        {
          success: false,
          error: 'Bad Request',
          message: 'Missing required parameter: atchmnflNo'
        },
        { status: 400 }
      );
    }

    // Parse document
    const browser = await puppeteer.launch(env.MYBROWSER);
    const startTime = Date.now();

    try {
      const { text, title } = await extractPreviewContent(atchmnflNo, browser);

      const parseTimeMs = Date.now() - startTime;

      return Response.json({
        success: true,
        content: text,
        metadata: {
          atchmnflNo,
          title,
          parsedAt: new Date().toISOString(),
          parseTimeMs
        }
      });

    } catch (error: any) {
      const parseTimeMs = Date.now() - startTime;

      return Response.json(
        {
          success: false,
          error: 'Internal Server Error',
          message: error.message || 'Failed to parse document',
          metadata: {
            atchmnflNo,
            parseTimeMs
          }
        },
        { status: 500 }
      );

    } finally {
      await browser.close();
    }
  }
};
```

**Run**: `npx vitest`
**Expected**: ✅ PASS

**Commit**: `[Behavioral] (api) Implement worker request handler [cf-browser-rendering-parser]`

---

### Phase 4: Markdown Conversion (Optional Enhancement)

#### Step 4.1: Write Failing Test - Markdown Formatter

**File**: `src/markdown.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { convertToMarkdown } from './markdown';

describe('convertToMarkdown', () => {
  it('should convert 【...】 to H1', () => {
    const input = '【한국교원대학교 공고 제2025-202호】';
    const output = convertToMarkdown(input);
    expect(output).toContain('# 【한국교원대학교 공고 제2025-202호】');
  });

  it('should convert ㆍ bullets to markdown list', () => {
    const input = 'ㆍ한국교원대학교 RISE 사업 운영 관리';
    const output = convertToMarkdown(input);
    expect(output).toContain('- 한국교원대학교 RISE 사업 운영 관리');
  });
});
```

**Run**: `npx vitest`
**Expected**: ❌ FAIL

---

#### Step 4.2: Implement Markdown Converter

**File**: `src/markdown.ts`

```typescript
export function convertToMarkdown(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      result.push('');
      continue;
    }

    // Title pattern: 【...】
    if (/^【.*】$/.test(trimmed)) {
      result.push(`# ${trimmed}`);
    }
    // Section headings: ١, ２, etc.
    else if (/^[１２３４５６７８９０]/.test(trimmed)) {
      result.push(`\n## ${trimmed}`);
    }
    // Bullet points: ㆍ, ‣, ○
    else if (/^[ㆍ‣○]/.test(trimmed)) {
      result.push(`- ${trimmed.substring(1).trim()}`);
    }
    // Sub-bullets: indented -
    else if (/^\s{2,}-/.test(line)) {
      result.push(`  ${trimmed}`);
    }
    // Regular text
    else {
      result.push(trimmed);
    }
  }

  // Normalize excessive blank lines
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
}
```

**Run**: `npx vitest`
**Expected**: ✅ PASS

**Commit**: `[Behavioral] (markdown) Add markdown conversion [cf-browser-rendering-parser]`

---

#### Step 4.3: Integrate Markdown Conversion

**File**: `src/index.ts` (update)

```typescript
import { convertToMarkdown } from "./markdown";

// In fetch handler, after extractPreviewContent:
const { text, title } = await extractPreviewContent(atchmnflNo, browser);
const markdownContent = convertToMarkdown(text);

return Response.json({
  success: true,
  content: markdownContent,  // ← Changed from `text`
  metadata: { /* ... */ }
});
```

**Commit**: `[Behavioral] (api) Integrate markdown conversion [cf-browser-rendering-parser]`

---

### Phase 5: Manual Testing & Verification

#### Step 5.1: Local Development Test

```bash
# Start dev server with remote browser
npx wrangler dev --remote

# In another terminal, test the endpoint
curl -H "Authorization: Bearer test-token" \
  "http://localhost:8787/?atchmnflNo=78541"
```

**Expected Response**:
```json
{
  "success": true,
  "content": "# 【한국교원대학교 공고 제2025-202호】\n\n...",
  "metadata": {
    "atchmnflNo": "78541",
    "title": "【한국교원대학교 공고 제2025-202호】",
    "parsedAt": "2025-10-18T...",
    "parseTimeMs": 2847
  }
}
```

**Verification Checklist**:
- [ ] Returns 200 OK
- [ ] `success` is true
- [ ] `content` contains Korean text
- [ ] `title` matches first heading
- [ ] `parseTimeMs` < 10000

---

#### Step 5.2: Error Case Testing

```bash
# Test 401 - No auth
curl "http://localhost:8787/?atchmnflNo=78541"

# Test 400 - Missing param
curl -H "Authorization: Bearer test-token" \
  "http://localhost:8787/"

# Test 500 - Invalid atchmnflNo
curl -H "Authorization: Bearer test-token" \
  "http://localhost:8787/?atchmnflNo=99999999"
```

**Verification Checklist**:
- [ ] 401 for missing/invalid token
- [ ] 400 for missing param
- [ ] 500 for non-existent document

---

### Phase 6: Deployment

#### Step 6.1: Set Production Secret

```bash
# Set bearer token as secret
npx wrangler secret put BEARER_TOKEN
# Enter your production token when prompted
```

**Verification**:
```bash
npx wrangler secret list
# Should show BEARER_TOKEN
```

---

#### Step 6.2: Deploy to Cloudflare

```bash
# Deploy
npx wrangler deploy

# Test production endpoint
curl -H "Authorization: Bearer YOUR_PRODUCTION_TOKEN" \
  "https://knue-preview-parser.YOUR_SUBDOMAIN.workers.dev/?atchmnflNo=78541"
```

**Verification Checklist**:
- [ ] Deployment succeeds
- [ ] Production URL returns 200 OK
- [ ] Response matches local test
- [ ] Parse time < 5s

**Commit**: `[Structural] (deploy) Deploy to Cloudflare Workers [cf-browser-rendering-parser]`

---

## Rollback Plan

If deployment fails or errors occur:

1. **Immediate**: Revert to previous deployment
   ```bash
   npx wrangler rollback
   ```

2. **Investigate**: Check logs
   ```bash
   npx wrangler tail
   ```

3. **Fix locally**: Reproduce error in dev environment
   ```bash
   npx wrangler dev --remote
   ```

4. **Redeploy**: After fix verified
   ```bash
   npx vitest && npx wrangler deploy
   ```

---

## Success Criteria

- [ ] All unit tests pass (`npx vitest`)
- [ ] Manual local testing succeeds
- [ ] Production deployment succeeds
- [ ] Parse time < 5s (production)
- [ ] Error handling works correctly
- [ ] Token authentication enforced

---

## Monitoring & Observability

### Usage Tracking

```bash
# View real-time logs
npx wrangler tail

# Check browser rendering usage
# Visit: https://dash.cloudflare.com → Workers → Browser Rendering
```

### Expected Metrics (First Week)

| Metric | Expected | Alert If |
|--------|----------|----------|
| Requests/day | 10-100 | > 1000 |
| Avg parse time | 2-4s | > 10s |
| Error rate | < 5% | > 20% |
| Browser hours/month | 0.1-1 hr | > 5 hrs |

---

## Next Steps After Completion

1. **Documentation**: Update README.md with API usage
2. **Caching**: Consider adding KV cache for frequently accessed documents
3. **Rate Limiting**: Implement per-client rate limits
4. **Monitoring**: Set up alerts for high error rates

---

## File Checklist

### New Files Created
- [ ] `src/parser.ts`
- [ ] `src/parser.test.ts`
- [ ] `src/markdown.ts`
- [ ] `src/markdown.test.ts`
- [ ] `src/index.test.ts` (if not exists)
- [ ] `vitest.config.ts` (if not exists)

### Modified Files
- [ ] `src/index.ts`
- [ ] `package.json` (dependencies)
- [ ] `wrangler.toml` (browser binding)

### Configuration
- [ ] `BEARER_TOKEN` secret set
- [ ] Browser binding configured
- [ ] Vitest pool workers configured

---

**Plan Status**: Ready for implementation ✅
**Estimated Time**: 2-3 hours
**Risk Level**: Low (well-researched, tested approach)
