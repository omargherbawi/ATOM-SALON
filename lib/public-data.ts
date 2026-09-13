import { getMongoDb, ObjectId } from '@/lib/mongodb';
import {
  PUBLIC_CACHE_KEYS,
  availabilityCacheKey,
  cachedRead,
} from '@/lib/public-cache';
import {
  ACTIVE_BOOKING_STATUSES,
  filterBreakSlots,
  filterPastSlots,
  getWorkingSlotsForDate,
  type BarberBreak,
  type WorkingHour,
} from '@/lib/working-hours';

export type PublicBarber = {
  _id: string;
  name: string;
  // Empty means the booking page falls back to the salon-wide CliQ details.
  cliqNumber?: string;
  cliqBank?: string;
};

export type PublicSettings = {
  systemTitle: string;
  tagline?: string;
  slotDuration?: number;
  payToConfirm?: boolean;
  requireTransferNumber?: boolean;
  paymentAmount?: string;
  paymentCurrency?: string;
  cliqNumber?: string;
  cliqBank?: string;
  allowBarberBreaks?: boolean;
};

export type GuestAppointment = {
  _id: string;
  customerName: string;
  customerPhone?: string;
  barberName: string;
  date: string;
  time: string;
  status: string;
  transferNumber?: string;
};

const DEFAULT_SETTINGS: PublicSettings = {
  systemTitle: 'Atom Salon',
  tagline: 'Premium Barbershop for Men',
  slotDuration: 30,
  payToConfirm: false,
  requireTransferNumber: true,
  paymentAmount: '1',
  paymentCurrency: 'JOD',
  cliqNumber: '00962797598857',
  cliqBank: 'Arab Banks',
  allowBarberBreaks: false,
};

export async function getPublicSettings(): Promise<PublicSettings> {
  return cachedRead<PublicSettings>({
    key: PUBLIC_CACHE_KEYS.settings,
    freshSeconds: 900,
    keepSeconds: 86_400,
    load: async () => {
      const db = await getMongoDb();
      const settings = await db
        .collection('settings')
        .findOne(
          {},
          {
            projection: {
              systemTitle: 1,
              tagline: 1,
              slotDuration: 1,
              payToConfirm: 1,
              requireTransferNumber: 1,
              paymentAmount: 1,
              paymentCurrency: 1,
              cliqNumber: 1,
              cliqBank: 1,
              allowBarberBreaks: 1,
            },
          }
        );

      if (!settings) return DEFAULT_SETTINGS;

      return {
        systemTitle: settings.systemTitle ?? DEFAULT_SETTINGS.systemTitle,
        tagline: settings.tagline ?? DEFAULT_SETTINGS.tagline,
        slotDuration:
          typeof settings.slotDuration === 'number' && settings.slotDuration > 0
            ? settings.slotDuration
            : DEFAULT_SETTINGS.slotDuration,
        payToConfirm: settings.payToConfirm ?? DEFAULT_SETTINGS.payToConfirm,
        requireTransferNumber: settings.requireTransferNumber ?? DEFAULT_SETTINGS.requireTransferNumber,
        paymentAmount: settings.paymentAmount ?? DEFAULT_SETTINGS.paymentAmount,
        paymentCurrency: settings.paymentCurrency ?? DEFAULT_SETTINGS.paymentCurrency,
        cliqNumber: settings.cliqNumber ?? DEFAULT_SETTINGS.cliqNumber,
        cliqBank: settings.cliqBank ?? DEFAULT_SETTINGS.cliqBank,
        allowBarberBreaks: settings.allowBarberBreaks ?? DEFAULT_SETTINGS.allowBarberBreaks,
      };
    },
  });
}

export async function getPublicBarbers(): Promise<PublicBarber[]> {
  return cachedRead<PublicBarber[]>({
    key: PUBLIC_CACHE_KEYS.barbers,
    freshSeconds: 900,
    keepSeconds: 86_400,
    load: async () => {
      const db = await getMongoDb();
      const barbers = await db
        .collection('users')
        .find({ role: 'barber', active: true })
        .project({ name: 1, cliqNumber: 1, cliqBank: 1 })
        .sort({ name: 1 })
        .toArray();

      return barbers.map((barber) => ({
        _id: String(barber._id),
        name: barber.name,
        cliqNumber: barber.cliqNumber || undefined,
        cliqBank: barber.cliqBank || undefined,
      }));
    },
  });
}

export async function getGuestAppointments(token: string): Promise<{
  customer: { name: string; phone: string } | null;
  guestToken: string;
  appointments: GuestAppointment[];
}> {
  const db = await getMongoDb();

  const customer = await db.collection('customers').findOne({
    guestToken: token,
  });
  if (!customer) {
    return { customer: null, guestToken: token, appointments: [] };
  }

  const appointments = await db
    .collection('appointments')
    .find({ customerId: String(customer._id) })
    .sort({ date: 1, time: 1 })
    .limit(50)
    .toArray();

  return {
    customer: {
      name: customer.name,
      phone: customer.phone,
    },
    guestToken: token,
    appointments: appointments.map((item) => ({
      _id: String(item._id),
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      barberName: item.barberName,
      date: item.date,
      time: item.time,
      status: item.status,
      transferNumber: item.transferNumber,
    })),
  };
}

type ScheduleSnapshot = {
  workingHours: WorkingHour[];
  breaks?: BarberBreak[];
  booked: string[];
} | null;

/**
 * The barber's hours and booked times are cached, but the past-slot filter runs
 * on every read so a stale entry can never offer a time that already passed.
 */
export async function getAvailableSlots(
  barberId: string,
  date: string
): Promise<string[] | null> {
  let objectId: InstanceType<typeof ObjectId>;
  try {
    objectId = new ObjectId(barberId);
  } catch {
    return null;
  }

  const snapshot = await cachedRead<ScheduleSnapshot>({
    key: availabilityCacheKey(barberId, date),
    freshSeconds: 30,
    keepSeconds: 86_400,
    load: async () => {
      const db = await getMongoDb();

      const barber = await db
        .collection('users')
        .findOne(
          { _id: objectId, role: 'barber', active: true },
          { projection: { workingHours: 1, breaks: 1 } }
        );

      if (!barber) return null;

      const booked = await db
        .collection('appointments')
        .find({
          barberId,
          date,
          status: { $in: [...ACTIVE_BOOKING_STATUSES] },
        })
        .project({ time: 1 })
        .toArray();

      return {
        workingHours: (barber.workingHours ?? []) as WorkingHour[],
        breaks: ((barber.breaks ?? []) as BarberBreak[]).filter(
          (item) => item.date === date
        ),
        booked: booked.map((item) => String(item.time)),
      };
    },
  });

  if (!snapshot) return null;

  const settings = await getPublicSettings();
  const slotDuration = settings.slotDuration || 30;

  const bookedTimes = new Set(snapshot.booked);
  const workingSlots = filterBreakSlots(
    snapshot.breaks,
    date,
    getWorkingSlotsForDate(snapshot.workingHours, date, slotDuration),
    slotDuration
  );
  return filterPastSlots(date, workingSlots).filter(
    (slot) => !bookedTimes.has(slot)
  );
}
