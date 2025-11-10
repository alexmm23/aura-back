import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

export const AssignmentSnapshot = sequelize.define(
  'AssignmentSnapshot',
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
    platform: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    external_assignment_id: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    course_id: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    course_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    first_seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    last_notification_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    is_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'assignment_snapshots',
    timestamps: false,
    indexes: [
      {
        name: 'idx_assignment_snapshot_unique',
        unique: true,
        fields: ['user_id', 'platform', 'external_assignment_id'],
      },
      {
        name: 'idx_assignment_snapshot_user_platform',
        fields: ['user_id', 'platform'],
      },
    ],
  },
)

export default AssignmentSnapshot
