import { fn, col } from 'sequelize';
import { Zone, Consumer } from '@/models';
import { getSessionUser } from '@/lib/auth';
import { userHasPermission } from '@/lib/rbac';
import ZoneManager from './_components/zone-manager';

/* Zones (or cells) group consumers geographically. Every consumer belongs to
   one, so at least one has to exist before the register can be started. */
export default async function ZonesPage() {
  const session = await getSessionUser();
  const canManage = await userHasPermission(session.id, 'manage-consumers');

  const [zones, counts] = await Promise.all([
    Zone.findAll({ order: [['name', 'ASC']] }),
    Consumer.findAll({
      attributes: ['zone_id', [fn('COUNT', col('id')), 'total']],
      group: ['zone_id'],
      raw: true,
    }),
  ]);

  const byZone = Object.fromEntries(counts.map((row) => [row.zone_id, Number(row.total)]));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <ZoneManager
        zones={zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          code: zone.code,
          supply_window: zone.supply_window,
          consumers: byZone[zone.id] ?? 0,
        }))}
        canManage={canManage}
      />
    </div>
  );
}
