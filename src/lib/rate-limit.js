import redis from './redis';

// proxy.js calls this on every matched request, so a Redis outage must never
// hang the whole app. Fail open (allow the request) if Redis doesn't answer
// within the timeout, rather than blocking traffic on an infra hiccup.
const FAIL_OPEN_TIMEOUT_MS = 200;

export function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

async function fixedWindowIncrement(key, limit, windowSeconds) {
  const redisKey = `ratelimit:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }
  const ttl = await redis.ttl(redisKey);
  const resetAt = Date.now() + Math.max(ttl, 0) * 1000;

  return { allowed: count <= limit, remaining: Math.max(limit - count, 0), resetAt };
}

export async function checkRateLimit(key, { limit, windowSeconds }) {
  const fallback = { allowed: true, remaining: limit, resetAt: Date.now() + windowSeconds * 1000 };

  try {
    const timeout = new Promise((resolve) => setTimeout(() => resolve(fallback), FAIL_OPEN_TIMEOUT_MS));
    return await Promise.race([fixedWindowIncrement(key, limit, windowSeconds), timeout]);
  } catch {
    return fallback;
  }
}
