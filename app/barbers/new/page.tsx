'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ProtectedRoute from '../../protected-route';
import SidebarLayout from '../../components/sidebar-layout';
import WorkingHoursEditor from '../../components/WorkingHoursEditor';
import { useTranslations } from '../../hooks/useTranslations';
import { defaultWorkingHours, type WorkingHour } from '@/lib/working-hours';

const fieldClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50';

export default function NewBarberPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    cliqNumber: '',
    cliqBank: '',
  });
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>(
    defaultWorkingHours()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/barbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, workingHours }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed');
        return;
      }

      toast.success(t('barbers.created'));
      router.push('/barbers');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <SidebarLayout
        title={t('barbers.newTitle')}
        description={t('barbers.newDescription')}
      >
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl rounded-xl border border-amber-500/20 bg-zinc-900 p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {t('barbers.name')}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {t('barbers.email')}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {t('barbers.password')}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              className={fieldClass}
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-zinc-300">
                {t('barbers.paymentDetails')}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {t('barbers.paymentDetailsHint')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  {t('barbers.cliqNumber')}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.cliqNumber}
                  onChange={(e) =>
                    setForm({ ...form, cliqNumber: e.target.value })
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  {t('barbers.cliqBank')}
                </label>
                <input
                  type="text"
                  value={form.cliqBank}
                  onChange={(e) => setForm({ ...form, cliqBank: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>
          </div>

          <WorkingHoursEditor value={workingHours} onChange={setWorkingHours} />

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
            >
              {t('barbers.create')}
            </button>
            <button
              type="button"
              onClick={() => router.push('/barbers')}
              className="min-h-11 rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
