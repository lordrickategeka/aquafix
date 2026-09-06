import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";
import { money } from "./money";

const TariffBand = sequelize.define(
  "TariffBand",
  {
    tariff_id: { type: DataTypes.INTEGER, allowNull: false },
    min_m3: { type: DataTypes.INTEGER, allowNull: false },
    // NULL means the band runs to infinity.
    max_m3: { type: DataTypes.INTEGER, allowNull: true },
    rate_per_m3: money("rate_per_m3"),
  },
  {
    tableName: "tariff_bands",
    timestamps: false,
  },
);

export default TariffBand;
