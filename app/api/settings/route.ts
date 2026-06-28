import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Settings from '@/models/Settings';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await dbConnect();

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    return NextResponse.json(
      {
        systemTitle: settings.systemTitle,
        tagline: settings.tagline,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
