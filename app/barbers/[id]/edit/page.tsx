'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ProtectedRoute from '../../../protected-route';
import SidebarLayout from '../../../components/sidebar-layout';
import WorkingHoursEditor from '../../../components/WorkingHoursEditor';
import BreaksEditor from '../../../components/BreaksEditor';
import { useTranslations } from '../../../hooks/useTranslations';
import {
  defaultWorkingHours,
  normalizeBreaks,
  resolveWorkingHours,
  type BarberBreak,
  type WorkingHour,
} from '@/lib/working-hours';

const fieldClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50';

export default function EditBarberPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    active: true,
    cliqNumber: '',
    cliqBank: '',
  });
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>(
    defaultWorkingHours()
  );
  const [breaks, setBreaks] = useState<BarberBreak[]>([]);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/barbers/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error);
          router.push('/barbers');
          return;
        }
        setForm({
          name: data.name || '',
          email: data.email || '',
          password: '',
          active: data.active !== false,
          cliqNumber: data.cliqNumber || '',
          cliqBank: data.cliqBank || '',
        });
        setWorkingHours(resolveWorkingHours(data.workingHours));
        setBreaks(normalizeBreaks(data.breaks) ?? []);
      })
      .catch(() => {
        toast.error('Failed to load barber');
        router.push('/barbers');
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validBreaks = normalizeBreaks(breaks);
    if (!validBreaks) {
      toast.error(t('breaks.invalid'));
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        active: form.active,
        cliqNumber: form.cliqNumber.trim(),
        cliqBank: form.cliqBank.trim(),
        workingHours,
        breaks: validBreaks,
      };
      if (form.password.trim()) {
        payload.password = form.password;
      }

      const res = await fetch(`/api/barbers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed');
        return;
      }

      toast.success(t('barbers.updated'));
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
        title={t('barbers.editTitle')}
        description={t('barbers.editDescription')}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400" />
          </div>
        ) : (
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
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                minLength={6}
                className={fieldClass}
              />
              <p className="text-xs text-zinc-500 mt-1">
                {t('barbers.passwordHint')}
              </p>
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

            <WorkingHoursEditor
              value={workingHours}
              onChange={setWorkingHours}
            />

            <BreaksEditor value={breaks} onChange={setBreaks} />

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {t('common.save')}
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
        )}
      </SidebarLayout>
    </ProtectedRoute>
  );
}
