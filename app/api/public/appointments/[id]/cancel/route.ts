import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb, ObjectId } from '@/lib/mongodb';
import { isActiveBooking } from '@/lib/working-hours';
import { readGuestToken } from '@/lib/guest';
import { invalidateAvailabilityCache } from '@/lib/public-cache';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let extraToken = '';
    try {
      const body = await request.json();
      extraToken = body?.guestToken || '';
    } catch {
      extraToken = '';
    }

    const token = readGuestToken(request, extraToken);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let objectId: InstanceType<typeof ObjectId>;
    try {
      objectId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const db = await getMongoDb();

    const customer = await db.collection('customers').findOne({
      guestToken: token,
    });
    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appointments = db.collection('appointments');
    const appointment = await appointments.findOne({ _id: objectId });
    if (!appointment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (appointment.customerId !== String(customer._id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isActiveBooking(appointment.status)) {
      return NextResponse.json(
        { error: 'This appointment cannot be cancelled' },
        { status: 400 }
      );
    }

    const updated = await appointments.findOneAndUpdate(
      { _id: objectId },
      { $set: { status: 'cancelled', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    await invalidateAvailabilityCache(appointment.barberId, appointment.date);

    return NextResponse.json({
      message: 'Appointment cancelled',
      data: updated ? { ...updated, _id: String(updated._id) } : null,
    });
  } catch (error) {
    console.error('POST /api/public/appointments/[id]/cancel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
