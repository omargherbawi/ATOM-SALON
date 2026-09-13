import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getMongoDb } from '@/lib/mongodb';
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
  return 'Could not create barber';
}

function serializeBarber(doc: Record<string, unknown>) {
  return {
    _id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    active: doc.active,
    department: doc.department ?? undefined,
    workingHours: doc.workingHours ?? [],
    cliqNumber: doc.cliqNumber ?? '',
    cliqBank: doc.cliqBank ?? '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = await getAdminTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getMongoDb();
    const query: Record<string, unknown> = { role: 'barber' };
    if (typeof token.department === 'string' && token.department) {
      query.department = token.department;
    }

    const barbers = await db
      .collection('users')
      .find(query)
      .project({ password: 0 })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(barbers.map((doc) => serializeBarber(doc)));
  } catch (error) {
    console.error('GET /api/barbers error:', error);
    return NextResponse.json(
      { error: mongoErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAdminTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, workingHours, cliqNumber, cliqBank } = body;

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

    const db = await getMongoDb();
    const users = db.collection('users');
    const normalizedEmail = String(email).toLowerCase().trim();

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    let hashedPassword: string;
    try {
      hashedPassword = bcrypt.hashSync(password, 8);
    } catch (hashError) {
      console.error('bcrypt.hashSync error:', hashError);
      return NextResponse.json(
        { error: mongoErrorMessage(hashError) },
        { status: 500 }
      );
    }

    const hours = normalizeWorkingHours(workingHours) ?? defaultWorkingHours();
    const now = new Date();
    const doc: Record<string, unknown> = {
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'barber',
      active: true,
      workingHours: hours,
      cliqNumber: typeof cliqNumber === 'string' ? cliqNumber.trim() : '',
      cliqBank: typeof cliqBank === 'string' ? cliqBank.trim() : '',
      createdAt: now,
      updatedAt: now,
    };

    if (typeof token.department === 'string' && token.department) {
      doc.department = token.department;
    }

    const inserted = await users.insertOne(doc);
    try {
      await invalidateBarberCaches();
    } catch (cacheError) {
      console.error('invalidateBarberCaches error:', cacheError);
    }

    return NextResponse.json({
      message: 'Barber created successfully',
      data: serializeBarber({ ...doc, _id: inserted.insertedId }),
    });
  } catch (error) {
    console.error('POST /api/barbers error:', error);
    return NextResponse.json(
      { error: mongoErrorMessage(error) },
      { status: 500 }
    );
  }
}
