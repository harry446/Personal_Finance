import 'server-only';

export type RateLimitScope = 'import_ip' | 'import_user' | 'sign_in';

type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitBucket>;

const globalForRateLimit = globalThis as typeof globalThis & {
  personalFinanceRateLimits?: RateLimitStore;
};

const store = globalForRateLimit.personalFinanceRateLimits ?? new Map();

if (process.env.NODE_ENV !== 'production') {
  globalForRateLimit.personalFinanceRateLimits = store;
}

const defaults: Record<RateLimitScope, RateLimitPolicy> = {
  import_ip: { limit: 5, windowSeconds: 15 * 60 },
  import_user: { limit: 12, windowSeconds: 60 * 60 },
  sign_in: { limit: 10, windowSeconds: 10 * 60 },
};

const environmentNames: Record<
  RateLimitScope,
  { limit: string; window: string }
> = {
  import_ip: {
    limit: 'RATE_LIMIT_IMPORT_IP_MAX',
    window: 'RATE_LIMIT_IMPORT_IP_WINDOW_SECONDS',
  },
  import_user: {
    limit: 'RATE_LIMIT_IMPORT_USER_MAX',
    window: 'RATE_LIMIT_IMPORT_USER_WINDOW_SECONDS',
  },
  sign_in: {
    limit: 'RATE_LIMIT_SIGN_IN_MAX',
    window: 'RATE_LIMIT_SIGN_IN_WINDOW_SECONDS',
  },
};

export function enforceRequestRateLimit(
  request: Request,
  scope: RateLimitScope,
  now = Date.now(),
) {
  return enforceRateLimit(
    scope,
    requestClientIdentifier(request),
    configuredPolicy(scope),
    now,
  );
}

export function enforceUserRateLimit(
  userId: string,
  scope: Extract<RateLimitScope, 'import_user'>,
  now = Date.now(),
) {
  return enforceRateLimit(scope, userId, configuredPolicy(scope), now);
}

export function enforceRateLimit(
  scope: RateLimitScope,
  identifier: string,
  policy: RateLimitPolicy,
  now = Date.now(),
) {
  pruneExpiredBuckets(now);

  const key = scope + ':' + (identifier || 'unknown');
  const existing = store.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + policy.windowSeconds * 1000 };

  if (bucket.count >= policy.limit) {
    store.set(key, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  store.set(key, bucket);

  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  );
}

export function requestClientIdentifier(request: Request) {
  const realIp = request.headers.get('x-real-ip')?.trim();

  if (realIp) {
    return realIp;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');

  return forwardedFor?.split(',', 1)[0]?.trim() || 'unknown';
}

export function clearRateLimitsForTest() {
  store.clear();
}

function configuredPolicy(scope: RateLimitScope): RateLimitPolicy {
  const defaultsForScope = defaults[scope];
  const names = environmentNames[scope];

  return {
    limit: positiveInteger(process.env[names.limit], defaultsForScope.limit),
    windowSeconds: positiveInteger(
      process.env[names.window],
      defaultsForScope.windowSeconds,
    ),
  };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pruneExpiredBuckets(now: number) {
  if (store.size < 1_000) {
    return;
  }

  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}
