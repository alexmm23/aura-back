import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

export interface UserSessionCreationAttributes {
  user_id: number
  refresh_token: string
  device_type: 'mobile' | 'web' | 'desktop'
  device_info?: string
  expires_at: Date
  is_active?: boolean
}

export interface UserSessionAttributes extends UserSessionCreationAttributes {
  id: number
  created_at: Date
}

export const UserSession = sequelize.define(
  'UserSession',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    refresh_token: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    device_type: {
      type: DataTypes.ENUM('mobile', 'web', 'desktop'),
      defaultValue: 'web',
    },
    device_info: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'user_sessions',
    timestamps: false,
    indexes: [
      {
        fields: ['user_id', 'refresh_token'],
      },
      {
        fields: ['user_id', 'is_active'],
      },
    ],
  },
)
