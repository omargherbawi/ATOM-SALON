'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBarbers = () => {
    fetch('/api/barbers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setBarbers(data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBarbers();
  }, []);

  const handleDelete = async (barber: Barber) => {
    if (!window.confirm(t('barbers.confirmDelete'))) return;

    setDeletingId(barber._id);
    try {
      const res = await fetch(`/api/barbers/${barber._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed');
        return;
      }
      toast.success(t('barbers.deleted'));
      setBarbers((current) => current.filter((item) => item._id !== barber._id));
    } catch {
      toast.error('Something went wrong');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <SidebarLayout
        title={t('barbers.title')}
        description={t('barbers.description')}
      >
        <div className="flex justify-end mb-4">
          <Link
            href="/barbers/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
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
                    <th className="text-start px-4 py-3 font-medium">
                      {t('common.actions')}
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/barbers/${barber._id}/edit`}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-700 text-amber-300 hover:bg-zinc-800"
                            aria-label={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(barber)}
                            disabled={deletingId === barber._id}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-700 text-red-400 hover:bg-zinc-800 disabled:opacity-50"
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
