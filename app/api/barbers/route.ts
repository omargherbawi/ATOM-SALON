import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAdminTokenFromRequest } from '@/lib/require-admin-request';
import {
  defaultWorkingHours,
  normalizeWorkingHours,
} from '@/lib/working-hours';
import { invalidateBarberCaches } from '@/lib/public-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mongoErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  ) {
    return 'Email already in use';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Internal server error';
}

export async function GET(request: NextRequest) {
  try {
    const token = await getAdminTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    const query: Record<string, unknown> = { role: 'barber' };
    if (token.department) {
      query.department = token.department;
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
    const token = await getAdminTokenFromRequest(request);
    if (!token) {
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const hours = normalizeWorkingHours(workingHours) ?? defaultWorkingHours();

    const barber = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'barber',
      ...(typeof token.department === 'string' && token.department
        ? { department: token.department }
        : {}),
      active: true,
      workingHours: hours,
    });

    const result = barber.toObject();
    delete result.password;
    try {
      await invalidateBarberCaches();
    } catch (cacheError) {
      console.error('invalidateBarberCaches error:', cacheError);
    }

    return NextResponse.json({
      message: 'Barber created successfully',
      data: { ...result, _id: String(barber._id) },
    });
  } catch (error) {
    console.error('POST /api/barbers error:', error);
    return NextResponse.json(
      { error: mongoErrorMessage(error) },
      { status: 500 }
    );
  }
}
