import NextAuth from 'next-auth';

import { authOptions } from '@/auth';
import { enforceRequestRateLimit, rateLimitedResponse } from '@/lib/rate-limit';

const handler = NextAuth(authOptions);

export function GET(request: Request) {
  return handler(request);
}

export function POST(request: Request) {
  if (new URL(request.url).pathname.endsWith('/signin/google')) {
    const rateLimit = enforceRequestRateLimit(request, 'sign_in');

    if (!rateLimit.allowed) {
      return rateLimitedResponse(rateLimit.retryAfterSeconds);
    }
  }

  return handler(request);
}
