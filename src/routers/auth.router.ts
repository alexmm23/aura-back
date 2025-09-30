// src/routes/auth.router.ts
import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { Op } from 'sequelize'
import {
  loginUser,
  resetPassword,
  validateRefreshToken,
  invalidateSession,
  invalidateAllUserSessions,
  updateSessionRefreshToken,
} from '@/services/user.service'
import { UserLoginAttributes, UserAttributes } from '@/types/user.types'
import { User } from '@/models/user.model'
import { UserAccount } from '@/models/userAccount.model'
import env from '@/config/enviroment'
import { generateRefreshToken, generateToken } from '@/utils/jwt'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { setAuthCookies, clearAuthCookies } from '@/utils/cookies'
import { checkRouteAccess } from '@/middlewares/authorization.middleware'

import { initiatePasswordReset, resetPasswordWithToken } from '@/services/passwordReset.service'

const authRouter = Router()

// LOGIN PARA MÓVIL (con tokens en response)
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const loginData: UserLoginAttributes = req.body
    if (!loginData.email || !loginData.password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const userAgent = req.headers['user-agent'] || 'Unknown'
    const { token, refreshToken } = await loginUser(loginData, 'mobile', userAgent)
    const user = await User.findOne({
      where: { email: loginData.email },
      attributes: { id: true },
    })

    res.status(200).json({ message: 'Login successful', token, refreshToken, userId: user?.id })
  } catch (error: any) {
    res.status(401).json({ error: error.message })
  }
})

// LOGIN PARA WEB (con cookies HttpOnly)
authRouter.post('/login/web', async (req: Request, res: Response) => {
  try {
    const { email, password }: UserLoginAttributes = req.body
    console.log('Login web request:', req.body)

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const userAgent = req.headers['user-agent'] || 'Unknown'
    const { token: accessToken, refreshToken } = await loginUser(
      { email, password },
      'web',
      userAgent,
    )

    // Obtener información del usuario
    const user = await User.findOne({
      where: { email },
      attributes: { exclude: ['password', 'refresh_token'] },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found after login' })
      return
    }

    // Establecer cookies HttpOnly
    setAuthCookies(res, accessToken, refreshToken)

    // Obtener plataformas activas
    const userAccounts = await UserAccount.findAll({
      where: { user_id: user.id },
      attributes: ['platform'],
    })

    const activePlatforms = userAccounts.map((account: any) => account.platform)

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastname: user.lastname,
        activePlatforms,
        role_id: user.role_id,
      },
    })
  } catch (error: any) {
    res.status(401).json({ error: error.message })
  }
})

// VERIFICAR AUTENTICACIÓN (funciona tanto con cookies como con headers)
authRouter.get(
  '/check',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res) => {
    try {
      // console.log('Check auth request:', req.headers, req.cookies)
      const { user } = req
      // console.log('user check', req.user, req.headers, req.cookies)

      if (!user) {
        res.status(401).json({ authenticated: false })
        return
      }

      const userProfile = await User.findOne({
        where: { id: user.id },
        attributes: { exclude: ['password', 'refresh_token'] },
      })

      if (!userProfile) {
        res.status(404).json({ authenticated: false })
        return
      }

      const userAccounts = await UserAccount.findAll({
        where: { user_id: user.id },
        attributes: ['platform'],
      })

      const activePlatforms = userAccounts.map((account: any) => account.platform)

      res.status(200).json({
        authenticated: true,
        user: {
          ...userProfile.toJSON(),
          activePlatforms,
        },
      })
    } catch (error: any) {
      res.status(500).json({ authenticated: false, error: error.message })
    }
  },
)

// REFRESH TOKEN (para móvil)
authRouter.post('/token/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token requerido' })
      return
    }

    const sessionData = await validateRefreshToken(refreshToken)
    if (!sessionData) {
      res.status(401).json({ error: 'Invalid or expired refresh token' })
      return
    }

    const { user } = sessionData
    const newRefreshToken = generateRefreshToken(user.toJSON() as UserAttributes)
    const accessToken = generateToken(user.toJSON() as UserAttributes)

    // Actualizar la sesión actual
    const updateSuccess = await updateSessionRefreshToken(refreshToken, newRefreshToken)
    if (!updateSuccess) {
      res.status(500).json({ error: 'Failed to update session' })
      return
    }

    res.json({ accessToken, refreshToken: newRefreshToken })
  } catch (error: any) {
    res.status(401).json({ error: error.message })
  }
})

// VERIFICAR TOKEN (para móvil)
authRouter.post('/token/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body
    if (!token) {
      res.status(400).json({ error: 'Token is required' })
      return
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload
    if (!decoded || !decoded.exp) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }
    const expired = decoded.exp < Math.floor(Date.now() / 1000)
    res.status(200).json({ expired })
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(403).json({ expired: true })
    } else {
      res.status(401).json({ error: error.message })
    }
  }
})

// Endpoint para solicitar reset
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' })
      return
    }

    const result = await initiatePasswordReset(email)

    // Respuesta genérica por seguridad
    res.status(200).json({
      message: 'If this email exists, a reset link has been sent',
      success: true,
    })
  } catch (error: any) {
    console.error('Reset password error:', error)
    // Respuesta genérica incluso en error para no revelar información
    res.status(200).json({
      message: 'If this email exists, a reset link has been sent',
      success: true,
    })
  }
})

