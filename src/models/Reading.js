import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";

const Reading = sequelize.define(
  "Reading",
  {
    consumer_id: { type: DataTypes.INTEGER, allowNull: false },
    billing_cycle_id: { type: DataTypes.INTEGER, allowNull: false },
    previous_value: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    current_value: { type: DataTypes.INTEGER, allowNull: true },
    usage_m3: { type: DataTypes.INTEGER, allowNull: true },
    flag: {
      type: DataTypes.ENUM("ok", "high", "zero", "negative", "missed"),
      allowNull: false,
      defaultValue: "ok",
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    note: { type: DataTypes.STRING(191), allowNull: true },
    source: { type: DataTypes.ENUM("web", "csv"), allowNull: false, defaultValue: "web" },
    read_at: { type: DataTypes.DATE, allowNull: true },
    read_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "readings",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Reading;
