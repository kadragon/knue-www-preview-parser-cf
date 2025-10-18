# Research: Cloudflare Browser Rendering API for Preview URL Parsing

**Task**: cf-browser-rendering-parser
**Date**: 2025-10-18
**Status**: Complete

---

## Executive Summary

Cloudflare Browser Rendering API is a fully managed headless browser service that integrates natively with Workers. It supports both Puppeteer and Playwright APIs, making it ideal for parsing JavaScript-heavy pages with iframe content like KNUE preview URLs.

**Key Decision**: Use `@cloudflare/puppeteer` with Workers Bindings approach.

---

## 1. Service Overview

### What is Browser Rendering API?

- **Type**: Managed headless Chromium browser service
- **Integration**: Native Cloudflare Workers binding
- **APIs**: Puppeteer and Playwright (GA since April 2025)
- **Access Methods**:
  - Workers Bindings (for complex automation)
  - REST API (for simple tasks)

### Latest Updates (2025)

- **General Availability**: April 7, 2025
- **New REST Endpoints**: `/json`, `/links`, `/markdown`
- **Free Tier**: Now available
- **Playwright Support**: Added alongside Puppeteer

---

## 2. Pricing Analysis

### Billing Model

- **Metric**: $0.09 per browser hour
- **Billing Start**: August 20, 2025

### Free Tier Allowances

| Plan | Daily/Monthly Limit | Concurrent Browsers |
|------|---------------------|---------------------|
| Workers Free | 10 min/day | 3 |
| Workers Paid | 10 hours/month | 10 (avg) |

### Cost Calculation Methods

- **Workers Bindings**: Duration + Concurrency
- **REST API**: Duration only

### Example Costs

For Workers Paid plan using 50 hours/month:
```
50 hrs - 10 hrs (included) = 40 hrs
40 hrs × $0.09 = $3.60/month
```

**Estimated Cost for Our Use Case**:
- Assumption: ~100 preview URL requests/day
- Average parse time: 2 seconds/request
- Monthly usage: 100 × 30 × 2s = 6,000s ≈ 1.67 hours
- **Cost**: Within free tier (10 hours/month) ✅

---

## 3. Technical Implementation

### Package

```json
{
  "dependencies": {
    "@cloudflare/puppeteer": "^1.0.4"
  }
}
```

### Workers Binding Configuration

`wrangler.toml`:
```toml
browser = { binding = "MYBROWSER" }
```

### Basic Usage Pattern

```typescript
import puppeteer from "@cloudflare/puppeteer";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();

    await page.goto("https://example.com");

    // Parse content
    const data = await page.evaluate(() => {
      return document.body.innerText;
    });

    await browser.close();
    return Response.json({ data });
  },
};
```

---

## 4. Iframe Parsing Techniques

### Method 1: `contentFrame()` (Recommended)

```typescript
// Select iframe element
const iframeElement = await page.$('iframe#innerWrap');

// Get frame context
const frame = await iframeElement.contentFrame();

// Access iframe content
const text = await frame.$eval('#content_body', el => el.innerText);
```

### Method 2: `page.frames()`

```typescript
// Find frame by name or URL
const frame = page.frames().find(f => f.name() === 'innerWrap');

if (frame) {
  await frame.waitForSelector('#content_body');
  const text = await frame.$eval('#content_body', el => el.innerText);
}
```

### Method 3: Direct `evaluate()` in iframe

```typescript
const text = await page.evaluate(() => {
  const iframe = document.getElementById('innerWrap') as HTMLIFrameElement;
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  return iframeDoc.getElementById('content_body').innerText;
});
```

**Choice for KNUE Preview**: Method 3 (fastest, least overhead)

---

## 5. Limitations & Constraints

### Known Limitations

1. **Session Duration**: Max browser session time not publicly documented
2. **Memory**: Limited to Workers runtime constraints
3. **Network**: Outbound requests from browser counted separately
4. **Local Development**: Requires Wrangler with remote mode

