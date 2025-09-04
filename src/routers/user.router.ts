import { Router, Request, Response } from 'express'

import {
  getAllUsers,
  loginUser,
  registerUser,
  resetPassword,
  hashPassword,
} from '@/services/user.service'
import { UserAttributes, UserLoginAttributes } from '@/types/user.types'
import { authenticateToken } from '@/middlewares/auth.middleware'
import jwt from 'jsonwebtoken'
import { User } from '@/models/user.model'
import env from '@/config/enviroment'
import { generateRefreshToken, generateToken } from '@/utils/jwt'
import { UserAccount } from '@/models/userAccount.model'

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

// Ruta protegida que requiere autenticación
userRouter.get(
  '/profile',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res) => {
    try {
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      const userProfile = await User.findOne({
        where: {
          id: user.id,
        },
        attributes: { exclude: ['password', 'refresh_token', 'id', 'role_id'] },
      })

      if (!userProfile) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      const userAccounts = await UserAccount.findAll({
        where: {
          user_id: user.id,
        },
        attributes: ['platform'],
      })

      const activePlatforms = userAccounts.map((account: any) => account.platform)

      res.status(200).json({
        message: 'User profile',
        user: { ...userProfile?.toJSON?.(), activePlatforms },
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)

userRouter.patch(
  '/update',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res) => {
    try {
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      console.log('user', user)
      const { id, ...updateData } = req.body
      if (updateData.password) {
        const hashedPassword = await hashPassword(updateData.password)
        updateData.password = hashedPassword
      }

      const [affectedRows] = await User.update(updateData, {
        where: {
          id: user.id,
        },
      })
      if (affectedRows === 0) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      const updatedUser = await User.findOne({
        where: {
          id: user.id,
        },
      })

      res.status(200).json({
        message: 'User updated successfully',
        user: updatedUser as UserAttributes,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)
userRouter.delete(
  '/delete/:id',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res) => {
    try {
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const { id } = req.params
      if (!id) {
        res.status(400).json({ error: 'User ID is required' })
        return
      }

      await User.update(
        { deleted: true },
        {
          where: {
            id,
          },
        },
      )
      const deletedUser = await User.findOne({
        where: {
          id,
        },
      })
      if (!deletedUser) {
        res.status(404).json({ error: ' User not found' })
        return
      }

      res.status(200).json({
        message: 'User deleted',
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)
userRouter.get(
  '/logout',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res) => {
    try {
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      await User.update(
        { refresh_token: null },
        {
          where: {
            id: user.id,
          },
        },
      )

      res.status(200).json({
        message: 'User logged out',
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)

export { userRouter }
