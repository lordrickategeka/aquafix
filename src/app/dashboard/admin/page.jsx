import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { userHasRole } from '@/lib/rbac';
import { User, Role, Permission } from '@/models';
import AdminPanel from './admin-panel';

export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) redirect('/login');
  if (!(await userHasRole(session.id, 'admin'))) redirect('/dashboard');

  const [users, roles, permissions] = await Promise.all([
    User.findAll({
      attributes: ['id', 'email', 'created_at'],
      include: { model: Role, as: 'roles', attributes: ['id', 'name'] },
      order: [['id', 'ASC']],
    }),
    Role.findAll({
      include: { model: Permission, as: 'permissions', attributes: ['id', 'name'] },
      order: [['id', 'ASC']],
    }),
    Permission.findAll({ order: [['id', 'ASC']] }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Users, roles &amp; permissions
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Assign roles to users and permissions to roles.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Back to dashboard
        </Link>
      </div>

      <AdminPanel
        initialUsers={users.map((user) => ({
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          roles: user.roles.map((role) => ({ id: role.id, name: role.name })),
        }))}
        initialRoles={roles.map((role) => ({
          id: role.id,
          name: role.name,
          permissions: role.permissions.map((permission) => ({
            id: permission.id,
            name: permission.name,
          })),
        }))}
        initialPermissions={permissions.map((permission) => ({
          id: permission.id,
          name: permission.name,
        }))}
      />
    </div>
  );
}
