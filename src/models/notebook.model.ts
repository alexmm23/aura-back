import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

const Notebook = sequelize.define('Notebook', {
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
      model: 'User', // Assuming you have a User model defined
      key: 'id',
    },
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
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
},{
  tableName: 'notebooks',
  timestamps: false,
})

export default Notebook
