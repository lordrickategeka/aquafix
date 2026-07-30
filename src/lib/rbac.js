import { User, Role, Permission } from '@/models';

export async function getUserRoles(userId) {
  const user = await User.findByPk(userId, { include: { model: Role, as: 'roles' } });
  return user ? user.roles.map((role) => role.name) : [];
}

export async function getUserPermissions(userId) {
  const user = await User.findByPk(userId, {
    include: {
      model: Role,
      as: 'roles',
      include: { model: Permission, as: 'permissions' },
    },
  });
  if (!user) return [];

  const names = new Set();
  for (const role of user.roles) {
    for (const permission of role.permissions) names.add(permission.name);
  }
  return [...names];
}

export async function userHasRole(userId, roleName) {
  const roles = await getUserRoles(userId);
  return roles.includes(roleName);
}

export async function userHasPermission(userId, permissionName) {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permissionName);
}

export async function addRoleToUser(userId, roleId) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error(`User ${userId} not found`);
  await user.addRole(roleId);
}

export async function removeRoleFromUser(userId, roleId) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error(`User ${userId} not found`);
  await user.removeRole(roleId);
}

export async function addPermissionToRole(roleId, permissionId) {
  const role = await Role.findByPk(roleId);
  if (!role) throw new Error(`Role ${roleId} not found`);
  await role.addPermission(permissionId);
}

export async function removePermissionFromRole(roleId, permissionId) {
  const role = await Role.findByPk(roleId);
  if (!role) throw new Error(`Role ${roleId} not found`);
  await role.removePermission(permissionId);
}
