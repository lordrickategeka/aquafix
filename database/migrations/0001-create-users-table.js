const { DataTypes } = require('sequelize');

module.exports = {
  async up({ context: queryInterface }) {
    // email is VARCHAR(191), not 255: a UNIQUE utf8mb4 index on VARCHAR(255)
    // exceeds MySQL's 1000-byte key length limit on older configs. Laravel
    // hit this same issue and standardized on 191 for indexed strings.
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING(191),
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.dropTable('users');
  },
};
