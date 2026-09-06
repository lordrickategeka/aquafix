import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";
import { money } from "./money";

const BillingCycle = sequelize.define(
  "BillingCycle",
  {
    period: { type: DataTypes.STRING(7), allowNull: false, unique: true },
    status: {
      type: DataTypes.ENUM("open", "locked", "billed", "closed"),
      allowNull: false,
      defaultValue: "open",
    },
    // When meter readers are expected to collect for this cycle.
    reading_start: { type: DataTypes.DATEONLY, allowNull: true },
    reading_end: { type: DataTypes.DATEONLY, allowNull: true },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    note: { type: DataTypes.STRING(191), allowNull: true },
    // Which tariff schedule prices this cycle.
    tariff_schedule_id: { type: DataTypes.INTEGER, allowNull: true },
    // Pricing overrides for this cycle. unit_cost set = flat per-m³ pricing
    // instead of the category's tariff bands; the other two override the
    // tariff's equivalents when present.
    unit_cost: money("unit_cost", { allowNull: true, defaultValue: null }),
    fixed_charge: money("fixed_charge", { allowNull: true, defaultValue: null }),
    levy_pct: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: null,
      get() {
        const value = this.getDataValue("levy_pct");
        return value === null || value === undefined ? null : Number(value);
      },
    },
    locked_at: { type: DataTypes.DATE, allowNull: true },
    billed_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "billing_cycles",
    createdAt: "created_at",
    updatedAt: false,
  },
);

export default BillingCycle;
