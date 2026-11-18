# KNUE Document Preview Parser

Cloudflare Workers 기반 서비스로 한국교원대학교 문서 미리보기를 Markdown으로 변환합니다.

## Features

- 🚀 Cloudflare Workers + Browser Rendering API
- 🔐 Bearer Token 인증
- 📝 자동 Markdown 변환
- 🗃️ Cloudflare KV 캐시 (기본 TTL 24시간, 설정 가능)
- 🇰🇷 한글 문서 지원
- ⚡ 서버리스 아키텍처

## Requirements

- Cloudflare account (Workers Paid plan)
- Node.js 18+
- Browser Rendering add-on enabled

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

**For Local Development** (`.dev.vars`):

```bash
# Create .dev.vars file
cat > .dev.vars << EOF
BEARER_TOKEN=YourTokenHere
EOF
```

**For Production** (Cloudflare Secrets):

```bash
npx wrangler secret put BEARER_TOKEN
# Enter your secure token (generate with: openssl rand -base64 32)
```

> **Note**: Browser Rendering configuration automatically uses remote browsers in production. For local unit testing, Vitest uses Miniflare with `local: true` (see `vitest.config.ts`).

### 3. Configure KV Namespace

```bash
# Create KV namespace (replace with your own name if needed)
npx wrangler kv namespace create CACHE

# Update wrangler.toml with the generated id/preview_id
```

> 캐시 TTL은 `CACHE_TTL_SECONDS` 환경변수로 조정 가능합니다. (기본값: 86400 초, `0` 또는 음수 → 캐시 비활성화)

### 4. Enable Browser Rendering

Cloudflare Dashboard → Workers & Pages → Browser Rendering → Enable

## Development

### Local Development

```bash
npm run dev
```

서버가 `http://localhost:8787`에서 실행됩니다.

### Run Tests

```bash
npm test
```

### Type Checking

```bash
npm run type-check
```

### Manual Testing (Local)

```bash
# Start dev server with remote browser (requires Cloudflare account)
npm run dev

# In another terminal, test the endpoint
curl -H "Authorization: Bearer YrAvnT6kkrakV4C9c0QRWNrh9dKA04CP7ltGtLZqFEo=" \
  "http://localhost:8787/?atchmnflNo=78541"
```

## Deployment

```bash
npm run deploy
```

## API Usage

### Endpoint

```
GET /?atchmnflNo={number}
```

### Authentication

```
Authorization: Bearer YOUR_TOKEN
```

### Example Request

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://knue-www-preview-parser.your-subdomain.workers.dev/?atchmnflNo=78541"
```

### Success Response (200 OK)

```json
{
  "success": true,
  "content": "# 【한국교원대학교 공고 제2025-202호】\n\n...",
  "metadata": {
    "atchmnflNo": "78541",
    "title": "【한국교원대학교 공고 제2025-202호】",
    "parsedAt": "2025-10-18T12:00:00.000Z",
    "cached": false,
    "cacheTtlSeconds": 86400
  }
}
```

### Error Responses

**401 Unauthorized**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing bearer token"
}
```

**400 Bad Request**
```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Missing required parameter: atchmnflNo"
}
```

**504 Gateway Timeout**
```json
{
  "success": false,
  "error": "Gateway Timeout",
  "message": "Document parsing timeout"
}
```

### TSV Table Export

문서 안의 실제 HTML `<table>`을 빈칸 위치 그대로 TSV로 내려받습니다. 기본 Markdown 응답은 바뀌지 않습니다.

```
GET /?atchmnflNo={number}&format=tsv&table={1-based table number}
```

- 응답: `text/tab-separated-values; charset=utf-8` 첨부 파일 (UTF-8 BOM, CRLF 줄바꿈 — 엑셀에서 바로 열림)
- 셀 안의 줄바꿈·탭은 공백 하나로 합칩니다.
- `=`, `+`, `-`, `@`로 시작해 수식으로 실행될 수 있는 셀은 앞에 `'`를 붙이고, 개수를 `X-Formula-Escaped-Cells` 헤더로 알립니다. 단, `- 명절휴가비`처럼 하이픈+공백 뒤에 한글 등 비ASCII 글자가 오는 목록 기호는 `|`, `!`, 함수 호출(`HYPERLINK(` 등), 셀 참조(`A1` 등)가 없으면 그대로 둡니다.
- 큰따옴표가 들어간 셀은 따옴표로 감싸고 내부 따옴표를 두 번 써서 열 경계가 유지되게 합니다.
- 병합 셀(rowspan/colspan)·중첩 표·열 수가 다른 표는 추정하지 않고 `422`로 거절합니다.
- 표가 없거나 번호가 범위를 벗어나면 `404`, `table` 누락·잘못된 값이나 숫자가 아닌 `atchmnflNo`는 `400`. 뷰어 로딩 실패는 캐시하지 않고 `500`.
- 표 추출 결과는 Markdown 캐시(`doc:{n}`)와 별도 키(`tables:{n}`)에 캐시되며, `DELETE /cache`가 둘 다 지웁니다.

### Cache Invalidation

```
DELETE /cache?atchmnflNo={number}
Authorization: Bearer YOUR_TOKEN
```

**성공 응답 (200):**
```json
{
  "success": true,
  "content": null,
  "metadata": {
    "atchmnflNo": "78541",
    "cached": false,
    "cacheTtlSeconds": 86400
  }
}
```

## Project Structure

```
.
├── .agents/          # Operational policies
├── .spec/            # API & parser specifications
├── .tasks/           # Task planning & research
├── src/
│   ├── index.ts      # Main worker entry
│   ├── auth.ts       # Authentication logic
│   ├── parser.ts     # Document parser
│   └── types.ts      # TypeScript interfaces
├── wrangler.toml     # Cloudflare Workers config
├── package.json
└── tsconfig.json
```

## Pricing

### Browser Rendering (as of Oct 2024)

**Free Tier (Workers Paid Plan)**:
- 10 hours browser usage per month
- 10 concurrent browsers (averaged monthly)
- **Estimated cost for typical usage**: $0/month (within free tier)

**Pay-as-you-go**:
- $0.09 per browser hour
- Billing starts after exceeding free tier

**Example**: 100 requests/day × 3 seconds each = ~2.5 hours/month → **Free** ✅

See [Cloudflare Browser Rendering Pricing](https://developers.cloudflare.com/browser-rendering/platform/pricing/)

## Security

- Bearer tokens stored in Cloudflare Workers secrets
- Constant-time token comparison
- No logging of sensitive data

## Limitations

- Request timeout: 30 seconds
- Depends on KNUE document viewer structure
- KV 캐시 전파 지연: 최대 60초 (Cloudflare KV 특성)
- TTL 0 이하 설정 시 캐시 비활성화 (실시간 강제 파싱)

## Documentation

- [API Specification](./.spec/api.spec.md)
- [Parser Specification](./.spec/parser.spec.md)
- [Implementation Plan](./.tasks/init-project/PLAN.md)

## License

MIT
