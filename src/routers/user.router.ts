import { Router, Request, Response } from 'express'
import { Op } from 'sequelize'

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

// Endpoint para hashear contraseñas (sin autenticación)
userRouter.post('/hash-password', async (req, res) => {
  try {
    const { password } = req.body
    if (!password) {
      res.status(400).json({ error: 'Password is required' })
      return
    }
    const hashed = await hashPassword(password)
    res.json({ hash: hashed })
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

// GET /api/users/students - Obtener usuarios estudiantes y maestros
userRouter.get(
  '/students',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
        return
      }

      const { role, search, limit = '50' } = req.query

      // Construir filtros
      const whereClause: any = {
        deleted: false, // Solo usuarios activos
      }

      // Filtrar por rol si se especifica
      if (role === 'student') {
        whereClause.role_id = 2 // Asumiendo que role_id 2 es estudiante
      } else if (role === 'teacher') {
        whereClause.role_id = 3 // Asumiendo que role_id 3 es maestro
      } else {
        // Si no se especifica rol, obtener estudiantes y maestros
        whereClause.role_id = [2, 3]
      }

      // Agregar búsqueda por nombre/email si se proporciona
      if (search && typeof search === 'string') {
        const searchTerm = `%${search.trim()}%`
        whereClause[Op.or] = [
          { name: { [Op.like]: searchTerm } },
          { lastname: { [Op.like]: searchTerm } },
          { email: { [Op.like]: searchTerm } },
        ]
      }

      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50))

      // Obtener usuarios
      const users = await User.findAll({
        where: whereClause,
        attributes: [
          'id',
          'name',
          'lastname',
          'email',
          'role_id',
          'subscription_status',
          'created_at',
        ],
        limit: limitNum,
        order: [
          ['name', 'ASC'],
          ['lastname', 'ASC'],
        ],
      })

      // Formatear respuesta
      const formattedUsers = users.map((user: any) => {
        const userData = user.dataValues
        return {
          id: userData.id,
          name: userData.name,
          lastname: userData.lastname,
          email: userData.email,
          full_name: `${userData.name} ${userData.lastname}`,
          role: userData.role_id === 2 ? 'student' : userData.role_id === 3 ? 'teacher' : 'unknown',
          role_id: userData.role_id,
          subscription_status: userData.subscription_status,
          created_at: userData.created_at,
        }
      })

      // Separar por roles si no se filtró específicamente
      let response: any = {
        success: true,
        data: {
          users: formattedUsers,
          total: formattedUsers.length,
        },
      }

      // Si no se especificó rol, agrupar por tipo
      if (!role) {
        const students = formattedUsers.filter((u: any) => u.role === 'student')
        const teachers = formattedUsers.filter((u: any) => u.role === 'teacher')

        response.data = {
          students,
          teachers,
          total: {
            students: students.length,
            teachers: teachers.length,
            all: formattedUsers.length,
          },
        }
      }

      res.json(response)
    } catch (error: any) {
      console.error('Error getting students/teachers:', error)
      res.status(500).json({
        error: 'Error al obtener usuarios',
        details: error.message,
      })
    }
  },
)

export { userRouter }
