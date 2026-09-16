import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Appointment from '@/models/Appointment';
import Customer from '@/models/Customer';
import {
  ACTIVE_BOOKING_STATUSES,
  filterBreakSlots,
  filterPastSlots,
  getWorkingSlotsForDate,
  holdsSlot,
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

    await dbConnect();

    const [barber, settings] = await Promise.all([
      User.findOne({
        _id: barberId,
        role: 'barber',
        active: true,
      }).select('name workingHours breaks'),
      getPublicSettings(),
    ]);

    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const slotDuration = settings.slotDuration || 30;

    const workingSlots = filterPastSlots(
      date,
      getWorkingSlotsForDate(barber.workingHours, date, slotDuration)
    );

    if (!workingSlots.includes(time)) {
      return NextResponse.json(
        { error: 'This time is outside the barber working hours' },
        { status: 400 }
      );
    }

    if (!filterBreakSlots(barber.breaks, date, [time], slotDuration).length) {
      return NextResponse.json(
        { error: 'The barber is on a break at this time' },
        { status: 400 }
      );
    }

    const existing = await Appointment.findOne({
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
    let customer = incomingToken
      ? await Customer.findOne({ guestToken: incomingToken })
      : null;

    const token = customer?.guestToken || createGuestToken();

    if (customer) {
      customer.name = customerName.trim();
      customer.phone = phone;
      await customer.save();
    } else {
      customer = await Customer.create({
        name: customerName.trim(),
        phone,
        guestToken: token,
      });
    }

    // With pay-to-confirm on, the booking is accepted right away but stays
    // unconfirmed - and unconfirmed bookings do not reserve the slot.
    const appointmentStatus = settings.payToConfirm
      ? 'unconfirmed'
      : 'scheduled';

    let appointment;
    try {
      appointment = await Appointment.create({
        customerName: customerName.trim(),
        customerPhone: phone,
        customerId: customer._id.toString(),
        date,
        time,
        barberId,
        barberName: barber.name,
        status: appointmentStatus,
      });
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
      data: appointment,
    });

    return withGuestCookie(response, token);
  } catch (error) {
    console.error('POST /api/public/appointments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
