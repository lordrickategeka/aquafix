const { DataTypes } = require('sequelize');

// The figure already on the dial when an account is registered. Without it the
// first reading is measured from zero, so a meter that had run for years would
// bill its whole history at once.
module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.addColumn('consumers', 'opening_reading', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.removeColumn('consumers', 'opening_reading');
  },
};
