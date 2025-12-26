---
id: GOV-POLICIES-001
version: 1.0.0
status: active
created: 2025-12-26
---

# Governance Policies

Trace:
  spec_id: SPEC-GOVERNANCE-001
  task_id: TASK-GOVERNANCE-001

## Loader and Precedence
- Load order: foundations → policies → workflows → roles → templates → overrides.
- Truth hierarchy: `.spec/` overrides `.governance/`, which overrides `.tasks/`.

## Project Context
- Purpose: Parse KNUE document previews using Cloudflare Workers Browser Rendering API.
- Stack: Cloudflare Workers (TypeScript), @cloudflare/puppeteer, Browser Rendering binding.
- Output: JSON-wrapped Markdown.
- Auth: Bearer token stored in env vars.

## Constraints
- Workers CPU: 30s limit (paid plan).
- Browser Rendering cost: billed per browser hour.
- No persistent browser instances.
- Korean text (UTF-8) must be preserved.

## Development Workflow
1. Research
2. Spec
3. Plan
4. Implement with TDD (red → green → refactor)

## Testing Strategy
- Manual curl tests during development.
- Validate acceptance criteria in specs.
- Prefer real KNUE documents for end-to-end verification.

## Git Policy
### Branching
- Do not commit directly to `main`.
- Use feature branches: `feat/*`, `fix/*`, `docs/*`, `refactor/*`, `chore/*`.

### Commit Messages
```
[Structural|Behavioral] (<scope>) <summary> [task-slug]
```

### Non-commit Items
- Secrets, `node_modules/`, `.wrangler/`, build artifacts, local env files.

### Pre-Commit Checklist
- Type-checks and tests pass.
- No secrets or sensitive logs.
- Commit message format matches policy.

## Maintenance
- When viewer structure changes, update parser and relevant specs.
- When API changes, update specs first, then implementation.
