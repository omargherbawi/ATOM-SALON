import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Customer from '@/models/Customer';
import Appointment from '@/models/Appointment';
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

    await dbConnect();

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

    if (!isActiveBooking(appointment.status)) {
      return NextResponse.json(
        { error: 'This appointment cannot be cancelled' },
        { status: 400 }
      );
    }

    appointment.status = 'cancelled';
    await appointment.save();
    await invalidateAvailabilityCache(appointment.barberId, appointment.date);

    return NextResponse.json({
      message: 'Appointment cancelled',
      data: appointment,
    });
  } catch (error) {
    console.error('POST /api/public/appointments/[id]/cancel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
