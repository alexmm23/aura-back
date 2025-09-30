import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

export interface ReminderCreationAttributes {
  title: string
  description?: string
  date_time: Date
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly'
  status?: 'pending' | 'sent'
  user_id: number
  deleted?: boolean
}

export interface ReminderAttributes extends ReminderCreationAttributes {
  id: number
  created_at: Date
}

export const Reminder = sequelize.define(
  'Reminder',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    date_time: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true,
        isAfter: {
          args: new Date().toISOString(),
          msg: 'Date must be in the future'
        }
      },
    },
    frequency: {
      type: DataTypes.ENUM('once', 'daily', 'weekly', 'monthly'),
      allowNull: false,
      defaultValue: 'once',
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent'),
      allowNull: false,
      defaultValue: 'pending',
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'reminders',
    timestamps: false,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['frequency'],
      },
      {
        fields: ['date_time'],
      },
      {
        fields: ['deleted'],
      },
      {
        fields: ['user_id', 'deleted'],
      },
      {
        fields: ['status', 'date_time'],
      },
    ],
    scopes: {
      active: {
        where: {
          deleted: false,
        },
      },
      pending: {
        where: {
          status: 'pending',
          deleted: false,
        },
      },
      byUser: (userId: number) => ({
        where: {
          user_id: userId,
          deleted: false,
        },
      }),
    },
  }
)