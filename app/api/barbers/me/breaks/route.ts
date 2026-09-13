import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getPublicSettings } from '@/lib/public-data';
import { normalizeBreaks } from '@/lib/working-hours';
import {
  invalidateAvailabilityCache,
  invalidateBarberCaches,
} from '@/lib/public-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getBarberId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role !== 'barber') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { id: session.user.id };
}

export async function GET() {
  try {
    const auth = await getBarberId();
    if (auth.error) return auth.error;

    const [settings] = await Promise.all([getPublicSettings(), dbConnect()]);
    const barber = await User.findOne({ _id: auth.id, role: 'barber' }).select(
      'breaks'
    );
    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        enabled: Boolean(settings.allowBarberBreaks),
        breaks: barber.breaks ?? [],
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('GET /api/barbers/me/breaks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getBarberId();
    if (auth.error) return auth.error;

    const settings = await getPublicSettings();
    if (!settings.allowBarberBreaks) {
      return NextResponse.json(
        { error: 'Barber breaks are disabled' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const breaks = normalizeBreaks(body.breaks);
    if (!breaks) {
      return NextResponse.json({ error: 'Invalid breaks' }, { status: 400 });
    }

    await dbConnect();
    const barber = await User.findOne({ _id: auth.id, role: 'barber' });
    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    // Breaks only affect availability on the dates they touch.
    const staleDates = new Set<string>();
    for (const item of [...(barber.breaks ?? []), ...breaks]) {
      staleDates.add(item.date);
    }
    barber.breaks = breaks;

    await barber.save();
    await invalidateBarberCaches();
    await Promise.all(
      [...staleDates].map((date) => invalidateAvailabilityCache(auth.id, date))
    );

    return NextResponse.json({
      message: 'Breaks updated successfully',
      breaks: barber.breaks,
    });
  } catch (error) {
    console.error('PUT /api/barbers/me/breaks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
