import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Appointment from '@/models/Appointment';
import {
  ACTIVE_BOOKING_STATUSES,
  filterPastSlots,
  getWorkingSlotsForDate,
} from '@/lib/working-hours';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barberId = searchParams.get('barberId');
    const date = searchParams.get('date');

    if (!barberId || !date) {
      return NextResponse.json(
        { error: 'barberId and date are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const barber = await User.findOne({
      _id: barberId,
      role: 'barber',
      active: true,
    }).select('workingHours');

    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const booked = await Appointment.find({
      barberId,
      date,
      status: { $in: [...ACTIVE_BOOKING_STATUSES] },
    })
      .select('time')
      .lean();

    const bookedTimes = new Set(booked.map((item) => item.time));
    const workingSlots = getWorkingSlotsForDate(barber.workingHours, date);
    const available = filterPastSlots(date, workingSlots).filter(
      (slot) => !bookedTimes.has(slot)
    );

    return NextResponse.json({ available });
  } catch (error) {
    console.error('GET /api/public/availability error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
