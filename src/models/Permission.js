import { DataTypes } from 'sequelize';
import sequelize from '@/lib/db';

const Permission = sequelize.define(
  'Permission',
  {
    name: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: 'permissions',
    createdAt: 'created_at',
    updatedAt: false,
  }
);

export default Permission;
