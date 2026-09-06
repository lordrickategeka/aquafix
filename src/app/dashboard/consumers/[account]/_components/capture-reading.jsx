'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { flagReading } from '@/lib/billing';
import { ugx, FLAG_PILL, FLAG_LABELS } from '@/lib/format';

const CARD = 'bg-white border border-line rounded-[11px]';
const LABEL = 'text-[11px] uppercase tracking-[.06em] text-muted font-semibold';

/* Capture this cycle's meter reading for one account. Usage and the exception
   flag are computed here with the same rules the server applies on save, so
   what the reader sees before submitting is what gets stored. */
export default function CaptureReading({
  consumer,
  cycle,
  previousValue,
  history = [],
  existing,
  flatRate,
  canCapture,
}) {
  const router = useRouter();
  const [value, setValue] = useState(
    existing?.current_value !== null && existing?.current_value !== undefined
      ? String(existing.current_value)
      : '',
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  if (!consumer.is_metered) {
    return (
      <div className={`${CARD} p-4.5`}>
        <div className="text-[13.5px] font-semibold">Meter reading</div>
        <div className="mt-2 rounded-lg border border-line-soft bg-[#F7FAF9] px-3 py-3 text-[12px] leading-relaxed text-muted-deep">
          This connection has no meter, so there is nothing to read. It is billed a flat{' '}
          <span className="font-mono">UGX {ugx(flatRate)}</span> every cycle.
        </div>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className={`${CARD} p-4.5`}>
        <div className="text-[13.5px] font-semibold">Meter reading</div>
        <div className="mt-2 rounded-lg border border-line-soft bg-[#F7FAF9] px-3 py-3 text-[12px] leading-relaxed text-muted-deep">
          No cycle is open for readings. Open one from the Billing screen first.
        </div>
      </div>
    );
  }

  const current = value === '' ? null : Number(value);
  const { flag, note } = flagReading({ previous: previousValue, current, history });
  const usage = current === null || flag === 'negative' ? null : current - previousValue;
  // The server refuses these; catching it here saves the round trip.
  const belowPrevious = current !== null && current < previousValue;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_id: cycle.id,
          readings: [{ consumer_id: consumer.id, current_value: value }],
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ tone: 'bad', text: data.error || 'Could not save the reading' });
        return;
      }

      const failure = data.data.failures?.[0];
      if (failure) {
        setMessage({ tone: 'bad', text: failure.message });
        return;
      }

      const saved = data.data.saved[0];
      setMessage({
        tone: saved.flag === 'ok' ? 'ok' : 'warn',
        text:
          saved.flag === 'ok'
            ? `Saved — ${saved.usage_m3} m³ approved for billing.`
            : `Saved as an exception (${FLAG_LABELS[saved.flag]}). It needs review before billing.`,
      });
      router.refresh();
    } catch {
      setMessage({ tone: 'bad', text: 'Could not save the reading' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD} p-4.5`}>
      <div className="flex items-baseline gap-2">
        <div className="text-[13.5px] font-semibold">Meter reading</div>
        <div className="ml-auto font-mono text-[11px] text-muted">Cycle {cycle.period}</div>
      </div>
      <div className="mt-0.75 text-[11.5px] text-muted">
        {consumer.meter_no ? `Meter ${consumer.meter_no}` : 'No meter number on file'}
        {existing ? ' · already captured this cycle' : ''}
      </div>

      <div className="mt-3.5 flex gap-2.5">
        <div className="flex-1 rounded-[9px] border border-line-soft bg-[#F7FAF9] p-2.5">
          <div className="text-[10.5px] text-muted">Previous</div>
          <div className="mt-0.75 font-mono text-[17px] font-semibold">{previousValue}</div>
        </div>
        <div className="flex-1 rounded-[9px] border border-brand-200 bg-brand-50 p-2.5">
          <div className="text-[10.5px] text-brand-600">Usage m³</div>
          <div className="mt-0.75 font-mono text-[17px] font-semibold text-brand-600">
            {usage === null ? '—' : usage}
          </div>
        </div>
      </div>

      <div className={`${LABEL} mt-4`}>Current reading</div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))}
        disabled={!canCapture}
        inputMode="numeric"
        placeholder="—"
        aria-invalid={belowPrevious || undefined}
        className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-center font-mono text-[22px] font-semibold tracking-[.06em] outline-none disabled:cursor-not-allowed disabled:bg-[#F7FAF9] ${
          belowPrevious ? 'border-bad-fg text-bad-fg' : 'border-line focus:border-brand-500'
        }`}
      />

      {belowPrevious ? (
        <div className="mt-2.5 rounded-lg bg-bad-bg px-3 py-2 text-[11.5px] text-bad-fg">
          A meter cannot count backwards — this is below the previous reading of{' '}
          <span className="font-mono">{previousValue}</span>. Check the digits.
        </div>
      ) : current !== null ? (
        <div className="mt-2.5 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.75 text-[10.5px] font-semibold ${FLAG_PILL[flag]}`}>
            {FLAG_LABELS[flag]}
          </span>
          <span className="text-[11.5px] text-muted">
            {note || 'Will be approved for billing straight away'}
          </span>
        </div>
      ) : null}

      {message ? (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-[11.5px] ${
            message.tone === 'bad'
              ? 'bg-bad-bg text-bad-fg'
              : message.tone === 'warn'
                ? 'bg-warn-bg text-warn-fg'
                : 'bg-ok-bg text-ok-fg'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canCapture || saving || value === '' || belowPrevious}
        title={canCapture ? undefined : 'You do not have permission to capture readings'}
        className="mt-3.5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-[12.5px] font-medium text-white hover:bg-[#0A5453] disabled:opacity-40"
      >
        {saving ? 'Saving…' : existing ? 'Update reading' : 'Save reading'}
      </button>

      {!canCapture ? (
        <div className="mt-2 text-center text-[11px] text-muted">
          Needs the capture-readings permission.
        </div>
      ) : null}
    </form>
  );
}
