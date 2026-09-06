import { DataTypes } from "sequelize";

// Sequelize hands BIGINT back as a string to protect precision it does not
// need here — UGX amounts stay far below Number.MAX_SAFE_INTEGER. Without the
// getter, `bill.total_due + fee` silently concatenates instead of adding.
//
//   balance: money("balance"),
//   flat_rate: money("flat_rate", { allowNull: true, defaultValue: null }),
export function money(field, options = {}) {
  return {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    ...options,
    get() {
      const value = this.getDataValue(field);
      return value === null || value === undefined ? value : Number(value);
    },
  };
}
