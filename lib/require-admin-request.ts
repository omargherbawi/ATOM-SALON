import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

export async function getAdminTokenFromRequest(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token || token.role !== 'admin') {
    return null;
  }

  return token;
}
