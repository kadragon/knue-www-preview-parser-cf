# Project Memory

Trace:
  spec_id: SPEC-GOVERNANCE-001
  task_id: TASK-GOVERNANCE-001

- Purpose: KNUE document preview parser on Cloudflare Workers using Browser Rendering API.
- Auth: Bearer token in `BEARER_TOKEN` env.
- Parser strategy: extract text from iframe content and convert to Markdown.
- Performance: target under 30s; Browser Rendering costs apply.
- Caching: KV caching planned with TTL and invalidation endpoint.
- Known risk: KNUE viewer structure may change; update selectors and specs accordingly.
- Security: never log tokens or full URLs.
- 2025-12-26: Compacted governance/spec/tasks structure; archived legacy .agents/.tasks/.spec markdown files.
- 2025-12-26: Aligned specs with current parser (innerWrap/content_body, fixed wait) and API errors; reduced request timeout to 30s and added table conversion in parser.
