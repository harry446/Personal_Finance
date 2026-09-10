import NextAuth from 'next-auth';

import { authOptions } from '@/auth';
import { enforceRequestRateLimit, rateLimitedResponse } from '@/lib/rate-limit';

const handler = NextAuth(authOptions);

type AuthRouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

export function GET(request: Request, context: AuthRouteContext) {
  return handler(request, context);
}

export function POST(request: Request, context: AuthRouteContext) {
  if (new URL(request.url).pathname.endsWith('/signin/google')) {
    const rateLimit = enforceRequestRateLimit(request, 'sign_in');

    if (!rateLimit.allowed) {
      return rateLimitedResponse(rateLimit.retryAfterSeconds);
    }
  }

  return handler(request, context);
}
