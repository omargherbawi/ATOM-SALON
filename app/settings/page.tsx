'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock, Coffee, CreditCard, Loader2, Save, Sparkles, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import ProtectedRoute from '../protected-route';
import SidebarLayout from '../components/sidebar-layout';
import { useTranslations } from '../hooks/useTranslations';
import { useSettings } from '../contexts/SettingsContext';
import { generateTimeSlots, formatSlotLabel } from '@/lib/working-hours';

const PRESET_DURATIONS = [15, 20, 30, 45, 60, 90];

export default function SettingsPage() {
  const { t, language } = useTranslations();
  const { settings, hydrateSettings, refreshSettings } = useSettings();

  const [form, setForm] = useState({
    systemTitle: settings.systemTitle || '',
    tagline: settings.tagline || '',
    slotDuration: settings.slotDuration || 30,
    payToConfirm: settings.payToConfirm || false,
    requireTransferNumber: settings.requireTransferNumber ?? true,
    paymentAmount: settings.paymentAmount || '1',
    paymentCurrency: settings.paymentCurrency || 'JOD',
    cliqNumber: settings.cliqNumber || '00962797598857',
    cliqBank: settings.cliqBank || 'Arab Banks',
    allowBarberBreaks: settings.allowBarberBreaks ?? false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setForm({
            systemTitle: data.systemTitle || 'Atom Salon',
            tagline: data.tagline || '',
            slotDuration: data.slotDuration || 30,
            payToConfirm: data.payToConfirm ?? false,
            requireTransferNumber: data.requireTransferNumber ?? true,
            paymentAmount: data.paymentAmount || '1',
            paymentCurrency: data.paymentCurrency || 'JOD',
            cliqNumber: data.cliqNumber || '00962797598857',
            cliqBank: data.cliqBank || 'Arab Banks',
            allowBarberBreaks: data.allowBarberBreaks ?? false,
          });
        }
      })
      .catch(() => {
        setForm({
          systemTitle: settings.systemTitle || 'Atom Salon',
          tagline: settings.tagline || '',
          slotDuration: settings.slotDuration || 30,
          payToConfirm: settings.payToConfirm ?? false,
          requireTransferNumber: settings.requireTransferNumber ?? true,
          paymentAmount: settings.paymentAmount || '1',
          paymentCurrency: settings.paymentCurrency || 'JOD',
          cliqNumber: settings.cliqNumber || '00962797598857',
          cliqBank: settings.cliqBank || 'Arab Banks',
          allowBarberBreaks: settings.allowBarberBreaks ?? false,
        });
      })
      .finally(() => setLoading(false));
  }, [settings]);

  // Live preview slots calculated for standard sample working hours (09:00 to 18:00)
  const previewSlots = useMemo(() => {
    const duration = Math.max(5, Math.min(240, Number(form.slotDuration) || 30));
    const rawSlots = generateTimeSlots('09:00', '18:00', duration);
    return rawSlots.slice(0, 8); // show first 8 for clean preview
  }, [form.slotDuration]);

  const handlePresetClick = (mins: number) => {
    setForm((prev) => ({ ...prev, slotDuration: mins }));
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setForm((prev) => ({
      ...prev,
      slotDuration: isNaN(val) ? 0 : val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.systemTitle.trim()) {
      toast.error('System title is required');
      return;
    }

    const duration = Number(form.slotDuration);
    if (!duration || duration < 5 || duration > 240) {
      toast.error('Slot duration must be between 5 and 240 minutes');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemTitle: form.systemTitle.trim(),
          tagline: form.tagline.trim(),
          slotDuration: duration,
          payToConfirm: form.payToConfirm,
          requireTransferNumber: form.requireTransferNumber,
          paymentAmount: form.paymentAmount.trim() || '1',
          paymentCurrency: form.paymentCurrency.trim() || 'JOD',
          cliqNumber: form.cliqNumber.trim() || '00962797598857',
          cliqBank: form.cliqBank.trim() || 'Arab Banks',
          allowBarberBreaks: form.allowBarberBreaks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('settings.saveError'));
        return;
      }

      toast.success(t('settings.saved'));
      hydrateSettings({
        systemTitle: form.systemTitle.trim(),
        tagline: form.tagline.trim(),
        slotDuration: duration,
        payToConfirm: form.payToConfirm,
        requireTransferNumber: form.requireTransferNumber,
        paymentAmount: form.paymentAmount.trim() || '1',
        paymentCurrency: form.paymentCurrency.trim() || 'JOD',
        cliqNumber: form.cliqNumber.trim() || '00962797598857',
        cliqBank: form.cliqBank.trim() || 'Arab Banks',
        allowBarberBreaks: form.allowBarberBreaks,
      });
      await refreshSettings();
    } catch {
      toast.error(t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors';

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <SidebarLayout
        title={t('settings.title')}
        description={t('settings.description')}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
            {/* General Salon Details */}
            <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-semibold border-b border-zinc-800 pb-3">
                <Store className="h-5 w-5" />
                <h3>{t('settings.general')}</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    {t('settings.systemTitle')}
                  </label>
                  <input
                    type="text"
                    value={form.systemTitle}
                    onChange={(e) =>
                      setForm({ ...form, systemTitle: e.target.value })
                    }
                    placeholder={t('settings.systemTitlePlaceholder')}
                    className={fieldClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    {t('settings.tagline')}
                  </label>
                  <input
                    type="text"
                    value={form.tagline}
                    onChange={(e) =>
                      setForm({ ...form, tagline: e.target.value })
                    }
                    placeholder={t('settings.taglinePlaceholder')}
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>

            {/* Slot Duration Configuration */}
            <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-6 space-y-6">
              <div className="flex items-center gap-2 text-amber-400 font-semibold border-b border-zinc-800 pb-3">
                <Clock className="h-5 w-5" />
                <h3>{t('settings.bookingSettings')}</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-200 mb-1">
                  {t('settings.slotDuration')}
                </label>
                <p className="text-xs text-zinc-400 mb-4">
                  {t('settings.slotDurationHint')}
                </p>

                {/* Duration Presets */}
                <div className="flex flex-wrap gap-2.5 mb-4">
                  {PRESET_DURATIONS.map((mins) => {
                    const isSelected = form.slotDuration === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => handlePresetClick(mins)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-10 ${
                          isSelected
                            ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 scale-105'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-amber-300 border border-zinc-700'
                        }`}
                      >
                        {mins} {t('settings.minutes')}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Minutes Input */}
                <div className="max-w-xs">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {t('settings.customDuration')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      max="240"
                      step="5"
                      value={form.slotDuration || ''}
                      onChange={handleCustomChange}
                      className={fieldClass}
                    />
                    <span className="absolute end-3 top-2.5 text-xs text-zinc-500 pointer-events-none">
                      {t('settings.minutes')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Live Preview */}
              <div className="rounded-lg border border-amber-500/15 bg-zinc-950/60 p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  <span>{t('settings.previewTitle')}</span>
                  <span className="text-xs text-zinc-400 font-normal">
                    ({form.slotDuration || 30} {t('settings.minutes')})
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  {t('settings.previewHint')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                  {previewSlots.map((slot) => (
                    <div
                      key={slot}
                      className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-200 whitespace-nowrap flex items-center justify-center"
                    >
                      {formatSlotLabel(slot, Number(form.slotDuration) || 30, language)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Barber Permissions */}
            <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-6 space-y-6">
              <div className="flex items-center gap-2 text-amber-400 font-semibold border-b border-zinc-800 pb-3">
                <Coffee className="h-5 w-5" />
                <h3>{t('settings.barberSettings')}</h3>
              </div>

              <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <div className="space-y-1">
                  <label
                    htmlFor="allowBarberBreaks"
                    className="text-sm font-medium text-zinc-200 block"
                  >
                    {t('settings.allowBarberBreaks')}
                  </label>
                  <p className="text-xs text-zinc-400">
                    {t('settings.allowBarberBreaksHint')}
                  </p>
                </div>
                <label className="relative inline-flex shrink-0 items-center cursor-pointer">
                  <input
                    id="allowBarberBreaks"
                    type="checkbox"
                    checked={form.allowBarberBreaks}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        allowBarberBreaks: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>

            {/* Pay to Confirm (CliQ) Configuration */}
            <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-6 space-y-6">
              <div className="flex items-center gap-2 text-amber-400 font-semibold border-b border-zinc-800 pb-3">
                <CreditCard className="h-5 w-5" />
                <h3>{t('settings.paymentSettings')}</h3>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-200 block">
                    {t('settings.payToConfirm')}
                  </label>
                  <p className="text-xs text-zinc-400">
                    {t('settings.payToConfirmHint')}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.payToConfirm}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, payToConfirm: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {form.payToConfirm && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-zinc-200 block">
                        {t('settings.requireTransferNumber')}
                      </label>
                      <p className="text-xs text-zinc-400">
                        {t('settings.requireTransferNumberHint')}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.requireTransferNumber}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            requireTransferNumber: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      {t('settings.paymentAmount')}
                    </label>
                    <input
                      type="text"
                      value={form.paymentAmount}
                      onChange={(e) =>
                        setForm({ ...form, paymentAmount: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      {t('settings.paymentCurrency')}
                    </label>
                    <input
                      type="text"
                      value={form.paymentCurrency}
                      onChange={(e) =>
                        setForm({ ...form, paymentCurrency: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      {t('settings.cliqNumber')}
                    </label>
                    <input
                      type="text"
                      value={form.cliqNumber}
                      onChange={(e) =>
                        setForm({ ...form, cliqNumber: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      {t('settings.cliqBank')}
                    </label>
                    <input
                      type="text"
                      value={form.cliqBank}
                      onChange={(e) =>
                        setForm({ ...form, cliqBank: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors shadow-lg shadow-amber-500/15 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? t('settings.saving') : t('settings.save')}
              </button>
            </div>
          </form>
        )}
      </SidebarLayout>
    </ProtectedRoute>
  );
}
