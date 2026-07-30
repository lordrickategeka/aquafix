import { DataTypes } from 'sequelize';
import sequelize from '@/lib/db';

const Role = sequelize.define(
  'Role',
  {
    name: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: 'roles',
    createdAt: 'created_at',
    updatedAt: false,
  }
);

export default Role;
