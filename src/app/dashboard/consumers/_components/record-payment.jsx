'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ugx, CHANNEL_LABELS } from '@/lib/format';

const CHANNELS = ['mtn', 'airtel', 'bank', 'cash'];
const FIELD =
  'rounded-lg border border-line bg-white px-2.75 py-2 text-[12.5px] text-ink outline-none focus:border-brand-500';
const LABEL = 'text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted';

export default function RecordPayment({ consumer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('mtn');
  const [reference, setReference] = useState('');

  // The component survives a change of selected consumer, so the prefilled
  // amount is taken from the current props at open time — never from whoever
  // was selected when this first mounted.
  function openForm() {
    setAmount(consumer.balance > 0 ? String(consumer.balance) : '');
    setReference('');
    setChannel('mtn');
    setError('');
    setOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumer_id: consumer.id,
          amount: Number(amount),
          channel,
          reference,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.errors?.amount || data.error || 'Something went wrong');
        return;
      }

      setOpen(false);
      setReference('');
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={openForm}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-[12.5px] font-medium text-white hover:bg-[#0A5453]"
      >
        Record payment
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[11px] border border-brand-200 bg-brand-50 p-3.5"
    >
      <div className="text-[12.5px] font-semibold">Record payment</div>
      <div className="mt-0.75 text-[11px] text-muted">
        {consumer.account_no} · balance {ugx(consumer.balance)}
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          <label className={LABEL}>Amount (UGX)</label>
          <input
            required
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            className={`${FIELD} font-mono`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL}>Channel</label>
          <div className="grid grid-cols-2 gap-1.5">
            {CHANNELS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setChannel(value)}
                className={`rounded-lg px-2 py-1.75 text-[11.5px] font-medium ${
                  channel === value
                    ? 'bg-brand-600 text-white'
                    : 'border border-line bg-white text-muted-deep hover:bg-[#F1F5F4]'
                }`}
              >
                {CHANNEL_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL}>Reference</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Transaction ID or receipt no."
            className={FIELD}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-2.5 rounded-lg bg-bad-bg px-2.5 py-1.75 text-[11.5px] text-bad-fg">{error}</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={saving || !amount}
          className="flex-1 rounded-lg bg-brand-600 px-3 py-2.25 text-[12.5px] font-medium text-white hover:bg-[#0A5453] disabled:opacity-50"
        >
          {saving ? 'Saving…' : `Post ${amount ? ugx(Number(amount)) : ''}`}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line bg-white px-3 py-2.25 text-[12.5px] font-medium text-[#26413F] hover:bg-[#F1F5F4]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