// Nuevo endpoint para verificar token
authRouter.get('/verify-reset-token/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    if (!token) {
      res.status(400).json({
        ok: false,
        data: { error: 'Token is required' },
      })
      return
    }

    const user = await User.findOne({
      where: {
        reset_password_token: token,
        deleted: false,
      },
      attributes: ['id', 'name', 'email', 'reset_password_expires', 'reset_password_token'],
    })

    console.log(
      'Resultado de búsqueda:',
      user
        ? {
            found: true,
            id: user.id,
            storedToken: user.reset_password_token,
            tokensMatch: user.reset_password_token === token,
          }
        : { found: false },
    )

    if (!user) {
      res.status(400).json({
        ok: false,
        data: { error: 'Invalid token' },
      })
      return
    }

    if (!user.reset_password_expires || new Date() > user.reset_password_expires) {
      console.log('Token expirado')
      res.status(400).json({
        ok: false,
        data: { error: 'Token has expired' },
      })
      return
    }

    console.log('Token válido, enviando respuesta exitosa')
    res.status(200).json({
      ok: true,
      data: {
        user: {
          name: user.name,
          email: user.email,
        },
      },
    })
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      data: { error: 'Error verifying token' },
    })
  }
})
// Nuevo endpoint para confirmar nueva contraseña
authRouter.post('/confirm-reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password, confirmPassword } = req.body

    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' })
      return
    }

    // Validar que las contraseñas coincidan
    if (confirmPassword && password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match' })
      return
    }

    // Validar contraseña (ajusta según tus reglas)
    if (password.length < 8) {
      res.status(400).json({
        error: 'Password must be at least 8 characters long',
      })
      return
    }

    // Validar complejidad de contraseña (opcional)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
    if (!passwordRegex.test(password)) {
      res.status(400).json({
        error:
          'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      })
      return
    }

    const result = await resetPasswordWithToken(token, password)

    res.status(200).json({
      message: 'Password reset successfully',
      success: true,
      user: result.user,
    })
  } catch (error: any) {
    console.error('Confirm reset password error:', error)
    res.status(400).json({ error: error.message })
  }
})

authRouter.post('/cleanup-expired-tokens', async (req: Request, res: Response) => {
  try {
    // Limpiar tokens expirados (puedes ejecutar esto como un cron job)
    const result = await User.update(
      {
        reset_password_token: null,
        reset_password_expires: null,
      },
      {
        where: {
          reset_password_expires: {
            [Op.lt]: new Date(), // menor que la fecha actual
          },
        },
      },
    )

    res.status(200).json({
      message: `Cleaned up ${result[0]} expired tokens`,
    })
  } catch (error: any) {
    console.error('Cleanup error:', error)
    res.status(500).json({ error: error.message })
  }
})

// LOGOUT PARA MÓVIL (con tokens)
authRouter.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const refreshToken = req.body.refreshToken

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    if (refreshToken) {
      // Invalidar solo esta sesión específica
      await invalidateSession(refreshToken, user.id!)
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error: any) {
    console.error('Error during logout:', error)
    res.status(500).json({ error: 'An error occurred during logout' })
  }
})

// LOGOUT PARA WEB (limpia cookies)
authRouter.post(
  '/logout/web',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res) => {
    try {
      const { user } = req
      const refreshToken = req.cookies.refreshToken

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (refreshToken) {
        // Invalidar solo esta sesión específica
        await invalidateSession(refreshToken, user.id!)
      }

      // Limpiar cookies
      clearAuthCookies(res)

      res.status(200).json({
        message: 'Logout successful',
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)

// LOGOUT DE TODAS LAS SESIONES
authRouter.post(
  '/logout/all',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      // Invalidar todas las sesiones del usuario
      await invalidateAllUserSessions(user.id!)

      // Limpiar cookies si es una sesión web
      clearAuthCookies(res)

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully',
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)

// VALIDAR ACCESO A RUTA (para móvil y web)
authRouter.post(
  '/validate-route',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { path } = req.body
      const { user } = req

      if (!user || !path) {
        res.status(400).json({
          hasAccess: false,
          reason: 'Missing user or path',
          code: 'MISSING_DATA',
        })
        return
      }

      // Obtener datos actualizados del usuario
      const currentUser = await User.findOne({
        where: { id: user.id, deleted: false },
        attributes: ['id', 'role_id', 'subscription_status', 'subscription_type', 'name', 'email'],
      })

      if (!currentUser) {
        res.status(401).json({
          hasAccess: false,
          reason: 'User not found',
          code: 'USER_NOT_FOUND',
        })
        return
      }

      // Verificar acceso a la ruta
      const hasAccess = checkRouteAccess(path, currentUser.role_id, currentUser.subscription_status)

      res.status(200).json({
        hasAccess,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role_id,
          subscription: currentUser.subscription_status || 'none',
        },
        path,
        timestamp: new Date().toISOString(),
      })
    } catch (error: any) {
      res.status(500).json({
        hasAccess: false,
        reason: error.message,
        code: 'VALIDATION_ERROR',
      })
    }
  },
)

export { authRouter }
