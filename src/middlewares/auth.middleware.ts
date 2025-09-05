// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { UserAttributes } from '@/types/user.types'
import env from '@/config/enviroment'

export const authenticateToken = (
  req: Request & { user?: UserAttributes },
  res: Response,
  next: NextFunction,
) => {
  // Prioridad: 1. Cookie, 2. Authorization header (para compatibilidad móvil)
  const tokenFromCookie = req.cookies?.accessToken
  const authHeader = req.headers['authorization']
  const tokenFromHeader = authHeader && authHeader.split(' ')[1]
  
  const token = tokenFromCookie || tokenFromHeader

  if (!token) {
    res.status(401).json({ error: 'Access token required' })
    return
  }

  jwt.verify(token, env.JWT_SECRET, (err: any, user: any) => {
    if (err) {
      // Si el token expiró, intentar renovar con refresh token
      if (err.name === 'TokenExpiredError' && req.cookies?.refreshToken) {
        return handleTokenRefresh(req, res, next)
      }
      res.status(403).json({ error: 'Invalid or expired token' })
      return
    }
    req.user = user as UserAttributes
    next()
  })
}

const handleTokenRefresh = async (
  req: Request & { user?: UserAttributes },
  res: Response,
  next: NextFunction,
) => {
  const refreshToken = req.cookies?.refreshToken

  if (!refreshToken) {
    res.status(401).json({ error: 'Refresh token required' })
    return
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as any
    
    // Verificar que el refresh token existe en la base de datos
    const { User } = await import('@/models/user.model')
    const user = await User.findOne({
      where: { id: decoded.id, refresh_token: refreshToken }
    })

    if (!user) {
      res.status(403).json({ error: 'Invalid refresh token' })
      return
    }

    // Generar nuevo access token
    const { generateToken } = await import('@/utils/jwt')
    const userData = { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      lastname: user.lastname, 
      password: user.password, 
      role_id: user.role_id 
    }
    const newAccessToken = generateToken(userData)

    // Actualizar cookie
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/'
    })

    req.user = userData as UserAttributes
    next()
  } catch (error) {
    res.status(403).json({ error: 'Invalid refresh token' })
  }
}
