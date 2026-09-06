import Link from 'next/link';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '@/lib/db';
import { Consumer, Zone, Tariff } from '@/models';
import { ugx, fullDate, STATUS_PILL, CATEGORY_SHORT } from '@/lib/format';
import Pagination from '@/components/pagination';
import ConsumerForm from './_components/consumer-form';

const CARD = 'bg-white border border-line rounded-[11px]';
// Account · Consumer+address · Phone · Zone · Category · Meter · Connected · Balance · Arrears · Status
const COLS =
  'grid-cols-[84px_1fr_96px] sm:grid-cols-[92px_1fr_96px_100px] ' +
  'lg:grid-cols-[100px_1.4fr_92px_96px_104px_92px] ' +
  'xl:grid-cols-[100px_1.5fr_108px_92px_100px_108px_104px_96px_104px_92px]';
const PAGE_SIZE = 10;

const FILTERS = [
  ['all', 'All'],
  ['metered', 'Metered'],
  ['flat', 'Flat rate'],
  ['arrears', 'In arrears'],
  ['disconnected', 'Disconnected'],
];

function filterWhere(filter) {
  switch (filter) {
    case 'metered':
      return { is_metered: true };
    case 'flat':
      return { is_metered: false };
    case 'arrears':
      return { balance: { [Op.gt]: 0 } };
    case 'disconnected':
      return { status: 'disconnected' };
    default:
      return {};
  }
}

