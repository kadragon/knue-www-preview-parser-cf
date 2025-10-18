# KNUE Document Preview Parser

Cloudflare Workers 기반 서비스로 한국교원대학교 문서 미리보기를 Markdown으로 변환합니다.

## Features

- 🚀 Cloudflare Workers + Browser Rendering API
- 🔐 Bearer Token 인증
- 📝 자동 Markdown 변환
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

```bash
npx wrangler secret put BEARER_TOKEN
# Enter your secure token (generate with: openssl rand -base64 32)
```

### 3. Enable Browser Rendering

Cloudflare Dashboard → Workers & Pages → Browser Rendering → Enable

## Development

### Local Development

```bash
npm run dev
```

서버가 `http://localhost:8787`에서 실행됩니다.

### Type Checking

```bash
npm run type-check
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
    "parsedAt": "2025-10-18T12:00:00.000Z"
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

- Workers Paid plan: $5/month
- Browser Rendering: $5 per 1000 requests
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## Security

- Bearer tokens stored in Cloudflare Workers secrets
- Constant-time token comparison
- No logging of sensitive data

## Limitations

- Request timeout: 30 seconds
- Depends on KNUE document viewer structure
- No content caching (MVP scope)

## Documentation

- [API Specification](./.spec/api.spec.md)
- [Parser Specification](./.spec/parser.spec.md)
- [Implementation Plan](./.tasks/init-project/PLAN.md)

## License

MIT
