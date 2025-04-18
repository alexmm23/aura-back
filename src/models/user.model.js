import { DataTypes } from 'sequelize'
import { sequelize } from '../config/database'

export const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Role',
      key: 'id',
    },
  },
  subscription_status: {
    type: DataTypes.ENUM('cancelled', 'none', 'active', 'expired'),
    defaultValue: 'none',
    allowNull: false,
  },
  subscription_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'free',
    allowNull: false,
  },
  subscription_start_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  subscription_end_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  deleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
})
