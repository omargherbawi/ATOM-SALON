import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const GUEST_COOKIE = 'atom_guest_token';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
};

export function createGuestToken() {
  return randomBytes(32).toString('hex');
}

export function readGuestToken(
  request: NextRequest,
  extra?: string | null
) {
  return (
    extra?.trim() ||
    request.cookies.get(GUEST_COOKIE)?.value ||
    ''
  );
}

export function withGuestCookie(response: NextResponse, token: string) {
  response.cookies.set(GUEST_COOKIE, token, cookieOptions);
  return response;
}

export function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}
