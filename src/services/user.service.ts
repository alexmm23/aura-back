import { User } from '../models/user.model.js'
import { UserAttributes, UserCreationAttributes, UserLoginAttributes } from '../types/user.types.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
export const getAllUsers = async (): Promise<UserAttributes[]> => {
  try {
    const users: Array<UserAttributes> = (
      await User.findAll({
        where: {
          deleted: false,
        },
      })
    ).map((user) => user.toJSON() as UserAttributes)
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
      throw new Error('User already exists')
    }
    // Create a new user
    // Hash the password before saving
    const hashedPassword = await hashPassword(userData.password)
    if (!hashedPassword) {
      throw new Error('Error hashing password')
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
    return newUser.toJSON() as UserAttributes
  } catch (error: any) {
    console.error('Error registering user:', error)
    throw new Error(error.message)
  }
}

const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10)
  return await bcrypt.hash(password, salt)
}
const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword)
}
const generateToken = (user: UserAttributes): string => {
  const secret = process.env.JWT_SECRET
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h'

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables')
  }

  const payload = {
    id: user.id,
    email: user.email,
    role_id: user.role_id, // o el campo correspondiente para el tipo de usuario
  }

  // Firmamos el token con una clave secreta y lo devolvemos
  return jwt.sign(payload, secret, { expiresIn })
}
export const loginUser = async (
  loginData: UserLoginAttributes
): Promise<{ token: string; user: Partial<UserAttributes> }> => {
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

    const isMatch = await comparePassword(
      loginData.password,
      user.getDataValue('password')
    )

    if (!isMatch) {
      throw new Error('Invalid email or password')
    }

    const token = generateToken(user.toJSON() as UserAttributes)

    // Elimina datos sensibles antes de devolver el usuario
    const sanitizedUser = {
      id: user.id,
      name: user.name,
      lastname: user.lastname,
      email: user.email,
      role_id: user.role_id,
    }

    return { token, user: sanitizedUser }
  } catch (error: any) {
    throw new Error(error.message)
  }
}



