import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Appointment from '@/models/Appointment';

export const runtime = 'nodejs';

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
    await dbConnect();

    const appointment = await Appointment.findById(id);
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

    return NextResponse.json(appointment);
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
    const body = await request.json();
    await dbConnect();

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (role === 'barber' && appointment.barberId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (body.status) appointment.status = body.status;
    if (body.notes !== undefined) appointment.notes = body.notes;

    await appointment.save();

    return NextResponse.json({
      message: 'Appointment updated',
      data: appointment,
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
    await dbConnect();

    const appointment = await Appointment.findByIdAndDelete(id);
    if (!appointment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Appointment deleted' });
  } catch (error) {
    console.error('DELETE /api/appointments/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
