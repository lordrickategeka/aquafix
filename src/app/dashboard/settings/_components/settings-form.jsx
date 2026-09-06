'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FIELD =
  'rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] text-ink outline-none focus:border-brand-500';
const LABEL = 'text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted';

export default function SettingsForm({ fields, values }) {
  const router = useRouter();
  const [form, setForm] = useState(values);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setErrors({});

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data.error || 'Could not save the settings' });
        setErrors(data.errors || {});
        return;
      }
      setMessage({ tone: 'ok', text: 'Saved. The new wording appears everywhere immediately.' });
      router.refresh();
    } catch {
      setMessage({ tone: 'bad', text: 'Could not save the settings' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[11px] border border-line bg-white">
      <div className="flex items-center gap-3 border-b border-line-soft px-4.5 py-3.5">
        <div>
          <div className="text-[13.5px] font-semibold">Organisation</div>
          <div className="mt-0.75 text-[11.5px] text-muted">
            Your name and the wording printed on every bill.
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="ml-auto rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#0A5453] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      {message ? (
        <div
          className={`border-b border-line-soft px-4.5 py-2.5 text-[12px] ${
            message.tone === 'bad' ? 'bg-bad-bg text-bad-fg' : 'bg-ok-bg text-ok-fg'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-3.5 p-4 sm:p-4.5">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label className={LABEL} htmlFor={field.key}>
              {field.label}
            </label>
            {field.multiline ? (
              <textarea
                id={field.key}
                rows={5}
                value={form[field.key] ?? ''}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className={`${FIELD} font-mono leading-relaxed`}
              />
            ) : (
              <input
                id={field.key}
                value={form[field.key] ?? ''}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className={FIELD}
              />
            )}
            <span className="text-[11px] text-muted">{field.hint}</span>
            {errors[field.key] ? (
              <span className="text-[11px] text-bad-fg">{errors[field.key]}</span>
            ) : null}
          </div>
        ))}
      </div>
    </form>
  );
}
