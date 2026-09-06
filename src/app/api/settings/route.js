import { requireRole } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { updateSettings, SETTING_FIELDS } from '@/lib/settings';

/* Identity and bill wording — administrators only, since it changes what every
   consumer sees on a printed bill. */
export async function PATCH(request) {
  const { response } = await requireRole('admin');
  if (response) return response;

  const body = await request.json();
  const patch = {};
  for (const field of SETTING_FIELDS) {
    if (body[field.key] !== undefined) patch[field.key] = body[field.key];
  }

  if (!Object.keys(patch).length) return fail('Nothing to update', 422);
  if (patch.organisation_name !== undefined && !String(patch.organisation_name).trim()) {
    return fail('Validation failed', 422, {
      organisation_name: 'The organisation needs a name',
    });
  }

  try {
    const settings = await updateSettings(patch);
    return success({ settings });
  } catch (err) {
    console.error('Update settings error:', err);
    return fail('Could not save the settings', 500);
  }
}
