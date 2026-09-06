'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/* Two-step import: the file is checked first and the operator sees what would
   land before anything is written. */
export default function CsvImport({ cycleId, disabled }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [check, setCheck] = useState(null);

  function reset() {
    setFile(null);
    setCheck(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function send(selected, dryRun) {
    const body = new FormData();
    body.append('file', selected);
    body.append('cycle_id', String(cycleId));
    if (dryRun) body.append('dry_run', '1');

    const res = await fetch('/api/readings/import', { method: 'POST', body });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'The import failed');
      return null;
    }
    return data.data;
  }

  async function handleCheck(selected) {
    setFile(selected);
    setError('');
    setBusy(true);
    try {
      const result = await send(selected, true);
      if (result) setCheck(result);
    } catch {
      setError('The import failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const result = await send(file, false);
      if (!result) return;
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError('The import failed');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-lg border border-line bg-[#F1F5F4] px-3.5 py-2 text-[12.5px] font-medium text-[#26413F] hover:bg-[#E7EDEC] disabled:opacity-40"
      >
        Import CSV
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/40 px-3 py-6 sm:px-4 sm:py-16">
      <div className="w-full max-w-120 rounded-[14px] border border-line bg-white p-5.5">
        <div className="text-[15px] font-semibold">Import readings from CSV</div>
        <div className="mt-1 text-[12px] text-muted">
          Two columns: account number and meter reading. A header row is optional.
        </div>

        <pre className="mt-3 overflow-x-auto rounded-lg border border-line-soft bg-[#F7FAF9] px-3 py-2.5 font-mono text-[11.5px] text-muted-deep">
{`account_no,current_value
KW-0105,1874
KW-0109,2233`}
        </pre>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) handleCheck(selected);
          }}
          className="mt-3.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[12px] file:mr-3 file:rounded-md file:border-0 file:bg-[#F1F5F4] file:px-2.5 file:py-1.5 file:text-[12px] file:text-[#26413F]"
        />

        {busy && !check ? (
          <div className="mt-3 text-[12px] text-muted">Checking the file…</div>
        ) : null}

        {check ? (
          <div className="mt-3.5 rounded-lg border border-line-soft bg-[#F7FAF9] p-3">
            <div className="text-[12.5px] font-semibold">
              {check.imported} row{check.imported === 1 ? '' : 's'} ready to import
            </div>
            {check.unknown.length ? (
              <div className="mt-1.5 text-[11.5px] text-warn-fg">
                {check.unknown.length} unknown account{check.unknown.length === 1 ? '' : 's'} will be
                skipped: {check.unknown.slice(0, 4).join(', ')}
                {check.unknown.length > 4 ? '…' : ''}
              </div>
            ) : null}
            {check.rejected.length ? (
              <div className="mt-1.5 text-[11.5px] text-bad-fg">
                {check.rejected.length} row{check.rejected.length === 1 ? '' : 's'} rejected:{' '}
                {check.rejected[0].message}
              </div>
            ) : null}
            {check.preview?.length ? (
              <div className="mt-2.5 flex flex-col gap-1">
                {check.preview.slice(0, 5).map((row) => (
                  <div key={row.account_no} className="flex gap-2 text-[11.5px]">
                    <span className="w-18 font-mono text-brand-600">{row.account_no}</span>
                    <span className="flex-1 truncate text-muted-deep">{row.name}</span>
                    <span className="font-mono">{row.current_value}</span>
                  </div>
                ))}
                {check.preview.length > 5 ? (
                  <div className="text-[11px] text-muted">…and more</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-[12px] text-bad-fg">{error}</p>
        ) : null}

        <div className="mt-4 flex gap-2.5 border-t border-line-soft pt-3.5">
          <button
            onClick={handleCommit}
            disabled={!check || !check.imported || busy}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-[12.5px] font-medium text-white hover:bg-[#0A5453] disabled:opacity-40"
          >
            {busy ? 'Importing…' : check ? `Import ${check.imported} reading${check.imported === 1 ? '' : 's'}` : 'Import'}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="rounded-lg border border-line bg-[#F1F5F4] px-4 py-2.5 text-[12.5px] font-medium text-[#26413F] hover:bg-[#E7EDEC]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
