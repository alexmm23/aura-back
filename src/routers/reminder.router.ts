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
  getStatistics,
  sendReminderEmail,
  sendUpcomingRemindersNotification,
  checkAndSendPendingReminders
} from '@/services/reminder.service'
import {
  CreateReminderRequest,
  UpdateReminderRequest,
  ReminderFilters,
  PaginationOptions
} from '@/types/reminder.types'
import nodemailer from 'nodemailer'
import { User } from '@/models/user.model'

const reminderRouter = Router()

// ==================== REMINDER ROUTES ====================

// GET /reminders - Obtener todos los reminders del usuario autenticado
reminderRouter.get('/', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
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
reminderRouter.get('/upcoming', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
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

// GET /reminders/pending-home - Obtener recordatorios pendientes para la página de inicio
reminderRouter.get('/pending-home', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
      return
    }

    // Obtener los próximos 5 recordatorios pendientes ordenados por fecha
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5
    
    const reminders = await getAllReminders(
      user.id!, 
      { 
        status: 'pending',
        date_from: new Date().toISOString() // Solo recordatorios futuros
      },
      {
        limit,
        sort_by: 'date_time',
        sort_order: 'ASC'
      }
    )
    
    res.status(200).json({
      success: true,
      data: reminders.reminders,
      count: reminders.reminders.length
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// GET /reminders/statistics - Obtener estadísticas de reminders
reminderRouter.get('/statistics', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
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
reminderRouter.get('/:id', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
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
reminderRouter.post('/', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
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
reminderRouter.put('/:id', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
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
reminderRouter.patch('/:id/mark-sent', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
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
reminderRouter.delete('/:id', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
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

// POST /reminders/:id/send-email - Enviar recordatorio por email manualmente
reminderRouter.post('/:id/send-email', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const success = await sendReminderEmail(parseInt(id), userId)
    
    if (success) {
      res.json({ 
        success: true,
        message: 'Recordatorio enviado por email exitosamente' 
      })
    } else {
      res.status(400).json({ 
        success: false,
        message: 'No se pudo enviar el recordatorio por email' 
      })
    }
  } catch (error: any) {
    console.error('Error sending reminder email:', error)
    res.status(500).json({ 
      success: false,
      message: error.message || 'Error interno del servidor'
    })
  }
})

// POST /reminders/send-upcoming - Enviar notificación de recordatorios próximos
reminderRouter.post('/send-upcoming', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    const { hours = 2 } = req.body

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    await sendUpcomingRemindersNotification(userId, hours)
    
    res.json({ 
      success: true,
      message: 'Notificación de recordatorios próximos enviada'
    })
  } catch (error: any) {
    console.error('Error sending upcoming reminders:', error)
    res.status(500).json({ 
      success: false,
      message: error.message || 'Error interno del servidor'
    })
  }
})

// POST /reminders/check-pending - Revisar y enviar recordatorios pendientes
reminderRouter.post('/check-pending', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
  try {
    await checkAndSendPendingReminders()
    
    res.json({ 
      success: true,
      message: 'Verificación de recordatorios pendientes completada'
    })
  } catch (error: any) {
    console.error('Error checking pending reminders:', error)
    res.status(500).json({ 
      success: false,
      message: error.message || 'Error interno del servidor'
    })
  }
})

// Ruta temporal para testing emails
reminderRouter.post('/test-email', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const user = await User.findByPk(userId)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    console.log('🧪 Testing email send...')
    console.log('📧 User email:', user.getDataValue('email'))
    console.log('🔑 API Key exists:', !!process.env.RESEND_API_KEY)
    console.log('🌐 Domain:', process.env.DOMAIN)

    const emailTransporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    })

    const result = await emailTransporter.sendMail({
      from: `"AURA Test" <noreply@${process.env.DOMAIN}>`,
      to: user.getDataValue('email'),
      subject: '🧪 Test Email from AURA',
      html: '<h1>¡Test exitoso!</h1><p>Si recibes este email, la configuración está funcionando.</p>',
    })

    console.log('✅ Test email sent:', result.messageId)

    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      messageId: result.messageId 
    })
  } catch (error: any) {
    console.error('❌ Test email failed:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: {
        code: error.code,
        response: error.response
      }
    })
  }
})

// ==================== WEBHOOK ROUTES (DEVELOPMENT) ====================

// POST /reminders/webhook/check-pending - Webhook para revisar recordatorios pendientes
reminderRouter.post('/webhook/check-pending', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🎣 Webhook triggered: Checking pending reminders...')
    
    const startTime = Date.now()
    await checkAndSendPendingReminders()
    const endTime = Date.now()
    
    res.status(200).json({
      success: true,
      message: 'Pending reminders check completed',
      executionTime: `${endTime - startTime}ms`,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('❌ Webhook error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// POST /reminders/webhook/send-upcoming - Webhook para recordatorios próximos
reminderRouter.post('/webhook/send-upcoming', async (req: Request, res: Response): Promise<void> => {
  try {
    const { hours = 2 } = req.body
    console.log(`🎣 Webhook triggered: Sending upcoming reminders (${hours}h ahead)...`)
    
    // Obtener todos los usuarios únicos con recordatorios próximos
    const allUpcoming = await getUpcomingReminders(0, hours) // 0 = todos los usuarios
    
    const userMap = new Map()
    allUpcoming.forEach(reminder => {
      if (reminder.user && !userMap.has(reminder.user_id)) {
        userMap.set(reminder.user_id, reminder.user)
      }
    })

    let sentCount = 0
    for (const [userId] of userMap) {
      try {
        await sendUpcomingRemindersNotification(userId, hours)
        sentCount++
      } catch (error: any) {
        console.error(`❌ Failed to send upcoming notification to user ${userId}:`, error.message)
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Upcoming notifications sent to ${sentCount} users`,
      totalUsers: userMap.size,
      sentCount,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('❌ Webhook error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// GET /reminders/webhook/status - Ver estado de recordatorios
reminderRouter.get('/webhook/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date()
    
    // Estadísticas globales
    const pendingReminders = await getPendingReminders({
      date_to: now.toISOString()
    })
    
    const upcomingReminders = await getUpcomingReminders(0, 24) // próximas 24h
    
    const stats = {
      timestamp: now.toISOString(),
      pending: {
        count: pendingReminders.length,
        ready_to_send: pendingReminders.filter(r => new Date(r.date_time) <= now).length,
        details: pendingReminders.slice(0, 5).map(r => ({
          id: r.id,
          title: r.title,
          date_time: r.date_time,
          user_email: r.user?.email,
          overdue_minutes: Math.round((now.getTime() - new Date(r.date_time).getTime()) / 60000)
        }))
      },
      upcoming: {
        count: upcomingReminders.length,
        next_24h: upcomingReminders.length,
        details: upcomingReminders.slice(0, 5).map(r => ({
          id: r.id,
          title: r.title,
          date_time: r.date_time,
          user_email: r.user?.email,
          hours_until: Math.round((new Date(r.date_time).getTime() - now.getTime()) / 3600000)
        }))
      },
      system: {
        server_time: now.toISOString(),
        environment: process.env.NODE_ENV || 'development',
        resend_configured: !!process.env.RESEND_API_KEY
      }
    }
    
    res.status(200).json({
      success: true,
      data: stats
    })
  } catch (error: any) {
    console.error('❌ Status webhook error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export { reminderRouter }