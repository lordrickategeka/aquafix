const { DataTypes } = require('sequelize');

// The printed bill shows how the brought-forward figure was arrived at:
// previous balance, less what was paid since. Both are stored rather than
// recomputed, so a payment backdated later cannot change a bill already issued.
module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.addColumn('bills', 'previous_balance', {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('bills', 'payments_since', {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.removeColumn('bills', 'payments_since');
    await queryInterface.removeColumn('bills', 'previous_balance');
  },
};
