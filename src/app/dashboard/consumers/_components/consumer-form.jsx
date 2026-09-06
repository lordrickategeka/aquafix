'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/billing';
import { ugx } from '@/lib/format';

const FIELD =
  'rounded-lg border border-line bg-white px-2.75 py-2 text-[12.5px] text-ink outline-none transition-colors focus:border-brand-500';
const LABEL = 'text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted';

const STATUSES = [
  ['new', 'New'],
  ['active', 'Active'],
  ['disconnected', 'Disconnected'],
  ['closed', 'Closed'],
];

function formFor(consumer, zones) {
  return {
    name: consumer?.name || '',
    phone: consumer?.phone || '',
    address: consumer?.address || '',
    zone_id: consumer?.zone_id || zones[0]?.id || '',
    category: consumer?.category || 'domestic',
    is_metered: consumer ? consumer.is_metered : true,
    meter_no: consumer?.meter_no || '',
    status: consumer?.status || 'new',
    connected_at: consumer?.connected_at ? String(consumer.connected_at).slice(0, 10) : '',
    opening_reading: consumer?.opening_reading ?? 0,
  };
}

export default function ConsumerForm({ zones, consumer = null, flatRates = {} }) {
  const router = useRouter();
  const editing = Boolean(consumer);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState(() => formFor(consumer, zones));

  // This component stays mounted while the selected row changes, so the state
  // has to be rebuilt from the current props every time the dialog opens —
  // otherwise it shows whichever consumer happened to be selected first.
  function openForm() {
    setForm(formFor(consumer, zones));
    setError('');
    setFieldErrors({});
    setOpen(true);
  }

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});

    try {
      const res = await fetch(editing ? `/api/consumers/${consumer.id}` : '/api/consumers', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, zone_id: Number(form.zone_id) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setFieldErrors(data.errors || {});
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return editing ? (
      <button
        onClick={openForm}
        className="ml-auto flex-none rounded-lg border border-line bg-[#F1F5F4] px-2.5 py-1.5 text-[11.5px] font-medium text-[#26413F] hover:bg-[#E7EDEC]"
      >
        Edit
      </button>
    ) : (
      <button
        onClick={openForm}
        className="rounded-lg bg-brand-600 px-3.5 py-1.75 text-[12px] font-medium text-white hover:bg-[#0A5453]"
      >
        + New consumer
      </button>
    );
  }

  const meterDisabled = form.category === 'kiosk' || !form.is_metered;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/40 px-3 py-6 sm:px-4 sm:py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-125 rounded-[14px] border border-line bg-white p-5.5"
      >
        <div className="text-[15px] font-semibold">
          {editing ? `Edit ${consumer.name}` : 'New consumer'}
        </div>
        <div className="mt-1 text-[12px] text-muted">
          {editing
            ? 'Changes apply from the next billing run.'
            : 'The account number is assigned automatically.'}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className={LABEL}>Name</label>
            <input required value={form.name} onChange={set('name')} className={FIELD} />
            {fieldErrors.name ? (
              <span className="text-[11px] text-bad-fg">{fieldErrors.name}</span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Zone</label>
            <select
              value={form.zone_id}
              onChange={set('zone_id')}
              disabled={zones.length === 0}
              className={`${FIELD} disabled:bg-[#F1F5F4]`}
            >
              {zones.length === 0 ? <option value="">No zones yet</option> : null}
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
            {zones.length === 0 ? (
              <span className="text-[11px] text-bad-fg">
                Add a zone first — every consumer belongs to one.
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Category</label>
            <select value={form.category} onChange={set('category')} className={FIELD}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className={LABEL}>Address</label>
            <input
              value={form.address}
              onChange={set('address')}
              placeholder="Plot 14, Rwenjura Road"
              className={FIELD}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Phone</label>
            <input
              value={form.phone}
              onChange={set('phone')}
              placeholder="07…"
              className={FIELD}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Connected on</label>
            <input
              type="date"
              value={form.connected_at ? String(form.connected_at).slice(0, 10) : ''}
              onChange={set('connected_at')}
              className={FIELD}
            />
          </div>

          <div className="sm:col-span-2 rounded-lg border border-line-soft bg-[#F7FAF9] px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <input
                id="is_metered"
                type="checkbox"
                checked={form.category === 'kiosk' ? false : form.is_metered}
                disabled={form.category === 'kiosk'}
                onChange={set('is_metered')}
                className="h-3.5 w-3.5 accent-brand-600"
              />
              <label htmlFor="is_metered" className="text-[12px] font-medium">
                This connection has a meter
              </label>
            </div>
            <div className="mt-1.5 pl-6 text-[11.5px] leading-relaxed text-muted">
              {form.category === 'kiosk' ? (
                <>
                  Kiosks and standpipes are never metered — this account is charged{' '}
                  <span className="font-mono text-muted-deep">
                    UGX {ugx(flatRates.kiosk ?? 0)}
                  </span>{' '}
                  every month.
                </>
              ) : form.is_metered ? (
                <>
                  Billed on meter readings: each cycle&apos;s usage is charged through the tariff
                  bands, plus the monthly service charge.
                </>
              ) : (
                <>
                  No meter, so nothing to read — billed a fixed{' '}
                  <span className="font-mono text-muted-deep">
                    UGX {ugx(flatRates[form.category] ?? 0)}
                  </span>{' '}
                  every month at the {CATEGORY_LABELS[form.category].toLowerCase()} flat rate.
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Meter number</label>
            <input
              value={meterDisabled ? '' : form.meter_no}
              onChange={set('meter_no')}
              disabled={meterDisabled}
              placeholder={meterDisabled ? 'Not metered' : 'M-31402'}
              className={`${FIELD} disabled:cursor-not-allowed disabled:bg-[#F1F5F4] disabled:text-muted`}
            />
            {fieldErrors.meter_no ? (
              <span className="text-[11px] text-bad-fg">{fieldErrors.meter_no}</span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Opening meter reading</label>
            <input
              inputMode="numeric"
              value={meterDisabled ? '' : form.opening_reading}
              onChange={set('opening_reading')}
              disabled={meterDisabled}
              placeholder={meterDisabled ? 'Not metered' : '0'}
              className={`${FIELD} font-mono disabled:cursor-not-allowed disabled:bg-[#F1F5F4] disabled:text-muted`}
            />
            <span className="text-[11px] text-muted">
              {meterDisabled
                ? 'No meter to read'
                : 'What the dial shows today. The first bill charges only what is used after this.'}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL}>Status</label>
            <select value={form.status} onChange={set('status')} className={FIELD}>
              {STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-[12px] text-bad-fg">{error}</p>
        ) : null}

        <div className="mt-4 flex gap-2.5 border-t border-line-soft pt-3.5">
          <button
            type="submit"
            disabled={saving || zones.length === 0}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-[12.5px] font-medium text-white hover:bg-[#0A5453] disabled:opacity-50"
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create consumer'}
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
