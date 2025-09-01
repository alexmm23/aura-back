// Config here
import { createRequire } from 'module'
import dotenv from 'dotenv'

// Workaround for ES modules with CommonJS packages
const require = createRequire(import.meta.url)
const { Sequelize } = require('sequelize')

dotenv.config()

// Configuración de la base de datos
let sequelize: any

if (process.env.MYSQL_URL) {
  // Usar URL completa de Railway/producción
  sequelize = new Sequelize(process.env.MYSQL_URL, {
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      ssl:
        process.env.NODE_ENV === 'production'
          ? {
              require: true,
              rejectUnauthorized: false,
            }
          : false,
    },
  })
} else {
  // Usar variables individuales para desarrollo local
  sequelize = new Sequelize(
    process.env.DB_NAME || 'database',
    process.env.DB_USER || 'database',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      dialect: 'mysql',
      logging: false,
    },
  )
}

export { sequelize }
