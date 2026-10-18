import { getCloudflareContext } from '@opennextjs/cloudflare';
import dbConnect from '@/lib/mongodb';
import PushSubscription, {
  type IPushSubscription,
} from '@/models/PushSubscription';
import { getPublicSettings } from '@/lib/public-data';
import {
  WEEKDAY_KEYS,
  formatSlotLabel,
  getDayOfWeek,
} from '@/lib/working-hours';
import { sendWebPush, type VapidKeys } from '@/lib/web-push';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';

type Language = 'en' | 'ar';
type OwnerType = IPushSubscription['ownerType'];

type NotificationContent = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

type BookingDetails = {
  _id: { toString(): string } | string;
  customerName: string;
  customerId?: string;
  barberId: string;
  barberName: string;
  date: string;
  time: string;
};

const messages = { en, ar };

// Browsers hand out endpoints on these push services only. Refusing anything
// else stops the server from being used to POST to arbitrary URLs.
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
];

export function isPushServiceEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'https:' &&
      PUSH_SERVICE_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
      )
    );
  } catch {
    return false;
  }
}

export function getVapidKeys(): VapidKeys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@example.com',
  };
}

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] : match
  );
}

async function describeSlot(
  appointment: BookingDetails,
  language: Language
) {
  const settings = await getPublicSettings().catch(() => null);
  const dayKey = WEEKDAY_KEYS[getDayOfWeek(appointment.date)];
  return {
    day: messages[language].workingHours.days[dayKey],
    date: appointment.date,
    time: formatSlotLabel(
      appointment.time,
      settings?.slotDuration || 30,
      language
    ),
  };
}

async function sendToOwner(
  ownerType: OwnerType,
  ownerId: string,
  build: (language: Language) => Promise<NotificationContent>
) {
  const vapid = getVapidKeys();
  if (!vapid) {
    console.warn('Push notifications skipped: VAPID keys are not configured');
    return;
  }

  await dbConnect();
  const subscriptions = await PushSubscription.find({ ownerType, ownerId })
    .select('endpoint keys language')
    .lean<Pick<IPushSubscription, '_id' | 'endpoint' | 'keys' | 'language'>[]>();

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const language = subscription.language === 'en' ? 'en' : 'ar';
      const content = await build(language);
      const payload = JSON.stringify({
        ...content,
        lang: language,
        dir: language === 'ar' ? 'rtl' : 'ltr',
      });

      try {
        const result = await sendWebPush(subscription, payload, vapid);
        if (result.gone) {
          await PushSubscription.deleteOne({ _id: subscription._id });
        } else if (!result.ok) {
          console.error(
            `Push to ${new URL(subscription.endpoint).hostname} failed with ${result.status}`
          );
        }
      } catch (error) {
        console.error('Push send error:', error);
      }
    })
  );
}

/** Tells the chosen barber - and only that barber - about a new booking. */
export function notifyBarberNewBooking(appointment: BookingDetails) {
  return sendToOwner('barber', appointment.barberId, async (language) => {
    const text = messages[language].push;
    const slot = await describeSlot(appointment, language);
    return {
      title: text.newBookingTitle,
      body: fill(text.newBookingBody, {
        customer: appointment.customerName,
        ...slot,
      }),
      url: '/my-appointments',
      tag: `booking-${appointment._id.toString()}`,
    };
  });
}

/** Tells the customer that their pay-to-confirm booking was accepted. */
export function notifyCustomerBookingConfirmed(appointment: BookingDetails) {
  if (!appointment.customerId) return Promise.resolve();

  return sendToOwner('customer', appointment.customerId, async (language) => {
    const text = messages[language].push;
    const slot = await describeSlot(appointment, language);
    return {
      title: text.confirmedTitle,
      body: fill(text.confirmedBody, {
        barber: appointment.barberName,
        ...slot,
      }),
      url: '/',
      tag: `confirmed-${appointment._id.toString()}`,
    };
  });
}

/**
 * Sends after the response is returned, so a slow push service never delays
 * the booking. On Workers the task is kept alive with `waitUntil`.
 */
export function sendInBackground(task: Promise<unknown>) {
  const safe = task.catch((error) => {
    console.error('Push notification failed:', error);
  });
  void getCloudflareContext({ async: true })
    .then((context) => context.ctx.waitUntil(safe))
    .catch(() => {});
}
