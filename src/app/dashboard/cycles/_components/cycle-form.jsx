'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FIELD =
  'rounded-lg border border-line bg-white px-2.75 py-2 text-[12.5px] text-ink outline-none focus:border-brand-500';
const LABEL = 'text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted';

/* Opening a cycle is what lets meter readers start capturing, so the dates
   that govern it are set here rather than defaulted silently. */
export default function CycleForm({ suggested, blockedBy, schedules = [], previousPeriod }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState(() => defaults(suggested));

  function defaults(period) {
    const [year, month] = period.split('-');
    const last = new Date(Number(year), Number(month), 0).getDate();
    return {
      period,
      reading_start: `${year}-${month}-01`,
      reading_end: `${year}-${month}-05`,
      due_date: `${year}-${month}-20`,
      note: '',
      // Blank means "use the tariff" — see the pricing block below.
      tariff_schedule_id: '',
      carry_forward: false,
      unit_cost: '',
      fixed_charge: '',
      levy_pct: '',
      lastDay: last,
    };
  }

  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  function openForm() {
    setForm(defaults(suggested));
    setError('');
    setFieldErrors({});
    setOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});

    try {
      const res = await fetch('/api/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Could not create the cycle');
        setFieldErrors(data.errors || {});
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not create the cycle');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="text-right">
        <button
          onClick={openForm}
          disabled={Boolean(blockedBy)}
          title={blockedBy ? `Cycle ${blockedBy} is still open — lock it first` : undefined}
          className="rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#0A5453] disabled:opacity-40"
        >
          + New cycle
        </button>
        {blockedBy ? (
          <div className="mt-1.5 text-[11px] text-muted">
            Lock {blockedBy} before opening another
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/40 px-3 py-6 sm:px-4 sm:py-16">
      <form onSubmit={handleSubmit} className="w-full max-w-120 rounded-[14px] border border-line bg-white p-5.5">
        <div className="text-[15px] font-semibold">New reading cycle</div>
        <div className="mt-1 text-[12px] text-muted">
          Readers capture against this cycle until it is locked.
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={LABEL}>Period</label>
            <input
              required
              value={form.period}
              onChange={set('period')}
              placeholder="2026-11"
              className={`${FIELD} font-mono`}
            />
            {fieldErrors.period ? (
              <span className="text-[11px] text-bad-fg">{fieldErrors.period}</span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Bills due</label>
            <input type="date" value={form.due_date} onChange={set('due_date')} className={FIELD} />
            {fieldErrors.due_date ? (
              <span className="text-[11px] text-bad-fg">{fieldErrors.due_date}</span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Readings from</label>
            <input
              type="date"
              value={form.reading_start}
              onChange={set('reading_start')}
              className={FIELD}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Readings to</label>
            <input
              type="date"
              value={form.reading_end}
              onChange={set('reading_end')}
              className={FIELD}
            />
            {fieldErrors.reading_end ? (
              <span className="text-[11px] text-bad-fg">{fieldErrors.reading_end}</span>
            ) : null}
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className={LABEL}>Tariff schedule</label>
            <select
              value={form.tariff_schedule_id}
              onChange={set('tariff_schedule_id')}
              disabled={form.carry_forward}
              className={`${FIELD} disabled:bg-[#F1F5F4] disabled:text-muted`}
            >
              <option value="">
                {form.carry_forward ? 'Carried from the previous cycle' : 'Choose a schedule…'}
              </option>
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.name}
                </option>
              ))}
            </select>
          </div>

          {previousPeriod ? (
            <label className="sm:col-span-2 flex items-start gap-2.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.carry_forward}
                onChange={(e) => setForm((c) => ({ ...c, carry_forward: e.target.checked }))}
                className="mt-0.5 h-3.5 w-3.5 accent-brand-600"
              />
              <span className="text-[12px]">
                Nothing has changed — carry everything forward from {previousPeriod}
                <span className="mt-0.5 block text-[11px] text-muted">
                  Reuses the same tariff schedule and any unit cost, service charge and tax set on
                  that cycle. The schedule is shared, not copied.
                </span>
              </span>
            </label>
          ) : null}

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className={LABEL}>Note</label>
            <input
              value={form.note}
              onChange={set('note')}
              placeholder="Anything readers or the billing officer should know"
              className={FIELD}
            />
          </div>

          <div className="sm:col-span-2 rounded-lg border border-line-soft bg-[#F7FAF9] p-3">
            <div className="text-[12px] font-medium">Pricing for this cycle</div>
            <div className="mt-1 text-[11.5px] leading-relaxed text-muted">
              Leave blank to price bills from each category&apos;s tariff, as usual. Set a unit cost
              and every m³ in this cycle is charged at that rate instead of the tariff bands.
            </div>

            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className={LABEL}>Unit cost / m³</label>
                <input
                  inputMode="numeric"
                  value={form.unit_cost}
                  onChange={set('unit_cost')}
                  placeholder="tariff"
                  className={`${FIELD} font-mono`}
                />
                {fieldErrors.unit_cost ? (
                  <span className="text-[11px] text-bad-fg">{fieldErrors.unit_cost}</span>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                <label className={LABEL}>Service charge</label>
                <input
                  inputMode="numeric"
                  value={form.fixed_charge}
                  onChange={set('fixed_charge')}
                  placeholder="tariff"
                  className={`${FIELD} font-mono`}
                />
                {fieldErrors.fixed_charge ? (
                  <span className="text-[11px] text-bad-fg">{fieldErrors.fixed_charge}</span>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                <label className={LABEL}>Tax %</label>
                <input
                  inputMode="decimal"
                  value={form.levy_pct}
                  onChange={set('levy_pct')}
                  placeholder="tariff"
                  className={`${FIELD} font-mono`}
                />
                {fieldErrors.levy_pct ? (
                  <span className="text-[11px] text-bad-fg">{fieldErrors.levy_pct}</span>
                ) : null}
              </div>
            </div>

            {form.unit_cost !== '' ? (
              <div className="mt-2 text-[11px] text-warn-fg">
                Tariff bands will be ignored for this cycle — every metered account pays{' '}
                {form.unit_cost || 0} per m³ regardless of category. Unmetered accounts stay on
                their flat rate.
              </div>
            ) : null}
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
            {saving ? 'Opening…' : 'Open cycle'}
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
