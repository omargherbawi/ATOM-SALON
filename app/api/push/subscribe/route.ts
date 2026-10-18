import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getMongoDb } from '@/lib/mongodb';
import { readGuestToken } from '@/lib/guest';
import {
  PUSH_SUBSCRIPTIONS_COLLECTION,
  getVapidKeys,
  isPushServiceEndpoint,
  type PushOwnerType,
  type PushSubscriptionDoc,
} from '@/lib/push-notifications';

export const runtime = 'nodejs';

function parseAudience(value: unknown): PushOwnerType | null {
  return value === 'barber' || value === 'customer' ? value : null;
}

/** Resolves who is subscribing: the signed-in barber, or the guest customer. */
async function resolveOwner(
  request: NextRequest,
  audience: PushOwnerType,
  guestToken?: string
): Promise<string | null> {
  if (audience === 'barber') {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'barber' || !session.user.id) return null;
    return session.user.id;
  }

  const token = readGuestToken(request, guestToken || '');
  if (!token) return null;
  const db = await getMongoDb();
  const customer = await db
    .collection('customers')
    .findOne({ guestToken: token }, { projection: { _id: 1 } });
  return customer ? String(customer._id) : null;
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

    const db = await getMongoDb();
    const now = new Date();
    await db
      .collection<PushSubscriptionDoc>(PUSH_SUBSCRIPTIONS_COLLECTION)
      .updateOne(
        { endpoint, ownerType: audience },
        {
          $set: {
            ownerId,
            keys: { p256dh, auth },
            language: body.language === 'en' ? 'en' : 'ar',
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
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

    const db = await getMongoDb();
    await db
      .collection<PushSubscriptionDoc>(PUSH_SUBSCRIPTIONS_COLLECTION)
      .deleteOne({ endpoint, ownerType: audience });

    return NextResponse.json({ message: 'Unsubscribed' });
  } catch (error) {
    console.error('DELETE /api/push/subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
