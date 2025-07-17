import { createRequire } from 'module'
import { sequelize } from '../config/database.js'

const require = createRequire(import.meta.url)
const { DataTypes } = require('sequelize')

const Content = sequelize.define('Content', {
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
      model: 'Page',
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
    comment: 'For images: file path, for text: content, for video/audio: file path'
  },
  x: {
    type: DataTypes.FLOAT, // Cambiado a FLOAT para mayor precisión
    allowNull: false,
    defaultValue: 0,
  },
  y: {
    type: DataTypes.FLOAT, // Cambiado a FLOAT para mayor precisión
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
}, {
  tableName: 'Contents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: false,
  
  // Hooks para limpiar archivos cuando se elimina un registro
  hooks: {
    beforeDestroy: async (instance: { type: string; data: string }) => {

      if (instance.type === 'image' && instance.data) {
        // Importar dinámicamente la función de eliminación
        const { deleteImageFile } = await import('../services/sendnote.service.js')
        await deleteImageFile(instance.data)
      }
    }
  }
})

export default Content
