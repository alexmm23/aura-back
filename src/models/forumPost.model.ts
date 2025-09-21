import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

export interface ForumPostCreationAttributes {
  forum_id: number
  title: string
  description: string
  user_id: number
  allow_responses?: boolean
  is_active?: boolean
}

export interface ForumPostAttributes extends ForumPostCreationAttributes {
  id: number
  created_at: Date
  updated_at: Date
}

export const ForumPost = sequelize.define(
  'ForumPost',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    forum_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'forums',
        key: 'id',
      },
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
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    allow_responses: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: 'forum_posts',
    timestamps: false,
    indexes: [
      {
        fields: ['forum_id'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['allow_responses'],
      },
      {
        fields: ['created_at'],
      },
    ],
  },
)
