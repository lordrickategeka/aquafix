import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";
import { money } from "./money";

const LedgerEntry = sequelize.define(
  "LedgerEntry",
  {
    consumer_id: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.ENUM("bill", "payment", "adjustment", "fee"),
      allowNull: false,
    },
    // Positive increases what the consumer owes, negative reduces it.
    amount: money("amount"),
    bill_id: { type: DataTypes.INTEGER, allowNull: true },
    payment_id: { type: DataTypes.INTEGER, allowNull: true },
    note: { type: DataTypes.STRING(191), allowNull: true },
    occurred_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "ledger_entries",
    createdAt: "created_at",
    updatedAt: false,
  },
);

export default LedgerEntry;
