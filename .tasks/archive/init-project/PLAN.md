---
task: init-project
created: 2025-10-18
status: in_progress
estimated-duration: 2-3 hours
---

# Implementation Plan: KNUE Document Preview Parser

## Overview

Cloudflare Workers 기반 문서 파싱 서비스를 구축하여 한국교원대학교 미리보기 문서를 Markdown으로 변환합니다.

## Prerequisites

- Cloudflare account (Workers Paid plan required)
- Node.js 18+ installed
- npm or pnpm
- Browser Rendering add-on enabled in Cloudflare dashboard

## Phase 1: Project Initialization

### Step 1.1: Initialize npm project
```bash
npm init -y
```

**Expected output:** `package.json` created

### Step 1.2: Install dependencies
```bash
npm install --save @cloudflare/puppeteer
npm install --save-dev wrangler typescript @cloudflare/workers-types
```

**Expected output:** `node_modules/`, `package-lock.json` created

### Step 1.3: Create configuration files
- Create `wrangler.toml`
- Create `tsconfig.json`
- Create `.gitignore`

**Validation:** Run `npx wrangler --version`

## Phase 2: Project Structure Setup

### Step 2.1: Create source directories
```bash
mkdir -p src
```

### Step 2.2: Create source files
- `src/index.ts` - Main worker entry point
- `src/types.ts` - TypeScript interfaces
- `src/auth.ts` - Authentication utilities
- `src/parser.ts` - Document parser logic

**Validation:** Directory structure matches SPEC-DELTA.md

## Phase 3: Core Implementation

### Step 3.1: Implement types (src/types.ts)

**Tasks:**
- Define `Env` interface
- Define `ParseResult` interface
- Define `ApiResponse` types

**Acceptance:**
- TypeScript compiles without errors
- All interfaces exported

### Step 3.2: Implement authentication (src/auth.ts)

**Tasks:**
- Implement `extractBearerToken(request)`
- Implement `validateToken(token, expected)`
- Use constant-time comparison

**Acceptance:**
- Valid token passes
- Invalid token fails
- Missing token fails
- Timing attack resistant

**Test cases:**
```typescript
// Valid
Authorization: Bearer correct-token → true

// Invalid
Authorization: Bearer wrong-token → false
Authorization: Token correct-token → false
(no header) → false
```

### Step 3.3: Implement parser (src/parser.ts)

**Tasks:**
- Implement `parseDocument(atchmnflNo, browser)`
- Implement `extractTextFromPage(page)`
- Implement `convertToMarkdown(textNodes)`

**Acceptance:**
- Navigates to correct URL
- Waits for iframe to load
- Extracts text nodes correctly
- Converts to Markdown format
- Extracts document title

**Test with:** `atchmnflNo=78541`

### Step 3.4: Implement main worker (src/index.ts)

**Tasks:**
- Implement request handler
- Integrate authentication
- Integrate parser
- Implement error handling
- Add timeout protection
- Return proper JSON responses

**Acceptance:**
- Handles all error cases per api.spec.md
- Returns correct status codes
- Returns proper JSON format
- Cleans up browser resources

## Phase 4: Local Testing

### Step 4.1: Configure environment
```bash
npx wrangler secret put BEARER_TOKEN --env dev
# Enter: test-token-dev
```

### Step 4.2: Run local development server
```bash
npm run dev
```

**Expected:** Server running on http://localhost:8787

### Step 4.3: Test endpoints

**Test 1: Valid request**
```bash
curl -H "Authorization: Bearer test-token-dev" \
  "http://localhost:8787/?atchmnflNo=78541"
```
**Expected:** 200 OK with Markdown content

**Test 2: Missing token**
```bash
curl "http://localhost:8787/?atchmnflNo=78541"
```
**Expected:** 401 Unauthorized

**Test 3: Invalid token**
```bash
curl -H "Authorization: Bearer wrong" \
  "http://localhost:8787/?atchmnflNo=78541"
```
**Expected:** 401 Unauthorized

**Test 4: Missing parameter**
```bash
curl -H "Authorization: Bearer test-token-dev" \
  "http://localhost:8787/"
```
**Expected:** 400 Bad Request

**Test 5: Different document**
```bash
curl -H "Authorization: Bearer test-token-dev" \
  "http://localhost:8787/?atchmnflNo=78542"
```
**Expected:** 200 OK or error if document doesn't exist

