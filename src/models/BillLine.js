import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";
import { money } from "./money";

const BillLine = sequelize.define(
  "BillLine",
  {
    bill_id: { type: DataTypes.INTEGER, allowNull: false },
    description: { type: DataTypes.STRING(191), allowNull: false },
    detail: { type: DataTypes.STRING(64), allowNull: true },
    amount: money("amount"),
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "bill_lines",
    timestamps: false,
  },
);

export default BillLine;
