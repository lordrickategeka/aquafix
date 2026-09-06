'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { flagReading } from '@/lib/billing';
import { FLAG_PILL, FLAG_LABELS } from '@/lib/format';
import CsvImport from './csv-import';

const CARD = 'bg-white border border-line rounded-[11px]';
const COLS = 'grid-cols-[104px_1.4fr_92px_92px_104px_88px_1fr]';

export default function ReadingsWorkspace({ cycle, cycles, zones, activeZone, only, rows, stats }) {
  const router = useRouter();
  const [entries, setEntries] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const editable = cycle.status === 'open';

  const dirty = Object.keys(entries).length;

  // Meters count up only, so anything below the previous figure is a mis-key.
  // The server refuses them; blocking the save here keeps a whole route's
  // worth of typing from bouncing back one row at a time.
  const belowPrevious = rows.filter((row) => {
    const typed = entries[row.consumer_id];
    return typed !== undefined && typed !== '' && Number(typed) < row.previous;
  });

  // Usage and flags update as you type, using the same rules the server will
  // apply on save — no surprises after the round trip.
  const preview = useMemo(() => {
    const map = {};
    for (const row of rows) {
      const typed = entries[row.consumer_id];
      if (typed === undefined) continue;
      const current = typed === '' ? null : Number(typed);
      const { flag, note } = flagReading({ previous: row.previous, current });
      map[row.consumer_id] = {
        usage: current === null || flag === 'negative' ? null : current - row.previous,
        flag,
        note,
      };
    }
    return map;
  }, [entries, rows]);

  function setValue(consumerId, value) {
    setEntries((current) => ({ ...current, [consumerId]: value.replace(/[^\d]/g, '') }));
  }

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_id: cycle.id,
          readings: Object.entries(entries).map(([consumer_id, current_value]) => ({
            consumer_id: Number(consumer_id),
            current_value,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data.error || 'Could not save the readings' });
        return;
      }

      const flagged = data.data.saved.filter((r) => r.flag !== 'ok').length;
      setMessage({
        tone: flagged ? 'warn' : 'ok',
        text: `Saved ${data.data.saved.length} reading${data.data.saved.length === 1 ? '' : 's'}${
          flagged ? ` · ${flagged} need review` : ''
        }${data.data.failures.length ? ` · ${data.data.failures.length} failed` : ''}`,
      });
      setEntries({});
      router.refresh();
    } catch {
      setMessage({ tone: 'bad', text: 'Could not save the readings' });
    } finally {
      setSaving(false);
    }
  }

  async function review(readingId, status) {
    const res = await fetch(`/api/readings/${readingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ tone: 'bad', text: data.error || 'Could not update that reading' });
      return;
    }
    router.refresh();
  }

  const linkFor = (extra) => ({
    pathname: '/dashboard/readings',
    query: {
      cycle: String(cycle.id),
      ...(activeZone ? { zone: activeZone } : {}),
      ...(only ? { only } : {}),
      ...extra,
    },
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[
          ['Meters to read', stats.expected, `cycle ${cycle.period}`],
          ['Captured', stats.captured, `${Math.round((stats.captured / Math.max(stats.expected, 1)) * 100)}% of route`],
          ['Approved', stats.approved, 'ready to bill'],
          ['Need review', stats.pending, stats.pending ? 'blocking the run' : 'all clear'],
        ].map(([label, value, note], index) => (
          <div key={label} className={`${CARD} px-4 py-3.75`}>
            <div className="text-[11px] font-medium text-[#7A8B89]">{label}</div>
            <div
              className={`mt-1.5 font-mono text-2xl font-semibold ${
                index === 3 && stats.pending > 0 ? 'text-warn-fg' : ''
              }`}
            >
              {value}
            </div>
            <div className="mt-1.25 text-[11px] text-muted">{note}</div>
          </div>
        ))}
      </div>

      <div className={`${CARD} mt-3.5 overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line-soft px-4 py-3">
          <select
            value={cycle.id}
            onChange={(e) => router.push(`/dashboard/readings?cycle=${e.target.value}`)}
            className="rounded-[7px] border border-line bg-[#F1F5F4] px-2.5 py-1.5 text-[12.5px] outline-none"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                Cycle {c.period} · {c.status}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-1.5">
            <Link
              href={linkFor({ zone: undefined })}
              className={`rounded-[7px] px-2.5 py-1.5 text-xs ${
                !activeZone ? 'bg-brand-700 font-medium text-white' : 'border border-line bg-[#F1F5F4] text-muted-deep hover:bg-[#E7EDEC]'
              }`}
            >
              All zones
            </Link>
            {zones.map((zone) => (
              <Link
                key={zone.id}
                href={linkFor({ zone: String(zone.id) })}
                className={`rounded-[7px] px-2.5 py-1.5 text-xs ${
                  activeZone === String(zone.id)
                    ? 'bg-brand-700 font-medium text-white'
                    : 'border border-line bg-[#F1F5F4] text-muted-deep hover:bg-[#E7EDEC]'
                }`}
              >
                {zone.name}
              </Link>
            ))}
            <Link
              href={linkFor({ only: only ? undefined : 'exceptions' })}
              className={`rounded-[7px] px-2.5 py-1.5 text-xs ${
                only
                  ? 'bg-warn-fg font-medium text-white'
                  : 'border border-line bg-[#F1F5F4] text-muted-deep hover:bg-[#E7EDEC]'
              }`}
            >
              Exceptions only
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <CsvImport cycleId={cycle.id} disabled={!editable} />
            <button
              onClick={saveAll}
              disabled={!dirty || saving || !editable || belowPrevious.length > 0}
              title={
                belowPrevious.length
                  ? 'Fix the readings below the previous value first'
                  : undefined
              }
              className="rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#0A5453] disabled:opacity-40"
            >
              {saving ? 'Saving…' : dirty ? `Save ${dirty} reading${dirty === 1 ? '' : 's'}` : 'Save readings'}
            </button>
          </div>
        </div>

        {belowPrevious.length ? (
          <div className="bg-bad-bg px-4 py-2.5 text-[12px] text-bad-fg">
            {belowPrevious.length} reading{belowPrevious.length === 1 ? ' is' : 's are'} below the
            previous meter value — a meter cannot count backwards. Fix{' '}
            {belowPrevious
              .slice(0, 4)
              .map((row) => row.account_no)
              .join(', ')}
            {belowPrevious.length > 4 ? ` and ${belowPrevious.length - 4} more` : ''} before saving.
          </div>
        ) : null}

        {message ? (
          <div
            className={`px-4 py-2.5 text-[12px] ${
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

        {!editable ? (
          <div className="bg-[#F7FAF9] px-4 py-2.5 text-[12px] text-muted-deep">
            Cycle {cycle.period} is {cycle.status} — readings are read-only.
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <div className="min-w-[940px]">
            <div
              className={`grid ${COLS} border-b border-line-soft bg-[#F7FAF9] px-4 py-2.25 text-[10.5px] font-semibold tracking-[.06em] text-muted uppercase`}
            >
              <div>Account</div>
              <div>Consumer</div>
              <div>Zone</div>
              <div className="text-right">Previous</div>
              <div className="text-right">Current</div>
              <div className="text-right">Usage m³</div>
              <div className="pl-4">Flag</div>
            </div>

            {rows.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12.5px] text-muted">
                {only ? 'No exceptions in this cycle.' : 'No metered accounts match this filter.'}
              </div>
            ) : (
              rows.map((row) => {
                const live = preview[row.consumer_id];
                const flag = live?.flag ?? row.reading?.flag ?? null;
                const usage = live ? live.usage : row.reading?.usage_m3 ?? null;
                const typed = entries[row.consumer_id];
                const value = typed !== undefined ? typed : (row.reading?.current_value ?? '');
                const pending = row.reading?.status === 'pending';
                const tooLow = typed !== undefined && typed !== '' && Number(typed) < row.previous;

                return (
                  <div
                    key={row.consumer_id}
                    className={`grid ${COLS} items-center border-b border-line-faint px-4 py-2 ${
                      tooLow ? 'bg-bad-bg/40' : pending ? 'bg-[#FDFBF6]' : ''
                    }`}
                  >
                    <div className="font-mono text-xs text-brand-600">{row.account_no}</div>
                    <div className="truncate pr-2 text-[12.5px]">{row.name}</div>
                    <div className="text-xs text-muted-deep">{row.zone}</div>
                    <div className="text-right font-mono text-xs text-muted-deep">{row.previous}</div>
                    <div className="text-right">
                      <input
                        value={value ?? ''}
                        disabled={!editable}
                        onChange={(e) => setValue(row.consumer_id, e.target.value)}
                        placeholder="—"
                        inputMode="numeric"
                        aria-invalid={tooLow || undefined}
                        title={tooLow ? `Below the previous reading of ${row.previous}` : undefined}
                        className={`w-22 rounded-md border px-2 py-1 text-right font-mono text-xs outline-none disabled:cursor-not-allowed disabled:bg-[#F7FAF9] ${
                          tooLow
                            ? 'border-bad-fg bg-white font-semibold text-bad-fg'
                            : typed !== undefined
                              ? 'border-brand-500 bg-brand-50 focus:border-brand-500'
                              : 'border-line bg-white focus:border-brand-500'
                        }`}
                      />
                    </div>
                    <div className="text-right font-mono text-xs font-semibold">
                      {usage === null || usage === undefined ? '—' : usage}
                    </div>
                    <div className="flex items-center gap-2 pl-4">
                      {flag ? (
                        <span
                          className={`rounded-full px-2 py-0.75 text-[10.5px] font-semibold ${FLAG_PILL[flag]}`}
                        >
                          {FLAG_LABELS[flag]}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-muted">Not read</span>
                      )}
                      <span className="truncate text-[11.5px] text-muted">
                        {live?.note ?? row.reading?.note ?? ''}
                      </span>
                      {pending && editable ? (
                        <span className="ml-auto flex flex-none gap-1">
                          <button
                            onClick={() => review(row.reading.id, 'approved')}
                            disabled={row.reading.usage_m3 === null}
                            title={
                              row.reading.usage_m3 === null
                                ? 'Capture a value before approving'
                                : 'Approve for billing'
                            }
                            className="rounded-md bg-ok-bg px-2 py-1 text-[11px] font-semibold text-ok-fg hover:brightness-95 disabled:opacity-40"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => review(row.reading.id, 'rejected')}
                            className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-semibold text-muted-deep hover:bg-[#F1F5F4]"
                          >
                            Skip
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
