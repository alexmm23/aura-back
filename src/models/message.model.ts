import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

export const Message = sequelize.define(
  'Message',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: {
          args: [1, 5000],
          msg: 'Message content must be between 1 and 5000 characters',
        },
      },
    },
    chat_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'chats',
        key: 'id',
      },
    },
    sender_id: {
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
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'messages',
    timestamps: false, // Solo usamos created_at
    indexes: [
      {
        name: 'idx_chat_id',
        fields: ['chat_id'],
      },
      {
        name: 'idx_sender_id',
        fields: ['sender_id'],
      },
      {
        name: 'idx_chat_created',
        fields: ['chat_id', 'created_at'],
      },
      {
        name: 'idx_unread_messages',
        fields: ['chat_id', 'is_read'],
      },
    ],
  },
)

export default Message
