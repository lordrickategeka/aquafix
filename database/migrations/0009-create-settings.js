const { DataTypes } = require('sequelize');

// Organisation identity and the wording printed on a bill. Key/value rather
// than columns: these are text an administrator edits, not data the billing
// engine reasons about, so adding one later should not need a migration.
module.exports = {
  async up({ context: queryInterface }) {
    const { sequelize } = queryInterface;

    await queryInterface.createTable('settings', {
      key: { type: DataTypes.STRING(64), primaryKey: true },
      value: { type: DataTypes.TEXT, allowNull: true },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    const defaults = [
      ['organisation_name', 'Kuwe Foundation'],
      ['organisation_initials', 'KW'],
      ['tagline', 'Water & Billing'],
      ['bill_title', 'KUWE FOUNDATION: WATER BILL'],
      ['pay_phone', '0788608076'],
      [
        'bill_footer',
        'PAY USING MOBILE MONEY\nINDICATE YOUR NAME AS REASON FOR SENDING PAYMENT.\nTHIS HELPS US TO CREDIT YOUR ACCOUNT IMMEDIATELY.\nPLEASE, PAY THIS BILL IN FULL WITHIN SEVEN DAYS AFTER GETTING THE BILL.\nPROMPT PAYMENT ENSURES GOOD SERVICE.',
      ],
    ];

    for (const [key, value] of defaults) {
      await sequelize.query(
        'INSERT INTO settings (`key`, value, updated_at) VALUES (?, ?, NOW())',
        { replacements: [key, value] },
      );
    }
  },

  async down({ context: queryInterface }) {
    await queryInterface.dropTable('settings');
  },
};
