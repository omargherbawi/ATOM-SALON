'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Phone,
  Scissors,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from './hooks/useTranslations';
import { useSettings } from './contexts/SettingsContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import {
  localDateString,
  isActiveBooking,
  formatSlotLabel,
} from '@/lib/working-hours';
import { readGuestProfile, saveGuestProfile } from '@/lib/guest-client';

interface Barber {
  _id: string;
  name: string;
  cliqNumber?: string;
  cliqBank?: string;
}

interface GuestAppointment {
  _id: string;
  customerName: string;
  customerPhone?: string;
  barberId: string;
  barberName: string;
  date: string;
  time: string;
  status: string;
  transferNumber?: string;
  slotTaken?: boolean;
}

export default function BookingPage() {
  const { t, language } = useTranslations();
  const { settings, hydrateSettings } = useSettings();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoading, setBarbersLoading] = useState(true);
  const [barbersError, setBarbersError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [appointments, setAppointments] = useState<GuestAppointment[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [transferNumbers, setTransferNumbers] = useState<Record<string, string>>(
    {}
  );
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    barberId: '',
    date: localDateString(),
    time: '',
  });

  const scheduledAppointments = appointments.filter((item) =>
    isActiveBooking(item.status)
  );
  const barbersRequestId = useRef(0);

  // Payment goes to the chosen barber's CliQ account when one is set.
  const paymentDetailsFor = (barberId: string) => {
    const barber = barbers.find((item) => item._id === barberId);
    return {
      cliqNumber: barber?.cliqNumber || settings.cliqNumber || '00962797598857',
      cliqBank: barber?.cliqBank || settings.cliqBank || 'Arab Banks',
    };
  };

  const payAmountText = t('booking.payAmount')
    .replace('{amount}', settings.paymentAmount || '1')
    .replace('{currency}', settings.paymentCurrency || 'JOD');

  const loadBarbers = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++barbersRequestId.current;
    setBarbersLoading(true);
    setBarbersError(false);

    try {
      const res = await fetch('/api/public/barbers', {
        signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load barbers');
      const data = await res.json();
      if (requestId !== barbersRequestId.current) return;
      if (Array.isArray(data)) setBarbers(data);
      else setBarbersError(true);
    } catch (error) {
      if (requestId !== barbersRequestId.current) return;
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return;
      }
      setBarbersError(true);
    } finally {
      if (requestId === barbersRequestId.current) {
        setBarbersLoading(false);
      }
    }
  }, []);

  const loadGuestAppointments = async (token?: string) => {
    const profile = readGuestProfile();
    const guestToken = token || profile?.token;
    const query = guestToken
      ? `/api/public/my-appointments?token=${encodeURIComponent(guestToken)}`
      : '/api/public/my-appointments';

    const res = await fetch(query, { credentials: 'include' });
    const data = await res.json();
    const list: GuestAppointment[] = Array.isArray(data.appointments)
      ? data.appointments
      : [];
    setAppointments(list);

    if (data.guestToken || profile?.token) {
      saveGuestProfile({
        token: data.guestToken || profile?.token || '',
        name: data.customer?.name || profile?.name || '',
        phone: data.customer?.phone || profile?.phone || '',
      });
    }

    if (data.customer?.name) {
      setForm((current) => ({
        ...current,
        customerName: current.customerName || data.customer.name,
        customerPhone: current.customerPhone || data.customer.phone || '',
      }));
    } else if (profile) {
      setForm((current) => ({
        ...current,
        customerName: current.customerName || profile.name,
        customerPhone: current.customerPhone || profile.phone,
      }));
    }

    return list;
  };

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++barbersRequestId.current;
    setBarbersLoading(true);
    setBarbersError(false);

    const profile = readGuestProfile();
    const query = profile?.token
      ? `/api/public/bootstrap?token=${encodeURIComponent(profile.token)}`
      : '/api/public/bootstrap';

    fetch(query, { credentials: 'include', signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load booking data');
        return res.json();
      })
      .then((data) => {
        if (requestId !== barbersRequestId.current) return;

        if (data.settings?.systemTitle) {
          hydrateSettings({
            systemTitle: data.settings.systemTitle,
            tagline: data.settings.tagline,
            slotDuration: data.settings.slotDuration,
            payToConfirm: data.settings.payToConfirm,
            requireTransferNumber: data.settings.requireTransferNumber,
            paymentAmount: data.settings.paymentAmount,
            paymentCurrency: data.settings.paymentCurrency,
            cliqNumber: data.settings.cliqNumber,
            cliqBank: data.settings.cliqBank,
          });
        }

        if (Array.isArray(data.barbers)) {
          setBarbers(data.barbers);
        } else {
          setBarbersError(true);
        }

        const list: GuestAppointment[] = Array.isArray(data.appointments)
          ? data.appointments
          : [];
        setAppointments(list);
        setShowForm(!list.some((item) => isActiveBooking(item.status)));

        if (data.guestToken || profile?.token) {
          saveGuestProfile({
            token: data.guestToken || profile?.token || '',
            name: data.customer?.name || profile?.name || '',
            phone: data.customer?.phone || profile?.phone || '',
          });
        }

        if (data.customer?.name) {
          setForm((current) => ({
            ...current,
            customerName: current.customerName || data.customer.name,
            customerPhone: current.customerPhone || data.customer.phone || '',
          }));
        } else if (profile) {
          setForm((current) => ({
            ...current,
            customerName: current.customerName || profile.name,
            customerPhone: current.customerPhone || profile.phone,
          }));
        }
      })
      .catch((error) => {
        if (requestId !== barbersRequestId.current) return;
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        setBarbersError(true);
        setShowForm(true);
      })
      .finally(() => {
        if (requestId === barbersRequestId.current) {
          setBarbersLoading(false);
          setGuestLoading(false);
        }
      });

    return () => {
      barbersRequestId.current += 1;
      controller.abort();
    };
  }, [hydrateSettings]);

  useEffect(() => {
    if (!form.barberId || !form.date) {
      setAvailableSlots([]);
      return;
    }

    setSlotsLoading(true);
    fetch(
      `/api/public/availability?barberId=${form.barberId}&date=${form.date}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.available)) setAvailableSlots(data.available);
        else setAvailableSlots([]);
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [form.barberId, form.date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.customerName ||
      !form.customerPhone ||
      !form.barberId ||
      !form.date ||
      !form.time
    ) {
      toast.error(t('booking.requiredFields'));
      return;
    }

    setSubmitting(true);
    try {
      const profile = readGuestProfile();
      const res = await fetch('/api/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          guestToken: profile?.token,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t('booking.slotTaken'));
        return;
      }

      if (data.guestToken) {
        saveGuestProfile({
          token: data.guestToken,
          name: form.customerName,
          phone: form.customerPhone,
        });
      }

      toast.success(
        settings.payToConfirm
          ? t('booking.bookedUnconfirmed')
          : t('booking.success')
      );
      await loadGuestAppointments(data.guestToken);
      setShowForm(false);
      setForm((current) => ({
        ...current,
        barberId: '',
        date: localDateString(),
        time: '',
      }));
      setAvailableSlots([]);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (appointment: GuestAppointment) => {
    const transferNumber = (transferNumbers[appointment._id] || '').trim();

    if (settings.requireTransferNumber !== false && !transferNumber) {
      toast.error(t('booking.transferNumberRequired'));
      return;
    }

    setPayingId(appointment._id);
    try {
      const profile = readGuestProfile();
      const res = await fetch(
        `/api/public/appointments/${appointment._id}/pay`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ guestToken: profile?.token, transferNumber }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(
          data.slotTaken ? t('booking.slotTakenNotice') : data.error || t('booking.slotTaken')
        );
        await loadGuestAppointments();
        return;
      }

      toast.success(t('booking.paymentSubmitted'));
      setTransferNumbers((current) => ({ ...current, [appointment._id]: '' }));
      await loadGuestAppointments();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setPayingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm(t('booking.cancelConfirm'))) return;

    setCancellingId(id);
    try {
      const profile = readGuestProfile();
      const res = await fetch(`/api/public/appointments/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ guestToken: profile?.token }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed');
        return;
      }

      toast.success(t('booking.cancelled'));
      const list = await loadGuestAppointments();
      const hasUpcoming = list.some((item) => isActiveBooking(item.status));
      setShowForm(!hasUpcoming);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setCancellingId(null);
    }
  };

  const fieldClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors';

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black">
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

      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-amber-400 mb-2">
            {showForm ? t('booking.title') : t('booking.yourAppointment')}
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            {showForm ? t('booking.subtitle') : t('booking.savedHint')}
          </p>
        </div>

        {guestLoading || barbersLoading ? (
          <div className="rounded-2xl border border-amber-500/25 bg-zinc-900/60 p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <p className="text-sm text-zinc-400">{t('common.loading')}</p>
          </div>
        ) : !showForm && scheduledAppointments.length > 0 ? (
          <div className="space-y-4">
            {scheduledAppointments.map((appt) => {
              const unconfirmed = appt.status === 'unconfirmed';
              const slotTaken = Boolean(unconfirmed && appt.slotTaken);
              const payment = paymentDetailsFor(appt.barberId);

              return (
                <div
                  key={appt._id}
                  className={`rounded-2xl border bg-zinc-900/60 p-5 sm:p-6 space-y-4 ${
                    slotTaken
                      ? 'border-red-500/40'
                      : unconfirmed
                        ? 'border-amber-500/40'
                        : 'border-amber-500/25'
                  }`}
                >
                  {slotTaken ? (
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">
                        {t('booking.slotTakenTitle')}
                      </span>
                    </div>
                  ) : unconfirmed ? (
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">
                        {t('booking.unconfirmedTitle')}
                      </span>
                    </div>
                  ) : appt.status === 'pending' ? (
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">
                        {t('booking.pendingReview')}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm font-medium">
                        {t('booking.confirmed')}
                      </span>
                    </div>
                  )}
                  {slotTaken ? (
                    <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                      {t('booking.slotTakenNotice')}
                    </p>
                  ) : unconfirmed ? (
                    <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 leading-relaxed">
                      {t('booking.unconfirmedNotice')} {payAmountText}
                    </p>
                  ) : appt.status === 'pending' ? (
                    <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                      {t('booking.pendingNotice')}
                    </p>
                  ) : null}
                  <div className="space-y-3 text-sm">
                    <p className="flex items-center gap-2 text-zinc-200">
                      <User className="h-4 w-4 text-amber-400" />
                      {appt.customerName}
                    </p>
                    {appt.customerPhone && (
                      <p className="flex items-center gap-2 text-zinc-200">
                        <Phone className="h-4 w-4 text-amber-400" />
                        {appt.customerPhone}
                      </p>
                    )}
                    <p className="flex items-center gap-2 text-zinc-200">
                      <Scissors className="h-4 w-4 text-amber-400" />
                      {appt.barberName}
                    </p>
                    <p className="flex items-center gap-2 text-zinc-200">
                      <Calendar className="h-4 w-4 text-amber-400" />
                      {appt.date}
                    </p>
                    <p className="flex items-center gap-2 text-zinc-200">
                      <Clock className="h-4 w-4 text-amber-400" />
                      {formatSlotLabel(appt.time, settings.slotDuration || 30, language)}
                    </p>
                    {appt.transferNumber && (
                      <p className="flex items-center gap-2 text-zinc-200">
                        <CreditCard className="h-4 w-4 text-amber-400" />
                        <span className="text-zinc-400">{t('booking.transferNumber')}:</span>
                        <span className="font-mono text-amber-300">{appt.transferNumber}</span>
                      </p>
                    )}
                  </div>
                  {unconfirmed && !slotTaken && (
                    <div className="rounded-xl border border-amber-500/20 bg-zinc-950/80 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-amber-300">
                        <CreditCard className="h-4 w-4" />
                        <span className="text-sm font-semibold">
                          {t('booking.paymentStepTitle')}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
                          <span className="text-zinc-500 block mb-1">
                            {t('booking.cliqNumber')}
                          </span>
                          <span
                            dir="ltr"
                            className="font-mono text-sm text-amber-300 font-bold select-all"
                          >
                            {payment.cliqNumber}
                          </span>
                        </div>
                        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
                          <span className="text-zinc-500 block mb-1">
                            {t('booking.cliqBank')}
                          </span>
                          <span className="text-sm text-zinc-200 font-medium">
                            {payment.cliqBank}
                          </span>
                        </div>
                      </div>

                      {settings.requireTransferNumber !== false && (
                        <div>
                          <label className="flex items-center gap-2 text-xs font-medium text-amber-300 mb-2">
                            <CreditCard className="h-4 w-4" />
                            {t('booking.transferNumber')}
                          </label>
                          <input
                            type="text"
                            value={transferNumbers[appt._id] || ''}
                            onChange={(e) =>
                              setTransferNumbers((current) => ({
                                ...current,
                                [appt._id]: e.target.value,
                              }))
                            }
                            placeholder={t('booking.transferNumberPlaceholder')}
                            className={fieldClass}
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handlePay(appt)}
                        disabled={payingId === appt._id}
                        className="w-full min-h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-sm font-semibold text-black hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                      >
                        {payingId === appt._id ? (
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        ) : (
                          t('booking.markAsPaid')
                        )}
                      </button>
                      <p className="text-[11px] text-zinc-500 text-center">
                        {t('booking.payLaterHint')}
                      </p>
                    </div>
                  )}

                  {slotTaken && (
                    <button
                      type="button"
                      onClick={() => setShowForm(true)}
                      className="min-h-11 w-full rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400"
                    >
                      {t('booking.bookAnother')}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCancel(appt._id)}
                    disabled={cancellingId === appt._id}
                    className="min-h-11 w-full rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {cancellingId === appt._id
                      ? t('common.loading')
                      : t('booking.cancelAppointment')}
                  </button>
                </div>
              );
            })}
          </div>
        ) : barbersError ? (
          <div className="rounded-xl border border-red-500/30 bg-zinc-900/50 p-8 text-center space-y-4">
            <p className="text-zinc-300">{t('booking.loadError')}</p>
            <button
              type="button"
              onClick={() => void loadBarbers()}
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
                className={fieldClass}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-amber-300 mb-2">
                <Phone className="h-4 w-4" />
                {t('booking.yourPhone')}
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={form.customerPhone}
                onChange={(e) =>
                  setForm({ ...form, customerPhone: e.target.value })
                }
                placeholder={t('booking.yourPhonePlaceholder')}
                className={fieldClass}
              />
            </div>

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
                    className={`min-h-11 rounded-lg border px-4 py-3 text-start text-sm font-medium transition-all ${
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

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-amber-300 mb-2">
                <Calendar className="h-4 w-4" />
                {t('booking.selectDate')}
              </label>
              <input
                type="date"
                value={form.date}
                min={localDateString()}
                onChange={(e) =>
                  setForm({ ...form, date: e.target.value, time: '' })
                }
                className={fieldClass}
              />
            </div>

            {form.barberId && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-amber-300 mb-2">
                  <Clock className="h-4 w-4" />
                  {t('booking.selectTime')}
                </label>
                {slotsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setForm({ ...form, time: slot })}
                        className={`min-h-11 rounded-lg border px-3 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center justify-center transition-all ${
                          form.time === slot
                            ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-amber-500/40'
                        }`}
                      >
                        {formatSlotLabel(slot, settings.slotDuration || 30, language)}
                      </button>
                    ))}
                  </div>
                )}
                {!slotsLoading && availableSlots.length === 0 && (
                  <p className="text-sm text-zinc-500 mt-2">
                    {t('booking.noSlots')}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3.5 text-sm font-semibold text-black hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                t('booking.submit')
              )}
            </button>

            {scheduledAppointments.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-full min-h-11 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                {t('booking.backToAppointments')}
              </button>
            )}
          </form>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-zinc-600">
        © {new Date().getFullYear()} {settings.systemTitle}
      </footer>
    </div>
  );
}
