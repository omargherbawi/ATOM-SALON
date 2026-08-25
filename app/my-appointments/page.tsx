'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '../protected-route';
import SidebarLayout from '../components/sidebar-layout';
import { useTranslations } from '../hooks/useTranslations';
import { isActiveBooking } from '@/lib/working-hours';

interface Appointment {
  _id: string;
  customerName: string;
  date: string;
  time: string;
  status: string;
}

export default function MyAppointmentsPage() {
  const { t } = useTranslations();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

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
    <ProtectedRoute allowedRoles={['barber']}>
      <SidebarLayout
        title={t('myAppointments.title')}
        description={t('myAppointments.description')}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-8 text-center text-zinc-400">
            {t('myAppointments.noAppointments')}
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => (
              <div
                key={appt._id}
                className="rounded-xl border border-amber-500/20 bg-zinc-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-amber-300 text-lg">
                    {appt.customerName}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {appt.date} · {appt.time}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(appt.status)}
                  {isActiveBooking(appt.status) && (
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
