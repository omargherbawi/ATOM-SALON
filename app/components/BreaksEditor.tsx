'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from '../hooks/useTranslations';
import { localDateString, type BarberBreak } from '@/lib/working-hours';

const inputClass =
  'rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50';

export default function BreaksEditor({
  value,
  onChange,
  hint,
}: {
  value: BarberBreak[];
  onChange: (breaks: BarberBreak[]) => void;
  hint?: string;
}) {
  const { t } = useTranslations();
  const today = localDateString();

  const updateBreak = (index: number, patch: Partial<BarberBreak>) => {
    onChange(
      value.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  const addBreak = () => {
    onChange([...value, { date: today, start: '13:00', end: '14:00' }]);
  };

  const removeBreak = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-zinc-300">{t('breaks.title')}</p>
        <p className="text-xs text-zinc-500 mt-1">{hint ?? t('breaks.hint')}</p>
      </div>

      <div className="space-y-2">
        {value.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-800 p-3 text-sm text-zinc-500">
            {t('breaks.empty')}
          </p>
        )}

        {value.map((item, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
          >
            <label className="text-xs text-zinc-500">{t('breaks.date')}</label>
            <input
              type="date"
              value={item.date}
              onChange={(e) => updateBreak(index, { date: e.target.value })}
              required
              className={inputClass}
            />
            <label className="text-xs text-zinc-500">{t('breaks.from')}</label>
            <input
              type="time"
              step={1800}
              value={item.start}
              onChange={(e) =>
                updateBreak(index, { start: e.target.value.slice(0, 5) })
              }
              required
              className={inputClass}
            />
            <label className="text-xs text-zinc-500">{t('breaks.to')}</label>
            <input
              type="time"
              step={1800}
              value={item.end}
              onChange={(e) =>
                updateBreak(index, { end: e.target.value.slice(0, 5) })
              }
              required
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeBreak(index)}
              aria-label={t('breaks.remove')}
              title={t('breaks.remove')}
              className="ms-auto rounded-lg p-2 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addBreak}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-400 hover:bg-amber-500/10"
      >
        <Plus className="h-4 w-4" />
        {t('breaks.add')}
      </button>
    </div>
  );
}
