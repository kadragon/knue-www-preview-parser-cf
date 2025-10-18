# Task: KV Caching for Parsed Documents

**Priority**: Medium
**Status**: In Progress
**Created**: 2025-10-18
**Depends On**: cf-browser-rendering-parser (completed)

---

## Objective

Implement Cloudflare KV-based caching to reduce Browser Rendering API usage and improve response times for frequently accessed documents.

---

## Business Case

### Current State
- Every request triggers browser rendering (2-3s latency)
- Browser hours cost $0.09/hour after free tier
- No persistence of parsed results

### Target State
- First request: Browser render + cache result
- Subsequent requests: Serve from KV (<100ms latency)
- Configurable TTL (default: 24 hours)
- Significant cost reduction for repeated documents

---

## Success Criteria

- [ ] KV namespace configured in wrangler.toml
- [ ] Cache key format: `doc:{atchmnflNo}`
- [ ] Cache hit returns result in <100ms
- [ ] Cache miss triggers browser render + stores result
- [ ] TTL configurable (default: 86400s = 24h)
- [ ] Cache invalidation endpoint (admin-only)
- [ ] Tests for cache hit/miss scenarios

---

## Technical Approach

### 1. KV Setup

**wrangler.toml**:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

### 2. Cache Flow

```typescript
// Pseudocode
async function handleRequest(atchmnflNo: string) {
  const cacheKey = `doc:${atchmnflNo}`;

  // Try cache first
  const cached = await env.CACHE.get(cacheKey, 'json');
  if (cached) {
    return { ...cached, cached: true };
  }

  // Cache miss: parse with browser
  const result = await parseDocument(atchmnflNo, env.BROWSER);

  // Store in cache (24h TTL)
  await env.CACHE.put(cacheKey, JSON.stringify(result), {
    expirationTtl: 86400
  });

  return { ...result, cached: false };
}
```

### 3. Cache Invalidation

```typescript
// Admin endpoint: DELETE /cache?atchmnflNo=78541
if (request.method === 'DELETE' && isAdmin(token)) {
  const key = `doc:${atchmnflNo}`;
  await env.CACHE.delete(key);
  return { success: true, message: 'Cache cleared' };
}
```

---

## Implementation Steps (TDD)

### Phase 1: KV Setup
1. Create KV namespace via dashboard
2. Add binding to wrangler.toml
3. Update Env type to include CACHE

### Phase 2: Cache Logic (TDD)
1. Write failing test: cache hit returns cached result
2. Implement cache lookup
3. Write failing test: cache miss triggers parse + store
4. Implement parse + cache storage
5. Write failing test: TTL expiration
6. Verify TTL behavior

### Phase 3: Cache Invalidation
1. Write failing test: DELETE endpoint clears cache
2. Implement DELETE handler
3. Add admin-only authorization

### Phase 4: Observability
1. Add cache hit/miss metrics to response metadata
2. Log cache operations (hit/miss/store)

---

## Cost Analysis

### Before Caching
- 100 requests/day × 3s = 300s/day = 9,000s/month = 2.5 hours/month
- Cost: $0 (within 10h free tier)

### After Caching (assuming 80% cache hit rate)
- 20 unique docs × 3s = 60s/day = 1,800s/month = 0.5 hours/month
- Cost: $0 (well within free tier)
- **Latency improvement**: 80% of requests <100ms vs 2-3s

### KV Costs
- Free tier: 100k reads/day, 1k writes/day
- 100 requests/day = well within free tier
- Cost: $0

**Total savings**: Better UX + future-proofing against scale

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stale cache | Users see outdated content | Short TTL (24h), manual invalidation endpoint |
| KV quota exceeded | Cache misses increase cost | Monitor usage, implement LRU eviction |
| Cache key collision | Wrong document returned | Use unique key format with validation |

---

## Testing Strategy

### Unit Tests
```typescript
describe('Cache layer', () => {
  it('should return cached result on hit');
  it('should parse and cache on miss');
  it('should include cache metadata in response');
  it('should handle cache errors gracefully');
});
```

### Integration Tests
```bash
# Test cache miss (first request)
curl "...?atchmnflNo=78541"
# Response: { ..., "metadata": { "cached": false } }

# Test cache hit (second request)
curl "...?atchmnflNo=78541"
# Response: { ..., "metadata": { "cached": true } }

# Test cache invalidation
curl -X DELETE -H "Authorization: Bearer ADMIN_TOKEN" \
  "...?atchmnflNo=78541"

# Verify cache cleared
curl "...?atchmnflNo=78541"
# Response: { ..., "metadata": { "cached": false } }
```

---

## Acceptance Criteria

### Functional
- [ ] Cache hit returns result in <100ms
- [ ] Cache miss triggers browser render
- [ ] Parsed content stored in KV with 24h TTL
- [ ] DELETE endpoint invalidates specific cache entry
- [ ] Response includes `cached: true/false` in metadata

### Non-Functional
- [ ] All existing tests still pass
- [ ] New tests for cache logic (>90% coverage)
- [ ] Documentation updated (README, spec)
- [ ] No performance regression on cache miss path

---

## Rollout Plan

1. **Dev**: Test locally with KV preview
2. **Staging**: Deploy with limited TTL (1 hour)
3. **Monitor**: Check cache hit rate, errors
4. **Production**: Increase TTL to 24h if successful

---

## Future Enhancements

- [ ] Preemptive caching (background refresh before TTL expiry)
- [ ] LRU eviction policy
- [ ] Cache warming (pre-populate popular documents)
- [ ] Cache analytics dashboard

---

## References

- [Cloudflare KV Documentation](https://developers.cloudflare.com/kv/)
- [KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [Best Practices](https://developers.cloudflare.com/kv/best-practices/)

---

**Next Step**: Create RESEARCH.md to investigate KV namespace setup and API details.
