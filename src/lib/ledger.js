import sequelize from '@/lib/db';
import { Consumer, LedgerEntry } from '@/models';

/* Every debit and credit goes through here. The ledger row and the cached
   consumers.balance are written in one transaction, so the two can never
   disagree — recomputeBalance exists for repair, not for normal operation. */

async function post({ consumerId, type, amount, billId, paymentId, note, occurredAt }, transaction) {
  await LedgerEntry.create(
    {
      consumer_id: consumerId,
      type,
      amount,
      bill_id: billId ?? null,
      payment_id: paymentId ?? null,
      note: note ?? null,
      occurred_at: occurredAt ?? new Date(),
    },
    { transaction },
  );

  await Consumer.increment('balance', { by: amount, where: { id: consumerId }, transaction });
}

/* A bill only adds this cycle's charges to the balance. The brought-forward
   figure printed on it is already on the account — posting the whole total
   would count the arrears twice. */
export async function postBill({ consumer, bill, transaction }) {
  const chargedThisCycle = bill.total_due - bill.brought_forward;
  await post(
    {
      consumerId: consumer.id,
      type: 'bill',
      amount: chargedThisCycle,
      billId: bill.id,
      note: `Bill ${bill.invoice_no}`,
      occurredAt: bill.issued_at,
    },
    transaction,
  );
  return chargedThisCycle;
}

export async function postPayment({ payment, transaction }) {
  await post(
    {
      consumerId: payment.consumer_id,
      type: 'payment',
      amount: -Math.abs(payment.amount),
      paymentId: payment.id,
      note: `Payment ${payment.reference || payment.channel}`,
      occurredAt: payment.received_at,
    },
    transaction,
  );
}

export async function postAdjustment({ consumerId, amount, note, type = 'adjustment' }, transaction) {
  await post({ consumerId, type, amount, note }, transaction);
}

/* Rebuilds the cached balance from the ledger. Use after an import or if a
   crash is suspected to have split a transaction. */
export async function recomputeBalance(consumerId) {
  return sequelize.transaction(async (transaction) => {
    const total = await LedgerEntry.sum('amount', {
      where: { consumer_id: consumerId },
      transaction,
    });
    const balance = Number(total || 0);
    await Consumer.update({ balance }, { where: { id: consumerId }, transaction });
    return balance;
  });
}