export default async function ConsumersPage({ searchParams }) {
  const params = await searchParams;
  const filter = FILTERS.some(([key]) => key === params.metered)
    ? params.metered
    : params.filter || 'all';
  const query = (params.q || '').trim();

  const where = { ...filterWhere(filter) };
  if (query) {
    where[Op.or] = [
      { account_no: { [Op.like]: `%${query}%` } },
      { name: { [Op.like]: `%${query}%` } },
      { meter_no: { [Op.like]: `%${query}%` } },
    ];
  }

  const total = await Consumer.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(Number(params.page) || 1, 1), pageCount);
  const offset = (page - 1) * PAGE_SIZE;

  const [zones, consumers, tariffs] = await Promise.all([
    Zone.findAll({ order: [['name', 'ASC']] }),
    Consumer.findAll({
      where,
      include: [{ model: Zone, as: 'zone', attributes: ['id', 'name'] }],
      // Newest registration first; id breaks ties for rows created in the same
      // second, which is most of them after a bulk import.
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: PAGE_SIZE,
      offset,
    }),
    // Only needed so the "new consumer" form can name the flat rate per category.
    Tariff.findAll({ attributes: ['category', 'flat_rate'], order: [['effective_from', 'DESC']] }),
  ]);

  // Latest revision wins for each category.
  const flatRates = {};
  for (const tariff of tariffs) {
    if (!(tariff.category in flatRates)) flatRates[tariff.category] = tariff.flat_rate ?? 0;
  }

  /* Arrears is the balance that is actually late — an account holding a bill
     that is not due yet owes money but is not in arrears. Taken from the
     oldest unpaid bill, for the rows on this page only. */
  const ids = consumers.map((c) => c.id);
  const overdue = ids.length
    ? await sequelize.query(
        `SELECT b.consumer_id,
                MIN(b.due_date) AS oldest_due,
                DATEDIFF(CURDATE(), MIN(b.due_date)) AS age_days
         FROM bills b
         WHERE b.consumer_id IN (:ids)
           AND b.status IN ('unpaid','part_paid')
           AND b.due_date < CURDATE()
         GROUP BY b.consumer_id`,
        { type: QueryTypes.SELECT, replacements: { ids } },
      )
    : [];

  const overdueBy = Object.fromEntries(
    overdue.map((row) => [row.consumer_id, Number(row.age_days)]),
  );

  // Filter and search always reset to the first page; only paging carries it.
  const link = (extra = {}) => ({
    pathname: '/dashboard/consumers',
    query: {
      ...(query ? { q: query } : {}),
      filter,
      ...extra,
    },
  });

  const firstOnPage = total === 0 ? 0 : offset + 1;
  const lastOnPage = offset + consumers.length;

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
        {FILTERS.map(([key, label]) => (
          <Link
            key={key}
            href={link({ filter: key })}
            className={`rounded-[7px] px-3 py-1.5 text-xs ${
              filter === key
                ? 'bg-brand-700 font-medium text-white'
                : 'border border-line bg-[#F1F5F4] text-muted-deep hover:bg-[#E7EDEC]'
            }`}
          >
            {label}
          </Link>
        ))}

        <form className="ml-auto flex items-center gap-2" action="/dashboard/consumers">
          <input type="hidden" name="filter" value={filter} />
          <input
            name="q"
            defaultValue={query}
            placeholder="Account, name or meter…"
            className="w-52 rounded-[7px] border border-line bg-[#F1F5F4] px-2.75 py-1.5 text-[12.5px] outline-none focus:border-brand-500"
          />
          <button className="rounded-[7px] border border-line bg-[#F1F5F4] px-3 py-1.5 text-xs text-muted-deep hover:bg-[#E7EDEC]">
            Search
          </button>
        </form>
      </div>

      <div className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5">
        <div className="font-mono text-[11.5px] text-muted">
          {total === 0
            ? 'No accounts'
            : `${firstOnPage}–${lastOnPage} of ${ugx(total)} · newest first`}
        </div>
        <div className="ml-auto">
          <ConsumerForm
            zones={zones.map((z) => ({ id: z.id, name: z.name }))}
            flatRates={flatRates}
          />
        </div>
      </div>

      {/* Every field the registration form captures. Wider than the viewport on
          smaller screens, so it scrolls sideways rather than dropping columns. */}
      <div className="overflow-x-auto">
        <div className="min-w-0 xl:min-w-260">
          <div
            className={`grid ${COLS} border-b border-line-soft bg-[#F7FAF9] px-4 py-2.25 text-[10.5px] font-semibold tracking-[.06em] text-muted uppercase`}
          >
            <div>Account</div>
            <div>Consumer</div>
            <div className="hidden xl:block">Phone</div>
            <div className="hidden lg:block">Zone</div>
            <div className="hidden xl:block">Category</div>
            <div className="hidden lg:block">Meter</div>
            <div className="hidden xl:block">Connected</div>
            <div className="text-right">Balance</div>
            <div className="hidden text-right lg:block">Arrears</div>
            <div className="hidden text-right sm:block">Status</div>
          </div>

          {consumers.length === 0 ? (
            <div className="px-4 py-10 text-center text-[12.5px] text-muted">
              No accounts match this filter.
            </div>
          ) : (
            consumers.map((consumer) => (
              <Link
                key={consumer.id}
                href={`/dashboard/consumers/${consumer.account_no}`}
                className={`grid ${COLS} cursor-pointer items-center border-b border-line-faint px-4 py-2.5 hover:bg-[#F7FAF9]`}
              >
                <div className="font-mono text-xs text-brand-600">{consumer.account_no}</div>

                <div className="min-w-0 pr-3">
                  <div className="truncate text-[12.5px]">{consumer.name}</div>
                  <div className="truncate text-[11px] text-muted">
                    {/* Below lg the zone and meter columns are gone, so they
                        ride along here instead of disappearing. */}
                    <span className="lg:hidden">
                      {consumer.zone?.name}
                      {consumer.meter_no ? ` · ${consumer.meter_no}` : ' · unmetered'}
                    </span>
                    <span className="hidden lg:inline">
                      {consumer.address || 'No address on file'}
                    </span>
                  </div>
                </div>

                <div className="hidden font-mono text-[11.5px] text-muted-deep xl:block">
                  {consumer.phone || '—'}
                </div>
                <div className="hidden text-xs text-muted-deep lg:block">{consumer.zone?.name}</div>
                <div className="hidden text-xs text-muted-deep xl:block">
                  {CATEGORY_SHORT[consumer.category]}
                </div>

                <div className="hidden min-w-0 pr-2 lg:block">
                  {consumer.is_metered ? (
                    <div className="truncate font-mono text-[11.5px] text-muted-deep">
                      {consumer.meter_no || '—'}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted">Flat rate</div>
                  )}
                </div>

                <div className="hidden font-mono text-[11.5px] text-muted-deep xl:block">
                  {consumer.connected_at ? fullDate(consumer.connected_at) : '—'}
                </div>

                <div
                  className={`text-right font-mono text-xs ${
                    consumer.balance > 0 ? 'font-semibold text-bad-fg' : 'text-[#9AA9A7]'
                  }`}
                >
                  {consumer.balance > 0 ? ugx(consumer.balance) : '—'}
                </div>

                {/* Owing money is not the same as being late — only a bill
                    past its due date counts as arrears. */}
                <div className="hidden text-right lg:block">
                  {overdueBy[consumer.id] !== undefined && consumer.balance > 0 ? (
                    <>
                      <div className="font-mono text-xs font-semibold text-bad-fg">
                        {ugx(consumer.balance)}
                      </div>
                      <div className="text-[10.5px] text-muted">{overdueBy[consumer.id]} d</div>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-[#9AA9A7]">—</span>
                  )}
                </div>

                <div className="hidden text-right sm:block">
                  <span
                    className={`rounded-full px-2.25 py-0.75 text-[10.5px] font-semibold ${STATUS_PILL[consumer.status]}`}
                  >
                    {consumer.status === 'disconnected'
                      ? 'Cut off'
                      : consumer.status[0].toUpperCase() + consumer.status.slice(1)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        linkFor={(n) => link({ ...(n > 1 ? { page: n } : {}) })}
      />
    </div>
  );
}
