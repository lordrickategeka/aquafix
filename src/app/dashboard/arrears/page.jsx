import Link from 'next/link';
import { QueryTypes } from 'sequelize';
import sequelize from '@/lib/db';
import { ugx, ugxShort, shortDate } from '@/lib/format';

const CARD = 'bg-white border border-line rounded-[11px]';
const COLS = 'grid-cols-[104px_1.3fr_92px_110px_84px_1fr]';

/* Age is driven by the oldest bill still carrying a balance, which is what
   decides whether an account gets a reminder, a final notice or the cut-off
   list. */
export default async function ArrearsPage() {
  const rows = await sequelize.query(
    `SELECT
       co.id, co.account_no, co.name, co.balance, co.status,
       z.name AS zone,
       MIN(b.due_date) AS oldest_due,
       DATEDIFF(CURDATE(), MIN(b.due_date)) AS age_days
     FROM consumers co
     JOIN zones z ON z.id = co.zone_id
     LEFT JOIN bills b ON b.consumer_id = co.id AND b.status IN ('unpaid','part_paid')
     WHERE co.balance > 0
     GROUP BY co.id
     ORDER BY age_days DESC, co.balance DESC
     LIMIT 100`,
    { type: QueryTypes.SELECT },
  );

  const totals = rows.reduce(
    (acc, row) => {
      const age = Number(row.age_days || 0);
      acc.owed += Number(row.balance);
      if (age > 90) {
        acc.over90 += Number(row.balance);
        acc.over90Count += 1;
      }
      if (age > 60) acc.over60Count += 1;
      return acc;
    },
    { owed: 0, over90: 0, over90Count: 0, over60Count: 0 },
  );

  function action(age) {
    if (age > 90) return ['Disconnect', 'bg-bad-bg text-bad-fg'];
    if (age > 60) return ['Final notice', 'bg-warn-bg text-warn-fg'];
    if (age > 0) return ['SMS reminder', 'bg-info-bg text-info-fg'];
    return ['Within terms', 'bg-[#F1F5F4] text-muted-deep'];
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[
          ['Total outstanding', ugxShort(totals.owed), `UGX across ${rows.length} accounts`, true],
          ['Over 90 days', ugxShort(totals.over90), `${totals.over90Count} accounts`, true],
          ['Past 60 days', String(totals.over60Count), 'due a final notice', false],
          [
            'Average owed',
            ugxShort(rows.length ? Math.round(totals.owed / rows.length) : 0),
            'per account in arrears',
            false,
          ],
        ].map(([label, value, note, red]) => (
          <div key={label} className={`${CARD} px-4 py-3.75`}>
            <div className="text-[11px] font-medium text-[#7A8B89]">{label}</div>
            <div className={`mt-1.5 font-mono text-2xl font-semibold ${red ? 'text-bad-fg' : ''}`}>
              {value}
            </div>
            <div className="mt-1.25 text-[11px] text-muted">{note}</div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 overflow-x-auto">
        <div className={`${CARD} min-w-225 overflow-hidden`}>
          <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3.25">
            <div className="text-[13.5px] font-semibold whitespace-nowrap">
              Disconnection worklist
            </div>
            <div className="text-[11.5px] text-muted">Sorted by age of the oldest unpaid bill</div>
          </div>

          <div
            className={`grid ${COLS} border-b border-line-soft bg-[#F7FAF9] px-4 py-2.25 text-[10.5px] font-semibold tracking-[.06em] text-muted uppercase`}
          >
            <div>Account</div>
            <div>Consumer</div>
            <div>Zone</div>
            <div className="text-right">Owed</div>
            <div className="text-right">Age</div>
            <div className="pl-4">Next action</div>
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12.5px] text-muted">
              No account is carrying a balance. Nothing to chase.
            </div>
          ) : (
            rows.map((row) => {
              const age = Number(row.age_days || 0);
              const [label, pill] = action(age);
              return (
                <Link
                  key={row.id}
                  href={`/dashboard/consumers?account=${row.account_no}`}
                  className={`grid ${COLS} items-center border-b border-line-faint px-4 py-2.75 hover:bg-[#F7FAF9]`}
                >
                  <div className="font-mono text-xs text-brand-600">{row.account_no}</div>
                  <div className="truncate pr-2 text-[12.5px]">{row.name}</div>
                  <div className="text-xs text-muted-deep">{row.zone}</div>
                  <div className="text-right font-mono text-xs font-semibold text-bad-fg">
                    {ugx(row.balance)}
                  </div>
                  <div className="text-right font-mono text-xs text-muted-deep">
                    {row.oldest_due ? `${age} d` : '—'}
                  </div>
                  <div className="flex items-center gap-2 pl-4">
                    <span className={`rounded-full px-2.25 py-0.75 text-[10.5px] font-semibold ${pill}`}>
                      {label}
                    </span>
                    <span className="text-[11px] text-muted">
                      {row.oldest_due ? `due ${shortDate(row.oldest_due)}` : 'no unpaid bill'}
                    </span>
                    {row.status === 'disconnected' ? (
                      <span className="ml-auto text-[11px] text-bad-fg">cut off</span>
                    ) : null}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
