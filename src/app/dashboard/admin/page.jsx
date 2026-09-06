import { redirect } from 'next/navigation';
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
    <div className="mx-auto w-full max-w-4xl">
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
