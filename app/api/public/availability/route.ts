import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Appointment from '@/models/Appointment';

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

    const booked = await Appointment.find({
      barberId,
      date,
      status: 'scheduled',
    })
      .select('time -_id')
      .lean();

    return NextResponse.json(booked.map((a) => a.time));
  } catch (error) {
    console.error('GET /api/public/availability error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
