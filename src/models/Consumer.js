import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";
import { money } from "./money";

const Consumer = sequelize.define(
  "Consumer",
  {
    account_no: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(191), allowNull: false },
    phone: { type: DataTypes.STRING(32), allowNull: true },
    address: { type: DataTypes.STRING(191), allowNull: true },
    zone_id: { type: DataTypes.INTEGER, allowNull: false },
    category: {
      type: DataTypes.ENUM("domestic", "institutional", "commercial", "kiosk"),
      allowNull: false,
      defaultValue: "domestic",
    },
    is_metered: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    meter_no: { type: DataTypes.STRING(32), allowNull: true, unique: true },
    status: {
      type: DataTypes.ENUM("new", "active", "disconnected", "closed"),
      allowNull: false,
      defaultValue: "new",
    },
    connected_at: { type: DataTypes.DATEONLY, allowNull: true },
    // What the dial already showed when the account was registered.
    opening_reading: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Mirrors SUM(ledger_entries.amount); written in the same transaction.
    balance: money("balance"),
  },
  {
    tableName: "consumers",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Consumer;
