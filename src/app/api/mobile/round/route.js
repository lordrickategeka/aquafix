import { Op, QueryTypes } from 'sequelize';
import sequelize from '@/lib/db';
import { Consumer, Zone, Reading, Bill, BillingCycle } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';

/* Everything a meter reader needs for one walk, in a single response they can
   download on the office wifi and then work from all day with no signal.
   Named "round" rather than "route" because in this codebase route.js already
   means something to Next.js.

   The whole point is that it must not issue a query per consumer: a round of
   several hundred meters would be thousands of round trips over a phone
   connection that may not survive one. Four queries, whatever the size. */

// Mirrors previousValueFor/usageHistoryFor in @/lib/readings, which rank by
// billing_cycle_id rather than period. It has to agree exactly — if the phone
// shows a different previous reading than the one saveReading measures from,
// the reader gets a rejection they cannot explain standing at the meter.
const PRIOR_READINGS_SQL = `
  SELECT consumer_id, current_value, usage_m3
  FROM (
    SELECT consumer_id, current_value, usage_m3,
           ROW_NUMBER() OVER (
             PARTITION BY consumer_id ORDER BY billing_cycle_id DESC
           ) AS rn
    FROM readings
    WHERE billing_cycle_id <> :cycleId AND current_value IS NOT NULL
  ) ranked
  WHERE rn <= 3
  ORDER BY consumer_id, rn
`;

export async function GET(request) {
  const { response } = await requirePermission('capture-readings');
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get('cycle');
  const zoneId = searchParams.get('zone');

  const cycle = cycleId
    ? await BillingCycle.findByPk(cycleId)
    : await BillingCycle.findOne({ where: { status: 'open' }, order: [['period', 'DESC']] });

  // Not an error: a reader may open the app between cycles. The app shows
  // "no cycle is open" rather than an error screen.
  if (!cycle) return success({ cycle: null, consumers: [] });

  const where = { status: { [Op.in]: ['active', 'new'] } };
  if (zoneId) where.zone_id = zoneId;

  const consumers = await Consumer.findAll({
    where,
    include: [{ model: Zone, as: 'zone', attributes: ['id', 'name'] }],
    order: [['account_no', 'ASC']],
  });

  const [priorRows, currentReadings, bills] = await Promise.all([
    sequelize.query(PRIOR_READINGS_SQL, {
      replacements: { cycleId: cycle.id },
      type: QueryTypes.SELECT,
    }),
    Reading.findAll({ where: { billing_cycle_id: cycle.id } }),
    Bill.findAll({
      where: { billing_cycle_id: cycle.id },
      attributes: ['consumer_id', 'invoice_no'],
    }),
  ]);

  const priorByConsumer = new Map();
  for (const row of priorRows) {
    const list = priorByConsumer.get(row.consumer_id) ?? [];
    list.push(row);
    priorByConsumer.set(row.consumer_id, list);
  }
  const readingByConsumer = new Map(currentReadings.map((r) => [r.consumer_id, r]));
  const billByConsumer = new Map(bills.map((b) => [b.consumer_id, b.invoice_no]));

  const payload = consumers.map((consumer) => {
    const prior = priorByConsumer.get(consumer.id) ?? [];
    const captured = readingByConsumer.get(consumer.id) ?? null;
    const invoiceNo = billByConsumer.get(consumer.id) ?? null;

    // Once a reading exists it carries its own baseline, so re-editing it
    // measures from the same place the first save did.
    const previous = captured
      ? captured.previous_value
      : (prior[0]?.current_value ?? consumer.opening_reading ?? 0);

    return {
      id: consumer.id,
      account_no: consumer.account_no,
      name: consumer.name,
      phone: consumer.phone,
      address: consumer.address,
      meter_no: consumer.meter_no,
      category: consumer.category,
      is_metered: consumer.is_metered,
      status: consumer.status,
      zone: consumer.zone ? { id: consumer.zone.id, name: consumer.zone.name } : null,
      balance: consumer.balance,
      previous_value: previous,
      usage_history: prior.map((row) => row.usage_m3).filter((value) => value !== null),
      reading: captured
        ? {
            id: captured.id,
            current_value: captured.current_value,
            usage_m3: captured.usage_m3,
            flag: captured.flag,
            status: captured.status,
            read_at: captured.read_at,
          }
        : null,
      // A billed meter is settled — the app greys it out rather than letting
      // someone capture a value the server will refuse.
      billed_invoice_no: invoiceNo,
    };
  });

  return success({
    cycle: {
      id: cycle.id,
      period: cycle.period,
      status: cycle.status,
      reading_start: cycle.reading_start,
      reading_end: cycle.reading_end,
    },
    consumers: payload,
    synced_at: new Date().toISOString(),
  });
}
