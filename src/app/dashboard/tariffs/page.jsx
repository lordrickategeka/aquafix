import Link from 'next/link';
import { Op, fn, col } from 'sequelize';
import { Tariff, TariffBand, TariffSchedule, BillingCycle, Consumer } from '@/models';
import { getSessionUser } from '@/lib/auth';
import { userHasPermission } from '@/lib/rbac';
import { CATEGORIES } from '@/lib/billing';
import { fullDate } from '@/lib/format';
import ScheduleEditor from './_components/schedule-editor';
import NewSchedule from './_components/new-schedule';

const CARD = 'bg-white border border-line rounded-[11px]';

export default async function TariffsPage({ searchParams }) {
  const params = await searchParams;

  const session = await getSessionUser();
  const canManage = await userHasPermission(session.id, 'run-billing');

  const schedules = await TariffSchedule.findAll({
    include: [
      { model: Tariff, as: 'tariffs', include: [{ model: TariffBand, as: 'bands' }] },
      { model: BillingCycle, as: 'cycles', attributes: ['id', 'period', 'status'] },
    ],
    order: [['effective_from', 'DESC']],
  });

  const selected =
    schedules.find((s) => String(s.id) === params.schedule) || schedules[0] || null;

  // A schedule that has priced real bills is frozen — changing it would leave
  // the invoices it produced unexplainable.
  const lockedBy = selected
    ? (selected.cycles || []).filter((c) => ['billed', 'closed'].includes(c.status))
    : [];

  // Only the categories this schedule actually prices — a missing one is a
  // real state, not a blank row, because the run refuses to bill it.
  const shaped = selected
    ? CATEGORIES.filter((category) =>
        (selected.tariffs || []).some((t) => t.category === category),
      ).map((category) => {
        const tariff = (selected.tariffs || []).find((t) => t.category === category);
        return {
          category,
          fixed_charge: tariff.fixed_charge ?? 0,
          levy_pct: tariff.levy_pct ?? 0,
          flat_rate: tariff.flat_rate ?? null,
          bands: [...(tariff.bands || [])]
            .sort((a, b) => a.min_m3 - b.min_m3)
            .map((band) => ({
              min_m3: band.min_m3,
              max_m3: band.max_m3,
              rate_per_m3: band.rate_per_m3,
            })),
        };
      })
    : [];

  // How many accounts would be left unbillable if a category went away.
  const counts = await Consumer.findAll({
    attributes: ['category', [fn('COUNT', col('id')), 'total']],
    where: { status: { [Op.in]: ['active', 'new'] } },
    group: ['category'],
    raw: true,
  });
  const consumersByCategory = Object.fromEntries(
    counts.map((row) => [row.category, Number(row.total)]),
  );

  return (
    <div className="flex flex-col gap-3.5">
      <div className={`${CARD} flex flex-wrap items-center gap-3 px-4.5 py-3.5`}>
        <div>
          <div className="text-[13.5px] font-semibold">Tariff schedules</div>
          <div className="mt-0.75 text-[11.5px] text-muted">
            A schedule holds the price of water per category. Cycles point at one, so several
            cycles can share the same prices — change nothing and next month simply reuses it.
          </div>
        </div>
        {canManage ? (
          <div className="ml-auto">
            <NewSchedule
              schedules={schedules.map((s) => ({ id: s.id, name: s.name }))}
              copyFrom={selected?.id ?? null}
            />
          </div>
        ) : null}
      </div>

      {schedules.length === 0 ? (
        <div className={`${CARD} px-4.5 py-10 text-center`}>
          <div className="text-[13px] font-semibold">No tariff schedules yet</div>
          <div className="mt-1 text-[12px] text-muted">
            Create one before a billing run — without prices, nothing can be billed.
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {schedules.map((schedule) => {
              const active = selected?.id === schedule.id;
              const used = (schedule.cycles || []).length;
              return (
                <Link
                  key={schedule.id}
                  href={`/dashboard/tariffs?schedule=${schedule.id}`}
                  className={`rounded-[9px] border px-3 py-2 text-[12px] ${
                    active
                      ? 'border-brand-600 bg-brand-50 font-medium text-ink'
                      : 'border-line bg-white text-muted-deep hover:bg-[#F7FAF9]'
                  }`}
                >
                  {schedule.name}
                  <span className="ml-1.5 font-mono text-[10.5px] text-muted">
                    {used ? `${used} cycle${used === 1 ? '' : 's'}` : 'unused'}
                  </span>
                </Link>
              );
            })}
          </div>

          {selected ? (
            <ScheduleEditor
              key={selected.id}
              schedule={{
                id: selected.id,
                name: selected.name,
                effective_from: selected.effective_from,
                note: selected.note,
              }}
              categories={shaped}
              consumersByCategory={consumersByCategory}
              cycles={(selected.cycles || []).map((c) => ({
                id: c.id,
                period: c.period,
                status: c.status,
              }))}
              lockedBy={lockedBy.map((c) => c.period)}
              canManage={canManage}
            />
          ) : null}
        </>
      )}

      <div className="text-[11px] text-muted">
        Bands are cumulative: each starts where the previous one ended, and the last may be left
        open-ended to cover everything above it.
      </div>
    </div>
  );
}
