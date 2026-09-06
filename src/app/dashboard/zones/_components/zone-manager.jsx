'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FIELD =
  'rounded-lg border border-line bg-white px-2.75 py-2 text-[12.5px] text-ink outline-none focus:border-brand-500';
const LABEL = 'text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted';
const BTN = 'rounded-md px-2.5 py-1.25 text-[11.5px] font-medium';

const EMPTY = { name: '', code: '', supply_window: '' };

export default function ZoneManager({ zones, canManage }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function call(url, options) {
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data.error || 'That did not work' });
        setErrors(data.errors || {});
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

  async function submit(event) {
    event.preventDefault();
    const result = editing
      ? await call(`/api/zones/${editing}`, { method: 'PATCH', body: JSON.stringify(form) })
      : await call('/api/zones', { method: 'POST', body: JSON.stringify(form) });

    if (result) {
      setForm(EMPTY);
      setEditing(null);
      setMessage({ tone: 'ok', text: editing ? 'Zone updated.' : 'Zone added.' });
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-[11px] border border-line bg-white">
        <div className="border-b border-line-soft px-4.5 py-3.5">
          <div className="text-[13.5px] font-semibold">Zones</div>
          <div className="mt-0.75 text-[11.5px] text-muted">
            The areas or cells you supply. Every consumer belongs to one, so add these before the
            register.
          </div>
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

        {zones.length === 0 ? (
          <div className="px-4.5 py-8 text-center text-[12.5px] text-muted">
            No zones yet. Add the first one below.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[90px_1fr_1fr_110px_140px] border-b border-line-soft bg-[#F7FAF9] px-4.5 py-2.25 text-[10.5px] font-semibold tracking-[.06em] text-muted uppercase">
              <div>Code</div>
              <div>Name</div>
              <div>Supply window</div>
              <div className="text-right">Consumers</div>
              <div className="pl-4">Actions</div>
            </div>

            {zones.map((zone) => (
              <div
                key={zone.id}
                className="grid grid-cols-[90px_1fr_1fr_110px_140px] items-center border-b border-line-faint px-4.5 py-2.5"
              >
                <div className="font-mono text-[12.5px] font-semibold">{zone.code}</div>
                <div className="text-[12.5px]">{zone.name}</div>
                <div className="text-[11.5px] text-muted">{zone.supply_window || '—'}</div>
                <div className="text-right font-mono text-[12px]">{zone.consumers}</div>
                <div className="flex gap-1.5 pl-4">
                  {canManage ? (
                    <>
                      <button
                        onClick={() => {
                          setEditing(zone.id);
                          setForm({
                            name: zone.name,
                            code: zone.code,
                            supply_window: zone.supply_window || '',
                          });
                          setMessage(null);
                        }}
                        className={`${BTN} border border-line bg-white text-muted-deep hover:bg-[#F1F5F4]`}
                      >
                        Edit
                      </button>

                      {zone.consumers === 0 ? (
                        confirmDelete === zone.id ? (
                          <button
                            onClick={async () => {
                              await call(`/api/zones/${zone.id}`, { method: 'DELETE' });
                              setConfirmDelete(null);
                            }}
                            disabled={busy}
                            className={`${BTN} bg-bad-fg text-white`}
                          >
                            Sure?
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(zone.id)}
                            className={`${BTN} border border-line bg-white text-muted-deep hover:border-bad-fg hover:text-bad-fg`}
                          >
                            Delete
                          </button>
                        )
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {canManage ? (
        <form onSubmit={submit} className="rounded-[11px] border border-line bg-white p-4.5">
          <div className="text-[12.5px] font-semibold">
            {editing ? 'Edit zone' : 'Add a zone'}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[110px_1fr_1fr]">
            <div className="flex flex-col gap-1">
              <label className={LABEL}>Code</label>
              <input
                required
                value={form.code}
                onChange={set('code')}
                placeholder="57"
                className={`${FIELD} font-mono uppercase`}
              />
              {errors.code ? <span className="text-[11px] text-bad-fg">{errors.code}</span> : null}
            </div>

            <div className="flex flex-col gap-1">
              <label className={LABEL}>Name</label>
              <input
                required
                value={form.name}
                onChange={set('name')}
                placeholder="Cell 57 / Central"
                className={FIELD}
              />
              {errors.name ? <span className="text-[11px] text-bad-fg">{errors.name}</span> : null}
            </div>

            <div className="flex flex-col gap-1">
              <label className={LABEL}>Supply window (optional)</label>
              <input
                value={form.supply_window}
                onChange={set('supply_window')}
                placeholder="06:00–11:00 daily"
                className={FIELD}
              />
            </div>
          </div>

          <div className="mt-3.5 flex gap-2.5">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#0A5453] disabled:opacity-50"
            >
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add zone'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY);
                  setErrors({});
                }}
                className="rounded-lg border border-line bg-[#F1F5F4] px-4 py-2 text-[12.5px] font-medium text-[#26413F]"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
