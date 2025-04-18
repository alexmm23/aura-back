import { User } from '../models/user.model.js'

export const getAllUsers = async () => {
  try {
    const users = await User.findAll({
      where: {
        deleted: false,
      },
    })
    return users
  } catch (error) {
    console.error('Error fetching users:', error)
    throw new Error('Error fetching users')
  }
}
