'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/billing';
import { ugx } from '@/lib/format';

const FIELD =
  'rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-[#F7FAF9]';
const LABEL = 'text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted';

/* Where each band starts is never a free choice: it is wherever the previous
   band stopped. So the editor asks only for a ceiling and a rate, and derives
   the rest — which makes gaps and overlaps impossible to express rather than
   merely invalid. Only the final band may be left open-ended. */
function derive(bands) {
  let cursor = 0;
  return bands.map((band, index) => {
    const raw = band.max_m3;
    const max = raw === null || raw === '' ? null : Number(raw);
    const min = cursor;
    if (max !== null) cursor = max;
    return {
      ...band,
      min_m3: min,
      max_m3: raw,
      needsCeiling: max === null && index !== bands.length - 1,
      invalid: max !== null && max <= min,
    };
  });
}

/* Edits one schedule's categories and bands. */
export default function ScheduleEditor({
  schedule,
  categories,
  cycles,
  lockedBy,
  canManage,
  consumersByCategory = {},
}) {
  const router = useRouter();
  const [rows, setRows] = useState(categories);
  const [meta, setMeta] = useState({
    name: schedule.name,
    effective_from: schedule.effective_from ? String(schedule.effective_from).slice(0, 10) : '',
    note: schedule.note || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const locked = lockedBy.length > 0 || !canManage;

  const problems = rows.flatMap((row) =>
    derive(row.bands)
      .filter((band) => band.needsCeiling || band.invalid || band.rate_per_m3 === '')
      .map(() => row.category),
  );

  function setCategory(index, key, value) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  function setBand(rowIndex, bandIndex, key, value) {
    setRows((current) =>
      current.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              bands: row.bands.map((band, b) =>
                b === bandIndex ? { ...band, [key]: value } : band,
              ),
            }
          : row,
      ),
    );
  }

  function addBand(rowIndex) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== rowIndex) return row;
        const bands = [...row.bands];
        const last = bands[bands.length - 1];

        // The band that was running to infinity now needs a ceiling, because
        // the new band picks up where it stops.
        if (last && (last.max_m3 === null || last.max_m3 === '')) {
          bands[bands.length - 1] = { ...last, max_m3: '' };
        }

        return { ...row, bands: [...bands, { max_m3: null, rate_per_m3: '' }] };
      }),
    );
  }

  const missing = CATEGORIES.filter((c) => !rows.some((row) => row.category === c));

  // Categories with accounts but no price here — the run would skip them.
  const stranded = missing
    .filter((category) => consumersByCategory[category])
    .map((category) => ({ category, count: consumersByCategory[category] }));

  function addCategory(category) {
    if (!category) return;
    setRows((current) => [
      ...current,
      {
        category,
        fixed_charge: 0,
        levy_pct: 0,
        flat_rate: category === 'kiosk' ? 0 : null,
        // Kiosks are never metered, so they price on the flat rate alone.
        bands: category === 'kiosk' ? [] : [{ max_m3: null, rate_per_m3: '' }],
      },
    ]);
  }

  function removeCategory(index) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function removeBand(rowIndex, bandIndex) {
    setRows((current) =>
      current.map((row, i) =>
        i === rowIndex ? { ...row, bands: row.bands.filter((_, b) => b !== bandIndex) } : row,
      ),
    );
  }

  async function remove() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tariff-schedules/${schedule.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data.error || 'Could not delete the schedule' });
        setConfirmDelete(false);
        return;
      }
      router.push('/dashboard/tariffs');
      router.refresh();
    } catch {
      setMessage({ tone: 'bad', text: 'Could not delete the schedule' });
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setErrors({});
    try {
      const res = await fetch(`/api/tariff-schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...meta,
          // Starts are derived here, never typed, so they always line up.
          categories: rows.map((row) => ({
            ...row,
            bands: derive(row.bands).map(({ min_m3, max_m3, rate_per_m3 }) => ({
              min_m3,
              max_m3,
              rate_per_m3,
            })),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data.error || 'Could not save the schedule' });
        setErrors(data.errors || {});
        return;
      }
      setMessage({ tone: 'ok', text: 'Schedule saved.' });
      router.refresh();
    } catch {
      setMessage({ tone: 'bad', text: 'Could not save the schedule' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[11px] border border-line bg-white">
      <div className="flex flex-wrap items-end gap-3 border-b border-line-soft px-4.5 py-3.5">
        <div className="flex flex-col gap-1">
          <label className={LABEL}>Schedule name</label>
          <input
            value={meta.name}
            disabled={locked}
            onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            className={`${FIELD} w-64`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL}>Effective from</label>
          <input
            type="date"
            value={meta.effective_from}
            disabled={locked}
            onChange={(e) => setMeta({ ...meta, effective_from: e.target.value })}
            className={FIELD}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className={LABEL}>Note</label>
          <input
            value={meta.note}
            disabled={locked}
            onChange={(e) => setMeta({ ...meta, note: e.target.value })}
            placeholder="Board approval reference, for example"
            className={`${FIELD} w-full`}
          />
        </div>

        {!locked ? (
          <div className="text-right">
            <button
              onClick={save}
              disabled={saving || problems.length > 0}
              title={problems.length ? 'Finish the incomplete bands first' : undefined}
              className="rounded-lg bg-brand-600 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#0A5453] disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save schedule'}
            </button>
            {problems.length ? (
              <div className="mt-1 text-[11px] text-bad-fg">
                {problems.length} band{problems.length === 1 ? '' : 's'} incomplete
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Only a schedule no cycle points at can be deleted — the API enforces
            it too, so a stale page cannot slip one through. */}
        {canManage && cycles.length === 0 ? (
          confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-bad-fg">Delete for good?</span>
              <button
                onClick={remove}
                disabled={saving}
                className="rounded-md bg-bad-fg px-2.5 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-muted-deep"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-[12px] font-medium text-muted-deep hover:border-bad-fg hover:text-bad-fg"
            >
              Delete
            </button>
          )
        ) : null}

        {canManage && cycles.length > 0 ? (
          <div className="text-[11px] text-muted">
            Used by {cycles.length} cycle{cycles.length === 1 ? '' : 's'} — cannot be deleted
          </div>
        ) : null}
      </div>

      {lockedBy.length ? (
        <div className="border-b border-line-soft bg-warn-bg px-4.5 py-2.5 text-[11.5px] text-warn-fg">
          Locked — this schedule already priced {lockedBy.join(', ')}. Clone it to change prices, so
          those invoices keep matching the tariff they cite.
        </div>
      ) : null}

      {cycles.length ? (
        <div className="border-b border-line-soft px-4.5 py-2 text-[11px] text-muted">
          Used by {cycles.map((c) => `${c.period} (${c.status})`).join(', ')}
        </div>
      ) : null}

      {message ? (
        <div
          className={`border-b border-line-soft px-4.5 py-2.5 text-[12px] ${
            message.tone === 'bad' ? 'bg-bad-bg text-bad-fg' : 'bg-ok-bg text-ok-fg'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {/* A category the schedule does not price blocks every account in it,
          so the cost of removing one is spelled out rather than discovered
          during a billing run. */}
      {stranded.length ? (
        <div className="border-b border-line-soft bg-warn-bg px-4.5 py-2.5 text-[11.5px] text-warn-fg">
          {stranded.map(({ category, count }) => (
            <div key={category}>
              {CATEGORY_LABELS[category]} is not priced here, but {count} account
              {count === 1 ? '' : 's'} use{count === 1 ? 's' : ''} it — they will be skipped by any
              billing run on a cycle using this schedule.
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3.5 p-4.5">
        {rows.length === 0 ? (
          <div className="rounded-[9px] border border-line-soft bg-[#F7FAF9] px-4 py-8 text-center text-[12.5px] text-muted">
            This schedule prices nothing. Add a category below, or no account can be billed on it.
          </div>
        ) : null}

        {rows.map((row, index) => (
          <div key={row.category} className="rounded-[9px] border border-line-soft bg-[#F7FAF9] p-3.5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="text-[12.5px] font-semibold">{CATEGORY_LABELS[row.category]}</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {consumersByCategory[row.category]
                    ? `${consumersByCategory[row.category]} account${
                        consumersByCategory[row.category] === 1 ? '' : 's'
                      } priced on this`
                    : 'No accounts in this category'}
                </div>
              </div>

              {!locked ? (
                <button
                  onClick={() => removeCategory(index)}
                  title={
                    consumersByCategory[row.category]
                      ? `${consumersByCategory[row.category]} accounts would have no price in this schedule`
                      : 'Remove this category from the schedule'
                  }
                  className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-muted-deep hover:border-bad-fg hover:text-bad-fg"
                >
                  Remove category
                </button>
              ) : null}

              <div className="ml-auto flex flex-wrap items-end gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className={LABEL}>Service charge</label>
                  <input
                    inputMode="numeric"
                    value={row.fixed_charge}
                    disabled={locked}
                    onChange={(e) => setCategory(index, 'fixed_charge', e.target.value)}
                    className={`${FIELD} w-24 font-mono`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={LABEL}>Tax %</label>
                  <input
                    inputMode="decimal"
                    value={row.levy_pct}
                    disabled={locked}
                    onChange={(e) => setCategory(index, 'levy_pct', e.target.value)}
                    className={`${FIELD} w-16 font-mono`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={LABEL}>Flat rate (unmetered)</label>
                  <input
                    inputMode="numeric"
                    value={row.flat_rate ?? ''}
                    disabled={locked}
                    onChange={(e) =>
                      setCategory(index, 'flat_rate', e.target.value === '' ? null : e.target.value)
                    }
                    placeholder="none"
                    className={`${FIELD} w-28 font-mono`}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-line pt-3">
              <div className="flex items-center gap-2">
                <div className={LABEL}>Bands · UGX per m³</div>
                {!locked ? (
                  <button
                    onClick={() => addBand(index)}
                    className="ml-auto rounded-md border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-muted-deep hover:bg-[#F1F5F4]"
                  >
                    + Add band
                  </button>
                ) : null}
              </div>

              {row.bands.length === 0 ? (
                <div className="mt-2 text-[11.5px] text-muted">
                  No bands — this category bills only its flat rate.
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-1.5">
                  {derive(row.bands).map((band, bandIndex) => (
                    <div key={bandIndex} className="flex flex-wrap items-center gap-2">
                      <span className="w-14 text-[11px] text-muted">
                        {bandIndex === 0 ? 'First' : 'Then'}
                      </span>
                      <span className="font-mono text-[11.5px] text-muted-deep">
                        {band.min_m3} →
                      </span>
                      <input
                        inputMode="numeric"
                        value={band.max_m3 ?? ''}
                        disabled={locked}
                        onChange={(e) =>
                          setBand(
                            index,
                            bandIndex,
                            'max_m3',
                            e.target.value === '' ? null : e.target.value,
                          )
                        }
                        placeholder="∞"
                        className={`${FIELD} w-20 font-mono`}
                      />
                      <span className="text-[11px] text-muted">m³ at</span>
                      <input
                        inputMode="numeric"
                        value={band.rate_per_m3}
                        disabled={locked}
                        onChange={(e) => setBand(index, bandIndex, 'rate_per_m3', e.target.value)}
                        className={`${FIELD} w-24 font-mono`}
                      />
                      <span className="text-[11px] text-muted">per m³</span>

                      {!locked ? (
                        <button
                          onClick={() => removeBand(index, bandIndex)}
                          aria-label="Remove band"
                          className="rounded-md px-1.5 text-[13px] text-muted hover:text-bad-fg"
                        >
                          ×
                        </button>
                      ) : null}

                      {band.needsCeiling ? (
                        <span className="text-[11px] text-bad-fg">
                          Set where this band ends — only the last one can run to ∞
                        </span>
                      ) : band.invalid ? (
                        <span className="text-[11px] text-bad-fg">
                          Must be more than {band.min_m3}
                        </span>
                      ) : errors[`${row.category}.band${bandIndex}`] ? (
                        <span className="text-[11px] text-bad-fg">
                          {errors[`${row.category}.band${bandIndex}`]}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {row.bands.length ? (
                <div className="mt-2 text-[11px] text-muted">
                  A 25 m³ bill on this category comes to{' '}
                  <span className="font-mono">{ugx(previewCharge(derive(row.bands), 25))}</span> of
                  water, before the service charge and tax.
                  {(() => {
                    const last = derive(row.bands).at(-1);
                    const ceiling = last?.max_m3;
                    // A closed top band means anything above it is free.
                    return ceiling !== null && ceiling !== '' ? (
                      <span className="ml-1 text-warn-fg">
                        Nothing is charged above {Number(ceiling)} m³ — leave the last band&apos;s
                        ceiling empty to cover everything above it.
                      </span>
                    ) : null;
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {!locked && missing.length ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[9px] border border-dashed border-line px-3.5 py-3">
            <span className="text-[11.5px] text-muted">Add a category:</span>
            {missing.map((category) => (
              <button
                key={category}
                onClick={() => addCategory(category)}
                className="rounded-md border border-line bg-white px-2.5 py-1.25 text-[11.5px] font-medium text-muted-deep hover:border-brand-500 hover:text-brand-600"
              >
                + {CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* Mirrors chargeForUsage so the editor can show what a band change costs
   without a round trip. */
function previewCharge(bands, usage) {
  return [...bands]
    .sort((a, b) => Number(a.min_m3) - Number(b.min_m3))
    .reduce((total, band) => {
      const min = Number(band.min_m3);
      const max = band.max_m3 === null || band.max_m3 === '' ? Infinity : Number(band.max_m3);
      const volume = Math.max(0, Math.min(usage, max) - min);
      return total + volume * (Number(band.rate_per_m3) || 0);
    }, 0);
}
