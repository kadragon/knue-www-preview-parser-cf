# Plan — KV Caching Implementation

## Goal
Introduce Cloudflare KV caching for parsed documents, expose cache metadata, and provide an authenticated invalidation endpoint while keeping responses aligned with updated API spec.

## Steps
1. **Spec Alignment**
   - Confirm API spec v1.1.0 updates (metadata, TTL, invalidation endpoint).
   - Adjust types (`Env`, API responses) to match new fields.
2. **Test First (TDD)**
   - Extend `index.test.ts` to cover cache miss → store, cache hit, TTL override, and invalidation behavior.
   - Mock KV namespace and ensure existing auth/validation tests still pass.
3. **Implementation**
   - Add KV binding to `wrangler.toml` and env typing.
   - Implement cache layer in `fetch` handler with TTL configuration and metrics logging.
   - Add DELETE handler for cache invalidation with proper responses.
4. **Verification**
   - Run `npm run test` and `npm run type-check`.
   - Update relevant documentation (README summary, task logs) if needed.

## Rollback Strategy
- Feature flag via env (`CACHE_TTL_SECONDS=0`) to disable caching quickly.
- Revert KV-specific changes in `index.ts` and configuration if critical issues arise.
