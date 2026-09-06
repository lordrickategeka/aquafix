import { QueryTypes } from 'sequelize';
import sequelize from '@/lib/db';

/* Aggregates for the overview screen. Raw SQL rather than the ORM: these are
   reporting queries over whole tables, and the joins read better written out
   than assembled from Sequelize fragments. */

const num = (value) => Number(value || 0);

export async function getOverviewData() {
  const [
    connections,
    cycles,
    zones,
    payMix,
    exceptions,
    arrears,
  ] = await Promise.all([
    sequelize.query(
      `SELECT
         SUM(status IN ('active','new')) AS active,
         SUM(status = 'disconnected')    AS disconnected,
         SUM(is_metered = 0)             AS unmetered
       FROM consumers`,
      { type: QueryTypes.SELECT, plain: true },
    ),

    // Per cycle: what was charged, what came in during that month, how much
    // water was billed.
    sequelize.query(
      `SELECT
         c.period,
         c.status,
         c.due_date,
         c.due_date < CURDATE() AS due_passed,
         COALESCE(b.charged, 0)   AS charged,
         COALESCE(b.volume, 0)    AS volume,
         COALESCE(p.collected, 0) AS collected,
         COALESCE(b.bill_count, 0) AS bill_count
       FROM billing_cycles c
       LEFT JOIN (
         SELECT billing_cycle_id,
                SUM(total_due - brought_forward) AS charged,
                SUM(usage_m3) AS volume,
                COUNT(*) AS bill_count
         FROM bills WHERE status <> 'void'
         GROUP BY billing_cycle_id
       ) b ON b.billing_cycle_id = c.id
       LEFT JOIN (
         SELECT DATE_FORMAT(received_at, '%Y-%m') AS period, SUM(amount) AS collected
         FROM payments GROUP BY period
       ) p ON p.period = c.period
       ORDER BY c.period ASC`,
      { type: QueryTypes.SELECT },
    ),

    // "Owing" counts only accounts past a due date — right after a run every
    // account has a balance, which would otherwise paint every zone red.
    sequelize.query(
      `SELECT z.name, z.supply_window,
              COUNT(DISTINCT co.id) AS connections,
              COUNT(DISTINCT overdue.consumer_id) AS in_arrears,
              COALESCE(SUM(DISTINCT GREATEST(co.balance, 0)), 0) AS owed
       FROM zones z
       LEFT JOIN consumers co ON co.zone_id = z.id AND co.status IN ('active','new')
       LEFT JOIN (
         SELECT DISTINCT consumer_id FROM bills
         WHERE status IN ('unpaid','part_paid') AND due_date < CURDATE()
       ) overdue ON overdue.consumer_id = co.id
       GROUP BY z.id
       ORDER BY connections DESC`,
      { type: QueryTypes.SELECT },
    ),

    sequelize.query(
      `SELECT channel, SUM(amount) AS total
       FROM payments
       WHERE received_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
       GROUP BY channel
       ORDER BY total DESC`,
      { type: QueryTypes.SELECT },
    ),

    sequelize.query(
      `SELECT r.flag, COUNT(*) AS n
       FROM readings r
       JOIN billing_cycles c ON c.id = r.billing_cycle_id
       WHERE r.status = 'pending' AND c.status IN ('open','locked')
       GROUP BY r.flag`,
      { type: QueryTypes.SELECT },
    ),

    // Age comes from the oldest still-unpaid bill on the account.
    sequelize.query(
      `SELECT
         COUNT(*) AS accounts,
         SUM(balance) AS owed,
         SUM(oldest_due IS NOT NULL AND oldest_due < DATE_SUB(CURDATE(), INTERVAL 60 DAY)) AS over_60
       FROM (
         SELECT co.id, co.balance, MIN(b.due_date) AS oldest_due
         FROM consumers co
         LEFT JOIN bills b ON b.consumer_id = co.id AND b.status IN ('unpaid','part_paid')
         WHERE co.balance > 0
         GROUP BY co.id
       ) t`,
      { type: QueryTypes.SELECT, plain: true },
    ),
  ]);

  const latestBilled = [...cycles].reverse().find((c) => num(c.charged) > 0) || null;
  const openCycle = cycles.find((c) => c.status === 'open' || c.status === 'locked') || null;

  // Collection efficiency is only meaningful once consumers have had until the
  // due date to pay; a cycle billed this morning would always read ~0%.
  const settled =
    [...cycles].reverse().find((c) => num(c.charged) > 0 && Number(c.due_passed) === 1) ||
    latestBilled;

  const charged = num(settled?.charged);
  const collected = num(settled?.collected);

  const previous = latestBilled
    ? cycles[cycles.findIndex((c) => c.period === latestBilled.period) - 1]
    : null;
  const volumeDelta =
    previous && num(previous.volume) > 0
      ? ((num(latestBilled.volume) - num(previous.volume)) / num(previous.volume)) * 100
      : null;

  const pendingExceptions = exceptions.reduce((sum, row) => sum + num(row.n), 0);

  return {
    connections: {
      active: num(connections.active),
      disconnected: num(connections.disconnected),
      unmetered: num(connections.unmetered),
    },
    latestBilled: latestBilled
      ? {
          period: latestBilled.period,
          charged: num(latestBilled.charged),
          collected: num(latestBilled.collected),
          volume: num(latestBilled.volume),
          bills: num(latestBilled.bill_count),
          volumeDelta,
        }
      : null,
    // The cycle the efficiency figure describes — often the previous one.
    settled: settled
      ? {
          period: settled.period,
          charged,
          collected,
          efficiency: charged > 0 ? Math.round((collected / charged) * 100) : 0,
        }
      : null,
    openCycle: openCycle
      ? { period: openCycle.period, status: openCycle.status, bills: num(openCycle.bill_count) }
      : null,
    cycles: cycles.map((c) => ({
      period: c.period,
      status: c.status,
      charged: num(c.charged),
      collected: num(c.collected),
      volume: num(c.volume),
    })),
    zones: zones.map((z) => ({
      name: z.name,
      window: z.supply_window,
      connections: num(z.connections),
      inArrears: num(z.in_arrears),
      owed: num(z.owed),
    })),
    payMix: payMix.map((p) => ({ channel: p.channel, total: num(p.total) })),
    exceptions: { total: pendingExceptions, byFlag: exceptions.map((e) => ({ flag: e.flag, n: num(e.n) })) },
    arrears: {
      accounts: num(arrears.accounts),
      owed: num(arrears.owed),
      over60: num(arrears.over_60),
    },
  };
}
