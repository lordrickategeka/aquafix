import { Op } from 'sequelize';
import { Consumer, Zone } from '@/models';
import { requireAnyPermission } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';

/* Account lookup for the field app: enough to find somebody at a kiosk and see
   what they owe, and nothing more. A cashier holds record-payments and nothing
   else, so they cannot use /api/consumers — that one is gated on
   manage-consumers, which is the permission to *edit* the register. */
export async function GET(request) {
  const { response } = await requireAnyPermission(['record-payments', 'capture-readings']);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

  const where = { status: { [Op.in]: ['active', 'new', 'disconnected'] } };
  if (q) {
    where[Op.or] = [
      { account_no: { [Op.like]: `%${q}%` } },
      { name: { [Op.like]: `%${q}%` } },
      { phone: { [Op.like]: `%${q}%` } },
      { meter_no: { [Op.like]: `%${q}%` } },
    ];
  }

  const consumers = await Consumer.findAll({
    where,
    include: [{ model: Zone, as: 'zone', attributes: ['id', 'name'] }],
    // Whoever owes the most is usually who the cashier is looking for.
    order: [['balance', 'DESC'], ['account_no', 'ASC']],
    limit,
  });

  return success({
    accounts: consumers.map((consumer) => ({
      id: consumer.id,
      account_no: consumer.account_no,
      name: consumer.name,
      phone: consumer.phone,
      address: consumer.address,
      meter_no: consumer.meter_no,
      status: consumer.status,
      zone: consumer.zone ? { id: consumer.zone.id, name: consumer.zone.name } : null,
      balance: consumer.balance,
    })),
  });
}

// A single account, for refreshing one balance after taking money.
export async function POST(request) {
  const { response } = await requireAnyPermission(['record-payments', 'capture-readings']);
  if (response) return response;

  const body = await request.json();
  const consumer = await Consumer.findByPk(body.consumer_id, {
    include: [{ model: Zone, as: 'zone', attributes: ['id', 'name'] }],
  });
  if (!consumer) return fail('Account not found', 404);

  return success({
    account: {
      id: consumer.id,
      account_no: consumer.account_no,
      name: consumer.name,
      phone: consumer.phone,
      balance: consumer.balance,
      zone: consumer.zone ? { id: consumer.zone.id, name: consumer.zone.name } : null,
    },
  });
}
