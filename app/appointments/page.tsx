'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '../protected-route';
import SidebarLayout from '../components/sidebar-layout';
import { useTranslations } from '../hooks/useTranslations';
import { useSettings } from '../contexts/SettingsContext';
import {
  isActiveBooking,
  localDateString,
  formatSlotLabel,
} from '@/lib/working-hours';

interface Appointment {
  _id: string;
  customerName: string;
  customerPhone?: string;
  barberName: string;
  date: string;
  time: string;
  status: string;
  transferNumber?: string;
}

export default function AppointmentsPage() {
  const { t, language } = useTranslations();
  const { settings } = useSettings();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'pending'>('today');

  const today = localDateString();
  const pendingCount = useMemo(
    () => appointments.filter((a) => a.status === 'pending').length,
    [appointments]
  );

  const visibleAppointments = useMemo(() => {
    if (filter === 'pending') return appointments.filter((a) => a.status === 'pending');
    if (filter === 'today') return appointments.filter((appt) => appt.date === today);
    return appointments;
  }, [appointments, filter, today]);

  const loadAppointments = () => {
    fetch('/api/appointments')
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

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <SidebarLayout
        title={t('appointments.title')}
        description={t('appointments.description')}
      >
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setFilter('today')}
            className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors ${
              filter === 'today'
                ? 'bg-amber-500 text-black'
                : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {t('appointments.today')}
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors flex items-center gap-1.5 ${
              filter === 'pending'
                ? 'bg-amber-500 text-black'
                : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <span>{t('appointments.pendingTab')}</span>
            {pendingCount > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                filter === 'pending' ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-amber-500 text-black'
                : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {t('appointments.all')}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400" />
          </div>
        ) : visibleAppointments.length === 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-8 text-center text-zinc-400">
            {filter === 'today'
              ? t('appointments.noAppointmentsToday')
              : t('appointments.noAppointments')}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="text-start px-4 py-3 font-medium">
                      {t('appointments.customer')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('booking.yourPhone')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('appointments.barber')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('appointments.date')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('appointments.time')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('appointments.transferNumber')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('common.status')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAppointments.map((appt) => (
                    <tr
                      key={appt._id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-200">{appt.customerName}</td>
                      <td className="px-4 py-3">{appt.customerPhone || '—'}</td>
                      <td className="px-4 py-3">{appt.barberName}</td>
                      <td className="px-4 py-3">{appt.date}</td>
                      <td className="px-4 py-3">
                        {formatSlotLabel(appt.time, settings.slotDuration || 30, language)}
                      </td>
                      <td className="px-4 py-3 font-mono text-amber-300 text-xs">
                        {appt.transferNumber || '—'}
                      </td>
                      <td className="px-4 py-3">{statusBadge(appt.status)}</td>
                      <td className="px-4 py-3">
                        {appt.status === 'pending' ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => updateStatus(appt._id, 'scheduled')}
                              className="rounded px-2.5 py-1 text-xs font-semibold bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/40 transition-colors"
                            >
                              {t('appointments.confirmPayment')}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStatus(appt._id, 'cancelled')}
                              className="rounded px-2.5 py-1 text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 transition-colors"
                            >
                              {t('appointments.reject')}
                            </button>
                          </div>
                        ) : appt.status === 'scheduled' ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => updateStatus(appt._id, 'completed')}
                              className="text-xs text-green-400 hover:text-green-300"
                            >
                              {t('appointments.markCompleted')}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStatus(appt._id, 'cancelled')}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              {t('appointments.markCancelled')}
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SidebarLayout>
    </ProtectedRoute>
  );
}
