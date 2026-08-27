import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

export async function getAdminTokenFromRequest(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token =
    (await getToken({ req: request, secret, secureCookie: true })) ||
    (await getToken({ req: request, secret, secureCookie: false }));

  if (!token || token.role !== 'admin') {
    return null;
  }

  return token;
}
