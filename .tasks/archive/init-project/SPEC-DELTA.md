---
task: init-project
created: 2025-10-18
status: in_progress
references:
  - ../../.spec/api.spec.md
  - ../../.spec/parser.spec.md
---

# Spec Delta: Implementation-Specific Details

## API Implementation

### Request Handler
```typescript
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // 1. Authenticate
    // 2. Validate parameters
    // 3. Parse document
    // 4. Return response
  }
}
```

### Environment Interface
```typescript
interface Env {
  BEARER_TOKEN: string;
  BROWSER: Fetcher;
}
```

### Response Helpers
```typescript
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function errorResponse(error: string, message: string, status: number): Response {
  return jsonResponse({ success: false, error, message }, status);
}

function successResponse(content: string, metadata: any): Response {
  return jsonResponse({ success: true, content, metadata });
}
```

## Authentication Implementation

### Token Extraction
```typescript
function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
```

### Token Validation
```typescript
function validateToken(token: string | null, expectedToken: string): boolean {
  if (!token || !expectedToken) return false;
  
  if (token.length !== expectedToken.length) return false;
  
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  
  return result === 0;
}
```

## Document Parser Implementation

### Main Parser Function
```typescript
async function parseDocument(
  atchmnflNo: string,
  browser: Fetcher
): Promise<{ content: string; title: string }> {
  const puppeteer = await import('@cloudflare/puppeteer');
  
  const browserInstance = await puppeteer.launch(browser);
  const page = await browserInstance.newPage();
  
  try {
    const url = `https://www.knue.ac.kr/www/previewBbsFile.do?atchmnflNo=${atchmnflNo}`;
    
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 20000
    });
    
    const rawText = await extractTextFromPage(page);
    
    const { content, title } = convertToMarkdown(rawText);
    
    return { content, title };
  } finally {
    await browserInstance.close();
  }
}
```

### Text Extraction
```typescript
async function extractTextFromPage(page: Page): Promise<string[]> {
  await page.waitForSelector('iframe#content', { timeout: 10000 });
  
  const textNodes = await page.evaluate(() => {
    const iframe = document.querySelector('iframe#content') as HTMLIFrameElement;
    if (!iframe || !iframe.contentDocument) {
      throw new Error('Iframe not found or inaccessible');
    }
    
    const walker = document.createTreeWalker(
      iframe.contentDocument.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const text = node.textContent?.trim() || '';
          if (text.length === 0) return NodeFilter.FILTER_REJECT;
          
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    const texts: string[] = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text) texts.push(text);
    }
    
    return texts;
  });
  
  return textNodes;
}
```

### Markdown Conversion
```typescript
interface ConversionResult {
  content: string;
  title: string;
}

function convertToMarkdown(textNodes: string[]): ConversionResult {
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
    }
    else if (/^[１２３４５６７８９０]+\s+/.test(text)) {
      if (!previousWasBlank) lines.push('');
      lines.push(`## ${text}`);
      previousWasBlank = false;
    }
    else if (/^={3,}/.test(text)) {
      lines.push('');
      lines.push('---');
      lines.push('');
      previousWasBlank = true;
    }
    else if (/^[ㆍ‣○□]\s*/.test(text)) {
      const cleaned = text.replace(/^[ㆍ‣○□]\s*/, '');
      lines.push(`- ${cleaned}`);
      previousWasBlank = false;
    }
    else if (/^\s*-\s+/.test(text)) {
      lines.push(text);
      previousWasBlank = false;
    }
    else if (text.length < 50 && /^[0-9]+\.\s+/.test(text)) {
      lines.push(text);
      previousWasBlank = false;
    }
    else {
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
```

## Error Handling

### Timeout Handler
```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeout]);
}
```

### Usage
```typescript
try {
  const result = await withTimeout(
    parseDocument(atchmnflNo, env.BROWSER),
    28000,
    'Document parsing timeout'
  );
  
  return successResponse(result.content, {
    atchmnflNo,
    title: result.title,
    parsedAt: new Date().toISOString()
  });
} catch (error) {
  if (error.message.includes('timeout')) {
    return errorResponse('Gateway Timeout', error.message, 504);
  }
  
  return errorResponse('Internal Server Error', 'Failed to parse document', 500);
}
```

## Project Structure

```
knue-www-preview-parser-cf/
├── .agents/              # Operational policies
│   ├── AGENTS.md
│   └── 10-policies/
├── .spec/                # Specifications
│   ├── api.spec.md
│   └── parser.spec.md
├── .tasks/               # Task planning
│   └── init-project/
│       ├── RESEARCH.md
│       ├── SPEC-DELTA.md
│       └── PLAN.md
├── src/
│   ├── index.ts          # Main worker entry
│   ├── auth.ts           # Authentication logic
│   ├── parser.ts         # Document parser
│   └── types.ts          # TypeScript interfaces
├── wrangler.toml         # Cloudflare Workers config
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration Files

### wrangler.toml
```toml
name = "knue-www-preview-parser"
main = "src/index.ts"
compatibility_date = "2025-10-18"
node_compat = true

[[browser]]
binding = "BROWSER"
```

### package.json
```json
{
  "name": "knue-www-preview-parser-cf",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev --remote",
    "deploy": "wrangler deploy",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241011.0",
    "typescript": "^5.6.3",
    "wrangler": "^3.80.4"
  },
  "dependencies": {
    "@cloudflare/puppeteer": "^0.0.11"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types/2023-07-01"],
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## Testing Strategy

### Manual Testing
```bash
# Set environment variable
npx wrangler secret put BEARER_TOKEN
# Enter: test-token-123

# Test with curl
curl -H "Authorization: Bearer test-token-123" \
  "https://your-worker.workers.dev/?atchmnflNo=78541"

# Test auth failure
curl "https://your-worker.workers.dev/?atchmnflNo=78541"

# Test missing parameter
curl -H "Authorization: Bearer test-token-123" \
  "https://your-worker.workers.dev/"
```

### Future: Automated Tests
- Unit tests for auth validation
- Unit tests for markdown conversion
- Integration tests with mock browser
- E2E tests with real documents

## Deployment Checklist

- [ ] Set BEARER_TOKEN secret
- [ ] Enable Browser Rendering in dashboard
- [ ] Verify Workers Paid plan active
- [ ] Deploy to production
- [ ] Test with production token
- [ ] Monitor first requests
- [ ] Document usage for clients
