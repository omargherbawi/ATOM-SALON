import { NextRequest, NextResponse } from 'next/server';
import { readGuestToken, withGuestCookie } from '@/lib/guest';
import {
  getPublicBarbers,
  getPublicSettings,
  getGuestAppointments,
} from '@/lib/public-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = readGuestToken(request, searchParams.get('token'));

    const [settings, barbers, guest] = await Promise.all([
      getPublicSettings(),
      getPublicBarbers(),
      token
        ? getGuestAppointments(token)
        : Promise.resolve({
            customer: null,
            guestToken: '',
            appointments: [],
          }),
    ]);

    const response = NextResponse.json({
      settings,
      barbers,
      customer: guest.customer,
      guestToken: guest.guestToken || token || '',
      appointments: guest.appointments,
    });

    if (token) {
      return withGuestCookie(response, token);
    }

    return response;
  } catch (error) {
    console.error('GET /api/public/bootstrap error:', error);
    return NextResponse.json(
      { error: 'Unable to load booking data. Please try again.' },
      { status: 503 }
    );
  }
}
