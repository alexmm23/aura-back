import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')
import { sequelize } from '../config/database.js'

sequelize.define('Content', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  page_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Page', // Assuming you have a Page model defined
      key: 'id',
    },
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      isIn: {
        args: [['text', 'image', 'video', 'audio']],
        msg: 'Type must be one of text, image, video, or audio',
      },
    },
  },
  data: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  x: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  y: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  width: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  deleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
})
