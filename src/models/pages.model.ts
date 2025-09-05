import { createRequire } from 'module'
import { sequelize } from '../config/database.js'
import { title } from 'process'
import { timeStamp } from 'console'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

const Page = sequelize.define(
  'Page',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    notebook_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Notebook', // Assuming you have a Notebook model defined
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
    changed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    timestamps: false,
    tableName: 'pages',
  },
)

export default Page
