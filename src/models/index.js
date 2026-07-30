import User from "./User";
import Role from "./Role";
import Permission from "./Permission";

// User <-> Role (many-to-many via user_roles)
User.belongsToMany(Role, {
  through: "user_roles",
  foreignKey: "user_id",
  otherKey: "role_id",
  as: "roles",
  timestamps: false,
});
Role.belongsToMany(User, {
  through: "user_roles",
  foreignKey: "role_id",
  otherKey: "user_id",
  as: "users",
  timestamps: false,
});

// Role <-> Permission (many-to-many via role_permissions)
Role.belongsToMany(Permission, {
  through: "role_permissions",
  foreignKey: "role_id",
  otherKey: "permission_id",
  as: "permissions",
  timestamps: false,
});
Permission.belongsToMany(Role, {
  through: "role_permissions",
  foreignKey: "permission_id",
  otherKey: "role_id",
  as: "roles",
  timestamps: false,
});

export { User, Role, Permission };
