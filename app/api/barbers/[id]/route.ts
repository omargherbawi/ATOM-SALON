import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getMongoDb, ObjectId } from '@/lib/mongodb';
import {
  normalizeBreaks,
  normalizeWorkingHours,
  type BarberBreak,
} from '@/lib/working-hours';
import {
  invalidateAvailabilityCache,
  invalidateBarberCaches,
} from '@/lib/public-cache';

export const runtime = 'nodejs';

/** Null when the route param is not a valid ObjectId. */
function toObjectId(id: string) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const objectId = toObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const db = await getMongoDb();
    const barber = await db
      .collection('users')
      .findOne({ _id: objectId, role: 'barber' }, { projection: { password: 0 } });

    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    return NextResponse.json(barber);
  } catch (error) {
    console.error('GET /api/barbers/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const objectId = toObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const body = await request.json();
    const db = await getMongoDb();
    const users = db.collection('users');

    const barber = await users.findOne({ _id: objectId, role: 'barber' });
    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (body.name) updates.name = String(body.name).trim();
    if (body.email) {
      const email = String(body.email).toLowerCase().trim();
      const taken = await users.findOne({
        email,
        _id: { $ne: objectId },
      });
      if (taken) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      }
      updates.email = email;
    }
    if (typeof body.active === 'boolean') updates.active = body.active;
    if (typeof body.cliqNumber === 'string') {
      updates.cliqNumber = body.cliqNumber.trim();
    }
    if (typeof body.cliqBank === 'string') {
      updates.cliqBank = body.cliqBank.trim();
    }
    if (body.password && body.password.length >= 6) {
      updates.password = await bcrypt.hash(body.password, 12);
    }
    if (body.workingHours !== undefined) {
      const hours = normalizeWorkingHours(body.workingHours);
      if (!hours) {
        return NextResponse.json(
          { error: 'Invalid working hours' },
          { status: 400 }
        );
      }
      updates.workingHours = hours;
    }
    // Working hours affect every date, breaks only the dates they touch.
    const staleDates = new Set<string>();
    if (body.breaks !== undefined) {
      const breaks = normalizeBreaks(body.breaks);
      if (!breaks) {
        return NextResponse.json({ error: 'Invalid breaks' }, { status: 400 });
      }
      for (const item of [
        ...((barber.breaks ?? []) as BarberBreak[]),
        ...breaks,
      ]) {
        staleDates.add(item.date);
      }
      updates.breaks = breaks;
    }

    updates.updatedAt = new Date();

    await users.updateOne({ _id: objectId }, { $set: updates });
    await invalidateBarberCaches();
    await Promise.all(
      [...staleDates].map((date) => invalidateAvailabilityCache(id, date))
    );

    const result = await users.findOne(
      { _id: objectId },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      message: 'Barber updated successfully',
      data: result,
    });
  } catch (error) {
    console.error('PUT /api/barbers/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const objectId = toObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const db = await getMongoDb();
    const users = db.collection('users');

    const barber = await users.findOne({ _id: objectId, role: 'barber' });
    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    // `barberId` is stored as a string on appointments, not an ObjectId.
    await db.collection('appointments').updateMany(
      { barberId: id, status: { $in: ['scheduled', 'scheduled'] } },
      { $set: { status: 'cancelled', updatedAt: new Date() } }
    );

    await users.deleteOne({ _id: objectId });
    await invalidateBarberCaches();

    return NextResponse.json({ message: 'Barber deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/barbers/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
