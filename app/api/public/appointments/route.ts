import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Appointment from '@/models/Appointment';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, date, time, barberId } = body;

    if (!customerName?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
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

    const barber = await User.findOne({
      _id: barberId,
      role: 'barber',
      active: true,
    }).select('name');

    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const existing = await Appointment.findOne({
      barberId,
      date,
      time,
      status: 'scheduled',
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This time slot is already booked' },
        { status: 400 }
      );
    }

    const appointment = await Appointment.create({
      customerName: customerName.trim(),
      date,
      time,
      barberId,
      barberName: barber.name,
      status: 'scheduled',
    });

    return NextResponse.json({
      message: 'Appointment booked successfully',
      data: appointment,
    });
  } catch (error) {
    console.error('POST /api/public/appointments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
