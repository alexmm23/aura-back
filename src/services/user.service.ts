import { User } from '../models/user.model.js'
import { UserSession } from '../models/userSession.model.js'
import { UserAttributes, UserCreationAttributes, UserLoginAttributes } from '../types/user.types.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendEmail } from './email.service.js'
import env from '@/config/enviroment'
import { generateRefreshToken, generateToken } from '@/utils/jwt'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { Op } = require('sequelize')
export const getAllUsers = async (): Promise<UserAttributes[]> => {
  try {
    const users: Array<UserAttributes> = (
      await User.findAll({
        where: {
          deleted: false,
        },
      })
    ).map((user: any) => user.toJSON() as UserAttributes)
    return users
  } catch (error: any) {
    console.error('Error fetching users:', error)
    throw new Error('Error fetching users: ' + error.message)
  }
}
export const registerUser = async (userData: UserCreationAttributes): Promise<UserAttributes> => {
  try {
    // Check if the user already exists
    const existingUser = await User.findOne({
      where: {
        email: userData.email,
        deleted: false,
      },
    })
    if (existingUser) {
      throw new Error('El correo electrónico que intenta usar ya fue registrado.')
    }
    // Create a new user
    // Hash the password before saving
    const hashedPassword = await hashPassword(userData.password)
    if (!hashedPassword) {
      throw new Error('Error al hashear la contraseña')
    }
    const newUser = await User.create({
      name: userData.name,
      lastname: userData.lastname,
      email: userData.email,
      password: hashedPassword, // Ahora usamos la contraseña hasheada
      role_id: userData.role_id,
      subscription_status: userData.subscription_status,
      subscription_type: userData.subscription_type,
      subscription_start: userData.subscription_start,
      subscription_end: userData.subscription_end,
    })
    return newUser.toJSON() as UserAttributes // Devolver el nuevo usuario como un objeto JSON
  } catch (error: any) {
    console.error('Error registering user:', error)
    throw new Error(error.message)
  }
}

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10)
  return await bcrypt.hash(password, salt)
}
const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword)
}

export const loginUser = async (
  loginData: UserLoginAttributes,
  deviceType: 'mobile' | 'web' | 'desktop' = 'web',
  deviceInfo?: string,
): Promise<{ token: string; refreshToken: string }> => {
  try {
    const user = await User.findOne({
      where: {
        email: loginData.email,
        deleted: false,
      },
    })

    if (!user) {
      throw new Error('Invalid email or password')
    }

    const isMatch = await comparePassword(loginData.password, user.getDataValue('password'))

    if (!isMatch) {
      throw new Error('Invalid email or password')
    }

    const token = generateToken(user.toJSON() as UserAttributes)
    const refreshToken = generateRefreshToken(user.toJSON() as UserAttributes)

    // Crear nueva sesión en lugar de sobrescribir
    await UserSession.create({
      user_id: user.getDataValue('id'),
      refresh_token: refreshToken,
      device_type: deviceType,
      device_info: deviceInfo,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      is_active: true,
    })

    // Limpiar sesiones expiradas
    await cleanExpiredSessions(user.getDataValue('id'))

    return { token, refreshToken }
  } catch (error: any) {
    throw new Error(error.message)
  }
}

export const resetPassword = async (email: string): Promise<void> => {
  try {
    const user = await User.findOne({
      where: {
        email,
        deleted: false,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }
    const newPassword = generateRandomPassword()
    const hashedPassword = await hashPassword(newPassword)
    await user.update({ password: hashedPassword })
    const emailContent = `
      <h1>Password Reset</h1>
      <p>Your new password is: ${newPassword}</p>
      <p>Please change it after logging in.</p>
    `
    await sendEmail(email, 'Password Reset', emailContent)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

const generateRandomPassword = (): string => {
  const length = 8
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()'
  let password = ''
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length)
    password += charset[randomIndex]
  }
  return password
}

// Función para limpiar sesiones expiradas
export const cleanExpiredSessions = async (userId: number) => {
  await UserSession.update(
    { is_active: false },
    {
      where: {
        user_id: userId,
        expires_at: { [Op.lt]: new Date() },
      },
    },
  )
}

// Validar refresh token desde sesiones
export const validateRefreshToken = async (refreshToken: string) => {
  try {
    const session = await UserSession.findOne({
      where: {
        refresh_token: refreshToken,
        is_active: true,
        expires_at: { [Op.gt]: new Date() },
      },
    })

    if (!session) {
      return null
    }

    // Obtener el usuario asociado a la sesión
    const user = await User.findOne({
      where: {
        id: session.getDataValue('user_id'),
        deleted: false,
      },
    })

    if (!user) {
      return null
    }

    return {
      session,
      user,
    }
  } catch (error) {
    console.error('Error validating refresh token:', error)
    return null
  }
}

// Invalidar sesión específica
export const invalidateSession = async (refreshToken: string, userId: number) => {
  try {
    await UserSession.update(
      { is_active: false },
      {
        where: {
          refresh_token: refreshToken,
          user_id: userId,
        },
      },
    )
    return true
  } catch (error) {
    console.error('Error invalidating session:', error)
    return false
  }
}

// Invalidar todas las sesiones de un usuario
export const invalidateAllUserSessions = async (userId: number) => {
  try {
    await UserSession.update(
      { is_active: false },
      {
        where: {
          user_id: userId,
        },
      },
    )
    return true
  } catch (error) {
    console.error('Error invalidating all user sessions:', error)
    return false
  }
}

// Actualizar refresh token de una sesión
export const updateSessionRefreshToken = async (
  oldRefreshToken: string,
  newRefreshToken: string,
) => {
  try {
    const result = await UserSession.update(
      {
        refresh_token: newRefreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      },
      {
        where: {
          refresh_token: oldRefreshToken,
          is_active: true,
        },
      },
    )
    return result[0] > 0 // Devuelve true si se actualizó al menos una fila
  } catch (error) {
    console.error('Error updating session refresh token:', error)
    return false
  }
}
