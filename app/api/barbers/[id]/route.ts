import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';
import { authOptions } from '../../auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Appointment from '@/models/Appointment';
import { normalizeWorkingHours } from '@/lib/working-hours';
import { invalidateBarberCaches } from '@/lib/public-cache';

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

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    await dbConnect();

    const barber = await User.findOne({ _id: id, role: 'barber' }).select(
      '-password'
    );

    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    return NextResponse.json(barber);
  } catch (error) {
    console.error('GET /api/barbers/[id] error:', error);
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

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    await dbConnect();

    const barber = await User.findOne({ _id: id, role: 'barber' });
    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    if (body.name) barber.name = body.name.trim();
    if (body.email) {
      const email = body.email.toLowerCase().trim();
      const taken = await User.findOne({
        email,
        _id: { $ne: id },
      });
      if (taken) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      }
      barber.email = email;
    }
    if (typeof body.active === 'boolean') barber.active = body.active;
    if (body.password && body.password.length >= 6) {
      barber.password = await bcrypt.hash(body.password, 12);
    }
    if (body.workingHours !== undefined) {
      const hours = normalizeWorkingHours(body.workingHours);
      if (!hours) {
        return NextResponse.json(
          { error: 'Invalid working hours' },
          { status: 400 }
        );
      }
      barber.workingHours = hours;
    }

    await barber.save();
    await invalidateBarberCaches();

    const result = barber.toObject();
    delete result.password;

    return NextResponse.json({
      message: 'Barber updated successfully',
      data: result,
    });
  } catch (error) {
    console.error('PUT /api/barbers/[id] error:', error);
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

    const barber = await User.findOne({ _id: id, role: 'barber' });
    if (!barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    await Appointment.updateMany(
      { barberId: id, status: { $in: ['scheduled', 'scheduled'] } },
      { status: 'cancelled' }
    );

    await User.deleteOne({ _id: id });
    await invalidateBarberCaches();

    return NextResponse.json({ message: 'Barber deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/barbers/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
