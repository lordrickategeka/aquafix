import { QueryTypes } from 'sequelize';
import sequelize from '@/lib/db';
import { Consumer, Zone } from '@/models';
import { formatAccountNo } from '@/lib/billing';

/* Registering a connection, in one place.
 *
 * Two callers reach this: the console's register page, and a handset in the
 * field. They are gated on different permissions and send different amounts of
 * detail, but an account created from a phone has to be indistinguishable from
 * one created at a desk — same account-number sequence, same meter rules, same
 * opening reading. Two copies of this would drift, and the thing that would
 * drift is the number printed on somebody's bill. */

export class ConsumerInputError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ConsumerInputError';
    this.errors = errors;
  }
}

/**
 * Creates a consumer and returns it. Throws ConsumerInputError with per-field
 * messages for anything the caller can fix; anything else is a real failure and
 * propagates.
 */
export async function createConsumer(input) {
  const zone = await Zone.findByPk(input.zone_id);
  if (!zone) throw new ConsumerInputError({ zone_id: 'Unknown zone' });

  // A kiosk is billed at a flat rate whatever the caller says, and an explicit
  // is_metered:false stands for a connection whose meter was never fitted.
  const isMetered = input.is_metered !== false && input.category !== 'kiosk';
  const meterNo = isMetered ? input.meter_no?.trim() || null : null;

  if (isMetered && !meterNo) {
    throw new ConsumerInputError({ meter_no: 'A metered connection needs a meter number' });
  }
  if (meterNo && (await Consumer.findOne({ where: { meter_no: meterNo } }))) {
    throw new ConsumerInputError({ meter_no: 'That meter is already on another account' });
  }

  // The account number is derived from the highest existing one, so the read
  // and the insert have to be in one transaction or two concurrent creates
  // would both claim the same KW- number.
  return sequelize.transaction(async (transaction) => {
    const [row] = await sequelize.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(account_no, 4) AS UNSIGNED)), 100) AS last
       FROM consumers FOR UPDATE`,
      { transaction, type: QueryTypes.SELECT },
    );

    return Consumer.create(
      {
        account_no: formatAccountNo(Number(row.last) + 1),
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        zone_id: zone.id,
        category: input.category,
        is_metered: isMetered,
        meter_no: meterNo,
        status: input.status || 'new',
        connected_at: input.connected_at || null,
        // The dial reading at registration; the first cycle measures from it.
        opening_reading: isMetered ? Math.max(0, Number(input.opening_reading) || 0) : 0,
        balance: 0,
      },
      { transaction },
    );
  });
}
