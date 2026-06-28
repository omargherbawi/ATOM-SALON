import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await dbConnect();

    const barbers = await User.find({ role: 'barber', active: true })
      .select('name _id')
      .sort({ name: 1 })
      .lean();

    return NextResponse.json(barbers, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('GET /api/public/barbers error:', error);
    return NextResponse.json(
      { error: 'Unable to load barbers. Please try again.' },
      { status: 503 }
    );
  }
}
