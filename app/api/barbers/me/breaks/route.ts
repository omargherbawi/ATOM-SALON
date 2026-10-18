import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { getMongoDb, ObjectId } from '@/lib/mongodb';
import { getPublicSettings } from '@/lib/public-data';
import { normalizeBreaks, type BarberBreak } from '@/lib/working-hours';
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

/** Null when the session carries an id that is not a valid ObjectId. */
function barberFilter(id: string) {
  try {
    return { _id: new ObjectId(id), role: 'barber' };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const auth = await getBarberId();
    if (auth.error) return auth.error;

    const filter = barberFilter(auth.id);
    if (!filter) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const [settings, db] = await Promise.all([getPublicSettings(), getMongoDb()]);
    const barber = await db
      .collection('users')
      .findOne(filter, { projection: { breaks: 1 } });

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

    const filter = barberFilter(auth.id);
    if (!filter) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const db = await getMongoDb();
    const users = db.collection('users');
    const barber = await users.findOne(filter, { projection: { breaks: 1 } });
    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    // Breaks only affect availability on the dates they touch.
    const staleDates = new Set<string>();
    for (const item of [
      ...((barber.breaks ?? []) as BarberBreak[]),
      ...breaks,
    ]) {
      staleDates.add(item.date);
    }

    await users.updateOne(filter, {
      $set: { breaks, updatedAt: new Date() },
    });

    await invalidateBarberCaches();
    await Promise.all(
      [...staleDates].map((date) => invalidateAvailabilityCache(auth.id, date))
    );

    return NextResponse.json({
      message: 'Breaks updated successfully',
      breaks,
    });
  } catch (error) {
    console.error('PUT /api/barbers/me/breaks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
