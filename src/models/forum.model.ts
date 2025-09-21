import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

export interface ForumCreationAttributes {
  title: string
  description?: string
  category: string
  grade?: string
  subject?: string
  career?: string
  is_active?: boolean
  created_by: number
}

export interface ForumAttributes extends ForumCreationAttributes {
  id: number
  created_at: Date
  updated_at: Date
}

export const Forum = sequelize.define(
  'Forum',
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
        len: [3, 255],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    grade: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    career: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'forums',
    timestamps: false,
    indexes: [
      {
        fields: ['category'],
      },
      {
        fields: ['grade'],
      },
      {
        fields: ['subject'],
      },
      {
        fields: ['career'],
      },
      {
        fields: ['created_by'],
      },
      {
        fields: ['is_active'],
      },
    ],
  },
)
