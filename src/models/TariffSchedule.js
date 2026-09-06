import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";

// A named set of tariff categories and bands. Cycles point at one, so several
// cycles can share the same prices without copying them.
const TariffSchedule = sequelize.define(
  "TariffSchedule",
  {
    name: { type: DataTypes.STRING(191), allowNull: false },
    effective_from: { type: DataTypes.DATEONLY, allowNull: true },
    note: { type: DataTypes.STRING(191), allowNull: true },
  },
  {
    tableName: "tariff_schedules",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default TariffSchedule;
