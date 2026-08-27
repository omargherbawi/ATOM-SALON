import { NextRequest, NextResponse } from 'next/server';
import { readGuestToken, withGuestCookie } from '@/lib/guest';
import { getGuestAppointments } from '@/lib/public-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = readGuestToken(request, searchParams.get('token'));

    if (!token) {
      return NextResponse.json({ customer: null, appointments: [] });
    }

    const data = await getGuestAppointments(token);
    const response = NextResponse.json(data);
    return withGuestCookie(response, token);
  } catch (error) {
    console.error('GET /api/public/my-appointments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
