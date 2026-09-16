import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb, ObjectId } from '@/lib/mongodb';
import {
  ACTIVE_BOOKING_STATUSES,
  filterBreakSlots,
  filterPastSlots,
  getWorkingSlotsForDate,
  holdsSlot,
  type BarberBreak,
  type WorkingHour,
} from '@/lib/working-hours';
import { isDuplicateSlotError } from '@/lib/appointment-errors';
import { getPublicSettings } from '@/lib/public-data';
import {
  createGuestToken,
  normalizePhone,
  readGuestToken,
  withGuestCookie,
} from '@/lib/guest';
import { invalidateAvailabilityCache } from '@/lib/public-cache';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, customerPhone, date, time, barberId, guestToken } =
      body;

    if (!customerName?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const phone = normalizePhone(String(customerPhone || ''));
    if (phone.length < 8) {
      return NextResponse.json(
        { error: 'A valid phone number is required' },
        { status: 400 }
      );
    }
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }
    if (!time) {
      return NextResponse.json({ error: 'Time is required' }, { status: 400 });
    }
    if (!barberId) {
      return NextResponse.json({ error: 'Barber is required' }, { status: 400 });
    }

    let barberObjectId: InstanceType<typeof ObjectId>;
    try {
      barberObjectId = new ObjectId(String(barberId));
    } catch {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const db = await getMongoDb();

    const [barber, settings] = await Promise.all([
      db.collection('users').findOne(
        {
          _id: barberObjectId,
          role: 'barber',
          active: true,
        },
        { projection: { name: 1, workingHours: 1, breaks: 1 } }
      ),
      getPublicSettings(),
    ]);

    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const slotDuration = settings.slotDuration || 30;

    const workingSlots = filterPastSlots(
      date,
      getWorkingSlotsForDate(
        (barber.workingHours ?? []) as WorkingHour[],
        date,
        slotDuration
      )
    );

    if (!workingSlots.includes(time)) {
      return NextResponse.json(
        { error: 'This time is outside the barber working hours' },
        { status: 400 }
      );
    }

    if (
      !filterBreakSlots(
        (barber.breaks ?? []) as BarberBreak[],
        date,
        [time],
        slotDuration
      ).length
    ) {
      return NextResponse.json(
        { error: 'The barber is on a break at this time' },
        { status: 400 }
      );
    }

    const appointments = db.collection('appointments');
    const customers = db.collection('customers');

    const existing = await appointments.findOne({
      barberId,
      date,
      time,
      status: { $in: [...ACTIVE_BOOKING_STATUSES] },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This time slot is already booked' },
        { status: 400 }
      );
    }

    const incomingToken = readGuestToken(request, guestToken);
    const customer = incomingToken
      ? await customers.findOne({ guestToken: incomingToken })
      : null;

    const token = (customer?.guestToken as string) || createGuestToken();
    const now = new Date();

    let customerId: string;
    if (customer) {
      await customers.updateOne(
        { _id: customer._id },
        {
          $set: {
            name: customerName.trim(),
            phone,
            updatedAt: now,
          },
        }
      );
      customerId = String(customer._id);
    } else {
      const inserted = await customers.insertOne({
        name: customerName.trim(),
        phone,
        guestToken: token,
        createdAt: now,
        updatedAt: now,
      });
      customerId = String(inserted.insertedId);
    }

    // With pay-to-confirm on, the booking is accepted right away but stays
    // unconfirmed - and unconfirmed bookings do not reserve the slot.
    const appointmentStatus = settings.payToConfirm
      ? 'unconfirmed'
      : 'scheduled';

    const appointment = {
      customerName: customerName.trim(),
      customerPhone: phone,
      customerId,
      date,
      time,
      barberId,
      barberName: barber.name,
      status: appointmentStatus,
      createdAt: now,
      updatedAt: now,
    };

    let insertedId: InstanceType<typeof ObjectId>;
    try {
      const inserted = await appointments.insertOne({ ...appointment });
      insertedId = inserted.insertedId;
    } catch (error) {
      if (isDuplicateSlotError(error)) {
        return NextResponse.json(
          { error: 'This time slot is already booked' },
          { status: 409 }
        );
      }
      throw error;
    }

    if (holdsSlot(appointmentStatus)) {
      await invalidateAvailabilityCache(barberId, date);
    }

    const response = NextResponse.json({
      message: settings.payToConfirm
        ? 'Appointment booked. It stays unconfirmed until you pay.'
        : 'Appointment booked successfully',
      guestToken: token,
      data: { ...appointment, _id: String(insertedId) },
    });

    return withGuestCookie(response, token);
  } catch (error) {
    console.error('POST /api/public/appointments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
