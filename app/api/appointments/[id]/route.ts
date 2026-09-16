import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getMongoDb, ObjectId } from '@/lib/mongodb';
import { ACTIVE_BOOKING_STATUSES, holdsSlot } from '@/lib/working-hours';
import { isDuplicateSlotError } from '@/lib/appointment-errors';
import { invalidateAvailabilityCache } from '@/lib/public-cache';

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

    const { id } = await params;
    const objectId = toObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const db = await getMongoDb();
    const appointment = await db
      .collection('appointments')
      .findOne({ _id: objectId });

    if (!appointment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const role = session.user.role || '';
    if (role === 'barber' && appointment.barberId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (role !== 'admin' && role !== 'barber') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ ...appointment, _id: String(appointment._id) });
  } catch (error) {
    console.error('GET /api/appointments/[id] error:', error);
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

    const role = session.user.role || '';
    if (role !== 'admin' && role !== 'barber') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const objectId = toObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const db = await getMongoDb();
    const appointments = db.collection('appointments');

    const appointment = await appointments.findOne({ _id: objectId });
    if (!appointment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (role === 'barber' && appointment.barberId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Moving an unpaid booking onto the schedule only works while nobody else
    // has taken that time.
    if (
      body.status &&
      holdsSlot(body.status) &&
      !holdsSlot(appointment.status)
    ) {
      const holder = await appointments.findOne({
        _id: { $ne: objectId },
        barberId: appointment.barberId,
        date: appointment.date,
        time: appointment.time,
        status: { $in: [...ACTIVE_BOOKING_STATUSES] },
      });

      if (holder) {
        return NextResponse.json(
          { error: 'Another booking already holds this time slot' },
          { status: 409 }
        );
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;

    let updated;
    try {
      updated = await appointments.findOneAndUpdate(
        { _id: objectId },
        { $set: updates },
        { returnDocument: 'after' }
      );
    } catch (error) {
      if (isDuplicateSlotError(error)) {
        return NextResponse.json(
          { error: 'Another booking already holds this time slot' },
          { status: 409 }
        );
      }
      throw error;
    }

    await invalidateAvailabilityCache(appointment.barberId, appointment.date);

    return NextResponse.json({
      message: 'Appointment updated',
      data: updated ? { ...updated, _id: String(updated._id) } : null,
    });
  } catch (error) {
    console.error('PUT /api/appointments/[id] error:', error);
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const db = await getMongoDb();
    const appointment = await db
      .collection('appointments')
      .findOneAndDelete({ _id: objectId });

    if (!appointment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await invalidateAvailabilityCache(appointment.barberId, appointment.date);

    return NextResponse.json({ message: 'Appointment deleted' });
  } catch (error) {
    console.error('DELETE /api/appointments/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
