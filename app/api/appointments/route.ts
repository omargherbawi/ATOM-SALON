import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Appointment from '@/models/Appointment';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role || '';
    if (role !== 'admin' && role !== 'barber') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    const query: Record<string, unknown> = {};

    if (role === 'barber') {
      query.barberId = session.user.id;
    }

    if (session.user.department) {
      query.department = session.user.department;
    }

    if (date) {
      query.date = date;
    }

    const appointments = await Appointment.find(query).sort({ date: 1, time: 1 });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error('GET /api/appointments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
