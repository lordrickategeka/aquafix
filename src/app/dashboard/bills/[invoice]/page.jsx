import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bill, BillLine, BillingCycle, Consumer, Zone, Reading } from '@/models';
import { ugx, fullDate, periodLabel } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import PrintButton from './_components/print-button';

function Row({ label, value, bold, rule }) {
  return (
    <div
      className={`flex items-baseline gap-4 py-1.5 ${rule ? 'border-t border-ink' : ''} ${
        bold ? 'font-semibold' : ''
      }`}
    >
      <div className="flex-1 text-[12.5px]">{label}</div>
      <div className="font-mono text-[12.5px] whitespace-nowrap">{value}</div>
    </div>
  );
}

/* The printable bill, laid out to match the sheet handed to consumers: the
   meter reading and this month's charges, then how the brought-forward figure
   was reached. Every figure comes from the stored bill, never recomputed, so a
   reprint of an old bill is identical to the original. */
export default async function BillPage({ params }) {
  const { invoice } = await params;
  const settings = await getSettings();

  const bill = await Bill.findOne({
    where: { invoice_no: decodeURIComponent(invoice) },
    include: [
      { model: BillLine, as: 'lines' },
      { model: BillingCycle, as: 'cycle' },
      { model: Reading, as: 'reading' },
      { model: Consumer, as: 'consumer', include: [{ model: Zone, as: 'zone' }] },
    ],
  });
  if (!bill) notFound();

  const consumer = bill.consumer;
  const reading = bill.reading;
  const currentCharges = bill.total_due - bill.brought_forward;

  // The consumption lines only — service charge, tax and the carried balance
  // are printed from their own stored totals.
  const waterLines = [...(bill.lines || [])]
    .sort((a, b) => a.position - b.position)
    .filter((line) => line.description.startsWith('Water consumed') || line.description.startsWith('Flat rate'));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3.5 flex items-center gap-2 print:hidden">
        <Link
          href={`/dashboard/consumers/${consumer.account_no}?tab=billing`}
          className="text-[11.5px] text-muted hover:text-brand-600"
        >
          ← {consumer.name}
        </Link>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      <div className="rounded-[11px] border border-line bg-white p-4 sm:p-8 print:rounded-none print:border-0 print:p-0">
        <div className="bg-[#E7EDEC] px-3 py-1.5 text-center text-[15px] font-semibold tracking-wide">
          {settings.bill_title || `${settings.organisation_name}: WATER BILL`}
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px] sm:gap-x-6 sm:text-[12.5px]">
          <div className="text-muted-deep">Water bill for:</div>
          <div className="font-semibold">{periodLabel(bill.cycle?.period).toUpperCase()}</div>

          <div className="text-muted-deep">Billing date:</div>
          <div>{fullDate(bill.issued_at)}</div>

          <div className="text-muted-deep">Zone / cell:</div>
          <div>{consumer.zone?.name ?? '—'}</div>

          <div className="text-muted-deep">Customer name:</div>
          <div className="font-semibold">{consumer.name}</div>

          <div className="text-muted-deep">Water meter no:</div>
          <div className="font-mono">{consumer.meter_no || 'Unmetered'}</div>

          <div className="text-muted-deep">Account no:</div>
          <div className="font-mono">{consumer.account_no}</div>

          <div className="text-muted-deep">Tel no:</div>
          <div className="font-mono">{consumer.phone || '—'}</div>
        </div>

        <div className="mt-5 bg-[#E7EDEC] px-3 py-1 text-center text-[12.5px] font-semibold">
          WATER METER READING AND CHARGES
        </div>

        <div className="mt-2">
          {consumer.is_metered ? (
            <>
              <Row label="Previous reading:" value={reading ? reading.previous_value : '—'} />
              <Row label="Current reading:" value={reading ? (reading.current_value ?? '—') : '—'} />
              <Row label="Units used:" value={bill.usage_m3 ?? '—'} />
            </>
          ) : (
            <Row label="Unmetered connection — flat rate" value="" />
          )}

          {/* Printed from the stored totals, under the wording used on the
              paper bill. The per-band detail below is shown only when there is
              more than one rate to explain — a single-rate bill needs no
              breakdown. */}
          <Row label="Current cost:" value={ugx(bill.consumption_amount)} />

          {waterLines.length > 1
            ? waterLines.map((line) => (
                <div key={line.id} className="flex items-baseline gap-4 py-0.5 pl-6">
                  <div className="flex-1 text-[11.5px] text-muted">
                    {line.description}
                    {line.detail ? ` (${line.detail})` : ''}
                  </div>
                  <div className="font-mono text-[11.5px] whitespace-nowrap text-muted">
                    {ugx(line.amount)}
                  </div>
                </div>
              ))
            : null}

          {bill.fixed_charge > 0 ? (
            <Row label="Monthly service charge:" value={ugx(bill.fixed_charge)} />
          ) : null}

          {bill.levy_amount > 0 ? <Row label="Tax:" value={ugx(bill.levy_amount)} /> : null}

          <Row label="Balance b/f from previous invoice:" value={ugx(bill.brought_forward)} />
          <Row label="Total amount due:" value={ugx(bill.total_due)} bold rule />
        </div>

        <div className="mt-5 bg-[#E7EDEC] px-3 py-1 text-center text-[12.5px] font-semibold">
          ACCOUNT SUMMARY
        </div>

        <div className="mt-2">
          <Row label="Previous balance:" value={ugx(bill.previous_balance)} />
          <Row label="Cash paid:" value={ugx(bill.payments_since)} />
          <Row label="Balance to be paid:" value={ugx(bill.brought_forward)} bold rule />
          <Row label={`Charges for ${periodLabel(bill.cycle?.period)}:`} value={ugx(currentCharges)} />
        </div>

        <div className="mt-6 text-[12px] leading-relaxed">
          <div className="font-semibold">THANK YOU!</div>
          {settings.pay_phone ? (
            <div className="mt-2 font-medium">USE CELL NO {settings.pay_phone}</div>
          ) : null}
          {/* Kept as separate lines rather than a paragraph so the wording
              prints exactly as an administrator typed it. */}
          <div className="mt-1 whitespace-pre-line text-muted-deep">{settings.bill_footer}</div>
          {bill.due_date ? (
            <div className="mt-2 font-medium">Due by {fullDate(bill.due_date)}.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
