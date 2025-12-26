# Coding Style

Trace:
  spec_id: SPEC-GOVERNANCE-001
  task_id: TASK-GOVERNANCE-001

- Language: TypeScript for Worker code.
- Formatting: prefer clear, small functions with explicit return types where helpful.
- Errors: return structured JSON error payloads with HTTP status codes.
- Security: constant-time token comparison; avoid sensitive logs.
- API responses: include `success`, `content`, `metadata` fields.
