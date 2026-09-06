'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ugx } from '@/lib/format';

/* Issues this consumer's bill for the open cycle, without waiting for the
   whole cycle to be locked and run — for the customer at the counter. */
export default function BillNow({ consumer, cycle, blockedReason, alreadyBilled }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (!cycle) return null;

  if (alreadyBilled) {
    return (
      <div className="rounded-[9px] border border-line-soft bg-[#F7FAF9] px-3 py-2.5 text-[11.5px] text-muted">
        Already billed for {cycle.period} —{' '}
        <Link
          href={`/dashboard/bills/${alreadyBilled}`}
          className="font-medium text-brand-600 hover:underline"
        >
          {alreadyBilled}
        </Link>
      </div>
    );
  }

  if (result) {
    return (
      <div className="rounded-[9px] border border-ok-fg/30 bg-ok-bg px-3 py-2.5 text-[11.5px] text-ok-fg">
        Billed {ugx(result.total_due)} —{' '}
        <Link href={`/dashboard/bills/${result.invoice_no}`} className="font-semibold underline">
          print {result.invoice_no}
        </Link>
      </div>
    );
  }

  async function issue() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/billing/consumer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumer_id: consumer.id, cycle_id: cycle.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not issue the bill');
        setConfirming(false);
        return;
      }
      setResult(data.data.bill);
      router.refresh();
    } catch {
      setError('Could not issue the bill');
    } finally {
      setBusy(false);
    }
  }

  if (blockedReason) {
    return (
      <div className="rounded-[9px] border border-line-soft bg-[#F7FAF9] px-3 py-2.5 text-[11.5px] text-muted">
        Cannot bill {cycle.period} yet — {blockedReason.toLowerCase()}.
      </div>
    );
  }

  return (
    <div>
      {confirming ? (
        <div className="rounded-[9px] border border-warn-dot/50 bg-warn-bg px-3 py-2.5">
          <div className="text-[11.5px] text-warn-fg">
            Issue this consumer&apos;s {cycle.period} bill now? Their reading for the cycle is
            frozen afterwards.
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={issue}
              disabled={busy}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Issuing…' : 'Issue bill'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md border border-line bg-white px-3 py-1.5 text-[11.5px] font-medium text-muted-deep"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="w-full rounded-lg border border-line bg-[#F1F5F4] px-4 py-2.5 text-[12.5px] font-medium text-[#26413F] hover:bg-[#E7EDEC]"
        >
          Bill {cycle.period} now
        </button>
      )}

      {error ? (
        <div className="mt-2 rounded-lg bg-bad-bg px-3 py-2 text-[11.5px] text-bad-fg">{error}</div>
      ) : null}
    </div>
  );
}
