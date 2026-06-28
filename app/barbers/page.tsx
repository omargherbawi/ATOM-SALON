'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import ProtectedRoute from '../protected-route';
import SidebarLayout from '../components/sidebar-layout';
import { useTranslations } from '../hooks/useTranslations';

interface Barber {
  _id: string;
  name: string;
  email: string;
  active: boolean;
}

export default function BarbersPage() {
  const { t } = useTranslations();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/barbers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setBarbers(data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <SidebarLayout
        title={t('barbers.title')}
        description={t('barbers.description')}
      >
        <div className="flex justify-end mb-4">
          <Link
            href="/barbers/new"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('barbers.addBarber')}
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400" />
          </div>
        ) : barbers.length === 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-8 text-center text-zinc-400">
            {t('barbers.noBarbers')}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="text-start px-4 py-3 font-medium">
                      {t('barbers.name')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('barbers.email')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium">
                      {t('common.status')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {barbers.map((barber) => (
                    <tr
                      key={barber._id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-3">{barber.name}</td>
                      <td className="px-4 py-3">{barber.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            barber.active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {barber.active
                            ? t('common.active')
                            : t('common.inactive')}
                        </span>
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
