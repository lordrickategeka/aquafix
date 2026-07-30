import { DataTypes } from "sequelize";
import sequelize from "@/lib/db";

const User = sequelize.define(
  "User",
  {
    email: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: "users",
    createdAt: "created_at",
    updatedAt: false,
  },
);

export default User;
