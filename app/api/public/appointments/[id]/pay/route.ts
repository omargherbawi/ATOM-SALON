import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Customer from '@/models/Customer';
import Appointment from '@/models/Appointment';
import { ACTIVE_BOOKING_STATUSES } from '@/lib/working-hours';
import { isDuplicateSlotError } from '@/lib/appointment-errors';
import { readGuestToken } from '@/lib/guest';
import { getPublicSettings } from '@/lib/public-data';
import { invalidateAvailabilityCache } from '@/lib/public-cache';

export const runtime = 'nodejs';

/**
 * Turns an unconfirmed (unpaid) booking into a pending one. This is the moment
 * the slot stops being available to everybody else; staff still verify the
 * transfer afterwards and move it to `scheduled`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let body: { guestToken?: string; transferNumber?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const token = readGuestToken(request, body.guestToken || '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const settings = await getPublicSettings();
    const transferNumber = String(body.transferNumber || '').trim();

    if (settings.requireTransferNumber !== false && !transferNumber) {
      return NextResponse.json(
        { error: 'Transfer number is required' },
        { status: 400 }
      );
    }

    const customer = await Customer.findOne({ guestToken: token });
    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (appointment.customerId !== customer._id.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (appointment.status !== 'unconfirmed') {
      return NextResponse.json(
        { error: 'This appointment is not waiting for payment' },
        { status: 400 }
      );
    }

    const holder = await Appointment.findOne({
      barberId: appointment.barberId,
      date: appointment.date,
      time: appointment.time,
      status: { $in: [...ACTIVE_BOOKING_STATUSES] },
    });

    if (holder) {
      return NextResponse.json(
        {
          error:
            'Someone else confirmed this time first. Please pick another time.',
          slotTaken: true,
        },
        { status: 409 }
      );
    }

    appointment.status = 'pending';
    if (transferNumber) appointment.transferNumber = transferNumber;

    try {
      await appointment.save();
    } catch (error) {
      if (isDuplicateSlotError(error)) {
        return NextResponse.json(
          {
            error:
              'Someone else confirmed this time first. Please pick another time.',
            slotTaken: true,
          },
          { status: 409 }
        );
      }
      throw error;
    }

    await invalidateAvailabilityCache(appointment.barberId, appointment.date);

    return NextResponse.json({
      message: 'Payment submitted',
      data: appointment,
    });
  } catch (error) {
    console.error('POST /api/public/appointments/[id]/pay error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
