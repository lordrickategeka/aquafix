import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";
import { money } from "./money";

const Tariff = sequelize.define(
  "Tariff",
  {
    schedule_id: { type: DataTypes.INTEGER, allowNull: true },
    category: {
      type: DataTypes.ENUM("domestic", "institutional", "commercial", "kiosk"),
      allowNull: false,
    },
    fixed_charge: money("fixed_charge"),
    levy_pct: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      get() {
        const value = this.getDataValue("levy_pct");
        return value === null ? null : Number(value);
      },
    },
    // Set for unmetered categories (kiosks, flat-rate connections); NULL means
    // the category is billed from meter readings via its bands.
    flat_rate: money("flat_rate", { allowNull: true, defaultValue: null }),
    effective_from: { type: DataTypes.DATEONLY, allowNull: false },
    note: { type: DataTypes.STRING(191), allowNull: true },
  },
  {
    tableName: "tariffs",
    createdAt: "created_at",
    updatedAt: false,
  },
);

export default Tariff;
