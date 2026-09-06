'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FIELD =
  'rounded-lg border border-line bg-white px-2.75 py-2 text-[12.5px] text-ink outline-none focus:border-brand-500';
const LABEL = 'text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted';

/* Prices change by cloning: the old schedule stays untouched for the cycles it
   already priced, and the copy is what gets edited. */
export default function NewSchedule({ schedules, copyFrom }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    effective_from: '',
    note: '',
    copy_from: copyFrom ? String(copyFrom) : '',
  });

  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/tariff-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          copy_from: form.copy_from ? Number(form.copy_from) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create the schedule');
        return;
      }
      setOpen(false);
      router.push(`/dashboard/tariffs?schedule=${data.data.schedule.id}`);
      router.refresh();
    } catch {
      setError('Could not create the schedule');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setForm({
            name: '',
            effective_from: '',
            note: '',
            copy_from: copyFrom ? String(copyFrom) : '',
          });
          setError('');
          setOpen(true);
        }}
        className="rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#0A5453]"
      >
        + New schedule
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/40 px-3 py-6 sm:px-4 sm:py-16">
      <form onSubmit={handleSubmit} className="w-full max-w-110 rounded-[14px] border border-line bg-white p-5.5">
        <div className="text-[15px] font-semibold">New tariff schedule</div>
        <div className="mt-1 text-[12px] text-muted">
          Copy an existing schedule to change a price, or start from scratch.
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className={LABEL}>Name</label>
            <input
              required
              value={form.name}
              onChange={set('name')}
              placeholder="Board approved Jan 2027"
              className={FIELD}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Copy prices from</label>
            <select value={form.copy_from} onChange={set('copy_from')} className={FIELD}>
              <option value="">Start empty (all rates at zero)</option>
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Effective from</label>
            <input
              type="date"
              value={form.effective_from}
              onChange={set('effective_from')}
              className={FIELD}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Note</label>
            <input value={form.note} onChange={set('note')} className={FIELD} />
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-[12px] text-bad-fg">{error}</p>
        ) : null}

        <div className="mt-4 flex gap-2.5 border-t border-line-soft pt-3.5">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-[12.5px] font-medium text-white hover:bg-[#0A5453] disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create schedule'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-line bg-[#F1F5F4] px-4 py-2.5 text-[12.5px] font-medium text-[#26413F] hover:bg-[#E7EDEC]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
