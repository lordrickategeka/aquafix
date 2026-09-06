import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";

const Zone = sequelize.define(
  "Zone",
  {
    name: { type: DataTypes.STRING(191), allowNull: false, unique: true },
    code: { type: DataTypes.STRING(16), allowNull: false, unique: true },
    supply_window: { type: DataTypes.STRING(191), allowNull: true },
  },
  {
    tableName: "zones",
    createdAt: "created_at",
    updatedAt: false,
  },
);

export default Zone;
