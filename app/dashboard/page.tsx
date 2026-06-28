'use client';

import { useEffect, useState } from 'react';
import { Calendar, Scissors, Users } from 'lucide-react';
import ProtectedRoute from '../protected-route';
import SidebarLayout from '../components/sidebar-layout';
import { useTranslations } from '../hooks/useTranslations';

interface Stats {
  totalAppointments: number;
  todayAppointments: number;
  activeBarbers: number;
  upcoming: Array<{
    _id: string;
    customerName: string;
    barberName: string;
    date: string;
    time: string;
    status: string;
  }>;
}

export default function DashboardPage() {
  const { t } = useTranslations();
  const [stats, setStats] = useState<Stats>({
    totalAppointments: 0,
    todayAppointments: 0,
    activeBarbers: 0,
    upcoming: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    Promise.all([
      fetch('/api/appointments').then((r) => r.json()),
      fetch('/api/barbers').then((r) => r.json()),
    ]).then(([appointments, barbers]) => {
      const appts = Array.isArray(appointments) ? appointments : [];
      const barberList = Array.isArray(barbers) ? barbers : [];

      setStats({
        totalAppointments: appts.length,
        todayAppointments: appts.filter(
          (a: { date: string; status: string }) =>
            a.date === today && a.status === 'scheduled'
        ).length,
        activeBarbers: barberList.filter((b: { active: boolean }) => b.active)
          .length,
        upcoming: appts
          .filter(
            (a: { status: string; date: string }) =>
              a.status === 'scheduled' && a.date >= today
          )
          .slice(0, 5),
      });
      setLoading(false);
    });
  }, []);

  const cards = [
    {
      label: t('dashboard.totalAppointments'),
      value: stats.totalAppointments,
      icon: Calendar,
    },
    {
      label: t('dashboard.todayAppointments'),
      value: stats.todayAppointments,
      icon: Scissors,
    },
    {
      label: t('dashboard.activeBarbers'),
      value: stats.activeBarbers,
      icon: Users,
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <SidebarLayout
        title={t('dashboard.title')}
        description={t('dashboard.description')}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="rounded-xl border border-amber-500/20 bg-zinc-900 p-5"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="h-5 w-5 text-amber-400" />
                      <span className="text-sm text-zinc-400">{card.label}</span>
                    </div>
                    <p className="text-3xl font-bold text-amber-400">
                      {card.value}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-zinc-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <h3 className="font-semibold text-amber-300">
                  {t('dashboard.upcoming')}
                </h3>
              </div>
              {stats.upcoming.length === 0 ? (
                <p className="p-5 text-zinc-500 text-sm">
                  {t('appointments.noAppointments')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="text-start px-5 py-3 font-medium">
                          {t('appointments.customer')}
                        </th>
                        <th className="text-start px-5 py-3 font-medium">
                          {t('appointments.barber')}
                        </th>
                        <th className="text-start px-5 py-3 font-medium">
                          {t('appointments.date')}
                        </th>
                        <th className="text-start px-5 py-3 font-medium">
                          {t('appointments.time')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.upcoming.map((appt) => (
                        <tr
                          key={appt._id}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                        >
                          <td className="px-5 py-3">{appt.customerName}</td>
                          <td className="px-5 py-3">{appt.barberName}</td>
                          <td className="px-5 py-3">{appt.date}</td>
                          <td className="px-5 py-3">{appt.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </SidebarLayout>
    </ProtectedRoute>
  );
}
