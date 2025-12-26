# Patterns

Trace:
  spec_id: SPEC-GOVERNANCE-001
  task_id: TASK-GOVERNANCE-001

- TDD loop: failing test → minimal pass → refactor.
- API flow: authenticate → validate input → parse/cached fetch → respond.
- Cache key: `doc:{atchmnflNo}` with TTL control via env.
- Parsing: extract text nodes, normalize whitespace, map headings/lists to Markdown.
