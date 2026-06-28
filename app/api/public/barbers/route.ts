import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    await dbConnect();

    const barbers = await User.find({ role: 'barber', active: true })
      .select('name email _id')
      .sort({ name: 1 });

    return NextResponse.json(barbers);
  } catch (error) {
    console.error('GET /api/public/barbers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
