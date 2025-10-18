# Research: Cloudflare Workers KV for Document Caching

**Task**: kv-caching
**Date**: 2025-10-18
**Status**: Complete

---

## Executive Summary

Cloudflare Workers KV is a global, low-latency key-value data store ideal for caching parsed documents. The **free tier is sufficient** for our use case (100-200 requests/day), providing:
- 100,000 reads/day
- 1,000 writes/day
- 1 GB storage
- **Cost: $0/month** ✅

---

## 1. KV Overview

### What is Workers KV?

- **Type**: Eventually-consistent key-value store
- **Latency**: <100ms reads from edge locations
- **Consistency**: Writes propagate globally within 60 seconds
- **Use Case**: Read-heavy workloads with infrequent updates (perfect for document caching)

### Core API Methods

```typescript
// Read
const value = await env.CACHE.get(key, 'json');

// Write with TTL
await env.CACHE.put(key, JSON.stringify(data), {
  expirationTtl: 86400 // 24 hours in seconds
});

// Delete
await env.CACHE.delete(key);
```

---

## 2. Namespace Setup

### Command-Line Method (Wrangler)

```bash
# Create namespace
npx wrangler kv namespace create CACHE

# Output:
# { binding = "CACHE", id = "abcd1234..." }
```

**Note**: Since Wrangler 3.60.0, use `kv namespace` (not `kv:namespace`)

### Configuration

**wrangler.toml**:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-namespace-id-from-above"
```

### Local Development

Wrangler automatically creates a preview namespace for `wrangler dev`:
```bash
# No additional setup needed for local testing
npx wrangler dev
```

---

## 3. KV API Reference

### get() Method

```typescript
const value = await env.CACHE.get(key);        // Returns string | null
const json = await env.CACHE.get(key, 'json'); // Parses JSON automatically
const buffer = await env.CACHE.get(key, 'arrayBuffer');
const stream = await env.CACHE.get(key, 'stream');
```

**Behavior**:
- Returns `null` if key doesn't exist or is expired
- Reads are eventually consistent (may read old value briefly after write)

---

### put() Method

```typescript
await env.CACHE.put(key, value, {
  expirationTtl: 3600,     // TTL in seconds (relative)
  expiration: 1672531200,  // Absolute UNIX timestamp
  metadata: { cached: true } // Optional metadata (max 1024 bytes)
});
```

**Options**:
- `expirationTtl`: Seconds from now until expiration
- `expiration`: Absolute UNIX timestamp
- If both set, `expirationTtl` takes precedence
- If neither set, key never expires

**Limits**:
- Max key size: 512 bytes (UTF-8)
- Max value size: 25 MB
- Max metadata size: 1024 bytes

---

### delete() Method

```typescript
await env.CACHE.delete(key);
```

**Behavior**:
- Idempotent (safe to call multiple times)
- Deletes propagate globally within 60 seconds

---

## 4. Pricing Analysis

### Free Tier Limits (Workers Paid Plan)

| Operation | Free Limit | Reset |
|-----------|-----------|-------|
| **Reads** | 100,000/day | Daily UTC 00:00 |
| **Writes** | 1,000/day | Daily UTC 00:00 |
| **Deletes** | 1,000/day | Daily UTC 00:00 |
| **Lists** | 1,000/day | Daily UTC 00:00 |
| **Storage** | 1 GB | - |

**Important**: All operations are **per-key** (not per-byte)

---

### Paid Tier Pricing

| Operation | Price |
|-----------|-------|
| Read | $0.50 / 1M operations |
| Write/Delete/List | $5.00 / 1M operations |
| Storage | $0.50 / GB-month |

---

### Our Use Case Analysis

**Assumptions**:
- 100 requests/day
- 80% cache hit rate
- 20 unique documents
- Avg document size: 10 KB

**Daily Operations**:
```
Reads:  100 requests × 1 read = 100/day
Writes: 20 unique docs = 20/day
Storage: 20 docs × 10 KB = 200 KB
```

**Monthly Operations**:
```
Reads:  100 × 30 = 3,000/month
Writes: 20 × 30 = 600/month
Storage: 200 KB
```

**Comparison to Free Tier**:
```
Reads:  3,000 << 100,000/day ✅
Writes: 600 << 1,000/day ✅
Storage: 200 KB << 1 GB ✅
```

**Conclusion**: **Completely within free tier** → **$0/month** 🎉

---

## 5. Implementation Pattern

### Cache Key Design

```typescript
const CACHE_KEY_PREFIX = 'doc:';

