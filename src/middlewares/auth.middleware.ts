// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { UserAttributes } from '@/types/user.types.js'

export const authenticateToken = async (
  req: Request & { user?: UserAttributes },
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] as string // Obtener el token del encabezado de autorización
  const JWT_SECRET = process.env.JWT_SECRET || 'default_secret' // Clave secreta para verificar el token
  if (!token) {
    res.status(401).json({ error: 'Token not provided' }) // Token no proporcionado
    return
  }

  // Verificar el token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' }) // Token inválido o expirado
    }

    // Almacenar la información del usuario en la solicitud
    req.user = user as UserAttributes
    next() // Continuar con la ejecución de la ruta protegida
  })
}
