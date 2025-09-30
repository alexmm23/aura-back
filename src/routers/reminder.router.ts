import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { UserAttributes } from '@/types/user.types'
import {
  getAllReminders,
  getReminderById,
  createReminder,
  updateReminder,
  deleteReminder,
  markReminderAsSent,
  getPendingReminders,
  getUpcomingReminders,
  getStatistics
} from '@/services/reminder.service'
import {
  CreateReminderRequest,
  UpdateReminderRequest,
  ReminderFilters,
  PaginationOptions
} from '@/types/reminder.types'

const reminderRouter = Router()

// ==================== REMINDER ROUTES ====================

// GET /reminders - Obtener todos los reminders del usuario autenticado
reminderRouter.get('/', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
      return
    }

    const filters: ReminderFilters = {
      status: req.query.status as 'pending' | 'sent',
      frequency: req.query.frequency as 'once' | 'daily' | 'weekly' | 'monthly',
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
      search: req.query.search as string
    }

    const pagination: PaginationOptions = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      sort_by: req.query.sort_by as 'date_time' | 'created_at' | 'title',
      sort_order: req.query.sort_order as 'ASC' | 'DESC'
    }

    const result = await getAllReminders(user.id!, filters, pagination)
    
    res.status(200).json({
      success: true,
      data: result.reminders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// GET /reminders/upcoming - Obtener próximos reminders
reminderRouter.get('/upcoming', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
      return
    }

    const hoursAhead = req.query.hours ? parseInt(req.query.hours as string) : 24
    const reminders = await getUpcomingReminders(user.id!, hoursAhead)
    
    res.status(200).json({
      success: true,
      data: reminders,
      count: reminders.length
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// GET /reminders/statistics - Obtener estadísticas de reminders
reminderRouter.get('/statistics', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
      return
    }

    const stats = await getStatistics(user.id!)
    
    res.status(200).json({
      success: true,
      data: stats
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// GET /reminders/:id - Obtener un reminder específico
reminderRouter.get('/:id', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
      return
    }

    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid reminder ID'
      })
      return
    }

    const reminder = await getReminderById(id, user.id!)
    if (!reminder) {
      res.status(404).json({
        success: false,
        error: 'Reminder not found'
      })
      return
    }

    res.status(200).json({
      success: true,
      data: reminder
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// POST /reminders - Crear nuevo reminder
reminderRouter.post('/', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
      return
    }

    const reminderData: CreateReminderRequest = req.body
    
    // Validaciones básicas
    if (!reminderData.title || !reminderData.date_time) {
      res.status(400).json({
        success: false,
        error: 'Title and date_time are required'
      })
      return
    }

    // Validar que la fecha sea válida
    const reminderDate = new Date(reminderData.date_time)
    if (isNaN(reminderDate.getTime())) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format'
      })
      return
    }

    // Validar que la fecha sea futura
    if (reminderDate <= new Date()) {
      res.status(400).json({
        success: false,
        error: 'Reminder date must be in the future'
      })
      return
    }

    const newReminder = await createReminder(reminderData, user.id!)
    res.status(201).json({
      success: true,
      data: newReminder,
      message: 'Reminder created successfully'
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// PUT /reminders/:id - Actualizar reminder
reminderRouter.put('/:id', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
      return
    }

    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid reminder ID'
      })
      return
    }

    const reminderData: UpdateReminderRequest = req.body

    // Validar fecha si se está actualizando
    if (reminderData.date_time) {
      const reminderDate = new Date(reminderData.date_time)
      if (isNaN(reminderDate.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format'
        })
        return
      }

      if (reminderDate <= new Date()) {
        res.status(400).json({
          success: false,
          error: 'Reminder date must be in the future'
        })
        return
      }
    }

    const updatedReminder = await updateReminder(id, reminderData, user.id!)
    if (!updatedReminder) {
      res.status(404).json({
        success: false,
        error: 'Reminder not found'
      })
      return
    }

    res.status(200).json({
      success: true,
      data: updatedReminder,
      message: 'Reminder updated successfully'
    })
  } catch (error: any) {
    res.status(403).json({
      success: false,
      error: error.message
    })
  }
})

// PATCH /reminders/:id/mark-sent - Marcar reminder como enviado
reminderRouter.patch('/:id/mark-sent', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
      return
    }

    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid reminder ID'
      })
      return
    }

    const updatedReminder = await markReminderAsSent(id, user.id!)
    if (!updatedReminder) {
      res.status(404).json({
        success: false,
        error: 'Pending reminder not found'
      })
      return
    }

    res.status(200).json({
      success: true,
      data: updatedReminder,
      message: 'Reminder marked as sent'
    })
  } catch (error: any) {
    res.status(403).json({
      success: false,
      error: error.message
    })
  }
})

// DELETE /reminders/:id - Eliminar reminder (soft delete)
reminderRouter.delete('/:id', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
      return
    }

    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid reminder ID'
      })
      return
    }

    await deleteReminder(id, user.id!)
    res.status(200).json({
      success: true,
      message: 'Reminder deleted successfully'
    })
  } catch (error: any) {
    res.status(403).json({
      success: false,
      error: error.message
    })
  }
})

// ==================== ADMIN ROUTES (OPTIONAL) ====================

// GET /reminders/admin/pending - Obtener todos los reminders pendientes (para sistema de notificaciones)
reminderRouter.get('/admin/pending', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
      return
    }

    // Aquí podrías agregar verificación de rol de admin si es necesario
    // if (user.role_id !== 1) { ... }

    const filters: ReminderFilters = {
      frequency: req.query.frequency as 'once' | 'daily' | 'weekly' | 'monthly',
      user_id: req.query.user_id ? parseInt(req.query.user_id as string) : undefined
    }

    const pendingReminders = await getPendingReminders(filters)
    
    res.status(200).json({
      success: true,
      data: pendingReminders,
      count: pendingReminders.length
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export { reminderRouter }