### Step 4.4: Verify output format

**Checklist:**
- [ ] Response is valid JSON
- [ ] Contains `success`, `content`, `metadata` fields
- [ ] `metadata.atchmnflNo` matches request
- [ ] `metadata.parsedAt` is ISO-8601
- [ ] `metadata.title` extracted correctly
- [ ] `content` is valid Markdown
- [ ] Korean characters preserved
- [ ] Structure preserved (headings, lists, etc.)

## Phase 5: Deployment

### Step 5.1: Set production token
```bash
npx wrangler secret put BEARER_TOKEN
# Enter: <strong-random-token>
```

**Generate secure token:**
```bash
openssl rand -base64 32
```

### Step 5.2: Deploy to Cloudflare
```bash
npm run deploy
```

**Expected:** Worker deployed to `*.workers.dev`

### Step 5.3: Test production endpoint
```bash
curl -H "Authorization: Bearer <prod-token>" \
  "https://knue-www-preview-parser.your-subdomain.workers.dev/?atchmnflNo=78541"
```

**Expected:** Same results as local testing

### Step 5.4: Monitor first requests

**Cloudflare Dashboard:**
- Check Analytics → Workers
- Verify requests succeed
- Check error rates
- Check duration (should be <30s)

## Phase 6: Documentation

### Step 6.1: Create README.md

**Contents:**
- Project description
- Setup instructions
- Usage examples
- API documentation
- Environment variables
- Deployment guide

### Step 6.2: Document API usage

**For clients:**
```markdown
# API Usage

## Endpoint
https://knue-www-preview-parser.your-subdomain.workers.dev/

## Authentication
Authorization: Bearer YOUR_TOKEN

## Request
GET /?atchmnflNo={number}

## Response
{
  "success": true,
  "content": "# Document Title\n\n...",
  "metadata": { ... }
}
```

### Step 6.3: Update .agents/AGENTS.md

**Document:**
- Project purpose
- Key decisions
- Maintenance notes
- Known limitations

## Phase 7: Verification & Cleanup

### Step 7.1: Final acceptance testing

**Run all test cases from Phase 4 against production**

**Checklist:**
- [ ] All API contract tests pass
- [ ] Authentication works correctly
- [ ] Parser handles Korean text
- [ ] Error responses correct
- [ ] Performance acceptable (<30s)

### Step 7.2: Code review

**Review:**
- [ ] No hardcoded secrets
- [ ] Error messages don't leak sensitive info
- [ ] TypeScript strict mode passes
- [ ] No console.logs in production code
- [ ] Browser cleanup in all paths

### Step 7.3: Archive task

**Update files:**
- Mark PLAN.md as completed
- Update PROGRESS.md with results
- Move to `.tasks/_archive/` if needed

## Rollback Plan

**If deployment fails:**

1. Check Cloudflare dashboard for errors
2. Verify Browser Rendering enabled
3. Verify BEARER_TOKEN set
4. Check wrangler.toml syntax
5. Rollback to previous version:
   ```bash
   npx wrangler rollback
   ```

## Success Criteria

### Must Have
- [x] Worker deployed and accessible
- [x] Authentication working
- [x] Document parsing working for atchmnflNo=78541
- [x] Markdown output correct
- [x] Error handling implemented
- [x] All tests pass

### Nice to Have
- [ ] Performance optimization
- [ ] Caching layer
- [ ] Rate limiting
- [ ] Monitoring/alerting
- [ ] Multiple document format support

## Next Steps (Future)

1. Add rate limiting per token
2. Implement caching with KV storage
3. Add webhook notifications
4. Support batch parsing
5. Add metrics/logging
6. Create client SDKs

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 15 min | - |
| Phase 2 | 10 min | Phase 1 |
| Phase 3 | 90 min | Phase 2 |
| Phase 4 | 30 min | Phase 3 |
| Phase 5 | 20 min | Phase 4 |
| Phase 6 | 30 min | Phase 5 |
| Phase 7 | 15 min | Phase 6 |
| **Total** | **3h 30m** | |

## Notes

- Browser Rendering incurs costs: $5/1000 requests
- Keep token secret, rotate periodically
- Monitor usage in Cloudflare dashboard
- Document viewer structure may change - update parser accordingly
