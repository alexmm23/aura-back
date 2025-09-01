// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { UserAttributes } from '@/types/user.types'
import env from '@/config/enviroment'

export const authenticateToken = async (
  req: Request & { user?: UserAttributes },
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers['authorization']
  const { JWT_SECRET } = env // Obtener la clave secreta del entorno
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header missing or malformed' }) // Encabezado de autorización faltante o malformado
    return
  }
  const token = authHeader.split(' ')[1] as string // Obtener el token del encabezado de autorización
  if (!token) {
    res.status(401).json({ error: 'Token not provided' }) // Token no proporcionado
    return
  }

  // Verificar el token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    console.log('err', err)
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' }) // Token inválido o expirado
      return
    }

    // Almacenar la información del usuario en la solicitud
    req.user = user as UserAttributes
    next() // Continuar con la ejecución de la ruta protegida
  })
}
