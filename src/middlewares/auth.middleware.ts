// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { UserAttributes } from '../types/user.types.js'

export const authenticateToken = async (
  req: Request & { user?: UserAttributes },
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // El token viene después de 'Bearer'

  if (!token) {
    return res.status(401).json({ error: 'Access denied, no token provided' })
  }

  // Verificar el token
  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' }) // Token inválido o expirado
    }

    // Almacenar la información del usuario en la solicitud
    req.user = user as UserAttributes
    next() // Continuar con la ejecución de la ruta protegida
  })
}
