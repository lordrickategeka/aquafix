import { Op, QueryTypes } from 'sequelize';
import sequelize from '@/lib/db';
import { BillingCycle, Consumer, TariffSchedule } from '@/models';
import { getSessionUser } from '@/lib/auth';
import { userHasPermission } from '@/lib/rbac';
import { ugx, fullDate, periodLabel } from '@/lib/format';
import { CYCLE_STATUS_LABELS, CYCLE_STATUS_PILL } from '@/lib/cycles';
import Pagination from '@/components/pagination';
import CycleForm from './_components/cycle-form';
import CycleRowActions from './_components/cycle-row-actions';

const CARD = 'bg-white border border-line rounded-[11px]';
const PAGE_SIZE = 12;

/* Per cycle: how much of the route was read, what is still unresolved, and what
   the run produced. Used for both the paged table and the open-cycle summary. */
function cycleStatsSql({ where = '', limit = '' }) {
  return `SELECT
       c.id, c.period, c.status, c.reading_start, c.reading_end, c.due_date,
       c.note, c.locked_at, c.billed_at,
       c.unit_cost, c.fixed_charge, c.levy_pct, c.tariff_schedule_id,
       (SELECT s.name FROM tariff_schedules s WHERE s.id = c.tariff_schedule_id) AS schedule_name,
       COALESCE(r.captured, 0) AS captured,
       COALESCE(r.pending, 0)  AS pending,
       COALESCE(b.bills, 0)    AS bills,
       COALESCE(b.charged, 0)  AS charged
     FROM billing_cycles c
     LEFT JOIN (
       SELECT billing_cycle_id,
              SUM(current_value IS NOT NULL) AS captured,
              SUM(status = 'pending')        AS pending
       FROM readings GROUP BY billing_cycle_id
     ) r ON r.billing_cycle_id = c.id
     LEFT JOIN (
       SELECT billing_cycle_id,
              COUNT(*) AS bills,
              SUM(total_due - brought_forward) AS charged
       FROM bills WHERE status <> 'void' GROUP BY billing_cycle_id
     ) b ON b.billing_cycle_id = c.id
     ${where}
     ORDER BY c.period DESC
     ${limit}`;
}

