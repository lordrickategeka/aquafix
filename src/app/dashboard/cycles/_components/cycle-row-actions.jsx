'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FIELD =
  'rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-brand-500';
const BTN = 'rounded-md px-2.5 py-1.25 text-[11.5px] font-medium';

/* Per-cycle settings and lifecycle. Settings stay editable while a cycle is
   open or locked; once it is billed the dates are part of the record. */
export default function CycleRowActions({ cycle, schedules = [] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmLock, setConfirmLock] = useState(false);
  const [form, setForm] = useState({
    reading_start: cycle.reading_start || '',
    reading_end: cycle.reading_end || '',
    due_date: cycle.due_date || '',
    note: cycle.note || '',
    // '' means "fall back to the tariff"; 0 is a real override.
    unit_cost: cycle.unit_cost ?? '',
    fixed_charge: cycle.fixed_charge ?? '',
    levy_pct: cycle.levy_pct ?? '',
    tariff_schedule_id: cycle.tariff_schedule_id ?? '',
  });

  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  async function call(body) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/cycles/${cycle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'That did not work');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('That did not work');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const editable = ['open', 'locked'].includes(cycle.status);

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="date" value={form.reading_start} onChange={set('reading_start')} className={FIELD} />
          <span className="text-[11px] text-muted">–</span>
          <input type="date" value={form.reading_end} onChange={set('reading_end')} className={FIELD} />
          <span className="text-[11px] text-muted">due</span>
          <input type="date" value={form.due_date} onChange={set('due_date')} className={FIELD} />
        </div>
        <input
          value={form.note}
          onChange={set('note')}
          placeholder="Note"
          className={`${FIELD} w-full`}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted">Tariff</span>
          <select
            value={form.tariff_schedule_id}
            onChange={set('tariff_schedule_id')}
            className={`${FIELD} w-44`}
          >
            <option value="">No schedule</option>
            {schedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted">Unit cost/m³</span>
          <input
            inputMode="numeric"
            value={form.unit_cost}
            onChange={set('unit_cost')}
            placeholder="tariff"
            className={`${FIELD} w-20 font-mono`}
          />
          <span className="text-[11px] text-muted">Service</span>
          <input
            inputMode="numeric"
            value={form.fixed_charge}
            onChange={set('fixed_charge')}
            placeholder="tariff"
            className={`${FIELD} w-20 font-mono`}
          />
          <span className="text-[11px] text-muted">Tax %</span>
          <input
            inputMode="decimal"
            value={form.levy_pct}
            onChange={set('levy_pct')}
            placeholder="tariff"
            className={`${FIELD} w-16 font-mono`}
          />
        </div>
        {form.unit_cost !== '' ? (
          <div className="text-[11px] text-warn-fg">
            Bands ignored — every metered account pays {form.unit_cost || 0} per m³ this cycle.
          </div>
        ) : null}

        {error ? <div className="text-[11px] text-bad-fg">{error}</div> : null}
        <div className="flex gap-1.5">
          <button
            onClick={async () => {
              if (await call(form)) setEditing(false);
            }}
            disabled={busy}
            className={`${BTN} bg-brand-600 text-white disabled:opacity-50`}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setError('');
            }}
            className={`${BTN} border border-line bg-white text-muted-deep`}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {editable ? (
        <button onClick={() => setEditing(true)} className={`${BTN} border border-line bg-white text-muted-deep hover:bg-[#F1F5F4]`}>
          Settings
        </button>
      ) : null}

      {cycle.status === 'open' ? (
        confirmLock ? (
          <span className="flex items-center gap-1.5">
            <button
              onClick={async () => {
                if (await call({ status: 'locked', force: true })) setConfirmLock(false);
              }}
              disabled={busy}
              className={`${BTN} bg-warn-fg text-white disabled:opacity-50`}
            >
              Lock anyway
            </button>
            <button
              onClick={() => setConfirmLock(false)}
              className={`${BTN} border border-line bg-white text-muted-deep`}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={async () => {
              if (cycle.pending > 0) {
                setConfirmLock(true);
                return;
              }
              await call({ status: 'locked' });
            }}
            disabled={busy}
            className={`${BTN} bg-brand-600 text-white disabled:opacity-50`}
          >
            Lock
          </button>
        )
      ) : null}

      {cycle.status === 'locked' ? (
        <button
          onClick={() => call({ status: 'open' })}
          disabled={busy}
          className={`${BTN} border border-line bg-white text-muted-deep hover:bg-[#F1F5F4]`}
        >
          Reopen
        </button>
      ) : null}

      {cycle.status === 'billed' ? (
        <button
          onClick={() => call({ status: 'closed' })}
          disabled={busy}
          className={`${BTN} border border-line bg-white text-muted-deep hover:bg-[#F1F5F4]`}
        >
          Close
        </button>
      ) : null}

      {confirmLock && cycle.pending > 0 ? (
        <span className="text-[11px] text-warn-fg">
          {cycle.pending} reading{cycle.pending === 1 ? '' : 's'} unresolved — they will not be
          billed
        </span>
      ) : null}

      {cycle.note && !confirmLock ? (
        <span className="truncate text-[11px] text-muted">{cycle.note}</span>
      ) : null}

      {error ? <span className="text-[11px] text-bad-fg">{error}</span> : null}
    </div>
  );
}