### Cloudflare-Specific Differences

From standard Puppeteer:
- No `puppeteer.connect()` - use `puppeteer.launch(env.MYBROWSER)`
- Some Node.js-specific features unavailable (filesystem, etc.)
- Must use Workers-compatible packages only

### KNUE Preview Specific Considerations

1. **Redirect Handling**: URL redirects to actual viewer page
2. **Load Wait**: Must wait for iframe content to fully load
3. **Content Size**: ~5,695 chars (well within limits)
4. **Parsing Time**: Estimated 1-3 seconds per request

---

## 6. Alternative Approaches Considered

### A. Standard Fetch + HTML Parsing

**Pros**: Simple, no browser needed
**Cons**: Fails for preview URLs (JavaScript-rendered iframe)
**Verdict**: ❌ Not viable for preview URLs

### B. External Browser Service (Browserless.io)

**Pros**: Managed, battle-tested
**Cons**: External API latency, additional cost ($50+/mo)
**Verdict**: ❌ More expensive, slower

### C. Hybrid Approach

**Pros**: Cost-optimized (browser only when needed)
**Cons**: Increased complexity
**Verdict**: ✅ Recommended for production

---

## 7. Recommended Architecture

### URL Detection Strategy

```typescript
function needsBrowser(url: string): boolean {
  return url.includes('/previewBbsFile.do');
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url).searchParams.get('url');

    if (needsBrowser(url)) {
      return await parseWithBrowser(url, env);
    } else {
      return await parseWithFetch(url);
    }
  }
}
```

### Error Handling Strategy

1. **Timeout**: Set page.goto timeout (5s)
2. **Retry**: Single retry on failure
3. **Fallback**: Return error JSON if both attempts fail
4. **Logging**: Track failures for monitoring

---

## 8. Development Workflow

### Local Testing

```bash
# Run in remote mode (connects to CF infrastructure)
npx wrangler dev --remote

# Test with curl
curl "http://localhost:8787/?url=https://www.knue.ac.kr/www/previewBbsFile.do?atchmnflNo=78541"
```

### Deployment

```bash
# Deploy to Cloudflare
npx wrangler deploy

# Monitor usage
wrangler tail
```

---

## 9. Key Findings

### ✅ Viable

- Browser Rendering API is production-ready (GA since Apr 2025)
- Free tier covers expected usage (1.67 hrs << 10 hrs/month)
- Puppeteer iframe handling is straightforward
- Native Workers integration = minimal latency

### ⚠️ Watch Out For

- Must handle page load timeouts gracefully
- Need to monitor usage to stay within free tier
- Local dev requires `--remote` flag (can't run fully local)

### 📊 Performance Estimates

| Metric | Estimated Value |
|--------|----------------|
| Parse Time | 1-3 seconds |
| Cost (monthly) | $0 (within free tier) |
| Success Rate | >95% (with retries) |
| Concurrent Limit | 3 browsers (free) / 10 (paid) |

---

## 10. Next Steps

1. **Spec**: Define parsing contract (input/output schema)
2. **Plan**: Detail implementation steps with TDD approach
3. **Implement**: Build parser with tests
4. **Deploy**: Push to Cloudflare and verify

---

## References

- [Browser Rendering Docs](https://developers.cloudflare.com/browser-rendering/)
- [Puppeteer Guide](https://developers.cloudflare.com/browser-rendering/platform/puppeteer/)
- [Pricing](https://developers.cloudflare.com/browser-rendering/platform/pricing/)
- [@cloudflare/puppeteer npm](https://www.npmjs.com/package/@cloudflare/puppeteer)
- [Iframe Handling Guide](https://www.webshare.io/academy-article/puppeteer-iframe)

---

**Research Complete**: 2025-10-18
**Confidence Level**: High ✅
**Ready for Spec Phase**: Yes
