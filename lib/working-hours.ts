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

export const ACTIVE_BOOKING_STATUSES = ['scheduled', 'scheduled'] as const;

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

  for (let mins = startMins; mins < endMins; mins += stepMinutes) {
    slots.push(minutesToTime(mins));
  }

  return slots;
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
  dateStr: string
): string[] {
  const resolved = resolveWorkingHours(hours);
  const day = getDayOfWeek(dateStr);
  const row = resolved.find((item) => item.day === day);
  if (!row?.enabled) return [];
  return generateTimeSlots(row.start, row.end);
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
  return status === 'scheduled' || status === 'scheduled';
}
