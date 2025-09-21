import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

export interface ForumAttachmentCreationAttributes {
  post_id?: number
  comment_id?: number
  user_id: number
  file_name: string
  file_url: string
  file_type: 'image' | 'document' | 'video' | 'link' | 'other'
  file_size?: number
}

export interface ForumAttachmentAttributes extends ForumAttachmentCreationAttributes {
  id: number
  created_at: Date
}

export const ForumAttachment = sequelize.define(
  'ForumAttachment',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'forum_posts',
        key: 'id',
      },
    },
    comment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'forum_comments',
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
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    file_url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    file_type: {
      type: DataTypes.ENUM('image', 'document', 'video', 'link', 'other'),
      allowNull: false,
      defaultValue: 'other',
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'forum_attachments',
    timestamps: false,
    indexes: [
      {
        fields: ['post_id'],
      },
      {
        fields: ['comment_id'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['file_type'],
      },
    ],
    validate: {
      // Validación para asegurar que se especifique post_id O comment_id, pero no ambos
      eitherPostOrComment() {
        const instance = this as any
        if (
          (instance.post_id && instance.comment_id) ||
          (!instance.post_id && !instance.comment_id)
        ) {
          throw new Error('Must specify either post_id or comment_id, but not both')
        }
      },
    },
  },
)
