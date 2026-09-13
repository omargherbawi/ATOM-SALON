'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '../protected-route';
import SidebarLayout from '../components/sidebar-layout';
import { useTranslations } from '../hooks/useTranslations';
import { useSettings } from '../contexts/SettingsContext';
import { formatSlotLabel, localDateString } from '@/lib/working-hours';

interface Appointment {
  _id: string;
  customerName: string;
  customerPhone?: string;
  date: string;
  time: string;
  status: string;
  transferNumber?: string;
}

type Filter = 'today' | 'pending' | 'all';

export default function MyAppointmentsPage() {
  const { t, language } = useTranslations();
  const { settings } = useSettings();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('today');

  const today = localDateString();
  const pendingCount = useMemo(
    () => appointments.filter((a) => a.status === 'pending').length,
    [appointments]
  );

  const visibleAppointments = useMemo(() => {
    if (filter === 'pending') {
      return appointments.filter((a) => a.status === 'pending');
    }
    if (filter === 'today') {
      return appointments.filter((a) => a.date === today);
    }
    return appointments;
  }, [appointments, filter, today]);

  const loadAppointments = () => {
    fetch('/api/appointments', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAppointments(data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      toast.success('Updated');
      loadAppointments();
    } else {
      toast.error('Failed to update');
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
      scheduled: 'bg-amber-500/20 text-amber-300',
      completed: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || ''}`}
      >
        {t(`appointments.${status}` as 'appointments.scheduled')}
      </span>
    );
  };

  const filterButton = (value: Filter, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors flex items-center gap-1.5 ${
        filter === value
          ? 'bg-amber-500 text-black'
          : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      <span>{label}</span>
      {!!count && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            filter === value
              ? 'bg-black text-amber-400'
              : 'bg-amber-500/20 text-amber-300'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <ProtectedRoute allowedRoles={['barber']}>
      <SidebarLayout
        title={t('myAppointments.title')}
        description={t('myAppointments.description')}
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {filterButton('today', t('appointments.today'))}
          {filterButton('pending', t('appointments.pendingTab'), pendingCount)}
          {filterButton('all', t('appointments.all'))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400" />
          </div>
        ) : visibleAppointments.length === 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-8 text-center text-zinc-400">
            {filter === 'today'
              ? t('appointments.noAppointmentsToday')
              : filter === 'pending'
                ? t('myAppointments.noPending')
                : t('myAppointments.noAppointments')}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleAppointments.map((appt) => (
              <div
                key={appt._id}
                className={`rounded-xl border bg-zinc-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  appt.status === 'pending'
                    ? 'border-yellow-500/40'
                    : 'border-amber-500/20'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-amber-300 text-lg">
                    {appt.customerName}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {appt.date} ·{' '}
                    {formatSlotLabel(appt.time, settings.slotDuration || 30, language)}
                  </p>
                  {(appt.customerPhone || appt.transferNumber) && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                      {appt.customerPhone && (
                        <span>
                          {t('myAppointments.phone')}:{' '}
                          <a
                            href={`tel:${appt.customerPhone}`}
                            dir="ltr"
                            className="text-zinc-200 hover:text-amber-300"
                          >
                            {appt.customerPhone}
                          </a>
                        </span>
                      )}
                      {appt.transferNumber && (
                        <span>
                          {t('appointments.transferNumber')}:{' '}
                          <span dir="ltr" className="font-mono text-amber-300 select-all">
                            {appt.transferNumber}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {statusBadge(appt.status)}
                  {appt.status === 'pending' && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateStatus(appt._id, 'scheduled')}
                        className="min-h-11 text-xs font-semibold rounded-lg bg-green-500/20 text-green-300 border border-green-500/40 px-3 py-1.5 hover:bg-green-500/30"
                      >
                        {t('appointments.confirmPayment')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(t('myAppointments.confirmReject'))) {
                            return;
                          }
                          updateStatus(appt._id, 'cancelled');
                        }}
                        className="min-h-11 text-xs font-semibold rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 px-3 py-1.5 hover:bg-red-500/30"
                      >
                        {t('appointments.reject')}
                      </button>
                    </div>
                  )}
                  {appt.status === 'scheduled' && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateStatus(appt._id, 'completed')}
                        className="min-h-11 text-xs rounded-lg bg-green-500/20 text-green-400 px-3 py-1.5 hover:bg-green-500/30"
                      >
                        {t('appointments.markCompleted')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(t('myAppointments.confirmCancel'))) {
                            return;
                          }
                          updateStatus(appt._id, 'cancelled');
                        }}
                        className="min-h-11 text-xs rounded-lg bg-red-500/20 text-red-400 px-3 py-1.5 hover:bg-red-500/30"
                      >
                        {t('appointments.markCancelled')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SidebarLayout>
    </ProtectedRoute>
  );
}
