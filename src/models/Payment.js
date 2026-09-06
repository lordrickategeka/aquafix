import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";
import { money } from "./money";

const Payment = sequelize.define(
  "Payment",
  {
    consumer_id: { type: DataTypes.INTEGER, allowNull: false },
    amount: money("amount"),
    channel: {
      type: DataTypes.ENUM("mtn", "airtel", "bank", "cash"),
      allowNull: false,
    },
    reference: { type: DataTypes.STRING(64), allowNull: true },
    received_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    recorded_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "payments",
    createdAt: "created_at",
    updatedAt: false,
  },
);

export default Payment;
