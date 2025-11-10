import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

export const NotificationToken = sequelize.define(
  'NotificationToken',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    expo_push_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    device_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    device_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    os_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    os_version: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    app_version: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      get(this: any) {
        const rawValue: string | null = this.getDataValue('metadata')
        if (!rawValue) return null
        try {
          return JSON.parse(rawValue)
        } catch (error) {
          return rawValue
        }
      },
      set(this: any, value: any) {
        if (!value) {
          this.setDataValue('metadata', null)
          return
        }
        this.setDataValue('metadata', typeof value === 'string' ? value : JSON.stringify(value))
      },
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'notification_tokens',
    timestamps: false,
  },
)

export default NotificationToken
