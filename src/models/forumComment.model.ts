import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

export interface ForumCommentCreationAttributes {
  post_id: number
  user_id: number
  content: string
  parent_comment_id?: number
  is_active?: boolean
}

export interface ForumCommentAttributes extends ForumCommentCreationAttributes {
  id: number
  created_at: Date
  updated_at: Date
}

export const ForumComment = sequelize.define(
  'ForumComment',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'forum_posts',
        key: 'id',
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
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    parent_comment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'forum_comments',
        key: 'id',
      },
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
    tableName: 'forum_comments',
    timestamps: false,
    indexes: [
      {
        fields: ['post_id'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['parent_comment_id'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['created_at'],
      },
    ],
  },
)