function getCacheKey(atchmnflNo: string): string {
  return `${CACHE_KEY_PREFIX}${atchmnflNo}`;
}

// Example: "doc:78541"
```

**Benefits**:
- Easy to identify cache entries
- Supports future prefix-based operations
- Avoids key collisions

---

### Cache Flow

```typescript
export async function getCachedOrParse(
  atchmnflNo: string,
  env: Env
): Promise<{ content: string; title: string; cached: boolean }> {
  const cacheKey = getCacheKey(atchmnflNo);

  // 1. Try cache
  const cached = await env.CACHE.get(cacheKey, 'json');
  if (cached) {
    return { ...cached, cached: true };
  }

  // 2. Cache miss: parse with browser
  const result = await parseDocument(atchmnflNo, env.BROWSER);

  // 3. Store in cache (24h TTL)
  await env.CACHE.put(cacheKey, JSON.stringify(result), {
    expirationTtl: 86400, // 24 hours
    metadata: {
      cachedAt: new Date().toISOString(),
      atchmnflNo
    }
  });

  return { ...result, cached: false };
}
```

---

### Error Handling

```typescript
try {
  const cached = await env.CACHE.get(cacheKey, 'json');
  if (cached) return cached;
} catch (error) {
  // Log KV error but continue (graceful degradation)
  console.error('[Cache] Read error:', error);
  // Fall through to parse
}

try {
  await env.CACHE.put(cacheKey, value, { expirationTtl: 86400 });
} catch (error) {
  // Log but don't fail request
  console.error('[Cache] Write error:', error);
}
```

**Strategy**: Graceful degradation - KV errors should not break the service

---

## 6. Performance Expectations

### Latency Comparison

| Scenario | Latency | Cost |
|----------|---------|------|
| **Cache Hit** | <100ms | 1 read op |
| **Cache Miss** | 2-3s + <10ms write | Browser time + 1 write op |
| **No Cache** | 2-3s | Browser time only |

**Improvement**: 95% faster for cached documents

---

### Cache Hit Rate Estimation

**Assumptions**:
- Documents updated infrequently (monthly)
- Users may request same document multiple times
- 24h TTL sufficient for most use cases

**Expected Hit Rate**: 70-90%

**Example (80% hit rate)**:
```
100 requests/day:
- 80 cache hits (fast)
- 20 cache misses (browser render)

Browser usage:
- Before: 100 × 3s = 300s/day = 2.5 hrs/month
- After:  20 × 3s = 60s/day = 0.5 hrs/month

Savings: 80% reduction in browser hours
```

---

## 7. TTL Strategy

### Recommended TTL: 24 Hours

**Rationale**:
- KNUE documents rarely change within a day
- Balances freshness vs cache utility
- Allows daily updates to propagate

### Alternative TTL Options

| TTL | Use Case | Pros | Cons |
|-----|----------|------|------|
| 1 hour | Frequently updated docs | Fresh | Low hit rate |
| 6 hours | Moderate updates | Balanced | - |
| **24 hours** | **Infrequent updates** | **High hit rate** | Max 24h stale |
| 7 days | Static docs | Very high hit rate | Potentially very stale |

---

## 8. Cache Invalidation

### Manual Invalidation Endpoint

```typescript
// DELETE /?atchmnflNo=78541&invalidate=true
if (url.searchParams.get('invalidate') === 'true') {
  // Verify admin token
  if (token !== env.ADMIN_TOKEN) {
    return errorResponse('Forbidden', 'Admin access required', 403);
  }

  const cacheKey = getCacheKey(atchmnflNo);
  await env.CACHE.delete(cacheKey);

  return Response.json({
    success: true,
    message: `Cache invalidated for ${atchmnflNo}`
  });
}
```

---

### Bulk Invalidation

```typescript
// Delete all cached documents
async function clearAllCache(env: Env) {
  const list = await env.CACHE.list({ prefix: 'doc:' });

  for (const key of list.keys) {
    await env.CACHE.delete(key.name);
  }

  return list.keys.length;
}
```

**Note**: List operation counts against daily quota (1,000/day)

---

## 9. Local Development

### Preview Namespace

Wrangler creates a separate preview namespace for `wrangler dev`:
```bash
npx wrangler dev

