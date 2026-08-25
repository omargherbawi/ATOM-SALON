'use client';

import { useTranslations } from '../hooks/useTranslations';
import {
  WEEKDAY_KEYS,
  type WorkingHour,
  defaultWorkingHours,
} from '@/lib/working-hours';

const inputClass =
  'rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-40';

export default function WorkingHoursEditor({
  value,
  onChange,
}: {
  value: WorkingHour[];
  onChange: (hours: WorkingHour[]) => void;
}) {
  const { t } = useTranslations();
  const hours = value.length === 7 ? value : defaultWorkingHours();

  const updateDay = (day: number, patch: Partial<WorkingHour>) => {
    onChange(
      hours.map((row) => (row.day === day ? { ...row, ...patch } : row))
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-zinc-300">
          {t('workingHours.title')}
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          {t('workingHours.hint')}
        </p>
      </div>

      <div className="space-y-2">
        {hours.map((row) => (
          <div
            key={row.day}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
          >
            <label className="flex items-center gap-2 min-w-[9.5rem]">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) =>
                  updateDay(row.day, { enabled: e.target.checked })
                }
                className="h-4 w-4 accent-amber-500"
              />
              <span className="text-sm text-zinc-200">
                {t(`workingHours.days.${WEEKDAY_KEYS[row.day]}`)}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-zinc-500">
                {t('workingHours.from')}
              </label>
              <input
                type="time"
                step={1800}
                value={row.start}
                disabled={!row.enabled}
                onChange={(e) =>
                  updateDay(row.day, { start: e.target.value.slice(0, 5) })
                }
                className={inputClass}
              />
              <label className="text-xs text-zinc-500">
                {t('workingHours.to')}
              </label>
              <input
                type="time"
                step={1800}
                value={row.end}
                disabled={!row.enabled}
                onChange={(e) =>
                  updateDay(row.day, { end: e.target.value.slice(0, 5) })
                }
                className={inputClass}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
