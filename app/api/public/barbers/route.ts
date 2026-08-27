import { NextResponse } from 'next/server';
import { getPublicBarbers } from '@/lib/public-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const barbers = await getPublicBarbers();
    return NextResponse.json(barbers, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
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
