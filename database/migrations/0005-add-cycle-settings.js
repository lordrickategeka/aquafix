const { DataTypes } = require('sequelize');

// A cycle is the period during which readings are collected, so it needs that
// window on it — not just the due date for the bills that follow.
module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.addColumn('billing_cycles', 'reading_start', {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('billing_cycles', 'reading_end', {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('billing_cycles', 'note', {
      type: DataTypes.STRING(191),
      allowNull: true,
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.removeColumn('billing_cycles', 'note');
    await queryInterface.removeColumn('billing_cycles', 'reading_end');
    await queryInterface.removeColumn('billing_cycles', 'reading_start');
  },
};
