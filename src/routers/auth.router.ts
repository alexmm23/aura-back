// src/routes/auth.router.ts
import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { loginUser, resetPassword } from '@/services/user.service'
import { UserLoginAttributes, UserAttributes } from '@/types/user.types'
import { User } from '@/models/user.model'
import { UserAccount } from '@/models/userAccount.model'
import env from '@/config/enviroment'
import { generateRefreshToken, generateToken } from '@/utils/jwt'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { setAuthCookies, clearAuthCookies } from '@/utils/cookies'
import { checkRouteAccess } from '@/middlewares/authorization.middleware'

const authRouter = Router()

// LOGIN PARA MÓVIL (con tokens en response)
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const loginData: UserLoginAttributes = req.body
    if (!loginData.email || !loginData.password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const { token, refreshToken } = await loginUser(loginData)
    res.status(200).json({ message: 'Login successful', token, refreshToken })
  } catch (error: any) {
    res.status(401).json({ error: error.message })
  }
})

// LOGIN PARA WEB (con cookies HttpOnly)
authRouter.post('/login/web', async (req: Request, res: Response) => {
  try {
    const { email, password }: UserLoginAttributes = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const { token: accessToken, refreshToken } = await loginUser({ email, password })

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
      },
    })
  } catch (error: any) {
    res.status(401).json({ error: error.message })
  }
})

// VERIFICAR AUTENTICACIÓN (funciona tanto con cookies como con headers)
authRouter.get('/check', authenticateToken, async (req: Request & { user?: UserAttributes }, res) => {
  try {
    const { user } = req

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
})

// REFRESH TOKEN (para móvil)
authRouter.post('/token/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token requerido' })
      return
    }
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload
    const user = await User.findOne({ where: { id: decoded.id, deleted: false } })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    if (user.refresh_token != refreshToken) {
      res.status(401).json({ error: 'Invalid refresh token' })
      return
    }

    const newRefreshToken = generateRefreshToken(user.toJSON() as UserAttributes)
    const accessToken = generateToken(user.toJSON() as UserAttributes)

    user.refresh_token = newRefreshToken
    await user.save()

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

// RESET PASSWORD
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    const user = await resetPassword(email)
    res.status(200).json({ message: 'Password reset email sent', user })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// LOGOUT PARA MÓVIL (con tokens)
authRouter.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    // Invalida el refresh token en la base de datos
    await User.update(
      { refresh_token: null },
      {
        where: {
          id: user.id,
        },
      },
    )

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
authRouter.post('/logout/web', authenticateToken, async (req: Request & { user?: UserAttributes }, res) => {
  try {
    const { user } = req

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    // Limpiar refresh token de la base de datos
    await User.update(
      { refresh_token: null },
      { where: { id: user.id } }
    )

    // Limpiar cookies
    clearAuthCookies(res)

    res.status(200).json({
      message: 'Logout successful'
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// VALIDAR ACCESO A RUTA (para móvil y web)
authRouter.post('/validate-route', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { path } = req.body
    const { user } = req

    if (!user || !path) {
      res.status(400).json({ 
        hasAccess: false, 
        reason: 'Missing user or path',
        code: 'MISSING_DATA'
      })
      return
    }

    // Obtener datos actualizados del usuario
    const currentUser = await User.findOne({
      where: { id: user.id, deleted: false },
      attributes: ['id', 'role_id', 'subscription_status', 'subscription_type', 'name', 'email']
    })

    if (!currentUser) {
      res.status(401).json({ 
        hasAccess: false, 
        reason: 'User not found',
        code: 'USER_NOT_FOUND'
      })
      return
    }

    // Verificar acceso a la ruta
    const hasAccess = checkRouteAccess(
      path, 
      currentUser.role_id, 
      currentUser.subscription_status
    )

    res.status(200).json({
      hasAccess,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role_id,
        subscription: currentUser.subscription_status || 'none'
      },
      path,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    res.status(500).json({ 
      hasAccess: false, 
      reason: error.message,
      code: 'VALIDATION_ERROR'
    })
  }
})

export { authRouter }
