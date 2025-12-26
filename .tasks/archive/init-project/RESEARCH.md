---
task: init-project
created: 2025-10-18
status: in_progress
---

# Research: KNUE Document Preview Parser

## Problem Statement

한국교원대학교 홈페이지의 문서 미리보기 기능은 JavaScript 기반 문서뷰어를 사용하여 렌더링됩니다. 일반적인 HTTP 요청으로는 문서 내용을 가져올 수 없으며, 브라우저 렌더링이 필요합니다.

## Key Findings

### 1. Document Viewer Architecture

**URL Pattern:**
```
https://www.knue.ac.kr/www/previewBbsFile.do?atchmnflNo={number}
```

**Viewer Structure:**
- Main page redirects to: `https://www.knue.ac.kr/sn3hcv/skin/doc.html?fn=...&rs=...`
- Content loaded in iframe with id="content"
- Document rendered as DOM nodes (not canvas/PDF)
- Each text fragment exposed as StaticText accessibility node

**Sample Analysis (atchmnflNo=78541):**
- Document type: HWP (한글) converted to HTML viewer
- Total text nodes: ~1700+
- Structure: Hierarchical with headings, lists, tables
- Encoding: UTF-8 Korean

### 2. Cloudflare Workers Browser Rendering

**Documentation:**
- Cloudflare Puppeteer: https://developers.cloudflare.com/browser-rendering/
- Based on Chromium via Puppeteer API
- Requires Workers Paid plan ($5/month base)
- Browser Rendering: $5 per 1000 requests

**Binding Configuration:**
```toml
[[browser]]
binding = "BROWSER"
```

**Usage Pattern:**
```typescript
import puppeteer from "@cloudflare/puppeteer";

export default {
  async fetch(request, env) {
    const browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    // ... use page
    await browser.close();
  }
}
```

### 3. Authentication Strategy

**Bearer Token:**
- Simplest implementation
- Store in environment variable
- Validate via header check

**Alternative Considered:**
- API Key (X-API-Key header): Similar complexity
- IP Whitelist: Not suitable for dynamic environments
- OAuth2: Overkill for single-user service

**Decision:** Bearer Token
- Store in `BEARER_TOKEN` env variable
- Validate: `Authorization: Bearer {token}`
- Constant-time comparison to prevent timing attacks

### 4. Text Extraction Strategy

**Option 1: page.evaluate() with DOM traversal** ✅
```typescript
const text = await page.evaluate(() => {
  const iframe = document.querySelector('iframe#content');
  const walker = document.createTreeWalker(
    iframe.contentDocument.body,
    NodeFilter.SHOW_TEXT
  );
  const nodes = [];
  while (node = walker.nextNode()) {
    nodes.push(node.textContent);
  }
  return nodes;
});
```

**Option 2: Accessibility Tree API**
```typescript
const snapshot = await page.accessibility.snapshot();
// Traverse AXTree
```

**Option 3: innerHTML parsing**
```typescript
const html = await page.evaluate(() => {
  return document.querySelector('iframe#content').contentDocument.body.innerHTML;
});
```

**Decision:** Option 1 (DOM TreeWalker)
- Preserves text order
- Filters out non-visible elements
- Direct access to structure

### 5. Markdown Conversion

**Libraries Considered:**
- turndown: HTML → Markdown (requires HTML input)
- remark: Markdown processing (not needed)
- Custom parser: Best fit for structured text

**Strategy:**
1. Extract text nodes in order
2. Detect patterns (headings, lists, tables)
3. Apply Markdown formatting rules
4. Normalize whitespace

**Pattern Detection:**
- Title: `【...】` or first large heading
- Sections: `１`, `２`, `===` separators
- Lists: `ㆍ`, `-`, `‣`, `○`, `□`
- Tables: Column-aligned consecutive rows

### 6. Error Handling Scenarios

| Scenario | Status Code | Handling |
|----------|-------------|----------|
| Missing token | 401 | Return auth error |
| Invalid token | 401 | Return auth error |
| Missing atchmnflNo | 400 | Return validation error |
| Page load timeout | 504 | Return timeout error |
| Viewer not loaded | 500 | Retry once, then error |
| Network error | 502 | Return network error |
| Unknown error | 500 | Log & return generic error |

### 7. Performance Considerations

**Timeouts:**
- Page navigation: 20s
- Total request: 30s (Workers limit: 30s CPU time on Paid plan)
- Browser launch: ~2-3s
- Content extraction: <1s

**Optimization:**
- Wait for `networkidle0` to ensure full load
- Early timeout on stuck requests
- Reuse browser instances? (Not supported by Cloudflare)

**Limitations:**
- Cold start: ~3-5s
- Warm requests: ~8-12s estimated
- Concurrent requests: Limited by browser binding

### 8. Development & Deployment

**Local Development:**
```bash
npm install
npx wrangler dev --remote
```

**Environment Variables:**
```bash
npx wrangler secret put BEARER_TOKEN
```

**Deployment:**
```bash
npx wrangler deploy
```

**Testing:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-worker.workers.dev/?atchmnflNo=78541"
```

## Dependencies

### Required
- `@cloudflare/workers-types`: TypeScript definitions
- `@cloudflare/puppeteer`: Browser automation
- `wrangler`: Cloudflare Workers CLI

### Development
- `typescript`: Type checking
- `@types/node`: Node.js types (for development)

## Open Questions

1. **Browser instance lifecycle:** Can we reuse across requests?
   - Answer: No, Cloudflare doesn't support persistent browsers
   
2. **Content caching:** Should we cache parsed content?
   - Decision: No, out of scope for MVP
   
3. **Rate limiting:** How to prevent abuse?
   - Decision: Defer to future, rely on token secrecy

4. **Iframe access:** Can we access cross-origin iframe content?
   - Answer: Yes, same-origin after navigation (knue.ac.kr)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Viewer structure changes | High | Monitor & update parser logic |
| Browser rendering cost | Medium | Token auth limits usage |
| Timeout on large docs | Medium | Increase timeout, optimize extraction |
| Unicode handling | Low | UTF-8 everywhere, tested with Korean |

## Next Steps

1. Create SPEC-DELTA.md with specific implementation details
2. Create PLAN.md with step-by-step implementation tasks
3. Initialize project structure (package.json, wrangler.toml)
4. Implement core worker logic
5. Test with sample documents
