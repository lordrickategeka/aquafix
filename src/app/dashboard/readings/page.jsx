import { Op } from 'sequelize';
import { Consumer, Zone, Reading, BillingCycle } from '@/models';
import { periodLabel } from '@/lib/format';
import ReadingsWorkspace from './_components/readings-workspace';

export default async function ReadingsPage({ searchParams }) {
  const params = await searchParams;

  const cycles = await BillingCycle.findAll({ order: [['period', 'DESC']] });
  const cycle =
    cycles.find((c) => String(c.id) === params.cycle) ||
    cycles.find((c) => c.status === 'open') ||
    cycles[0] ||
    null;

  if (!cycle) {
    return (
      <div className="rounded-[11px] border border-line bg-white px-6 py-12 text-center">
        <div className="text-[15px] font-semibold">No billing cycle yet</div>
        <div className="mt-1.5 text-[12.5px] text-muted">
          Create one from the Billing screen before capturing readings.
        </div>
      </div>
    );
  }

  const zones = await Zone.findAll({ order: [['name', 'ASC']] });
  const zoneId = params.zone && zones.some((z) => String(z.id) === params.zone) ? params.zone : null;
  const only = params.only === 'exceptions' ? 'exceptions' : null;

  const consumers = await Consumer.findAll({
    where: {
      is_metered: true,
      status: { [Op.in]: ['active', 'new'] },
      ...(zoneId ? { zone_id: zoneId } : {}),
    },
    include: [
      { model: Zone, as: 'zone', attributes: ['id', 'name'] },
      {
        model: Reading,
        as: 'readings',
        where: { billing_cycle_id: cycle.id },
        required: false,
      },
    ],
    order: [['account_no', 'ASC']],
  });

  // The previous meter value is whatever the last cycle closed on; for rows
  // with no reading yet it has to be looked up per consumer.
  const priorReadings = await Reading.findAll({
    where: {
      consumer_id: { [Op.in]: consumers.map((c) => c.id) },
      billing_cycle_id: { [Op.ne]: cycle.id },
      current_value: { [Op.ne]: null },
    },
    order: [['billing_cycle_id', 'ASC']],
  });
  const lastValue = new Map();
  for (const reading of priorReadings) lastValue.set(reading.consumer_id, reading.current_value);

  const rows = consumers
    .map((consumer) => {
      const reading = consumer.readings?.[0] ?? null;
      return {
        consumer_id: consumer.id,
        account_no: consumer.account_no,
        name: consumer.name,
        zone: consumer.zone?.name ?? '—',
        meter_no: consumer.meter_no,
        previous: reading ? reading.previous_value : (lastValue.get(consumer.id) ?? 0),
        reading: reading
          ? {
              id: reading.id,
              current_value: reading.current_value,
              usage_m3: reading.usage_m3,
              flag: reading.flag,
              status: reading.status,
              note: reading.note,
            }
          : null,
      };
    })
    .filter((row) => (only === 'exceptions' ? row.reading && row.reading.status === 'pending' : true));

  const allForCycle = await Reading.findAll({ where: { billing_cycle_id: cycle.id } });
  const stats = {
    expected: await Consumer.count({
      where: { is_metered: true, status: { [Op.in]: ['active', 'new'] } },
    }),
    captured: allForCycle.filter((r) => r.current_value !== null).length,
    pending: allForCycle.filter((r) => r.status === 'pending').length,
    approved: allForCycle.filter((r) => r.status === 'approved').length,
  };

  return (
    <ReadingsWorkspace
      cycle={{ id: cycle.id, period: cycle.period, status: cycle.status, label: periodLabel(cycle.period) }}
      cycles={cycles.map((c) => ({ id: c.id, period: c.period, status: c.status }))}
      zones={zones.map((z) => ({ id: z.id, name: z.name }))}
      activeZone={zoneId}
      only={only}
      rows={rows}
      stats={stats}
    />
  );
}
