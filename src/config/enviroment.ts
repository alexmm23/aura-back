import * as dotenv from 'dotenv'
//Cargar credenciales de Google desde el archivo classroom_web_credentials.json
import * as fs from 'fs'

// Cargar variables de entorno desde el archivo .env
dotenv.config()

// Cargar credenciales de Google desde el archivo classroom_web_credentials.json
const credentialsPath = 'classroom_web_credentials.json'
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))
const { client_id, client_secret, redirect_uris } = credentials.web

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
  GOOGLE_CLIENT_ID: client_id || process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: client_secret || process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: redirect_uris || process.env.GOOGLE_REDIRECT_URIS || '',
  API_BASE_PATH: process.env.API_BASE_PATH || '/api',
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8081',
  SERVER_URL: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`,
  MS_CLIENT_ID: process.env.MS_CLIENT_ID || '',
  MS_TENANT_ID: process.env.MS_TENANT_ID || '',
  MS_CLIENT_SECRET: process.env.MS_CLIENT_SECRET || '',
}

export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'
export const PORT = process.env.PORT || 3000
export const API_BASE_PATH = process.env.API_BASE_PATH || '/api'
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
export const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || ''
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ''
export const GOOGLE_DRIVE_CREDENTIALS = process.env.GOOGLE_DRIVE_CREDENTIALS || ''

export default env
