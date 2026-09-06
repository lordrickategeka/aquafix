import { getSessionUser } from '@/lib/auth';
import { getUserRoles, getUserPermissions } from '@/lib/rbac';
import { getSettings } from '@/lib/settings';
import { success, fail } from '@/lib/api-response';

/* What the app calls on launch to find out whether the token it stored months
   ago is still good, and what the person holding the phone is allowed to do.
   Cheap enough to call on every cold start. */
export async function GET() {
  const session = await getSessionUser();
  if (!session) return fail('Not authenticated', 401);

  const [roles, permissions, settings] = await Promise.all([
    getUserRoles(session.id),
    getUserPermissions(session.id),
    getSettings(),
  ]);

  return success({
    user: { id: session.id, email: session.email },
    roles,
    permissions,
    organisation: {
      name: settings.organisation_name,
      initials: settings.organisation_initials,
    },
  });
}
