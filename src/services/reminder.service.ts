import { Reminder } from '../models/reminder.model.js'
import { User } from '../models/user.model.js'
import { 
  ReminderCreationAttributes, 
  ReminderAttributes,
  ReminderUpdateAttributes,
  ReminderFilters,
  ReminderWithUser,
  CreateReminderRequest,
  UpdateReminderRequest,
  PaginatedReminders,
  PaginationOptions
} from '../types/reminder.types.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { Op } = require('sequelize')

// ==================== REMINDER SERVICES ====================

export const getAllReminders = async (
  userId: number, 
  filters: ReminderFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedReminders> => {
  try {
    const page = pagination.page || 1
    const limit = pagination.limit || 10
    const offset = (page - 1) * limit
    const sortBy = pagination.sort_by || 'date_time'
    const sortOrder = pagination.sort_order || 'ASC'

    const whereConditions: any = {
      user_id: userId,
      deleted: false
    }

    // Aplicar filtros
    if (filters.status) whereConditions.status = filters.status
    if (filters.frequency) whereConditions.frequency = filters.frequency
    if (filters.date_from && filters.date_to) {
      whereConditions.date_time = {
        [Op.between]: [new Date(filters.date_from), new Date(filters.date_to)]
      }
    } else if (filters.date_from) {
      whereConditions.date_time = {
        [Op.gte]: new Date(filters.date_from)
      }
    } else if (filters.date_to) {
      whereConditions.date_time = {
        [Op.lte]: new Date(filters.date_to)
      }
    }

    if (filters.search) {
      whereConditions[Op.or] = [
        { title: { [Op.like]: `%${filters.search}%` } },
        { description: { [Op.like]: `%${filters.search}%` } }
      ]
    }

    const { count, rows } = await Reminder.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email']
        }
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset
    })

    const reminders = rows.map((reminder: any) => reminder.toJSON()) as ReminderWithUser[]

    return {
      reminders,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  } catch (error: any) {
    console.error('Error fetching reminders:', error)
    throw new Error('Error fetching reminders: ' + error.message)
  }
}

export const getReminderById = async (id: number, userId: number): Promise<ReminderWithUser | null> => {
  try {
    const reminder = await Reminder.findOne({
      where: { 
        id, 
        user_id: userId,
        deleted: false 
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email']
        }
      ]
    })

    if (!reminder) return null

    return reminder.toJSON() as ReminderWithUser
  } catch (error: any) {
    console.error('Error fetching reminder:', error)
    throw new Error('Error fetching reminder: ' + error.message)
  }
}

export const createReminder = async (
  reminderData: CreateReminderRequest, 
  userId: number
): Promise<ReminderWithUser> => {
  try {
    // Validar que la fecha sea futura
    const reminderDate = new Date(reminderData.date_time)
    if (reminderDate <= new Date()) {
      throw new Error('Reminder date must be in the future')
    }

    const newReminder = await Reminder.create({
      title: reminderData.title,
      description: reminderData.description,
      date_time: reminderDate,
      frequency: reminderData.frequency || 'once',
      user_id: userId,
      status: 'pending'
    })

    // Obtener el reminder completo con relaciones
    const reminderWithUser = await getReminderById(
      newReminder.getDataValue('id'), 
      userId
    )

    return reminderWithUser!
  } catch (error: any) {
    console.error('Error creating reminder:', error)
    throw new Error('Error creating reminder: ' + error.message)
  }
}

export const updateReminder = async (
  id: number, 
  reminderData: UpdateReminderRequest, 
  userId: number
): Promise<ReminderWithUser | null> => {
  try {
    const reminder = await Reminder.findOne({ 
      where: { 
        id, 
        user_id: userId,
        deleted: false 
      } 
    })
    
    if (!reminder) {
      throw new Error('Reminder not found')
    }

    // Validar fecha si se está actualizando
    if (reminderData.date_time) {
      const reminderDate = new Date(reminderData.date_time)
      if (reminderDate <= new Date()) {
        throw new Error('Reminder date must be in the future')
      }
    }

    const updateData: any = {}
    if (reminderData.title !== undefined) updateData.title = reminderData.title
    if (reminderData.description !== undefined) updateData.description = reminderData.description
    if (reminderData.date_time !== undefined) updateData.date_time = new Date(reminderData.date_time)
    if (reminderData.frequency !== undefined) updateData.frequency = reminderData.frequency
    if (reminderData.status !== undefined) updateData.status = reminderData.status

    await reminder.update(updateData)

    const updatedReminder = await getReminderById(id, userId)
    return updatedReminder
  } catch (error: any) {
    console.error('Error updating reminder:', error)
    throw new Error('Error updating reminder: ' + error.message)
  }
}

