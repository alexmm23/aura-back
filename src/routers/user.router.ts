import { Router, Request, Response } from 'express'

import { getAllUsers, loginUser, registerUser, resetPassword } from '@/services/user.service'
import { UserAttributes, UserLoginAttributes } from '@/types/user.types'
import { authenticateToken } from '@/middlewares/auth.middleware'
import jwt from 'jsonwebtoken'
import { User } from '@/models/user.model'
import env from '@/config/enviroment'
import { generateRefreshToken, generateToken } from '@/utils/jwt'

const userRouter = Router()

userRouter.get('/', async (req, res) => {
  try {
    const users = await getAllUsers()
    res.status(200).json(users)
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error ${error}` })
  }
})

userRouter.post('/create', async (req, res) => {
  try {
    const user = await registerUser(req.body)
    res.status(201).json(user)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Iniciar sesión (login)
userRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const loginData: UserLoginAttributes = req.body

    if (!loginData.email || !loginData.password) {
      res.status(400).json({ error: 'Email and password are required' })
    }

    const { token, refreshToken } = await loginUser(req.body)

    res.status(200).json({
      message: 'Login successful',
      token,
      refreshToken,
    })
  } catch (error: any) {
    res.status(401).json({ error: error.message })
  }
})

userRouter.post('/token/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token requerido' })
    }
    const { JWT_REFRESH_SECRET } = env

    // Verificar el refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as jwt.JwtPayload

    // Verificar si el refresh token está en la base de datos
    const user = await User.findOne({
      where: {
        id: decoded.id,
        deleted: false,
      },
    })
    if (!user || user.refresh_token !== refreshToken) {
      res.status(403).json({ error: 'Refresh token inválido' })
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

userRouter.post('/reset-password/', async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      res.status(400).json({ error: 'Email is required' })
    }

    const user = await resetPassword(email)

    res.status(200).json({
      message: 'Password reset email sent',
      user,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Ruta protegida que requiere autenticación
userRouter.get(
  '/profile',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res) => {
    try {
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
      }

      res.status(200).json({
        message: 'User profile',
        user,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)

export { userRouter }
