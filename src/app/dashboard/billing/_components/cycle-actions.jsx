'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ugx } from '@/lib/format';

const BTN = 'rounded-lg px-4 py-2 text-[12.5px] font-medium disabled:opacity-40';

/* Drives the cycle through open -> locked -> billed -> closed. Each button is
   only offered when that transition is actually legal. */
export default function CycleActions({ cycle, cycles, preflight }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmLock, setConfirmLock] = useState(null);

  async function call(url, options) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data.error || 'That did not work', errors: data.errors });
        return null;
      }
      router.refresh();
      return data.data;
    } catch {
      setMessage({ tone: 'bad', text: 'That did not work' });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function lock(force = false) {
    const result = await call(`/api/cycles/${cycle.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'locked', force }),
    });
    if (result) {
      setConfirmLock(null);
      setMessage({ tone: 'ok', text: `Cycle ${cycle.period} locked. Ready to bill.` });
    }
  }

  async function run() {
    const result = await call('/api/billing/run', {
      method: 'POST',
      body: JSON.stringify({ cycle_id: cycle.id }),
    });
    if (result) {
      setMessage({
        tone: result.failed?.length ? 'warn' : 'ok',
        text: `Generated ${result.created} bill${result.created === 1 ? '' : 's'} totalling UGX ${ugx(
          result.total,
        )}${result.skipped ? ` · ${result.skipped} already billed` : ''}${
          result.blocked ? ` · ${result.blocked} skipped` : ''
        }${result.failed?.length ? ` · ${result.failed.length} failed` : ''}`,
      });
    }
  }


  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          value={cycle?.id ?? ''}
          onChange={(e) => router.push(`/dashboard/billing?cycle=${e.target.value}`)}
          disabled={!cycles.length}
          className="rounded-[7px] border border-line bg-[#F1F5F4] px-2.5 py-1.75 text-[12.5px] outline-none"
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.period} · {c.status}
            </option>
          ))}
          {cycles.length ? null : <option value="">No cycles</option>}
        </select>

        {cycle?.status === 'open' ? (
          <button
            onClick={() =>
              preflight?.blockedTotal
                ? setConfirmLock(preflight.blockedTotal)
                : lock(false)
            }
            disabled={busy}
            className={`${BTN} bg-brand-600 text-white hover:bg-[#0A5453]`}
          >
            {busy ? 'Working…' : 'Lock cycle'}
          </button>
        ) : null}

        {cycle?.status === 'locked' ? (
          <button
            onClick={run}
            disabled={busy || !preflight?.billable}
            title={preflight?.billable ? undefined : 'Nothing is ready to bill'}
            className={`${BTN} bg-brand-600 text-white hover:bg-[#0A5453]`}
          >
            {busy ? 'Running…' : `Generate ${preflight?.billable ?? 0} bills`}
          </button>
        ) : null}

        {cycle?.status === 'billed' ? (
          <button
            onClick={() =>
              call(`/api/cycles/${cycle.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'closed' }),
              })
            }
            disabled={busy}
            className={`${BTN} border border-line bg-[#F1F5F4] text-[#26413F] hover:bg-[#E7EDEC]`}
          >
            Close cycle
          </button>
        ) : null}

        {/* Cycles are created and configured in their own module. */}
        <Link
          href="/dashboard/cycles"
          className={`${BTN} border border-line bg-[#F1F5F4] text-[#26413F] hover:bg-[#E7EDEC]`}
        >
          Manage cycles
        </Link>
      </div>

      {confirmLock ? (
        <div className="max-w-90 rounded-lg border border-warn-dot/50 bg-warn-bg px-3 py-2.5 text-right">
          <div className="text-[11.5px] text-warn-fg">
            {confirmLock} account{confirmLock === 1 ? '' : 's'} would be skipped — unresolved
            readings or missing tariffs. Lock anyway?
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => lock(true)}
              disabled={busy}
              className="rounded-md bg-warn-fg px-2.5 py-1.25 text-[11.5px] font-semibold text-white"
            >
              Lock anyway
            </button>
            <button
              onClick={() => setConfirmLock(null)}
              className="rounded-md border border-line bg-white px-2.5 py-1.25 text-[11.5px] font-semibold text-muted-deep"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div
          className={`max-w-100 rounded-lg px-3 py-2 text-right text-[11.5px] ${
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
    </div>
  );
}
