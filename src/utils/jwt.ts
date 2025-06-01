import jwt from 'jsonwebtoken'
import { UserAttributes } from '@/types/user.types.js'
import env from '@/config/enviroment.js'
import { User } from '@/models/user.model.js'

// Generar un token JWT para el usuario (Access Token)
export const generateToken = (user: UserAttributes): string => {
  const { JWT_SECRET: secret } = env // Obtener la clave secreta del entorno
  const { AT_EXPIRATION: expiresIn } = env

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables')
  }
  const { id, email, role_id } = user // Desestructurar el id y el email del usuario
  const payload = {
    id,
    email,
    role_id,
  }

  // Firmamos el token con una clave secreta y lo devolvemos
  return jwt.sign(payload, secret, { expiresIn } as any)
}
export const generateRefreshToken = (user: any) => {
  const { JWT_REFRESH_SECRET, RT_EXPIRATION } = env // Obtener la clave secreta del entorno

  if (!JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is not defined in environment variables')
  }

  const payload = {
    id: user.id,
    email: user.email,
    role_id: user.role_id,
  }

  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: RT_EXPIRATION } as any) // Firmamos el token con una clave secreta y lo devolvemos
}
