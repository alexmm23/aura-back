// src/routes/auth.router.ts
import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { loginUser, resetPassword } from '@/services/user.service'
import { UserLoginAttributes, UserAttributes } from '@/types/user.types'
import { User } from '@/models/user.model'
import env from '@/config/enviroment'
import { generateRefreshToken, generateToken } from '@/utils/jwt'

const authRouter = Router()

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
    console.log('user', user)
    console.log('refreshToken', refreshToken)
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

export { authRouter }