# Output includes:
# env.CACHE (preview)  KV Namespace
```

**Behavior**:
- Preview namespace is isolated from production
- Safe to test cache operations locally
- Data persists across local dev sessions

---

## 10. Monitoring

### Observability Strategy

```typescript
// Add cache metadata to responses
return Response.json({
  success: true,
  content,
  metadata: {
    atchmnflNo,
    title,
    parsedAt,
    cached: isCacheHit,
    cacheAge: cacheHit ? calculateAge(cachedAt) : null
  }
});
```

**Metrics to Track**:
- Cache hit rate (hits / total requests)
- Cache miss latency
- KV read/write errors
- Storage usage

---

### Cloudflare Dashboard

**Workers & Pages → KV**:
- View all namespaces
- Monitor operations count
- Check storage usage
- Browse keys (in production)

---

## 11. Best Practices

### DO ✅

- Use `expirationTtl` for automatic cleanup
- Handle KV errors gracefully (don't fail requests)
- Use JSON format for complex data
- Add metadata for debugging
- Monitor cache hit rate

### DON'T ❌

- Store sensitive data without encryption
- Rely on immediate consistency (60s propagation)
- Use KV for write-heavy workloads
- Store values >25 MB
- Forget to set expiration (avoid unbounded growth)

---

## 12. Alternatives Considered

### Option 1: Cache API

**Pros**: Standard web API, familiar
**Cons**: Not global, limited to single datacenter
**Verdict**: ❌ Not suitable for global service

### Option 2: Durable Objects

**Pros**: Strong consistency, transactional
**Cons**: More complex, higher cost
**Verdict**: ❌ Overkill for simple caching

### Option 3: R2 (Object Storage)

**Pros**: Unlimited storage, cheap
**Cons**: Higher latency, designed for large files
**Verdict**: ❌ Not optimized for small K-V pairs

### Option 4: KV (Chosen)

**Pros**: Low latency, global, simple API, free tier
**Cons**: Eventually consistent
**Verdict**: ✅ **Perfect for document caching**

---

## 13. Migration Path

### Phase 1: Add KV Without Cache (No-Op)

- Add KV binding
- Update types
- Deploy (no behavior change)

### Phase 2: Implement Cache Layer

- Wrap `parseDocument()` with cache logic
- Add tests
- Deploy with feature flag

### Phase 3: Enable Caching

- Enable feature flag
- Monitor hit rate
- Adjust TTL if needed

### Phase 4: Add Invalidation

- Implement DELETE endpoint
- Add admin token check
- Document usage

---

## 14. Success Metrics

### Targets (After 1 Week)

| Metric | Target | Measure |
|--------|--------|---------|
| Cache hit rate | >70% | Logs |
| Avg latency (hit) | <100ms | Response times |
| Avg latency (miss) | 2-3s | Response times |
| KV errors | <1% | Error logs |
| Browser hours saved | >60% | Usage dashboard |

---

## 15. Rollback Plan

If issues arise:

1. **Immediate**: Disable cache lookup (keep writes)
   ```typescript
   const USE_CACHE = false; // Feature flag
   if (USE_CACHE) {
     const cached = await env.CACHE.get(...);
   }
   ```

2. **Emergency**: Remove KV binding from wrangler.toml
   ```bash
   git revert <commit-hash>
   npm run deploy
   ```

3. **Data cleanup**: Clear all cached data
   ```bash
   npx wrangler kv key list --namespace-id <id>
   # Delete keys manually or via bulk script
   ```

---

## 16. References

- [Cloudflare KV Documentation](https://developers.cloudflare.com/kv/)
- [KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [KV Limits](https://developers.cloudflare.com/kv/platform/limits/)
- [Wrangler KV Commands](https://developers.cloudflare.com/kv/reference/kv-commands/)
- [Cache Data Example](https://developers.cloudflare.com/kv/examples/cache-data-with-workers-kv/)

---

## Conclusion

**Recommendation**: Proceed with KV caching implementation

**Confidence**: High ✅
- Free tier sufficient
- Low latency guaranteed
- Simple API
- Well-documented
- Battle-tested at scale

**Next Step**: Create KV namespace and define caching spec

---

**Research Complete**: 2025-10-18
**Ready for Spec Phase**: Yes
