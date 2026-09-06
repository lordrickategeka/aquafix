import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Op } from 'sequelize';
import {
  Consumer,
  Zone,
  Reading,
  Bill,
  BillLine,
  LedgerEntry,
  BillingCycle,
  Tariff,
  TariffBand,
} from '@/models';
import { getSessionUser } from '@/lib/auth';
import { userHasPermission } from '@/lib/rbac';
import { previousValueFor, usageHistoryFor } from '@/lib/readings';
import { prepareOne } from '@/lib/billing-run';
import { CATEGORY_LABELS } from '@/lib/billing';
import {
  ugx,
  fullDate,
  shortDate,
  periodLabel,
  STATUS_PILL,
  FLAG_PILL,
  FLAG_LABELS,
  BILL_STATUS_PILL,
  BILL_STATUS_LABELS,
  CATEGORY_SHORT,
} from '@/lib/format';
import ConsumerForm from '../_components/consumer-form';
import RecordPayment from '../_components/record-payment';
import CaptureReading from './_components/capture-reading';
import BillNow from './_components/bill-now';
import ConsumptionChart from './_components/consumption-chart';

const CARD = 'bg-white border border-line rounded-[11px]';
const HEAD = 'text-[13.5px] font-semibold';
const SUB = 'text-[11.5px] text-muted';
const LABEL = 'text-[11px] uppercase tracking-[.06em] text-muted font-semibold';

// Tabs live in the URL rather than component state, so a tab is linkable and
// survives the refresh that follows saving a reading or a payment.
const DEFAULT_TAB = 'readings';

