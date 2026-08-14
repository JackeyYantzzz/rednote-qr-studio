type Bucket = { count: number; resetAt: number };

declare global {
  var __rednoteRateLimits: Map<string, Bucket> | undefined;
}

const buckets = (globalThis.__rednoteRateLimits ??= new Map<string, Bucket>());

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (current.count >= limit) {
    return { ok: false, retryAfterMs: current.resetAt - now };
  }
  current.count += 1;
  return { ok: true, remaining: limit - current.count };
}

export function requestKey(request: Request, scope: string) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  return `${scope}:${ip}`;
}
