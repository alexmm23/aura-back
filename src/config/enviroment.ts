import * as dotenv from 'dotenv'

// Cargar variables de entorno desde el archivo .env
dotenv.config()

// Validar y limpiar las variables de entorno
const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'database',
  JWT_SECRET: process.env.JWT_SECRET || 'secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'refresh_secret',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:8081',
  AT_EXPIRATION: process.env.AT_EXPIRATION || '1d',
  RT_EXPIRATION: process.env.RT_EXPIRATION || '7d',
}
export default env
