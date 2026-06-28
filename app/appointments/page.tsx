'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '../protected-route';
import SidebarLayout from '../components/sidebar-layout';
import { useTranslations } from '../hooks/useTranslations';

interface Appointment {
  _id: string;
  customerName: string;
  barberName: string;
  date: string;
  time: string;
  status: string;
}

export default function AppointmentsPage() {
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
    <ProtectedRoute allowedRoles={['admin']}>
      <SidebarLayout
        title={t('appointments.title')}
        description={t('appointments.description')}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-8 text-center text-zinc-400">
            {t('appointments.noAppointments')}
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
                      {t('appointments.barber')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('appointments.date')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('appointments.time')}
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
                  {appointments.map((appt) => (
                    <tr
                      key={appt._id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-3">{appt.customerName}</td>
                      <td className="px-4 py-3">{appt.barberName}</td>
                      <td className="px-4 py-3">{appt.date}</td>
                      <td className="px-4 py-3">{appt.time}</td>
                      <td className="px-4 py-3">{statusBadge(appt.status)}</td>
                      <td className="px-4 py-3">
                        {appt.status === 'scheduled' && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateStatus(appt._id, 'completed')
                              }
                              className="text-xs text-green-400 hover:text-green-300"
                            >
                              {t('appointments.markCompleted')}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateStatus(appt._id, 'cancelled')
                              }
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              {t('appointments.markCancelled')}
                            </button>
                          </div>
                        )}
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