export default async function CyclesPage({ searchParams }) {
  const params = await searchParams;

  const session = await getSessionUser();
  const canManage = await userHasPermission(session.id, 'run-billing');

  const total = await BillingCycle.count();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(Number(params.page) || 1, 1), pageCount);
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, openRows, newest, meters, schedules] = await Promise.all([
    sequelize.query(cycleStatsSql({ limit: 'LIMIT :limit OFFSET :offset' }), {
      type: QueryTypes.SELECT,
      replacements: { limit: PAGE_SIZE, offset },
    }),
    // The open cycle heads its own card, so it must not depend on which page
    // of the table you happen to be looking at.
    sequelize.query(cycleStatsSql({ where: "WHERE c.status = 'open'", limit: 'LIMIT 1' }), {
      type: QueryTypes.SELECT,
    }),
    BillingCycle.findOne({ order: [['period', 'DESC']], attributes: ['period'] }),
    Consumer.count({ where: { is_metered: true, status: { [Op.in]: ['active', 'new'] } } }),
    TariffSchedule.findAll({ order: [['effective_from', 'DESC']], attributes: ['id', 'name'] }),
  ]);

  const openCycle = openRows[0] ?? null;

  // Next period after the newest cycle, as the default for a new one.
  const suggested = (() => {
    if (!newest) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const [year, month] = newest.period.split('-').map(Number);
    const next = month === 12 ? [year + 1, 1] : [year, month + 1];
    return `${next[0]}-${String(next[1]).padStart(2, '0')}`;
  })();

  const firstOnPage = total === 0 ? 0 : offset + 1;
  const lastOnPage = offset + rows.length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className={`${CARD} flex flex-wrap items-center gap-3 px-4.5 py-3.5`}>
        <div>
          <div className="text-[13.5px] font-semibold">Reading cycles</div>
          <div className="mt-0.75 text-[11.5px] text-muted">
            A cycle is the period meter readers collect in. Every reading belongs to one, and only
            one cycle is open at a time.
          </div>
        </div>

        {canManage ? (
          <div className="ml-auto">
            <CycleForm
              suggested={suggested}
              blockedBy={openCycle?.period ?? null}
              schedules={schedules.map((sch) => ({ id: sch.id, name: sch.name }))}
              previousPeriod={newest?.period ?? null}
            />
          </div>
        ) : null}
      </div>

      {openCycle ? (
        <div className={`${CARD} px-4.5 py-4`}>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <div className="text-[13.5px] font-semibold">
              Collecting now · {periodLabel(openCycle.period)}
            </div>
            <div className="text-[11.5px] text-muted">
              {openCycle.reading_start || openCycle.reading_end
                ? `Readings ${fullDate(openCycle.reading_start)} – ${fullDate(openCycle.reading_end)}`
                : 'No reading window set'}
              {openCycle.due_date ? ` · bills due ${fullDate(openCycle.due_date)}` : ''}
              {openCycle.unit_cost === null
                ? ' · priced on tariff bands'
                : ` · flat ${ugx(Number(openCycle.unit_cost))}/m³ this cycle`}
            </div>
          </div>

          <div className="mt-3 flex h-2.25 overflow-hidden rounded-[5px] bg-line-soft">
            <div
              className="bg-brand-500"
              style={{
                width: `${Math.min(100, (Number(openCycle.captured) / Math.max(meters, 1)) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[11.5px] text-muted">
            <span>
              <span className="font-mono font-semibold text-ink">{openCycle.captured}</span> of{' '}
              {meters} meters read
            </span>
            {Number(openCycle.pending) > 0 ? (
              <span className="text-warn-fg">
                <span className="font-mono font-semibold">{openCycle.pending}</span> awaiting review
              </span>
            ) : (
              <span className="text-ok-fg">No exceptions outstanding</span>
            )}
          </div>
        </div>
      ) : (
        <div className={`${CARD} px-4.5 py-6 text-center`}>
          <div className="text-[13px] font-semibold">No cycle is open</div>
          <div className="mt-1 text-[12px] text-muted">
            Meter readers cannot capture anything until a cycle is open.
          </div>
        </div>
      )}

      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center gap-2.5 border-b border-line-soft px-4.5 py-3.5">
          <div className="text-[13.5px] font-semibold">All cycles</div>
          <div className="ml-auto font-mono text-[11.5px] text-muted">
            {total === 0 ? 'None yet' : `${firstOnPage}–${lastOnPage} of ${total} · newest first`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-245">
            <div className="grid grid-cols-[92px_142px_162px_100px_120px_104px_100px_1fr] border-b border-line-soft bg-[#F7FAF9] px-4.5 py-2.25 text-[10.5px] font-semibold tracking-[.06em] text-muted uppercase">
              <div>Period</div>
              <div>Status</div>
              <div>Reading window</div>
              <div>Bills due</div>
              <div>Pricing</div>
              <div className="text-right">Readings</div>
              <div className="text-right">Billed</div>
              <div className="pl-4">Actions</div>
            </div>

            {rows.length === 0 ? (
              <div className="px-4.5 py-10 text-center text-[12.5px] text-muted">
                No cycles yet. Create one before readers go out.
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[92px_142px_162px_100px_120px_104px_100px_1fr] items-center border-b border-line-faint px-4.5 py-2.75"
                >
                  <div className="font-mono text-[12.5px] font-semibold">{row.period}</div>

                  <div>
                    <span
                      className={`rounded-full px-2.25 py-0.75 text-[10.5px] font-semibold ${CYCLE_STATUS_PILL[row.status]}`}
                    >
                      {CYCLE_STATUS_LABELS[row.status]}
                    </span>
                  </div>

                  <div className="font-mono text-[11.5px] text-muted-deep">
                    {row.reading_start || row.reading_end
                      ? `${fullDate(row.reading_start)} – ${fullDate(row.reading_end)}`
                      : '—'}
                  </div>

                  <div className="font-mono text-[11.5px] text-muted-deep">
                    {row.due_date ? fullDate(row.due_date) : '—'}
                  </div>

                  <div className="text-[11px]">
                    {row.unit_cost === null ? (
                      <span className="text-muted" title={row.schedule_name || 'No schedule'}>
                        {row.schedule_name || 'No schedule'}
                      </span>
                    ) : (
                      <span
                        className="font-mono font-semibold text-warn-fg"
                        title="Flat rate for this cycle — tariff bands ignored"
                      >
                        {ugx(Number(row.unit_cost))}/m³
                      </span>
                    )}
                  </div>

                  <div className="text-right font-mono text-[11.5px]">
                    {row.captured}
                    {Number(row.pending) > 0 ? (
                      <span className="ml-1.5 text-warn-fg">({row.pending}?)</span>
                    ) : null}
                  </div>

                  <div className="text-right font-mono text-[11.5px]">
                    {Number(row.bills) > 0 ? (
                      <span title={`${row.bills} invoices`}>{ugx(Number(row.charged))}</span>
                    ) : (
                      '—'
                    )}
                  </div>

                  <div className="pl-4">
                    {canManage ? (
                      <CycleRowActions
                        schedules={schedules.map((sch) => ({ id: sch.id, name: sch.name }))}
                        cycle={{
                          id: row.id,
                          period: row.period,
                          status: row.status,
                          reading_start: row.reading_start,
                          reading_end: row.reading_end,
                          due_date: row.due_date,
                          note: row.note,
                          unit_cost: row.unit_cost === null ? null : Number(row.unit_cost),
                          fixed_charge:
                            row.fixed_charge === null ? null : Number(row.fixed_charge),
                          levy_pct: row.levy_pct === null ? null : Number(row.levy_pct),
                          tariff_schedule_id: row.tariff_schedule_id,
                          pending: Number(row.pending),
                        }}
                      />
                    ) : (
                      <span className="text-[11px] text-muted">{row.note || ''}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <Pagination
          page={page}
          pageCount={pageCount}
          linkFor={(n) => ({
            pathname: '/dashboard/cycles',
            query: n > 1 ? { page: n } : {},
          })}
        />
      </div>

      <div className="text-[11px] text-muted">
        Locking a cycle freezes its readings so the billing run has a stable set to price. Only one
        cycle can be open for collection at a time.
      </div>
    </div>
  );
}