export const deleteReminder = async (id: number, userId: number): Promise<boolean> => {
  try {
    const reminder = await Reminder.findOne({ 
      where: { 
        id, 
        user_id: userId,
        deleted: false 
      } 
    })
    
    if (!reminder) {
      throw new Error('Reminder not found')
    }

    await reminder.update({ deleted: true })
    return true
  } catch (error: any) {
    console.error('Error deleting reminder:', error)
    throw new Error('Error deleting reminder: ' + error.message)
  }
}

export const markReminderAsSent = async (id: number, userId: number): Promise<ReminderWithUser | null> => {
  try {
    const reminder = await Reminder.findOne({ 
      where: { 
        id, 
        user_id: userId,
        deleted: false,
        status: 'pending'
      } 
    })
    
    if (!reminder) {
      throw new Error('Pending reminder not found')
    }

    await reminder.update({ status: 'sent' })

    const updatedReminder = await getReminderById(id, userId)
    return updatedReminder
  } catch (error: any) {
    console.error('Error marking reminder as sent:', error)
    throw new Error('Error marking reminder as sent: ' + error.message)
  }
}

// ==================== ADMIN/SYSTEM SERVICES ====================

export const getPendingReminders = async (filters: ReminderFilters = {}): Promise<ReminderWithUser[]> => {
  try {
    const whereConditions: any = {
      status: 'pending',
      deleted: false,
      date_time: { [Op.lte]: new Date() } // Solo reminders que ya deberían haberse enviado
    }

    if (filters.frequency) whereConditions.frequency = filters.frequency
    if (filters.user_id) whereConditions.user_id = filters.user_id

    const reminders = await Reminder.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email']
        }
      ],
      order: [['date_time', 'ASC']]
    })

    return reminders.map((reminder: any) => reminder.toJSON()) as ReminderWithUser[]
  } catch (error: any) {
    console.error('Error fetching pending reminders:', error)
    throw new Error('Error fetching pending reminders: ' + error.message)
  }
}

export const getUpcomingReminders = async (
  userId: number, 
  hoursAhead: number = 24
): Promise<ReminderWithUser[]> => {
  try {
    const now = new Date()
    const futureDate = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000))

    const reminders = await Reminder.findAll({
      where: {
        user_id: userId,
        status: 'pending',
        deleted: false,
        date_time: {
          [Op.between]: [now, futureDate]
        }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email']
        }
      ],
      order: [['date_time', 'ASC']]
    })

    return reminders.map((reminder: any) => reminder.toJSON()) as ReminderWithUser[]
  } catch (error: any) {
    console.error('Error fetching upcoming reminders:', error)
    throw new Error('Error fetching upcoming reminders: ' + error.message)
  }
}

export const getStatistics = async (userId: number): Promise<any> => {
  try {
    const totalReminders = await Reminder.count({
      where: { user_id: userId, deleted: false }
    })

    const pendingReminders = await Reminder.count({
      where: { user_id: userId, status: 'pending', deleted: false }
    })

    const sentReminders = await Reminder.count({
      where: { user_id: userId, status: 'sent', deleted: false }
    })

    const upcomingToday = await Reminder.count({
      where: {
        user_id: userId,
        status: 'pending',
        deleted: false,
        date_time: {
          [Op.between]: [
            new Date(new Date().setHours(0, 0, 0, 0)),
            new Date(new Date().setHours(23, 59, 59, 999))
          ]
        }
      }
    })

    return {
      total: totalReminders,
      pending: pendingReminders,
      sent: sentReminders,
      upcoming_today: upcomingToday
    }
  } catch (error: any) {
    console.error('Error fetching statistics:', error)
    throw new Error('Error fetching statistics: ' + error.message)
  }
}