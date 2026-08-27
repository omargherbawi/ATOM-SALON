import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import Customer from '@/models/Customer';
import Appointment from '@/models/Appointment';
import {
  PUBLIC_CACHE_KEYS,
  readPublicCache,
  writePublicCache,
  availabilityCacheKey,
} from '@/lib/public-cache';
import {
  ACTIVE_BOOKING_STATUSES,
  filterPastSlots,
  getWorkingSlotsForDate,
} from '@/lib/working-hours';

export type PublicBarber = {
  _id: string;
  name: string;
};

export type PublicSettings = {
  systemTitle: string;
  tagline?: string;
};

export type GuestAppointment = {
  _id: string;
  customerName: string;
  customerPhone?: string;
  barberName: string;
  date: string;
  time: string;
  status: string;
};

export async function getPublicSettings(): Promise<PublicSettings> {
  const cached = await readPublicCache<PublicSettings>(
    PUBLIC_CACHE_KEYS.settings
  );
  if (cached) return cached;

  await dbConnect();
  let settings = await Settings.findOne().lean();
  if (!settings) {
    const created = await Settings.create({});
    settings = created.toObject();
  }

  const payload: PublicSettings = {
    systemTitle: settings.systemTitle,
    tagline: settings.tagline,
  };
  await writePublicCache(PUBLIC_CACHE_KEYS.settings, payload, 300);
  return payload;
}

export async function getPublicBarbers(): Promise<PublicBarber[]> {
  const cached = await readPublicCache<PublicBarber[]>(
    PUBLIC_CACHE_KEYS.barbers
  );
  if (cached) return cached;

  await dbConnect();
  const barbers = await User.find({ role: 'barber', active: true })
    .select('name _id')
    .sort({ name: 1 })
    .lean();

  const payload = barbers.map((barber) => ({
    _id: String(barber._id),
    name: barber.name,
  }));
  await writePublicCache(PUBLIC_CACHE_KEYS.barbers, payload, 120);
  return payload;
}

export async function getGuestAppointments(token: string): Promise<{
  customer: { name: string; phone: string } | null;
  guestToken: string;
  appointments: GuestAppointment[];
}> {
  await dbConnect();

  const customer = await Customer.findOne({ guestToken: token }).lean();
  if (!customer) {
    return { customer: null, guestToken: token, appointments: [] };
  }

  const appointments = await Appointment.find({
    customerId: customer._id.toString(),
  })
    .sort({ date: 1, time: 1 })
    .lean();

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
    })),
  };
}

export async function getAvailableSlots(barberId: string, date: string) {
  const cacheKey = availabilityCacheKey(barberId, date);
  const cached = await readPublicCache<string[]>(cacheKey);
  if (cached) return cached;

  await dbConnect();

  const barber = await User.findOne({
    _id: barberId,
    role: 'barber',
    active: true,
  }).select('workingHours');

  if (!barber) return null;

  const booked = await Appointment.find({
    barberId,
    date,
    status: { $in: [...ACTIVE_BOOKING_STATUSES] },
  })
    .select('time')
    .lean();

  const bookedTimes = new Set(booked.map((item) => item.time));
  const workingSlots = getWorkingSlotsForDate(barber.workingHours, date);
  const available = filterPastSlots(date, workingSlots).filter(
    (slot) => !bookedTimes.has(slot)
  );

  await writePublicCache(cacheKey, available, 20);
  return available;
}
