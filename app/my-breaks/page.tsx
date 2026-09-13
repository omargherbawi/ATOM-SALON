'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import ProtectedRoute from '../protected-route';
import SidebarLayout from '../components/sidebar-layout';
import BreaksEditor from '../components/BreaksEditor';
import { useTranslations } from '../hooks/useTranslations';
import { normalizeBreaks, type BarberBreak } from '@/lib/working-hours';

export default function MyBreaksPage() {
  const { t } = useTranslations();
  const [breaks, setBreaks] = useState<BarberBreak[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/barbers/me/breaks')
      .then((res) => res.json())
      .then((data) => {
        setEnabled(Boolean(data.enabled));
        setBreaks(normalizeBreaks(data.breaks) ?? []);
      })
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validBreaks = normalizeBreaks(breaks);
    if (!validBreaks) {
      toast.error(t('breaks.invalid'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/barbers/me/breaks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breaks: validBreaks }),
      });

      if (res.status === 403) {
        setEnabled(false);
        toast.error(t('myBreaks.disabled'));
        return;
      }
      if (!res.ok) {
        toast.error(t('myBreaks.saveError'));
        return;
      }

      const data = await res.json();
      setBreaks(normalizeBreaks(data.breaks) ?? validBreaks);
      toast.success(t('myBreaks.saved'));
    } catch {
      toast.error(t('myBreaks.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['barber']}>
      <SidebarLayout
        title={t('myBreaks.title')}
        description={t('myBreaks.description')}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400" />
          </div>
        ) : !enabled ? (
          <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-8 text-center text-zinc-400">
            {t('myBreaks.disabled')}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="max-w-3xl space-y-6 rounded-xl border border-amber-500/20 bg-zinc-900 p-6"
          >
            <BreaksEditor
              value={breaks}
              onChange={setBreaks}
              hint={t('myBreaks.hint')}
            />

            <div className="flex justify-end border-t border-zinc-800 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? t('myBreaks.saving') : t('myBreaks.save')}
              </button>
            </div>
          </form>
        )}
      </SidebarLayout>
    </ProtectedRoute>
  );
}
