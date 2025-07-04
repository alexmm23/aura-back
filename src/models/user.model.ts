import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

export const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: {
          args: [2, 50],
          msg: 'Name must be between 2 and 50 characters long',
        },
      },
    },
    lastname: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: {
          args: [2, 50],
          msg: 'Lastname must be between 2 and 50 characters long',
        },
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          msg: 'Must be a valid email address',
        },
        notEmpty: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: {
          args: [6, 100],
          msg: 'Password must be between 6 and 100 characters long',
        },
      },
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Role',
        key: 'id',
      },
      validate: {
        isInt: {
          msg: 'Role ID must be an integer',
        },
      },
    },
    subscription_status: {
      type: DataTypes.ENUM('cancelled', 'none', 'active', 'expired'),
      defaultValue: 'none',
      allowNull: false,
    },
    subscription_type: {
      type: DataTypes.STRING(20),
      defaultValue: 'free',
      allowNull: false,
    },
    subscription_start: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    subscription_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    refresh_token: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        is: {
          args: /^[a-zA-Z0-9_.-]*$/,
          msg: 'Refresh token can only contain letters, numbers, underscores, dots, and dashes',
        },
      },
    },
  },
  {
    tableName: 'users',
    timestamps: false,
  },
)

// // Define associations
// export const associateUser = (models) => {
//   User.belongsTo(models.Role, {
//     foreignKey: 'role_id',
//     as: 'role',
//   })
// }
// export const associateUserWithSubscription = (models) => {
//   User.hasMany(models.Subscription, {
//     foreignKey: 'user_id',
//     as: 'subscriptions',
//   })
// }
// export const associateUserWithPayment = (models) => {
//   User.hasMany(models.Payment, {
//     foreignKey: 'user_id',
//     as: 'payments',
//   })
// }
