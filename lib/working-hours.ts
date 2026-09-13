export type WorkingHour = {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
};

export const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export const ACTIVE_BOOKING_STATUSES = ['scheduled', 'pending'] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function defaultWorkingHours(): WorkingHour[] {
  return WEEKDAY_KEYS.map((_, day) => ({
    day,
    enabled: day !== 0,
    start: '09:00',
    end: '18:00',
  }));
}

export function normalizeTime(value: string): string | null {
  const trimmed = value.trim().slice(0, 5);
  if (!TIME_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function generateTimeSlots(
  start: string,
  end: string,
  stepMinutes = 30
): string[] {
  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);
  const slots: string[] = [];
  const step = Math.max(5, stepMinutes);

  for (let mins = startMins; mins + step <= endMins; mins += step) {
    slots.push(minutesToTime(mins));
  }

  return slots;
}

export function formatTime12h(timeStr: string, language = 'en'): string {
  const [hoursStr, minutesStr] = timeStr.split(':');
  let hours = parseInt(hoursStr, 10);
  if (isNaN(hours)) return timeStr;
  const isPm = hours >= 12;
  hours = hours % 12;
  if (hours === 0) hours = 12;
  if (language === 'ar') {
    // Wrap in an RTL isolate so the browser doesn't reorder digits and suffix.
    return `⁧${hours}:${minutesStr} ${isPm ? 'م' : 'ص'}⁩`;
  }
  return `${hours}:${minutesStr} ${isPm ? 'PM' : 'AM'}`;
}

export function formatSlotLabel(
  startTime: string,
  durationMinutes = 30,
  language = 'en'
): string {
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + durationMinutes;
  const start12 = formatTime12h(startTime, language);
  const end12 = formatTime12h(minutesToTime(endMins), language);
  return `${start12} - ${end12}`;
}

export function normalizeWorkingHours(
  input: unknown
): WorkingHour[] | null {
  if (!Array.isArray(input)) return null;

  const byDay = new Map<number, WorkingHour>();

  for (const row of input) {
    if (!row || typeof row !== 'object') return null;
    const day = Number((row as WorkingHour).day);
    const enabled = Boolean((row as WorkingHour).enabled);
    const start = normalizeTime(String((row as WorkingHour).start || '09:00'));
    const end = normalizeTime(String((row as WorkingHour).end || '18:00'));

    if (!Number.isInteger(day) || day < 0 || day > 6 || !start || !end) {
      return null;
    }
    if (enabled && timeToMinutes(start) >= timeToMinutes(end)) {
      return null;
    }

    byDay.set(day, { day, enabled, start, end });
  }

  return defaultWorkingHours().map(
    (fallback) => byDay.get(fallback.day) ?? fallback
  );
}

export function resolveWorkingHours(
  hours?: WorkingHour[] | null
): WorkingHour[] {
  return normalizeWorkingHours(hours) ?? defaultWorkingHours();
}

export function getWorkingSlotsForDate(
  hours: WorkingHour[] | null | undefined,
  dateStr: string,
  stepMinutes = 30
): string[] {
  const resolved = resolveWorkingHours(hours);
  const day = getDayOfWeek(dateStr);
  const row = resolved.find((item) => item.day === day);
  if (!row?.enabled) return [];
  return generateTimeSlots(row.start, row.end, stepMinutes);
}

export function filterPastSlots(
  dateStr: string,
  slots: string[],
  now = new Date()
): string[] {
  const today = localDateString(now);
  if (dateStr > today) return slots;
  if (dateStr < today) return [];

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slots.filter((slot) => timeToMinutes(slot) > nowMinutes);
}

export function isActiveBooking(status: string): boolean {
  return status === 'scheduled' || status === 'pending';
}

export type BarberBreak = {
  date: string;
  start: string;
  end: string;
};

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function normalizeBreaks(input: unknown): BarberBreak[] | null {
  if (!Array.isArray(input)) return null;

  const breaks: BarberBreak[] = [];

  for (const row of input) {
    if (!row || typeof row !== 'object') return null;
    const date = String((row as BarberBreak).date || '').trim();
    const start = normalizeTime(String((row as BarberBreak).start || ''));
    const end = normalizeTime(String((row as BarberBreak).end || ''));

    if (!DATE_PATTERN.test(date) || !start || !end) return null;
    if (timeToMinutes(start) >= timeToMinutes(end)) return null;

    breaks.push({ date, start, end });
  }

  return breaks.sort((a, b) =>
    a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)
  );
}

/** Drops every slot whose window overlaps a break on that date. */
export function filterBreakSlots(
  breaks: BarberBreak[] | null | undefined,
  dateStr: string,
  slots: string[],
  slotDurationMinutes = 30
): string[] {
  const dayBreaks = (breaks ?? []).filter((item) => item.date === dateStr);
  if (dayBreaks.length === 0) return slots;

  const duration = Math.max(5, slotDurationMinutes);

  return slots.filter((slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + duration;
    return !dayBreaks.some(
      (item) =>
        slotStart < timeToMinutes(item.end) &&
        slotEnd > timeToMinutes(item.start)
    );
  });
}
