# Spec Delta — KV Caching (2025-10-18)

## Scope
- Update API contract to expose cache metadata.
- Define cache invalidation endpoint and authentication requirements.
- Document TTL configurability and default value.

## Changes
1. **Success response metadata**
   - Add `cached: boolean` flag indicating cache hit.
   - Add `cacheTtlSeconds: number` to surface effective TTL.
2. **Caching behavior**
   - First request parses document, stores JSON payload in KV bound as `CACHE`.
   - Subsequent requests within TTL serve cached payload.
   - Default TTL: 86400 seconds (24h); override via `CACHE_TTL_SECONDS` env var.
3. **Invalidation endpoint**
   - `DELETE /cache?atchmnflNo={id}` uses the same bearer token gating as parse requests.
   - Returns 200 with `{ success: true, metadata: { atchmnflNo, cached: false, cacheTtlSeconds } }` on successful deletion.
   - Missing/invalid token → 401; missing `atchmnflNo` → 400.
4. **Error semantics**
   - KV read/write errors are logged and fall back to direct parsing to avoid downtime.
   - Cache misses include `cached: false` in metadata.

## Acceptance Criteria Alignment
- AC-5 (Response Format) revised with new metadata fields.
- New AC-8: Cache behavior (hit/miss, TTL, invalidation).

## Notes
- TTL precision limited to seconds.
- TTL <= 0 disables caching (bypass KV reads/writes).
- Invalidation is idempotent; deleting non-existent keys still returns success.
