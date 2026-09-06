const { DataTypes } = require('sequelize');

// Tariffs move from "a loose set of effective-dated rows" to named schedules a
// cycle points at. Reusing last cycle's schedule is then a single foreign key
// rather than a copy, so "nothing changed this month" costs nothing and the
// prices behind an old cycle can always be found.
module.exports = {
  async up({ context: queryInterface }) {
    const { sequelize } = queryInterface;

    await queryInterface.createTable('tariff_schedules', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(191), allowNull: false },
      effective_from: { type: DataTypes.DATEONLY, allowNull: true },
      note: { type: DataTypes.STRING(191), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.addColumn('tariffs', 'schedule_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'tariff_schedules', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addColumn('billing_cycles', 'tariff_schedule_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'tariff_schedules', key: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    /* Backfill: one schedule per distinct effective_from already in use, so
       nothing that has been billed loses the prices it was billed on. */
    const [dates] = await sequelize.query(
      'SELECT DISTINCT effective_from FROM tariffs ORDER BY effective_from ASC',
    );

    for (const { effective_from: date } of dates) {
      const [result] = await sequelize.query(
        `INSERT INTO tariff_schedules (name, effective_from, note, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())`,
        { replacements: [`Schedule from ${date}`, date, 'Carried over from the original tariffs'] },
      );
      await sequelize.query('UPDATE tariffs SET schedule_id = ? WHERE effective_from = ?', {
        replacements: [result, date],
      });
    }

    // Point every existing cycle at the newest schedule effective by then.
    await sequelize.query(
      `UPDATE billing_cycles c
       SET tariff_schedule_id = (
         SELECT s.id FROM tariff_schedules s
         WHERE s.effective_from IS NULL OR s.effective_from <= CONCAT(c.period, '-01')
         ORDER BY s.effective_from DESC LIMIT 1
       )`,
    );

    // A category appears once per schedule; the old key was per effective date.
    await queryInterface.removeConstraint('tariffs', 'tariffs_category_effective_from_unique');
    await queryInterface.addConstraint('tariffs', {
      fields: ['schedule_id', 'category'],
      type: 'unique',
      name: 'tariffs_schedule_category_unique',
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.removeConstraint('tariffs', 'tariffs_schedule_category_unique');
    await queryInterface.addConstraint('tariffs', {
      fields: ['category', 'effective_from'],
      type: 'unique',
      name: 'tariffs_category_effective_from_unique',
    });
    await queryInterface.removeColumn('billing_cycles', 'tariff_schedule_id');
    await queryInterface.removeColumn('tariffs', 'schedule_id');
    await queryInterface.dropTable('tariff_schedules');
  },
};
