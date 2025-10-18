---
id: SPEC-PARSER-001
version: 1.0.0
status: active
created: 2025-10-18
owner: kadragon
---

# Parser Specification - Document Content Extraction

## Contract

### Input
- URL: `https://www.knue.ac.kr/www/previewBbsFile.do?atchmnflNo={number}`
- Browser instance from Cloudflare Browser Rendering API

### Output
- Structured text content as Markdown string
- Document metadata (title)

## Parsing Strategy

### Step 1: Page Navigation
```typescript
await page.goto(`https://www.knue.ac.kr/www/previewBbsFile.do?atchmnflNo=${atchmnflNo}`);
```

### Step 2: Wait for Content
- Wait for iframe with id/name "content" to load
- Wait for StaticText nodes to appear in accessibility tree
- Timeout: 20 seconds

### Step 3: Extract Content
- Use accessibility tree snapshot (CDP: `Accessibility.getFullAXTree`)
- Extract all StaticText nodes in document order
- Filter out UI elements (navigation, buttons)

### Step 4: Structure Detection
- Detect headings: text in `【】` brackets or `===` separators
- Detect lists: lines starting with `ㆍ`, `-`, `‣`, numbered patterns
- Detect tables: consecutive lines with column-aligned text
- Detect paragraphs: blank line separated text blocks

### Step 5: Markdown Conversion
- Convert headings to `#`, `##`, `###` based on hierarchy
- Convert lists to `- ` or `1. ` format
- Convert tables to Markdown table format
- Preserve line breaks within paragraphs

## Acceptance Criteria

### AC-1: Text Extraction
- MUST extract all visible text from document viewer
- MUST preserve text order as rendered
- MUST NOT include viewer UI elements (buttons, info bar)

### AC-2: Structure Recognition
- MUST detect title from first `【...】` pattern or similar
- MUST recognize section headings (lines with `１`, `２`, etc.)
- MUST recognize bullet points (`ㆍ`, `-`, `‣`)
- MUST recognize numbered lists

### AC-3: Whitespace Normalization
- MUST collapse multiple spaces to single space
- MUST preserve intentional line breaks
- MUST NOT create excessive blank lines (max 2 consecutive)
- MUST trim leading/trailing whitespace per line

### AC-4: Table Handling
- SHOULD detect table-like structures
- SHOULD convert to Markdown table format
- MAY fallback to plain text if table detection fails

### AC-5: Special Characters
- MUST preserve Korean characters correctly (UTF-8)
- MUST preserve special symbols (`【】`, `ㆍ`, `‣`, `○`, `□`)
- MUST handle mixed Korean/English/numbers

## Examples

### Example 1: Title Extraction
**Input:**
```
StaticText: "【한국교원대학교 공고 제2025-202호】"
```

**Output:**
```markdown
# 【한국교원대학교 공고 제2025-202호】
```

### Example 2: Section Heading
**Input:**
```
StaticText: "１ 채용분야 및 담당업무"
```

**Output:**
```markdown
## １ 채용분야 및 담당업무
```

### Example 3: Bullet List
**Input:**
```
StaticText: "ㆍ한국교원대학교 RISE 사업 운영 관리"
StaticText: "  - RISE 사업 관리, 운영 전반"
StaticText: "  - 단위과제별 사업계획서 및 연차평가 보고서 등 작성 지원"
```

**Output:**
```markdown
- 한국교원대학교 RISE 사업 운영 관리
  - RISE 사업 관리, 운영 전반
  - 단위과제별 사업계획서 및 연차평가 보고서 등 작성 지원
```

### Example 4: Table
**Input:**
```
StaticText: "직종"
StaticText: "채용인원"
StaticText: "채용분야"
StaticText: "사무원"
StaticText: "1명"
StaticText: "RISE사업운영"
```

**Output:**
```markdown
| 직종 | 채용인원 | 채용분야 |
|------|----------|----------|
| 사무원 | 1명 | RISE사업운영 |
```

## Implementation Notes

### Browser Rendering API Usage
```typescript
const browser = await puppeteer.launch(env.BROWSER);
const page = await browser.newPage();

try {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  
  const content = await page.evaluate(() => {
    const iframe = document.querySelector('iframe#content');
    if (!iframe) return null;
    
    const walker = document.createTreeWalker(
      iframe.contentDocument.body,
      NodeFilter.SHOW_TEXT
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        textNodes.push(node.textContent);
      }
    }
    
    return textNodes.join('\n');
  });
  
  return parseToMarkdown(content);
} finally {
  await browser.close();
}
```

### Markdown Conversion Logic
```typescript
function parseToMarkdown(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (/^【.*】$/.test(trimmed)) {
      result.push(`# ${trimmed}`);
    } else if (/^[１２３４５６７８９０]/.test(trimmed)) {
      result.push(`\n## ${trimmed}`);
    } else if (/^[ㆍ‣○]/.test(trimmed)) {
      result.push(`- ${trimmed.substring(1).trim()}`);
    } else {
      result.push(trimmed);
    }
  }
  
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
}
```

## Edge Cases

### EC-1: Empty Document
- IF no text extracted, RETURN error "Document is empty or failed to load"

### EC-2: Malformed HTML
- IF iframe not found, RETRY once after 2s delay
- IF still fails, RETURN error "Document viewer failed to load"

### EC-3: Very Long Documents
- NO size limit (Cloudflare Workers: 128MB response limit)
- SHOULD stream if content exceeds 10MB (future enhancement)

### EC-4: Mixed Languages
- MUST handle Korean, English, numbers, symbols
- PRESERVE original text encoding
