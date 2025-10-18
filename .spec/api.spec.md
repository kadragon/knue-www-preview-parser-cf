---
id: SPEC-API-001
version: 1.0.0
status: active
created: 2025-10-18
owner: kadragon
---

# API Specification - KNUE Document Preview Parser

## Contract

### Endpoint
```
GET /?atchmnflNo={number}
```

### Authentication
```
Authorization: Bearer {token}
```

### Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| atchmnflNo | string | Yes | Document attachment file number from KNUE preview URL |

### Response Format

#### Success Response (200 OK)
```json
{
  "success": true,
  "content": "# Document Title\n\n...",
  "metadata": {
    "atchmnflNo": "78541",
    "title": "Document Title",
    "parsedAt": "2025-10-18T12:00:00.000Z"
  }
}
```

#### Error Responses

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

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "Failed to parse document"
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

## Acceptance Criteria

### AC-1: Authentication
- MUST validate Bearer token from Authorization header
- MUST reject requests without valid token (401)
- MUST reject requests with missing Authorization header (401)

### AC-2: Parameter Validation
- MUST validate presence of `atchmnflNo` query parameter
- MUST return 400 if `atchmnflNo` is missing
- MUST accept numeric string values for `atchmnflNo`

### AC-3: Document Parsing
- MUST navigate to `https://www.knue.ac.kr/www/previewBbsFile.do?atchmnflNo={number}`
- MUST wait for document viewer to fully render
- MUST extract text content from accessibility tree
- MUST convert extracted text to Markdown format

### AC-4: Markdown Conversion
- MUST preserve document structure (headings, paragraphs, lists)
- MUST detect title from first heading-like text
- MUST normalize whitespace (no excessive blank lines)
- MUST handle tables if present

### AC-5: Response Format
- MUST return JSON response with `success`, `content`, `metadata` fields
- MUST include ISO-8601 timestamp in `parsedAt`
- MUST include original `atchmnflNo` in metadata

### AC-6: Error Handling
- MUST handle network errors gracefully
- MUST handle timeout scenarios (30s default)
- MUST return appropriate HTTP status codes
- MUST include descriptive error messages

### AC-7: Performance
- SHOULD complete parsing within 30 seconds
- MUST timeout and return 504 if exceeds limit

## Examples

### Example 1: Successful Parse
**Request:**
```http
GET /?atchmnflNo=78541 HTTP/1.1
Host: your-worker.workers.dev
Authorization: Bearer secret-token-123
```

**Response:**
```json
{
  "success": true,
  "content": "# 【한국교원대학교 공고 제2025-202호】\n\n2025학년도 한국교원대학교 지역혁신중심 대학지원체계(RISE) 사업전담직원(기간제) 채용 공고문(안)\n\n...",
  "metadata": {
    "atchmnflNo": "78541",
    "title": "【한국교원대학교 공고 제2025-202호】",
    "parsedAt": "2025-10-18T12:00:00.000Z"
  }
}
```

### Example 2: Missing Token
**Request:**
```http
GET /?atchmnflNo=78541 HTTP/1.1
Host: your-worker.workers.dev
```

**Response:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing bearer token"
}
```

### Example 3: Missing Parameter
**Request:**
```http
GET / HTTP/1.1
Host: your-worker.workers.dev
Authorization: Bearer secret-token-123
```

**Response:**
```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Missing required parameter: atchmnflNo"
}
```

## Non-Functional Requirements

### Security
- Bearer token MUST be stored in Cloudflare Workers environment variable
- MUST NOT log sensitive information (tokens, full URLs)
- SHOULD implement rate limiting if abuse detected

### Reliability
- MUST handle browser rendering failures
- MUST clean up browser resources after each request
- SHOULD retry failed requests once before returning error

### Observability
- SHOULD log request metadata (timestamp, atchmnflNo, duration)
- SHOULD NOT log response content (privacy)
- MUST log errors with stack traces
