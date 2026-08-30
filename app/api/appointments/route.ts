import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getMongoDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    const token =
      (await getToken({ req: request, secret, secureCookie: true })) ||
      (await getToken({ req: request, secret, secureCookie: false }));

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = typeof token.role === 'string' ? token.role : '';
    if (role !== 'admin' && role !== 'barber') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    const query: Record<string, unknown> = {};

    if (role === 'barber') {
      query.barberId = token.id;
    }
    if (typeof token.department === 'string' && token.department) {
      query.department = token.department;
    }
    if (date) {
      query.date = date;
    }

    const db = await getMongoDb();
    const appointments = await db
      .collection('appointments')
      .find(query)
      .sort({ date: 1, time: 1 })
      .limit(500)
      .toArray();

    return NextResponse.json(
      appointments.map((item) => ({ ...item, _id: String(item._id) }))
    );
  } catch (error) {
    console.error('GET /api/appointments error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
