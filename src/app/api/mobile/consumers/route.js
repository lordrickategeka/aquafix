import { Zone } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';
import { CATEGORIES } from '@/lib/billing';
import { createConsumer, ConsumerInputError } from '@/lib/consumers';

/* Registering a connection from the field.
 *
 * Separate from /api/consumers, which is the register's full editor and is
 * gated on manage-consumers — the permission to change anybody's account.
 * Somebody enrolling a household at their gate needs to add one, not to edit
 * the rest, so this is gated on register-consumers and does nothing else.
 *
 * Deliberately online-only. The KW- account number is handed out by the server
 * inside a transaction; a registration queued on a handset would have no number
 * until it synced, and two handsets could enrol the same household with nothing
 * to tell them apart. The app says so rather than pretending to have saved. */

const REGISTER = 'register-consumers';

// What the form on the handset needs to render: the zones to choose from and
// the categories the server will accept. Sent as one call so the app has no
// list of its own to fall out of date.
export async function GET() {
  const { response } = await requirePermission(REGISTER);
  if (response) return response;

  const zones = await Zone.findAll({
    attributes: ['id', 'name', 'code'],
    order: [['name', 'ASC']],
  });

  return success({
    zones: zones.map((zone) => ({ id: zone.id, name: zone.name, code: zone.code })),
    categories: CATEGORIES,
  });
}

export async function POST(request) {
  const { user, response } = await requirePermission(REGISTER);
  if (response) return response;

  const body = await request.json();
  const { valid, errors } = validate(body, {
    name: 'required',
    zone_id: 'required|integer',
    category: `required|in:${CATEGORIES.join(',')}`,
  });
  if (!valid) return fail('Validation failed', 422, errors);

  try {
    const consumer = await createConsumer(body);
    console.log(`Consumer ${consumer.account_no} registered from the field by ${user.email}.`);

    // Only what the confirmation screen shows. The handset keeps no register of
    // its own, so there is nothing else for it to do with the row.
    return success(
      {
        consumer: {
          id: consumer.id,
          account_no: consumer.account_no,
          name: consumer.name,
          phone: consumer.phone,
          address: consumer.address,
          category: consumer.category,
          is_metered: consumer.is_metered,
          meter_no: consumer.meter_no,
          opening_reading: consumer.opening_reading,
          status: consumer.status,
        },
      },
      201,
    );
  } catch (err) {
    if (err instanceof ConsumerInputError) return fail('Validation failed', 422, err.errors);

    console.error('Field registration error:', err);
    return fail('Could not register the connection', 500);
  }
}
