'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Loader2, Scissors, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from './hooks/useTranslations';
import { useSettings } from './contexts/SettingsContext';
import LanguageSwitcher from './components/LanguageSwitcher';

interface Barber {
  _id: string;
  name: string;
}

const TIME_SLOTS = Array.from({ length: 19 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

function todayString() {
  return new Date().toISOString().split('T')[0];
}

export default function BookingPage() {
  const { t } = useTranslations();
  const { settings } = useSettings();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoading, setBarbersLoading] = useState(true);
  const [barbersError, setBarbersError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [form, setForm] = useState({
    customerName: '',
    barberId: '',
    date: todayString(),
    time: '',
  });

  const loadBarbers = () => {
    setBarbersLoading(true);
    setBarbersError(false);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    fetch('/api/public/barbers', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load barbers');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setBarbers(data);
        else setBarbersError(true);
      })
      .catch(() => setBarbersError(true))
      .finally(() => {
        clearTimeout(timeout);
        setBarbersLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  };

  useEffect(() => {
    return loadBarbers();
  }, []);

  useEffect(() => {
    if (!form.barberId || !form.date) {
      setBookedTimes([]);
      return;
    }

    fetch(
      `/api/public/availability?barberId=${form.barberId}&date=${form.date}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setBookedTimes(data);
      });
  }, [form.barberId, form.date]);

  const availableSlots = useMemo(
    () => TIME_SLOTS.filter((slot) => !bookedTimes.includes(slot)),
    [bookedTimes]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customerName || !form.barberId || !form.date || !form.time) {
      toast.error(t('booking.requiredFields'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t('booking.slotTaken'));
        return;
      }

      toast.success(t('booking.success'));
      setForm({
        customerName: '',
        barberId: '',
        date: todayString(),
        time: '',
      });
      setBookedTimes([]);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black">
      {/* Header */}
      <header className="border-b border-amber-500/20 bg-black/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/10 p-2 border border-amber-500/30">
              <Scissors className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-amber-400">
                {settings.systemTitle}
              </h1>
              <p className="text-xs text-zinc-500">{settings.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link
              href="/login"
              className="text-xs sm:text-sm text-amber-400/80 hover:text-amber-300 border border-amber-500/30 rounded-lg px-3 py-1.5 transition-colors"
            >
              {t('common.adminLogin')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero + Form */}
      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-amber-400 mb-2">
            {t('booking.title')}
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            {t('booking.subtitle')}
          </p>
        </div>

        {barbersLoading ? (
          <div className="rounded-2xl border border-amber-500/25 bg-zinc-900/60 p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <p className="text-sm text-zinc-400">{t('common.loading')}</p>
          </div>
        ) : barbersError ? (
          <div className="rounded-xl border border-red-500/30 bg-zinc-900/50 p-8 text-center space-y-4">
            <p className="text-zinc-300">{t('booking.loadError')}</p>
            <button
              type="button"
              onClick={loadBarbers}
              className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/10 transition-colors"
            >
              {t('booking.retry')}
            </button>
          </div>
        ) : barbers.length === 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-zinc-900/50 p-8 text-center text-zinc-400">
            {t('booking.noBarbers')}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-amber-500/25 bg-zinc-900/60 backdrop-blur p-5 sm:p-8 shadow-xl shadow-amber-500/5 space-y-6"
          >
            {/* Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-amber-300 mb-2">
                <User className="h-4 w-4" />
                {t('booking.yourName')}
              </label>
              <input
                type="text"
                value={form.customerName}
                onChange={(e) =>
                  setForm({ ...form, customerName: e.target.value })
                }
                placeholder={t('booking.yourNamePlaceholder')}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
              />
            </div>

            {/* Barber */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-amber-300 mb-2">
                <Scissors className="h-4 w-4" />
                {t('booking.selectBarber')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {barbers.map((barber) => (
                  <button
                    key={barber._id}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, barberId: barber._id, time: '' })
                    }
                    className={`rounded-lg border px-4 py-3 text-start text-sm font-medium transition-all ${
                      form.barberId === barber._id
                        ? 'border-amber-500 bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-500/20'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-amber-500/40'
                    }`}
                  >
                    {barber.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-amber-300 mb-2">
                <Calendar className="h-4 w-4" />
                {t('booking.selectDate')}
              </label>
              <input
                type="date"
                value={form.date}
                min={todayString()}
                onChange={(e) =>
                  setForm({ ...form, date: e.target.value, time: '' })
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>

            {/* Time */}
            {form.barberId && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-amber-300 mb-2">
                  <Clock className="h-4 w-4" />
                  {t('booking.selectTime')}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setForm({ ...form, time: slot })}
                      className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-all ${
                        form.time === slot
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-amber-500/40'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                {availableSlots.length === 0 && (
                  <p className="text-sm text-zinc-500 mt-2">
                    {t('booking.slotTaken')}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3.5 text-sm font-semibold text-black hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                t('booking.submit')
              )}
            </button>
          </form>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-zinc-600">
        © {new Date().getFullYear()} {settings.systemTitle}
      </footer>
    </div>
  );
}
