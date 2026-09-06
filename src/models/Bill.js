import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";
import { money } from "./money";

const Bill = sequelize.define(
  "Bill",
  {
    invoice_no: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    consumer_id: { type: DataTypes.INTEGER, allowNull: false },
    billing_cycle_id: { type: DataTypes.INTEGER, allowNull: false },
    reading_id: { type: DataTypes.INTEGER, allowNull: true },
    usage_m3: { type: DataTypes.INTEGER, allowNull: true },
    consumption_amount: money("consumption_amount"),
    fixed_charge: money("fixed_charge"),
    levy_amount: money("levy_amount"),
    brought_forward: money("brought_forward"),
    // How the brought-forward figure was reached, frozen at issue.
    previous_balance: money("previous_balance"),
    payments_since: money("payments_since"),
    total_due: money("total_due"),
    issued_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    status: {
      type: DataTypes.ENUM("unpaid", "part_paid", "paid", "void"),
      allowNull: false,
      defaultValue: "unpaid",
    },
  },
  {
    tableName: "bills",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Bill;
