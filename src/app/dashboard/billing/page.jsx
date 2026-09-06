import { Op } from 'sequelize';
import {
  BillingCycle,
  Bill,
  BillLine,
  Consumer,
  Zone,
  Tariff,
  TariffBand,
  TariffSchedule,
} from '@/models';
import { billingPreflight } from '@/lib/billing-run';
import { CATEGORY_LABELS } from '@/lib/billing';
import { ugx, periodLabel, fullDate, BILL_STATUS_PILL, BILL_STATUS_LABELS } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import CycleActions from './_components/cycle-actions';

const CARD = 'bg-white border border-line rounded-[11px]';
const HEAD = 'text-[13.5px] font-semibold';
const SUB = 'text-[11.5px] text-muted';

function bandLabel(band, index) {
  if (band.max_m3 === null) return band.min_m3 === 0 ? 'All volume' : `Above ${band.min_m3} m³`;
  return `${index === 0 ? 0 : band.min_m3 + 1} – ${band.max_m3} m³`;
}

export default async function BillingPage({ searchParams }) {
  const params = await searchParams;
  const settings = await getSettings();

  const cycles = await BillingCycle.findAll({ order: [['period', 'DESC']] });
  const cycle =
    cycles.find((c) => String(c.id) === params.cycle) ||
    cycles.find((c) => ['open', 'locked'].includes(c.status)) ||
    cycles[0] ||
    null;

  // Show the prices this cycle actually bills on, not every schedule ever
  // published — otherwise the table would list each category several times.
  const schedule = cycle?.tariff_schedule_id
    ? await TariffSchedule.findByPk(cycle.tariff_schedule_id)
    : null;

  const tariffs = await Tariff.findAll({
    where: schedule ? { schedule_id: schedule.id } : {},
    include: [{ model: TariffBand, as: 'bands' }],
    order: [
      ['category', 'ASC'],
      ['effective_from', 'DESC'],
    ],
    ...(schedule ? {} : { limit: 4 }),
  });

  let preflight = null;
  if (cycle) {
    const result = await billingPreflight(cycle);
    preflight = {
      billable: result.billable.length,
      alreadyBilled: result.alreadyBilled,
      blockedTotal: result.blocked.length,
      blocked: result.blocked.slice(0, 8).map(({ consumer, reason }) => ({
        account_no: consumer.account_no,
        name: consumer.name,
        reason,
      })),
    };
  }

  const latestBill = cycle
    ? await Bill.findOne({
        where: { billing_cycle_id: cycle.id },
        include: [
          { model: BillLine, as: 'lines' },
          { model: Consumer, as: 'consumer', include: [{ model: Zone, as: 'zone' }] },
        ],
        order: [['total_due', 'DESC']],
      })
    : null;

  const fallbackBill = latestBill
    ? null
    : await Bill.findOne({
        include: [
          { model: BillLine, as: 'lines' },
          { model: Consumer, as: 'consumer', include: [{ model: Zone, as: 'zone' }] },
        ],
        order: [['issued_at', 'DESC']],
      });

  const bill = latestBill || fallbackBill;
  const billedTotals = cycle
    ? await Bill.findAll({
        where: { billing_cycle_id: cycle.id, status: { [Op.ne]: 'void' } },
        attributes: ['total_due'],
      })
    : [];
  const billedSum = billedTotals.reduce((sum, b) => sum + b.total_due, 0);

  const STEPS = [
    ['Readings captured', 'Meters entered or imported', ['open', 'locked', 'billed', 'closed']],
    ['Cycle locked', 'Readings frozen for billing', ['locked', 'billed', 'closed']],
    ['Bills generated', 'Tariff applied, ledger posted', ['billed', 'closed']],
    ['Cycle closed', 'Archived, no further changes', ['closed']],
  ];

  return (
    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1fr_400px]">
      <div className="flex flex-col gap-3.5">
        <div className={`${CARD} p-4.5`}>
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <div className="text-sm font-semibold">
                Billing run · {cycle ? periodLabel(cycle.period) : 'no cycle'}
              </div>
              <div className="mt-0.75 text-xs text-muted">
                Metered consumers bill on approved readings; unmetered accounts bill at the
                category flat rate.
              </div>
              {cycle?.unit_cost !== null && cycle?.unit_cost !== undefined ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-warn-bg px-2.5 py-1.5 text-[11.5px] text-warn-fg">
                  <span className="font-semibold">Cycle pricing in force:</span>
                  UGX {ugx(cycle.unit_cost)} per m³ flat — the tariff bands below do not apply to{' '}
                  {cycle.period}.
                </div>
              ) : null}
            </div>
            <div className="ml-auto">
              <CycleActions
                cycle={cycle ? { id: cycle.id, period: cycle.period, status: cycle.status } : null}
                cycles={cycles.map((c) => ({ id: c.id, period: c.period, status: c.status }))}
                preflight={preflight}
              />
            </div>
          </div>

          <div className="mt-5 flex items-start">
            {STEPS.map(([title, sub, activeFor], index) => {
              const done = cycle ? activeFor.includes(cycle.status) : false;
              const isNow =
                cycle && !done && STEPS.findIndex(([, , a]) => !a.includes(cycle.status)) === index;
              return (
                <div key={title} className="flex flex-1 flex-col gap-2.25">
                  <div className="flex items-center">
                    <div
                      className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-semibold ${
                        done
                          ? 'bg-brand-600 text-white'
                          : isNow
                            ? 'border-2 border-brand-600 bg-white text-brand-600'
                            : 'bg-line-soft text-[#9AA9A7]'
                      }`}
                    >
                      {done ? '✓' : index + 1}
                    </div>
                    {index === STEPS.length - 1 ? null : (
                      <div className={`h-0.5 flex-1 ${done ? 'bg-brand-600' : 'bg-line'}`} />
                    )}
                  </div>
                  <div className="pr-3.5">
                    <div className="text-[12.5px] font-medium">{title}</div>
                    <div className="mt-0.5 text-[11.5px] text-muted">{sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {preflight ? (
            <div className="mt-5 grid grid-cols-3 gap-2.5 border-t border-line-soft pt-4">
              {[
                ['Ready to bill', preflight.billable, 'ok'],
                ['Already billed', preflight.alreadyBilled, 'flat'],
                ['Will be skipped', preflight.blockedTotal, preflight.blockedTotal ? 'warn' : 'flat'],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-lg border border-line-soft bg-[#F7FAF9] px-3 py-2.5">
                  <div className="text-[10.5px] text-muted">{label}</div>
                  <div
                    className={`mt-0.75 font-mono text-[17px] font-semibold ${
                      tone === 'warn' ? 'text-warn-fg' : tone === 'ok' ? 'text-brand-600' : ''
                    }`}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {preflight?.blocked.length ? (
            <div className="mt-3 rounded-lg border border-warn-dot/40 bg-warn-bg/50 px-3 py-2.5">
              <div className="text-[11.5px] font-semibold text-warn-fg">
                These accounts will not be billed
              </div>
              <div className="mt-1.5 flex flex-col gap-1">
                {preflight.blocked.map((row) => (
                  <div key={row.account_no} className="flex gap-2 text-[11.5px]">
                    <span className="w-18 flex-none font-mono text-brand-600">{row.account_no}</span>
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    <span className="flex-none text-muted-deep">{row.reason}</span>
                  </div>
                ))}
                {preflight.blockedTotal > preflight.blocked.length ? (
                  <div className="text-[11px] text-muted">
                    …and {preflight.blockedTotal - preflight.blocked.length} more
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {billedSum > 0 ? (
            <div className="mt-3 text-[11.5px] text-muted">
              UGX {ugx(billedSum)} billed in this cycle across {billedTotals.length} invoices.
            </div>
          ) : null}
        </div>

        <div className={`${CARD} p-4.5`}>
          <div className={HEAD}>Tariff schedule</div>
          <div className={`${SUB} mt-0.75`}>
            {schedule
              ? `${schedule.name}${schedule.effective_from ? ` · effective ${fullDate(schedule.effective_from)}` : ''}`
              : 'No schedule attached to this cycle'}
          </div>

          <div className="mt-3.5 grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-line-soft pt-2.5 pb-2 text-[10.5px] font-semibold tracking-[.06em] text-muted uppercase">
            <div>Category</div>
            <div>Band</div>
            <div className="text-right">UGX / m³</div>
            <div className="text-right">Monthly fixed</div>
          </div>

          {tariffs.flatMap((tariff) => {
            const bands = [...(tariff.bands || [])].sort((a, b) => a.min_m3 - b.min_m3);
            if (!bands.length) {
              return (
                <div
                  key={`${tariff.id}-flat`}
                  className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-line-faint py-2.5"
                >
                  <div className="text-[12.5px]">{CATEGORY_LABELS[tariff.category]}</div>
                  <div className="font-mono text-xs text-muted-deep">Flat</div>
                  <div className="text-right font-mono text-[12.5px] font-semibold">—</div>
                  <div className="text-right font-mono text-xs text-muted-deep">
                    {ugx(tariff.flat_rate ?? tariff.fixed_charge)}
                  </div>
                </div>
              );
            }
            return bands.map((band, index) => (
              <div
                key={band.id}
                className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-line-faint py-2.5"
              >
                <div className="text-[12.5px]">
                  {index === 0 ? CATEGORY_LABELS[tariff.category] : ''}
                </div>
                <div className="font-mono text-xs text-muted-deep">{bandLabel(band, index)}</div>
                <div className="text-right font-mono text-[12.5px] font-semibold">
                  {ugx(band.rate_per_m3)}
                </div>
                <div className="text-right font-mono text-xs text-muted-deep">
                  {index === 0 ? ugx(tariff.fixed_charge) : ''}
                </div>
              </div>
            ));
          })}

          <div className="mt-3 text-[11px] text-muted">
            Bands are progressive: each m³ is charged at the rate for the band it falls in. A
            tax of {tariffs[0]?.levy_pct ?? 0}% applies to consumption
            plus the fixed charge.
          </div>
        </div>
      </div>

      {bill ? (
        <div className={`${CARD} self-start px-6 py-5.5`}>
          <div className="flex items-start">
            <div>
              <div className="text-[11px] font-semibold tracking-widest text-muted uppercase">
                Water bill
              </div>
              <div className="mt-1 text-[15px] font-semibold">{settings.organisation_name}</div>
            </div>
            <div className="ml-auto text-right font-mono text-[11.5px] text-muted">
              <div>{bill.invoice_no}</div>
              <div>Due {fullDate(bill.due_date)}</div>
            </div>
          </div>

          <div className="mt-4 border-t border-line-soft pt-3.5 text-[12.5px] leading-relaxed">
            <div className="font-semibold">{bill.consumer?.name}</div>
            <div className="text-muted">
              {bill.consumer?.address || 'No address on file'}
              {bill.consumer?.zone ? `, ${bill.consumer.zone.name} Zone` : ''}
              <br />
              Acct {bill.consumer?.account_no}
              {bill.consumer?.meter_no ? ` · Meter ${bill.consumer.meter_no}` : ' · Unmetered'}
            </div>
          </div>

          <div className="mt-4 border-t border-line-soft">
            {[...(bill.lines || [])]
              .sort((a, b) => a.position - b.position)
              .map((line) => (
                <div key={line.id} className="flex gap-3 border-b border-line-faint py-2.25">
                  <div className="flex-1 text-[12.5px]">{line.description}</div>
                  <div className="font-mono text-[11.5px] text-muted">{line.detail}</div>
                  <div className="w-20.5 text-right font-mono text-[12.5px]">{ugx(line.amount)}</div>
                </div>
              ))}
          </div>

          <div className="mt-3.5 flex items-baseline">
            <div className="text-[13px] font-semibold">Total due</div>
            <div className="ml-auto font-mono text-[22px] font-semibold whitespace-nowrap">
              UGX {ugx(bill.total_due)}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2.25 py-0.75 text-[10.5px] font-semibold ${BILL_STATUS_PILL[bill.status]}`}
            >
              {BILL_STATUS_LABELS[bill.status]}
            </span>
            <span className="text-[11px] text-muted">
              {bill.usage_m3 === null ? 'Flat rate' : `${bill.usage_m3} m³ this cycle`}
            </span>
          </div>

          <div className="mt-4 rounded-[9px] border border-brand-200 bg-brand-50 px-3.25 py-3">
            <div className="text-[11px] font-semibold tracking-[.06em] text-brand-600 uppercase">
              Pay by mobile money
            </div>
            <div className="mt-1.5 font-mono text-[12.5px] leading-loose">
              {settings.pay_phone || 'Mobile money'}
              <br />
              Ref {bill.consumer?.account_no}
            </div>
          </div>

          <div className="mt-3.5 text-[11px] leading-normal text-[#9AA9A7]">
            Disconnection notice is issued 7 days after the due date. Reconnection fee UGX 20,000.
          </div>
        </div>
      ) : (
        <div className={`${CARD} self-start px-6 py-10 text-center`}>
          <div className="text-[13.5px] font-semibold">No bills yet</div>
          <div className="mt-1.5 text-[12px] text-muted">
            Run billing on a locked cycle and the newest invoice appears here.
          </div>
        </div>
      )}
    </div>
  );
}