export default async function ConsumerProfilePage({ params, searchParams }) {
  const { account } = await params;
  const query = await searchParams;

  const consumer = await Consumer.findOne({
    where: { account_no: decodeURIComponent(account) },
    include: [{ model: Zone, as: 'zone' }],
  });
  if (!consumer) notFound();

  const session = await getSessionUser();
  const [canCapture, canPay, canManage] = await Promise.all([
    userHasPermission(session.id, 'capture-readings'),
    userHasPermission(session.id, 'record-payments'),
    userHasPermission(session.id, 'manage-consumers'),
  ]);

  const [zones, readings, bills, ledger, openCycle, tariffs] = await Promise.all([
    Zone.findAll({ order: [['name', 'ASC']] }),
    Reading.findAll({
      where: { consumer_id: consumer.id },
      include: [{ model: BillingCycle, as: 'cycle', attributes: ['id', 'period', 'status'] }],
      order: [['billing_cycle_id', 'DESC']],
    }),
    Bill.findAll({
      where: { consumer_id: consumer.id },
      include: [
        { model: BillingCycle, as: 'cycle', attributes: ['period'] },
        { model: BillLine, as: 'lines' },
      ],
      order: [['issued_at', 'DESC']],
    }),
    LedgerEntry.findAll({
      where: { consumer_id: consumer.id },
      order: [
        ['occurred_at', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: 20,
    }),
    BillingCycle.findOne({ where: { status: 'open' }, order: [['period', 'DESC']] }),
    Tariff.findAll({
      where: { category: consumer.category },
      include: [{ model: TariffBand, as: 'bands' }],
      order: [['effective_from', 'DESC']],
      limit: 1,
    }),
  ]);

  const tariff = tariffs[0] ?? null;
  const flatRates = {};
  for (const row of await Tariff.findAll({
    attributes: ['category', 'flat_rate'],
    order: [['effective_from', 'DESC']],
  })) {
    if (!(row.category in flatRates)) flatRates[row.category] = row.flat_rate ?? 0;
  }

  // What the capture form needs to price and flag a new reading.
  const existingThisCycle = openCycle
    ? readings.find((r) => r.billing_cycle_id === openCycle.id) ?? null
    : null;
  const previousValue = openCycle
    ? existingThisCycle
      ? existingThisCycle.previous_value
      : await previousValueFor(consumer.id, openCycle.id)
    : null;
  const history = openCycle ? await usageHistoryFor(consumer.id, openCycle.id) : [];

  // Can this consumer be billed for the live cycle right now, and have they
  // been already?
  const billedThisCycle = openCycle
    ? (bills.find((b) => b.billing_cycle_id === openCycle.id)?.invoice_no ?? null)
    : null;
  const readyToBill =
    openCycle && !billedThisCycle && canManage ? await prepareOne(openCycle, consumer) : null;

  const usages = readings.map((r) => r.usage_m3).filter((u) => u !== null && u !== undefined);
  const averageUsage = usages.length
    ? Math.round(usages.reduce((sum, u) => sum + u, 0) / usages.length)
    : null;
  const chart = [...readings].filter((r) => r.usage_m3 !== null).reverse().slice(-12);
  const peak = Math.max(...chart.map((r) => r.usage_m3), 1);

  const expandedBill = query.bill ? bills.find((b) => String(b.id) === query.bill) : null;

  // Charges only — the brought-forward part of each bill is last cycle's debt,
  // not a new charge, so counting it would inflate the lifetime total.
  const billedTotal = bills.reduce((sum, b) => sum + (b.total_due - b.brought_forward), 0);
  const paidTotal = (
    await LedgerEntry.findAll({ where: { consumer_id: consumer.id, type: 'payment' } })
  ).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);

  // "Meter reading" and "Reading history" share a tab: you want last cycle's
  // figures in view while typing this one's.
  const TABS = [
    [DEFAULT_TAB, 'Readings', readings.length],
    ['billing', 'Billing history', bills.length],
    ['statement', 'Statement', ledger.length],
    ['consumption', 'Consumption', null],
  ];
  const tab = TABS.some(([key]) => key === query.tab) ? query.tab : DEFAULT_TAB;

  // Account number, zone and category already appear above as the heading, the
  // address line and a pill, so they are not repeated here.
  const tags = [
    ['Meter', consumer.is_metered ? consumer.meter_no || 'not fitted' : 'unmetered'],
    ['Phone', consumer.phone || '—'],
    ['Connected', consumer.connected_at ? fullDate(consumer.connected_at) : '—'],
    ['Registered', consumer.created_at ? fullDate(consumer.created_at) : '—'],
    ['Average use', averageUsage === null ? '—' : `${averageUsage} m³/mo`],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2 text-[11.5px] text-muted">
        <Link href="/dashboard/consumers" className="hover:text-brand-600">
          Consumer registry
        </Link>
        <span className="text-[#B6C2C0]">/</span>
        <span className="font-mono text-muted-deep">{consumer.account_no}</span>
      </div>

      {/* ---------- identity + balance ---------- */}
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1fr_320px]">
        <div className={`${CARD} p-4 sm:p-4.5`}>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[11.5px] text-brand-600">{consumer.account_no}</div>
              <h2 className="mt-1 text-[19px] font-semibold tracking-[-.01em]">{consumer.name}</h2>
              <div className="mt-1 text-[12.5px] text-muted">
                {consumer.address || 'No address on file'} · {consumer.zone?.name} Zone
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.75">
                <span
                  className={`rounded-full px-2.25 py-0.75 text-[10.5px] font-semibold ${STATUS_PILL[consumer.status]}`}
                >
                  {consumer.status[0].toUpperCase() + consumer.status.slice(1)}
                </span>
                <span className="rounded-full border border-line bg-[#F1F5F4] px-2 py-0.75 text-[11px] text-muted-deep">
                  {CATEGORY_LABELS[consumer.category]} ·{' '}
                  {consumer.is_metered ? 'metered' : 'flat rate'}
                </span>
              </div>
            </div>

            {canManage ? (
              <div className="ml-auto">
                <ConsumerForm
                  zones={zones.map((z) => ({ id: z.id, name: z.name }))}
                  flatRates={flatRates}
                  consumer={{
                    id: consumer.id,
                    name: consumer.name,
                    phone: consumer.phone,
                    address: consumer.address,
                    zone_id: consumer.zone_id,
                    category: consumer.category,
                    is_metered: consumer.is_metered,
                    meter_no: consumer.meter_no,
                    status: consumer.status,
                    connected_at: consumer.connected_at,
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-[#F7FAF9] px-2.25 py-1 text-[11px]"
              >
                <span className="text-muted">{key}</span>
                <span className="font-mono font-semibold text-muted-deep">{value}</span>
              </span>
            ))}
          </div>
        </div>

        <div className={`${CARD} flex flex-col p-4 sm:p-4.5`}>
          <div className={LABEL}>Balance</div>
          <div
            className={`mt-1.5 font-mono text-[30px] font-semibold tracking-[-.02em] ${
              consumer.balance > 0 ? 'text-bad-fg' : ''
            }`}
          >
            {consumer.balance > 0 ? ugx(consumer.balance) : 'Nil'}
          </div>
          <div className="mt-1 text-[11.5px] text-muted">
            {consumer.balance > 0
              ? 'UGX outstanding'
              : consumer.balance < 0
                ? `UGX ${ugx(Math.abs(consumer.balance))} in credit`
                : 'Nothing outstanding'}
          </div>

          <div className="mt-3.5 flex gap-3 border-t border-line-soft pt-3">
            <div>
              <div className="text-[10.5px] text-muted">Billed to date</div>
              <div className="mt-0.75 font-mono text-[13px] font-semibold">{ugx(billedTotal)}</div>
            </div>
            <div>
              <div className="text-[10.5px] text-muted">Paid to date</div>
              <div className="mt-0.75 font-mono text-[13px] font-semibold">{ugx(paidTotal)}</div>
            </div>
          </div>

          {openCycle && canManage ? (
            <div className="mt-4">
              <BillNow
                consumer={{ id: consumer.id, account_no: consumer.account_no }}
                cycle={{ id: openCycle.id, period: openCycle.period }}
                blockedReason={readyToBill?.reason ?? null}
                alreadyBilled={billedThisCycle}
              />
            </div>
          ) : null}

          {canPay ? (
            <div className="mt-4">
              <RecordPayment
                consumer={{
                  id: consumer.id,
                  account_no: consumer.account_no,
                  name: consumer.name,
                  balance: consumer.balance,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* ---------- tabs ---------- */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line">
        {TABS.map(([key, label, count]) => (
          <Link
            key={key}
            href={`/dashboard/consumers/${consumer.account_no}${key === DEFAULT_TAB ? '' : `?tab=${key}`}`}
            aria-current={tab === key ? 'page' : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] transition-colors ${
              tab === key
                ? 'border-brand-600 font-medium text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
            {count === null ? null : (
              <span
                className={`rounded-full px-1.5 py-px font-mono text-[10.5px] ${
                  tab === key ? 'bg-brand-100 text-brand-600' : 'bg-[#F1F5F4] text-muted'
                }`}
              >
                {count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {tab === 'readings' ? (
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[320px_1fr]">
        <CaptureReading
          consumer={{
            id: consumer.id,
            account_no: consumer.account_no,
            is_metered: consumer.is_metered,
            meter_no: consumer.meter_no,
            category: consumer.category,
          }}
          cycle={openCycle ? { id: openCycle.id, period: openCycle.period } : null}
          previousValue={previousValue}
          history={history}
          existing={
            existingThisCycle
              ? {
                  current_value: existingThisCycle.current_value,
                  usage_m3: existingThisCycle.usage_m3,
                  flag: existingThisCycle.flag,
                  status: existingThisCycle.status,
                }
              : null
          }
          flatRate={flatRates[consumer.category] ?? 0}
          canCapture={canCapture}
        />

        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-2.5 border-b border-line-soft px-4.5 py-3.5">
            <div className={HEAD}>Reading history</div>
            <div className={`${SUB} ml-auto`}>{readings.length} captured</div>
          </div>

          {readings.length === 0 ? (
            <div className="px-4.5 py-10 text-center text-[12.5px] text-muted">
              {consumer.is_metered ? 'No readings yet.' : 'Unmetered connection — nothing to read.'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[80px_78px_78px_70px_1fr] border-b border-line-soft bg-[#F7FAF9] px-4.5 py-2.25 text-[10.5px] font-semibold tracking-[.06em] text-muted uppercase">
                <div>Cycle</div>
                <div className="text-right">Prev</div>
                <div className="text-right">Current</div>
                <div className="text-right">Usage</div>
                <div className="pl-4">Flag</div>
              </div>
              {readings.map((reading) => (
                <div
                  key={reading.id}
                  className={`grid grid-cols-[80px_78px_78px_70px_1fr] items-center border-b border-line-faint px-4.5 py-2.25 ${
                    reading.status === 'pending' ? 'bg-[#FDFBF6]' : ''
                  }`}
                >
                  <div className="font-mono text-xs text-muted-deep">{reading.cycle?.period}</div>
                  <div className="text-right font-mono text-xs text-muted-deep">
                    {reading.previous_value}
                  </div>
                  <div className="text-right font-mono text-xs">{reading.current_value ?? '—'}</div>
                  <div className="text-right font-mono text-xs font-semibold">
                    {reading.usage_m3 ?? '—'}
                  </div>
                  <div className="flex items-center gap-2 pl-4">
                    <span
                      className={`rounded-full px-2 py-0.75 text-[10.5px] font-semibold ${FLAG_PILL[reading.flag]}`}
                    >
                      {FLAG_LABELS[reading.flag]}
                    </span>
                    <span className="truncate text-[11px] text-muted">
                      {reading.status === 'approved'
                        ? shortDate(reading.read_at)
                        : reading.status === 'pending'
                          ? 'awaiting review'
                          : 'skipped'}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      ) : null}

      {tab === 'billing' ? (
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line-soft px-4.5 py-3.5">
          <div className={HEAD}>Billing history</div>
          <div className={SUB}>
            {bills.length
              ? `${bills.length} invoice${bills.length === 1 ? '' : 's'} · click one to see how it was worked out`
              : 'No bills raised yet'}
          </div>
        </div>

        {bills.length === 0 ? (
          <div className="px-4.5 py-10 text-center text-[12.5px] text-muted">
            This account has not been billed. Bills appear here after a billing run.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-215">
              <div className="grid grid-cols-[140px_88px_80px_1fr_1fr_1fr_110px_96px] border-b border-line-soft bg-[#F7FAF9] px-4.5 py-2.25 text-[10.5px] font-semibold tracking-[.06em] text-muted uppercase">
                <div>Invoice</div>
                <div>Cycle</div>
                <div className="text-right">Usage</div>
                <div className="text-right">Water</div>
                <div className="text-right">Fixed + tax</div>
                <div className="text-right">Brought fwd</div>
                <div className="text-right">Total due</div>
                <div className="text-right">Status</div>
              </div>

              {bills.map((bill) => {
                const open = expandedBill?.id === bill.id;
                return (
                  <div key={bill.id}>
                    <Link
                      href={
                        open
                          ? `/dashboard/consumers/${consumer.account_no}?tab=billing`
                          : `/dashboard/consumers/${consumer.account_no}?tab=billing&bill=${bill.id}`
                      }
                      className={`grid grid-cols-[140px_88px_80px_1fr_1fr_1fr_110px_96px] items-center border-b border-line-faint px-4.5 py-2.5 hover:bg-[#F7FAF9] ${
                        open ? 'bg-brand-50' : ''
                      }`}
                    >
                      <div className="font-mono text-xs text-brand-600">{bill.invoice_no}</div>
                      <div className="text-xs text-muted-deep">{bill.cycle?.period}</div>
                      <div className="text-right font-mono text-xs">
                        {bill.usage_m3 === null ? 'flat' : `${bill.usage_m3} m³`}
                      </div>
                      <div className="text-right font-mono text-xs">{ugx(bill.consumption_amount)}</div>
                      <div className="text-right font-mono text-xs text-muted-deep">
                        {ugx(bill.fixed_charge + bill.levy_amount)}
                      </div>
                      <div className="text-right font-mono text-xs text-muted-deep">
                        {bill.brought_forward ? ugx(bill.brought_forward) : '—'}
                      </div>
                      <div className="text-right font-mono text-xs font-semibold">
                        {ugx(bill.total_due)}
                      </div>
                      <div className="text-right">
                        <span
                          className={`rounded-full px-2.25 py-0.75 text-[10.5px] font-semibold ${BILL_STATUS_PILL[bill.status]}`}
                        >
                          {BILL_STATUS_LABELS[bill.status]}
                        </span>
                      </div>
                    </Link>

                    {open ? (
                      <div className="border-b border-line-faint bg-[#F7FAF9] px-4.5 py-3.5">
                        <div className={LABEL}>How {bill.invoice_no} was worked out</div>
                        <div className="mt-2 max-w-140">
                          {[...(bill.lines || [])]
                            .sort((a, b) => a.position - b.position)
                            .map((line) => (
                              <div
                                key={line.id}
                                className="flex gap-3 border-b border-line-soft py-1.75"
                              >
                                <div className="flex-1 text-[12.5px]">{line.description}</div>
                                <div className="font-mono text-[11.5px] text-muted">{line.detail}</div>
                                <div className="w-24 text-right font-mono text-[12.5px]">
                                  {ugx(line.amount)}
                                </div>
                              </div>
                            ))}
                          <div className="flex gap-3 pt-2">
                            <div className="flex-1 text-[12.5px] font-semibold">Total due</div>
                            <div className="w-24 text-right font-mono text-[13px] font-semibold">
                              {ugx(bill.total_due)}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <span className="text-[11px] text-muted">
                              Issued {fullDate(bill.issued_at)} · due {fullDate(bill.due_date)}
                            </span>
                            <Link
                              href={`/dashboard/bills/${bill.invoice_no}`}
                              className="rounded-md border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-muted-deep hover:border-brand-500 hover:text-brand-600"
                            >
                              Open printable bill →
                            </Link>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      ) : null}

      {tab === 'statement' ? (
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center gap-2.5 border-b border-line-soft px-4.5 py-3.5">
          <div className={HEAD}>Statement</div>
          <div className={`${SUB} ml-auto`}>Newest first</div>
        </div>

          {ledger.length === 0 ? (
          <div className="px-4.5 py-10 text-center text-[12.5px] text-muted">
            Nothing has been posted to this account yet.
          </div>
        ) : (
          ledger.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 border-b border-line-faint px-4.5 py-2.5"
              >
                <div className="w-13 flex-none font-mono text-[11px] text-muted">
                  {shortDate(entry.occurred_at)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px]">{entry.note || entry.type}</div>
                  <div className="text-[10.5px] text-muted capitalize">{entry.type}</div>
                </div>
                <div
                  className={`font-mono text-[12.5px] font-semibold ${
                    entry.amount < 0 ? 'text-ok-fg' : ''
                  }`}
                >
                  {entry.amount < 0 ? '−' : '+'}
                  {ugx(Math.abs(entry.amount))}
                </div>
              </div>
          ))
        )}
      </div>

      ) : null}

      {tab === 'consumption' ? (
      <ConsumptionChart
        points={chart.map((reading) => ({
          period: reading.cycle?.period,
          label: periodLabel(reading.cycle?.period).split(' ')[0],
          usage: reading.usage_m3,
        }))}
        average={averageUsage}
      />

      ) : null}

      {tariff ? (
        <div className="text-[11px] text-muted">
          Billed on the {CATEGORY_LABELS[consumer.category].toLowerCase()} tariff effective{' '}
          {fullDate(tariff.effective_from)}
          {consumer.is_metered
            ? ` · ${(tariff.bands || []).length} band${(tariff.bands || []).length === 1 ? '' : 's'}, fixed charge UGX ${ugx(tariff.fixed_charge)}, levy ${tariff.levy_pct}%`
            : ` · flat rate UGX ${ugx(tariff.flat_rate ?? 0)} per month`}
          .
        </div>
      ) : null}
    </div>
  );
}
