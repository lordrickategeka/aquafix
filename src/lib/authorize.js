import { getSessionUser } from '@/lib/auth';
import { userHasRole, userHasPermission } from '@/lib/rbac';
import { fail } from '@/lib/api-response';

async function requireSession() {
  const session = await getSessionUser();
  if (!session) return { user: null, response: fail('Not authenticated', 401) };
  return { user: session, response: null };
}

// Usage in a route handler:
//   const { user, response } = await requireRole('admin');
//   if (response) return response;
export async function requireRole(roleName) {
  const { user, response } = await requireSession();
  if (response) return { user: null, response };

  if (!(await userHasRole(user.id, roleName))) {
    return { user: null, response: fail('This action is unauthorized.', 403) };
  }
  return { user, response: null };
}

export async function requirePermission(permissionName) {
  const { user, response } = await requireSession();
  if (response) return { user: null, response };

  if (!(await userHasPermission(user.id, permissionName))) {
    return { user: null, response: fail('This action is unauthorized.', 403) };
  }
  return { user, response: null };
}

/* For routes that serve more than one job. The account lookup in the field app
   is wanted by a meter reader (who has capture-readings) and by a cashier (who
   has record-payments and nothing else); demanding either one would lock out
   half the people who need it. */
export async function requireAnyPermission(permissionNames) {
  const { user, response } = await requireSession();
  if (response) return { user: null, response };

  const held = await Promise.all(
    permissionNames.map((name) => userHasPermission(user.id, name)),
  );
  if (!held.some(Boolean)) {
    return { user: null, response: fail('This action is unauthorized.', 403) };
  }
  return { user, response: null };
}
