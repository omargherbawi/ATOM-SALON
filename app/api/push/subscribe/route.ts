import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Customer from '@/models/Customer';
import PushSubscription from '@/models/PushSubscription';
import { readGuestToken } from '@/lib/guest';
import { getVapidKeys, isPushServiceEndpoint } from '@/lib/push-notifications';

export const runtime = 'nodejs';

type Audience = 'barber' | 'customer';

function parseAudience(value: unknown): Audience | null {
  return value === 'barber' || value === 'customer' ? value : null;
}

/** Resolves who is subscribing: the signed-in barber, or the guest customer. */
async function resolveOwner(
  request: NextRequest,
  audience: Audience,
  guestToken?: string
): Promise<string | null> {
  if (audience === 'barber') {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'barber' || !session.user.id) return null;
    return session.user.id;
  }

  const token = readGuestToken(request, guestToken || '');
  if (!token) return null;
  await dbConnect();
  const customer = await Customer.findOne({ guestToken: token }).select('_id');
  return customer ? customer._id.toString() : null;
}

/** The browser needs the VAPID public key before it can subscribe. */
export async function GET() {
  const vapid = getVapidKeys();
  return NextResponse.json({ publicKey: vapid?.publicKey ?? null });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const audience = parseAudience(body.audience);
    const endpoint = String(body.subscription?.endpoint || '');
    const p256dh = String(body.subscription?.keys?.p256dh || '');
    const auth = String(body.subscription?.keys?.auth || '');

    if (!audience) {
      return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
    }
    if (!isPushServiceEndpoint(endpoint) || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'Invalid push subscription' },
        { status: 400 }
      );
    }

    const ownerId = await resolveOwner(request, audience, body.guestToken);
    if (!ownerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    await PushSubscription.findOneAndUpdate(
      { endpoint, ownerType: audience },
      {
        endpoint,
        ownerType: audience,
        ownerId,
        keys: { p256dh, auth },
        language: body.language === 'en' ? 'en' : 'ar',
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ message: 'Subscribed' });
  } catch (error) {
    console.error('POST /api/push/subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// The endpoint itself is an unguessable capability URL, so knowing it is
// enough to unsubscribe it.
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const audience = parseAudience(body.audience);
    const endpoint = String(body.endpoint || '');

    if (!audience || !endpoint) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    await dbConnect();
    await PushSubscription.deleteOne({ endpoint, ownerType: audience });

    return NextResponse.json({ message: 'Unsubscribed' });
  } catch (error) {
    console.error('DELETE /api/push/subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
