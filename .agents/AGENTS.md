---
id: AGENTS-LOADER-001
version: 1.0.0
status: active
created: 2025-10-18
---

# AGENTS Loader - KNUE Document Preview Parser

> Modular policy loader for Cloudflare Workers project.
> All records in `.agents/`, `.tasks/`, `.spec/` use **English**.
> All user-facing outputs use **Korean**.

## Load Order

```
1. 00-foundations/    # Core principles, terminology
2. 10-policies/       # Global rules (git, commits, testing)
3. 20-workflows/      # RSP-I workflow, TDD, SDD
4. 30-roles/          # Role-based behaviors
5. 40-templates/      # Standard templates
6. 90-overrides/      # Exceptions (if any)
```

Files load lexicographically within each folder.
Higher numeric prefix = higher precedence.

## Truth Hierarchy

1. **`.spec/`** - Canonical specifications (API contract, parser behavior)
2. **`.agents/`** - Operational policies and workflows
3. **`.tasks/`** - Task-specific research and plans

On conflict: `.spec/` overrides all.

## Project Context

### Purpose
Parse KNUE (한국교원대학교) document previews using Cloudflare Workers Browser Rendering API.

### Key Technologies
- Cloudflare Workers (TypeScript)
- Puppeteer (@cloudflare/puppeteer)
- Browser Rendering API binding

### Architecture Decisions
- **Authentication:** Bearer Token (stored in env var)
- **Parsing Strategy:** DOM TreeWalker extraction
- **Output Format:** JSON-wrapped Markdown
- **Error Handling:** HTTP status codes per REST conventions

### Constraints
- Workers CPU time: 30s limit (Paid plan)
- Browser Rendering: $5/1000 requests
- No persistent browser instances
- Korean (UTF-8) text support required

## Core Workflows

### Development Workflow (RSP-I)
1. **Research** - Analyze document viewer, APIs, constraints
2. **Spec** - Define contracts in `.spec/`
3. **Plan** - Create step-by-step implementation plan
4. **Implement** - TDD: failing test → minimal pass → refactor

### Testing Strategy
- Manual testing with curl during development
- Validate all acceptance criteria from `.spec/`
- Test with real KNUE documents (atchmnflNo=78541)
- Future: Unit tests for auth, parser logic

### Commit Policy
- Feature branches only (no commits to main)
- Format: `[Structural|Behavioral] (<scope>) <summary> [task-slug]`
- Examples:
  - `[Structural] (parser) Add markdown conversion utilities [init-project]`
  - `[Behavioral] (api) Implement bearer token auth [init-project]`

## File Organization

```
.agents/          # This directory - policies in English
.spec/            # API & parser specifications
.tasks/           # Task research, plans, progress
  init-project/   # Current task
    RESEARCH.md   # Investigation findings
    SPEC-DELTA.md # Implementation details
    PLAN.md       # Step-by-step execution plan
src/              # Source code (TypeScript)
wrangler.toml     # Cloudflare Workers config
```

## Security & Privacy

### Secrets Management
- `BEARER_TOKEN` stored in Cloudflare Workers secrets
- Never log tokens or full request URLs
- Use constant-time comparison for token validation

### Data Handling
- No caching of document content (MVP scope)
- No logging of parsed content (privacy)
- Only log: timestamp, atchmnflNo, duration, errors

## Known Limitations

1. **Document Viewer Changes:** Parser logic depends on KNUE's viewer structure
2. **Cost:** Browser rendering incurs per-request costs
3. **Performance:** Cold start ~3-5s, total request ~8-12s
4. **No Caching:** Each request re-parses (future enhancement)

## Maintenance Notes

### When Document Viewer Changes
1. Update parser logic in `src/parser.ts`
2. Test with multiple documents
3. Update `.spec/parser.spec.md` if needed
4. Document changes in `.agents/90-overrides/`

### When API Changes
1. Update `.spec/api.spec.md` first
2. Update implementation to match spec
3. Test all acceptance criteria
4. Version increment if breaking change

## References

- Cloudflare Browser Rendering: https://developers.cloudflare.com/browser-rendering/
- Workers Documentation: https://developers.cloudflare.com/workers/
- Puppeteer API: https://pptr.dev/

## Status

- **Current Phase:** Implementation (Phase 3)
- **Next Milestone:** Local testing
- **Blockers:** None
- **Last Updated:** 2025-10-18
