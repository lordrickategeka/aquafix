import Link from 'next/link';
import { ugx, ugxShort, periodLabel, CHANNEL_LABELS } from '@/lib/format';

const CARD = 'bg-white border border-line rounded-[11px]';
const HEAD = 'text-[13.5px] font-semibold';
const SUB = 'text-[11.5px] text-muted';

const TONE = {
  ok: 'text-ok-fg bg-ok-bg',
  warn: 'text-warn-fg bg-warn-bg',
  bad: 'text-bad-fg bg-bad-bg',
  info: 'text-info-fg bg-info-bg',
  flat: 'text-muted-deep bg-[#F1F5F4]',
};

function Kpi({ label, value, delta, tone = 'flat', note }) {
  return (
    <div className={`${CARD} px-4 py-3.75`}>
      <div className="text-[11px] font-medium text-[#7A8B89]">{label}</div>
      <div className="mt-1.75 font-mono text-[26px] font-semibold tracking-[-.02em]">{value}</div>
      <div className="mt-2 flex items-center gap-1.5">
        {delta ? (
          <span className={`rounded-full px-1.75 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}>
            {delta}
          </span>
        ) : null}
        <span className="text-[11px] text-muted">{note}</span>
      </div>
    </div>
  );
}

export default function Overview({ data }) {
  const { connections, latestBilled, settled, openCycle, cycles, zones, payMix, exceptions, arrears } =
    data;

  const chartCycles = cycles.slice(-8);
  const peak = Math.max(...chartCycles.map((c) => Math.max(c.charged, c.collected)), 1);

  const collectedThisCycle = latestBilled?.collected ?? 0;
  const chargedThisCycle = latestBilled?.charged ?? 0;
  const collectedPct = chargedThisCycle ? Math.min(100, (collectedThisCycle / chargedThisCycle) * 100) : 0;
  const payTotal = payMix.reduce((sum, p) => sum + p.total, 0);

  const queue = [
    exceptions.total > 0 && {
      tag: 'Readings',
      tone: 'warn',
      text: `${exceptions.total} reading exception${exceptions.total === 1 ? '' : 's'} to review before billing`,
      count: exceptions.total,
      href: '/dashboard/readings',
    },
    arrears.over60 > 0 && {
      tag: 'Arrears',
      tone: 'bad',
      text: 'Accounts past 60 days awaiting disconnection notice',
      count: arrears.over60,
      href: '/dashboard/arrears',
    },
    openCycle &&
      openCycle.bills === 0 && {
        tag: 'Billing',
        tone: 'info',
        text: `Cycle ${openCycle.period} has not been billed yet`,
        count: '—',
        href: '/dashboard/billing',
      },
    connections.unmetered > 0 && {
      tag: 'Meters',
      tone: 'flat',
      text: 'Connections billed at flat rate because they have no meter',
      count: connections.unmetered,
      href: '/dashboard/consumers?metered=flat',
    },
  ].filter(Boolean);

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi
          label="Active connections"
          value={ugx(connections.active)}
          delta={connections.disconnected ? `${connections.disconnected} cut` : null}
          tone="bad"
          note={`${connections.unmetered} unmetered`}
        />
        <Kpi
          label={`Volume billed (${periodLabel(latestBilled?.period)})`}
          value={latestBilled ? `${ugx(latestBilled.volume)} m³` : '—'}
          delta={
            latestBilled?.volumeDelta === null || latestBilled?.volumeDelta === undefined
              ? null
              : `${latestBilled.volumeDelta >= 0 ? '+' : ''}${latestBilled.volumeDelta.toFixed(1)}%`
          }
          tone={latestBilled?.volumeDelta >= 0 ? 'ok' : 'warn'}
          note="vs previous cycle"
        />
        <Kpi
          label={`Collection efficiency (${periodLabel(settled?.period)})`}
          value={settled ? `${settled.efficiency}%` : '—'}
          delta={settled ? `${ugxShort(settled.collected)}` : null}
          tone={settled && settled.efficiency >= 70 ? 'ok' : 'warn'}
          note={settled ? `of ${ugxShort(settled.charged)} charged` : ''}
        />
        <Kpi
          label="Outstanding balance"
          value={ugxShort(arrears.owed)}
          delta={`${arrears.accounts} accts`}
          tone="bad"
          note="UGX"
        />
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 xl:grid-cols-[1.55fr_1fr]">
        <div className={`${CARD} flex flex-col px-4.5 pt-4 pb-3`}>
          <div className="flex flex-wrap items-baseline gap-3">
            <div className={HEAD}>Charged vs collected</div>
            <div className={SUB}>UGX per cycle · the gap is what went into arrears</div>
          </div>

          {chartCycles.length ? (
            <>
              <div className="mt-5 flex flex-1 items-end gap-3.5">
                {chartCycles.map((cycle) => (
                  <div key={cycle.period} className="flex h-full flex-1 flex-col items-center gap-1.75">
                    <div className="flex min-h-37.5 w-full flex-1 items-end justify-center gap-0.75">
                      <div
                        className="w-[44%] rounded-t-[3px] bg-brand-200"
                        style={{ height: `${(cycle.charged / peak) * 100}%` }}
                        title={`Charged ${ugx(cycle.charged)}`}
                      />
                      <div
                        className="w-[44%] rounded-t-[3px] bg-brand-500"
                        style={{ height: `${(cycle.collected / peak) * 100}%` }}
                        title={`Collected ${ugx(cycle.collected)}`}
                      />
                    </div>
                    <div className="font-mono text-[10.5px] text-muted">
                      {periodLabel(cycle.period).split(' ')[0]}
                    </div>
                    <div className="font-mono text-[10px] text-[#B4740E]">
                      {cycle.charged ? `${Math.round((1 - cycle.collected / cycle.charged) * 100)}%` : '—'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-muted">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.75 w-2.75 rounded-[3px] bg-brand-200" />
                  Charged
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.75 w-2.75 rounded-[3px] bg-brand-500" />
                  Collected
                </div>
                <div className="ml-auto text-[10.5px]">amber = share unpaid</div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center py-10 text-[12.5px] text-muted">
              No billing cycles yet.
            </div>
          )}
        </div>

        <div className={`${CARD} px-4.5 py-4`}>
          <div className={HEAD}>Zones</div>
          <div className={`${SUB} mt-0.5`}>Connections and accounts past due</div>
          <div className="mt-3.5 flex flex-col gap-2.25">
            {zones.map((zone) => (
              <div
                key={zone.name}
                className="flex items-center gap-2.75 rounded-[9px] border border-[#E7ECEB] px-2.75 py-2.25"
              >
                <span
                  className="inline-block h-2 w-2 flex-none rounded-full"
                  style={{
                    background: zone.owed > 0 && zone.inArrears > zone.connections * 0.4
                      ? '#C4574A'
                      : zone.inArrears > 0
                        ? '#E4B75C'
                        : '#2F8F6E',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium">{zone.name}</div>
                  <div className="truncate text-[11px] text-muted">{zone.window || '—'}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[12.5px] font-semibold whitespace-nowrap">
                    {zone.connections} conns
                  </div>
                  <div className="text-[10.5px] whitespace-nowrap text-muted">
                    {zone.inArrears ? `${zone.inArrears} overdue` : 'none overdue'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center border-b border-line-soft px-4.5 py-3.5">
            <div className={HEAD}>Needs your attention</div>
            <div className="ml-auto text-[11.5px] font-medium text-brand-600">Work queue</div>
          </div>
          {queue.length ? (
            queue.map((item) => (
              <Link
                key={item.tag}
                href={item.href}
                className="flex items-center gap-3 border-b border-line-faint px-4.5 py-3 last:border-b-0 hover:bg-[#F7FAF9]"
              >
                <span
                  className={`w-19.5 rounded-full px-2 py-0.75 text-center text-[10.5px] font-semibold ${TONE[item.tone]}`}
                >
                  {item.tag}
                </span>
                <span className="flex-1 text-[12.5px] text-ink">{item.text}</span>
                <span className="font-mono text-xs text-muted-deep">{item.count}</span>
                <span className="text-[13px] text-[#B6C2C0]">→</span>
              </Link>
            ))
          ) : (
            <div className="px-4.5 py-8 text-center text-[12.5px] text-muted">
              Nothing waiting — readings are clean and no account is past 60 days.
            </div>
          )}
        </div>

        <div className={`${CARD} px-4.5 py-4`}>
          <div className="flex items-center">
            <div className={HEAD}>Collections · {periodLabel(latestBilled?.period)}</div>
            <div className="ml-auto font-mono text-xs text-muted-deep">UGX</div>
          </div>
          <div className="mt-3 flex items-baseline gap-2.5">
            <div className="font-mono text-[30px] font-semibold tracking-[-.02em]">
              {ugxShort(collectedThisCycle)}
            </div>
            <div className="text-xs text-muted">of {ugx(chargedThisCycle)} charged</div>
          </div>
          <div className="mt-3.5 flex h-2.25 overflow-hidden rounded-[5px] bg-line-soft">
            <div className="bg-brand-500" style={{ width: `${collectedPct}%` }} />
          </div>

          <div className="mt-3 flex flex-wrap gap-4.5">
            {payMix.length ? (
              payMix.map((row) => (
                <div key={row.channel}>
                  <div className="text-[11px] text-muted">{CHANNEL_LABELS[row.channel]}</div>
                  <div className="mt-0.75 font-mono text-sm font-semibold">{ugxShort(row.total)}</div>
                </div>
              ))
            ) : (
              <div className="text-[12px] text-muted">No payments recorded in the last 60 days.</div>
            )}
          </div>
          {payTotal > 0 ? (
            <div className="mt-2 text-[10.5px] text-muted">
              {ugx(payTotal)} received in the last 60 days
            </div>
          ) : null}

          <div className="mt-4 flex gap-2.5 border-t border-line-soft pt-3.5">
            <Link
              href="/dashboard/billing"
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-[12.5px] font-medium text-white hover:bg-[#0A5453]"
            >
              Run billing
            </Link>
            <Link
              href="/dashboard/arrears"
              className="flex-1 rounded-lg border border-line bg-[#F1F5F4] px-4 py-2.5 text-center text-[12.5px] font-medium text-[#26413F] hover:bg-[#E7EDEC]"
            >
              Arrears list
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
