import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getPublicSettings } from '@/lib/public-data';
import { getAdminTokenFromRequest } from '@/lib/require-admin-request';
import { invalidateSettingsCache } from '@/lib/public-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getPublicSettings();
    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = await getAdminTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      systemTitle,
      tagline,
      slotDuration,
      payToConfirm,
      requireTransferNumber,
      paymentAmount,
      paymentCurrency,
      cliqNumber,
      cliqBank,
      allowBarberBreaks,
    } = body;

    if (!systemTitle || typeof systemTitle !== 'string' || !systemTitle.trim()) {
      return NextResponse.json(
        { error: 'System title is required' },
        { status: 400 }
      );
    }

    const parsedDuration = Number(slotDuration);
    if (
      !Number.isInteger(parsedDuration) ||
      parsedDuration < 5 ||
      parsedDuration > 240
    ) {
      return NextResponse.json(
        { error: 'Slot duration must be between 5 and 240 minutes' },
        { status: 400 }
      );
    }

    const db = await getMongoDb();
    const updateData = {
      systemTitle: systemTitle.trim(),
      tagline: typeof tagline === 'string' ? tagline.trim() : '',
      slotDuration: parsedDuration,
      payToConfirm: Boolean(payToConfirm),
      requireTransferNumber: requireTransferNumber !== undefined ? Boolean(requireTransferNumber) : true,
      paymentAmount: typeof paymentAmount === 'string' && paymentAmount.trim() ? paymentAmount.trim() : '1',
      paymentCurrency: typeof paymentCurrency === 'string' && paymentCurrency.trim() ? paymentCurrency.trim() : 'JOD',
      cliqNumber: typeof cliqNumber === 'string' ? cliqNumber.trim() : '',
      cliqBank: typeof cliqBank === 'string' ? cliqBank.trim() : '',
      allowBarberBreaks: Boolean(allowBarberBreaks),
      updatedAt: new Date(),
    };

    await db.collection('settings').updateOne(
      {},
      {
        $set: updateData,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    await invalidateSettingsCache();

    return NextResponse.json({
      message: 'Settings updated successfully',
      data: updateData,
    });
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update settings',
      },
      { status: 500 }
    );
  }
}
