const { DataTypes } = require('sequelize');

// The cycle pipeline: readings are captured against an open cycle, the cycle
// locks, then the billing run turns approved readings into bills. The unique
// pairs on (consumer_id, billing_cycle_id) are what make a re-run safe.
module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.createTable('billing_cycles', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      period: { type: DataTypes.STRING(7), allowNull: false, unique: true }, // '2026-09'
      status: {
        type: DataTypes.ENUM('open', 'locked', 'billed', 'closed'),
        allowNull: false,
        defaultValue: 'open',
      },
      due_date: { type: DataTypes.DATEONLY, allowNull: true },
      locked_at: { type: DataTypes.DATE, allowNull: true },
      billed_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.createTable('readings', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      consumer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'consumers', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      billing_cycle_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'billing_cycles', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      previous_value: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      current_value: { type: DataTypes.INTEGER, allowNull: true },
      usage_m3: { type: DataTypes.INTEGER, allowNull: true },
      // ok = billable as-is; anything else needs a human before the run.
      flag: {
        type: DataTypes.ENUM('ok', 'high', 'zero', 'negative', 'missed'),
        allowNull: false,
        defaultValue: 'ok',
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      note: { type: DataTypes.STRING(191), allowNull: true },
      source: { type: DataTypes.ENUM('web', 'csv'), allowNull: false, defaultValue: 'web' },
      read_at: { type: DataTypes.DATE, allowNull: true },
      read_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addConstraint('readings', {
      fields: ['consumer_id', 'billing_cycle_id'],
      type: 'unique',
      name: 'readings_consumer_cycle_unique',
    });

    await queryInterface.createTable('bills', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      invoice_no: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      consumer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'consumers', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      billing_cycle_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'billing_cycles', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      reading_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'readings', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      usage_m3: { type: DataTypes.INTEGER, allowNull: true },
      consumption_amount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      fixed_charge: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      levy_amount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      brought_forward: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      total_due: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      issued_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      due_date: { type: DataTypes.DATEONLY, allowNull: true },
      status: {
        type: DataTypes.ENUM('unpaid', 'part_paid', 'paid', 'void'),
        allowNull: false,
        defaultValue: 'unpaid',
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addConstraint('bills', {
      fields: ['consumer_id', 'billing_cycle_id'],
      type: 'unique',
      name: 'bills_consumer_cycle_unique',
    });

    // Frozen copy of how the total was reached, so a re-priced tariff never
    // changes what an already-issued bill says.
    await queryInterface.createTable('bill_lines', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      bill_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'bills', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      description: { type: DataTypes.STRING(191), allowNull: false },
      detail: { type: DataTypes.STRING(64), allowNull: true }, // '8 × 2,180'
      amount: { type: DataTypes.BIGINT, allowNull: false },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    });

    await queryInterface.createTable('payments', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      consumer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'consumers', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      amount: { type: DataTypes.BIGINT, allowNull: false },
      channel: {
        type: DataTypes.ENUM('mtn', 'airtel', 'bank', 'cash'),
        allowNull: false,
      },
      reference: { type: DataTypes.STRING(64), allowNull: true },
      received_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      recorded_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('payments', ['consumer_id']);

    // Every money movement, in order. Positive = the consumer owes more,
    // negative = they owe less. consumers.balance is SUM(amount).
    await queryInterface.createTable('ledger_entries', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      consumer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'consumers', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      type: {
        type: DataTypes.ENUM('bill', 'payment', 'adjustment', 'fee'),
        allowNull: false,
      },
      amount: { type: DataTypes.BIGINT, allowNull: false },
      bill_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'bills', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      payment_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'payments', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      note: { type: DataTypes.STRING(191), allowNull: true },
      occurred_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('ledger_entries', ['consumer_id', 'occurred_at']);
  },

  async down({ context: queryInterface }) {
    await queryInterface.dropTable('ledger_entries');
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('bill_lines');
    await queryInterface.dropTable('bills');
    await queryInterface.dropTable('readings');
    await queryInterface.dropTable('billing_cycles');
  },
};
