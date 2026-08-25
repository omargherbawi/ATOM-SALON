import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';
import { authOptions } from '../auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import {
  defaultWorkingHours,
  normalizeWorkingHours,
} from '@/lib/working-hours';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role || '';
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    const query: Record<string, unknown> = { role: 'barber' };
    if (session.user.department) {
      query.department = session.user.department;
    }

    const barbers = await User.find(query)
      .select('-password')
      .sort({ name: 1 });

    return NextResponse.json(barbers);
  } catch (error) {
    console.error('GET /api/barbers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, workingHours } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    await dbConnect();

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const hours = normalizeWorkingHours(workingHours) ?? defaultWorkingHours();

    const barber = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'barber',
      department: session.user.department,
      active: true,
      workingHours: hours,
    });

    const result = barber.toObject();
    delete result.password;

    return NextResponse.json({
      message: 'Barber created successfully',
      data: result,
    });
  } catch (error) {
    console.error('POST /api/barbers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
