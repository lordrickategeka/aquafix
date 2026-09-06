const { DataTypes } = require('sequelize');

// Reference data (zones, tariffs) plus the consumer register. Money is stored
// as whole UGX in BIGINT — the currency has no minor unit in practice, and
// floats have no business anywhere near a billing run.
module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.createTable('zones', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(191), allowNull: false, unique: true },
      code: { type: DataTypes.STRING(16), allowNull: false, unique: true },
      supply_window: { type: DataTypes.STRING(191), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    // One row per category per revision. Superseded rows are kept so old bills
    // can still be explained; the run picks the latest effective_from <= cycle.
    await queryInterface.createTable('tariffs', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      category: {
        type: DataTypes.ENUM('domestic', 'institutional', 'commercial', 'kiosk'),
        allowNull: false,
      },
      fixed_charge: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      levy_pct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      flat_rate: { type: DataTypes.BIGINT, allowNull: true },
      effective_from: { type: DataTypes.DATEONLY, allowNull: false },
      note: { type: DataTypes.STRING(191), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addConstraint('tariffs', {
      fields: ['category', 'effective_from'],
      type: 'unique',
      name: 'tariffs_category_effective_from_unique',
    });

    // Progressive slabs: max_m3 NULL means "and everything above".
    await queryInterface.createTable('tariff_bands', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      tariff_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'tariffs', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      min_m3: { type: DataTypes.INTEGER, allowNull: false },
      max_m3: { type: DataTypes.INTEGER, allowNull: true },
      rate_per_m3: { type: DataTypes.BIGINT, allowNull: false },
    });

    await queryInterface.createTable('consumers', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      account_no: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(191), allowNull: false },
      phone: { type: DataTypes.STRING(32), allowNull: true },
      address: { type: DataTypes.STRING(191), allowNull: true },
      zone_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'zones', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      category: {
        type: DataTypes.ENUM('domestic', 'institutional', 'commercial', 'kiosk'),
        allowNull: false,
        defaultValue: 'domestic',
      },
      is_metered: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      meter_no: { type: DataTypes.STRING(32), allowNull: true, unique: true },
      status: {
        type: DataTypes.ENUM('new', 'active', 'disconnected', 'closed'),
        allowNull: false,
        defaultValue: 'new',
      },
      connected_at: { type: DataTypes.DATEONLY, allowNull: true },
      // Running balance in UGX, kept in step with ledger_entries inside the
      // same transaction. Positive means the consumer owes money.
      balance: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('consumers', ['zone_id']);
    await queryInterface.addIndex('consumers', ['status']);
  },

  async down({ context: queryInterface }) {
    await queryInterface.dropTable('consumers');
    await queryInterface.dropTable('tariff_bands');
    await queryInterface.dropTable('tariffs');
    await queryInterface.dropTable('zones');
  },
};
