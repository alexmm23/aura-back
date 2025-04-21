import { User } from '../models/user.model.js'
import { UserAttributes, UserCreationAttributes } from '../types/user.types.js'

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
    const newUser = await User.create(userData as any)
    return newUser.toJSON() as UserAttributes
  } catch (error: any) {
    console.error('Error registering user:', error)
    throw new Error('Error registering user: ' + error.message)
  }
}
