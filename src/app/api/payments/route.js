import { Op } from 'sequelize';
import sequelize from '@/lib/db';
import { Consumer, Payment, Bill } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';
import { postPayment } from '@/lib/ledger';
import { emit, EVENTS } from '@/lib/events';

const CHANNELS = ['mtn', 'airtel', 'bank', 'cash'];

export async function POST(request) {
  const { user, response } = await requirePermission('record-payments');
  if (response) return response;

  const body = await request.json();
  const { valid, errors } = validate(body, {
    consumer_id: 'required|integer',
    amount: `required|positive`,
    channel: `required|in:${CHANNELS.join(',')}`,
  });
  if (!valid) return fail('Validation failed', 422, errors);

  const amount = Number(body.amount);
  if (amount <= 0) return fail('Validation failed', 422, { amount: 'Enter an amount above zero' });

  const consumer = await Consumer.findByPk(body.consumer_id);
  if (!consumer) return fail('Consumer not found', 404);

  try {
    const payment = await sequelize.transaction(async (transaction) => {
      const record = await Payment.create(
        {
          consumer_id: consumer.id,
          amount,
          channel: body.channel,
          reference: body.reference?.trim() || null,
          received_at: body.received_at ? new Date(body.received_at) : new Date(),
          recorded_by: user.id,
        },
        { transaction },
      );

      await postPayment({ payment: record, transaction });

      // Settle outstanding bills oldest first so each bill's status reflects
      // what the account has actually covered.
      let remaining = amount;
      const open = await Bill.findAll({
        where: { consumer_id: consumer.id, status: { [Op.in]: ['unpaid', 'part_paid'] } },
        order: [['issued_at', 'ASC']],
        transaction,
      });

      for (const bill of open) {
        if (remaining <= 0) break;
        const owed = bill.total_due - bill.brought_forward;
        if (remaining >= owed) {
          await bill.update({ status: 'paid' }, { transaction });
          remaining -= owed;
        } else {
          await bill.update({ status: 'part_paid' }, { transaction });
          remaining = 0;
        }
      }

      return record;
    });

    const updated = await Consumer.findByPk(consumer.id);
    await emit(EVENTS.PAYMENT_RECORDED, {
      consumer_id: consumer.id,
      account_no: consumer.account_no,
      amount,
      channel: body.channel,
      balance: updated.balance,
    });

    return success({ payment, balance: updated.balance }, 201);
  } catch (err) {
    console.error('Record payment error:', err);
    return fail('Could not record the payment', 500);
  }
}
