const { DataTypes } = require('sequelize');

// Per-cycle pricing overrides. All nullable: when unit_cost is set, that cycle
// bills every m³ at one rate instead of walking the category's tariff bands.
// fixed_charge and levy_pct override the tariff's equivalents when present, so
// setting a unit cost does not silently drop the service charge.
module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.addColumn('billing_cycles', 'unit_cost', {
      type: DataTypes.BIGINT,
      allowNull: true,
    });
    await queryInterface.addColumn('billing_cycles', 'fixed_charge', {
      type: DataTypes.BIGINT,
      allowNull: true,
    });
    await queryInterface.addColumn('billing_cycles', 'levy_pct', {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.removeColumn('billing_cycles', 'levy_pct');
    await queryInterface.removeColumn('billing_cycles', 'fixed_charge');
    await queryInterface.removeColumn('billing_cycles', 'unit_cost');
  },
};
