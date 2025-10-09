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
  PaginationOptions,
} from '../types/reminder.types.js'
import { createRequire } from 'module'
import nodemailer from 'nodemailer'
import env from '@/config/enviroment'

const require = createRequire(import.meta.url)
const { Op } = require('sequelize')

// Configurar el transportador de email
const emailTransporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 587,
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: 'resend',
    pass: process.env.RESEND_API_KEY, // Usar directamente process.env
  },
})

// Agregar esta función para testing
const testEmailConnection = async () => {
  try {
    await emailTransporter.verify()
    console.log('✅ Email server connection successful')
    return true
  } catch (error) {
    console.error('❌ Email server connection failed:', error)
    return false
  }
}

// ==================== REMINDER SERVICES ====================

export const getAllReminders = async (
  userId: number,
  filters: ReminderFilters = {},
  pagination: PaginationOptions = {},
): Promise<PaginatedReminders> => {
  try {
    const page = pagination.page || 1
    const limit = pagination.limit || 10
    const offset = (page - 1) * limit
    const sortBy = pagination.sort_by || 'date_time'
    const sortOrder = pagination.sort_order || 'ASC'

    const whereConditions: any = {
      user_id: userId,
      deleted: false,
    }

    // Aplicar filtros
    if (filters.status) whereConditions.status = filters.status
    if (filters.frequency) whereConditions.frequency = filters.frequency
    if (filters.date_from && filters.date_to) {
      whereConditions.date_time = {
        [Op.between]: [new Date(filters.date_from), new Date(filters.date_to)],
      }
    } else if (filters.date_from) {
      whereConditions.date_time = {
        [Op.gte]: new Date(filters.date_from),
      }
    } else if (filters.date_to) {
      whereConditions.date_time = {
        [Op.lte]: new Date(filters.date_to),
      }
    }

    if (filters.search) {
      whereConditions[Op.or] = [
        { title: { [Op.like]: `%${filters.search}%` } },
        { description: { [Op.like]: `%${filters.search}%` } },
      ]
    }

    const { count, rows } = await Reminder.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email'],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset,
    })

    const reminders = rows.map((reminder: any) => reminder.toJSON()) as ReminderWithUser[]

    return {
      reminders,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    }
  } catch (error: any) {
    console.error('Error fetching reminders:', error)
    throw new Error('Error fetching reminders: ' + error.message)
  }
}

export const getReminderById = async (
  id: number,
  userId: number,
): Promise<ReminderWithUser | null> => {
  try {
    const reminder = await Reminder.findOne({
      where: {
        id,
        user_id: userId,
        deleted: false,
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email'],
        },
      ],
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
  userId: number,
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
      status: 'pending',
    })

    // Obtener el reminder completo con relaciones
    const reminderWithUser = await getReminderById(newReminder.getDataValue('id'), userId)

    return reminderWithUser!
  } catch (error: any) {
    console.error('Error creating reminder:', error)
    throw new Error('Error creating reminder: ' + error.message)
  }
}

export const updateReminder = async (
  id: number,
  reminderData: UpdateReminderRequest,
  userId: number,
): Promise<ReminderWithUser | null> => {
  try {
    const reminder = await Reminder.findOne({
      where: {
        id,
        user_id: userId,
        deleted: false,
      },
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
    if (reminderData.date_time !== undefined)
      updateData.date_time = new Date(reminderData.date_time)
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
        deleted: false,
      },
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

export const markReminderAsSent = async (
  id: number,
  userId: number,
): Promise<ReminderWithUser | null> => {
  try {
    const reminder = await Reminder.findOne({
      where: {
        id,
        user_id: userId,
        deleted: false,
        status: 'pending',
      },
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

export const getPendingReminders = async (
  filters: ReminderFilters = {},
): Promise<ReminderWithUser[]> => {
  try {
    const whereConditions: any = {
      status: 'pending',
      deleted: false,
      date_time: { [Op.lte]: new Date() },
    }

    if (filters.frequency) whereConditions.frequency = filters.frequency
    if (filters.user_id) whereConditions.user_id = filters.user_id

    const reminders = await Reminder.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email'],
        },
      ],
      order: [['date_time', 'ASC']],
    })

    return reminders.map((reminder: any) => reminder.toJSON()) as ReminderWithUser[]
  } catch (error: any) {
    console.error('Error fetching pending reminders:', error)
    throw new Error('Error fetching pending reminders: ' + error.message)
  }
}

export const getUpcomingReminders = async (
  userId: number,
  hoursAhead: number = 24,
): Promise<ReminderWithUser[]> => {
  try {
    const now = new Date()
    const futureDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

    const whereConditions: any = {
      status: 'pending',
      deleted: false,
      date_time: {
        [Op.between]: [now, futureDate],
      },
    }

    // Si userId es 0, obtener de todos los usuarios
    if (userId > 0) {
      whereConditions.user_id = userId
    }

    const reminders = await Reminder.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email'],
        },
      ],
      order: [['date_time', 'ASC']],
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
      where: { user_id: userId, deleted: false },
    })

    const pendingReminders = await Reminder.count({
      where: { user_id: userId, status: 'pending', deleted: false },
    })

    const sentReminders = await Reminder.count({
      where: { user_id: userId, status: 'sent', deleted: false },
    })

    const upcomingToday = await Reminder.count({
      where: {
        user_id: userId,
        status: 'pending',
        deleted: false,
        date_time: {
          [Op.between]: [
            new Date(new Date().setHours(0, 0, 0, 0)),
            new Date(new Date().setHours(23, 59, 59, 999)),
          ],
        },
      },
    })

    return {
      total: totalReminders,
      pending: pendingReminders,
      sent: sentReminders,
      upcoming_today: upcomingToday,
    }
  } catch (error: any) {
    console.error('Error fetching statistics:', error)
    throw new Error('Error fetching statistics: ' + error.message)
  }
}

// ==================== EMAIL SERVICES ====================

export const sendReminderEmail = async (reminderId: number, userId: number): Promise<boolean> => {
  try {
    console.log(`🔍 Attempting to send email for reminder ${reminderId}`)

    // Test connection first
    const connectionOK = await testEmailConnection()
    if (!connectionOK) {
      throw new Error('Email server connection failed')
    }

    const reminder = await getReminderById(reminderId, userId)

    if (!reminder) {
      throw new Error('Reminder not found')
    }

    if (reminder.status === 'sent') {
      throw new Error('Reminder already sent')
    }

    if (!reminder.user) {
      throw new Error('User information not loaded')
    }

    console.log(`📧 Sending email to: ${reminder.user.email}`)
    console.log(`📝 Subject: Recordatorio AURA: ${reminder.title}`)

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #A44076;">🔔 ¡Recordatorio de AURA!</h2>
        <p>Hola ${reminder.user.name},</p>
        <h3>${reminder.title}</h3>
        ${reminder.description ? `<p>${reminder.description}</p>` : ''}
        <p><strong>Fecha:</strong> ${new Date(reminder.date_time).toLocaleDateString('es-ES')}</p>
        <p><strong>Hora:</strong> ${new Date(reminder.date_time).toLocaleTimeString('es-ES')}</p>
        <p>Saludos,<br>Equipo AURA</p>
      </div>
    `

    const mailOptions = {
      from: `"AURA Recordatorios" <noreply@${process.env.DOMAIN}>`,
      to: reminder.user.email,
      subject: `🔔 Recordatorio AURA: ${reminder.title}`,
      html: emailContent,
    }

    console.log('📤 Mail options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    })

    const result = await emailTransporter.sendMail(mailOptions)

    console.log('✅ Email sent successfully:', result.messageId)

    // Marcar como enviado
    await markReminderAsSent(reminderId, userId)

    return true
  } catch (error: any) {
    console.error('❌ Error sending reminder email:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
    })
    throw new Error('Error sending reminder email: ' + error.message)
  }
}

export const sendUpcomingRemindersNotification = async (
  userId: number,
  hoursAhead: number = 2,
): Promise<void> => {
  try {
    const upcomingReminders = await getUpcomingReminders(userId, hoursAhead)

    if (upcomingReminders.length === 0) return

    const firstReminder = upcomingReminders[0]

    // Verificar que el usuario esté cargado
    if (!firstReminder.user) {
      throw new Error('User information not loaded')
    }

    const user = firstReminder.user
    const remindersList = upcomingReminders
      .map(
        (r) =>
          `• ${r.title} - ${new Date(r.date_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
      )
      .join('\n')

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #E6E2D2; padding: 20px;">
        <div style="background-color: white; padding: 30px; border-radius: 15px;">
          <h2 style="color: #CB8D27; text-align: center;">⏰ Recordatorios próximos</h2>
          <p>Hola ${user.name},</p>
          <p>Tienes ${upcomingReminders.length} recordatorio(s) próximo(s):</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <pre style="font-family: Arial, sans-serif; white-space: pre-line; margin: 0;">${remindersList}</pre>
          </div>
          <p style="color: #666; font-size: 12px;">¡Prepárate para no olvidar nada! 📚</p>
        </div>
      </div>
    `

    await emailTransporter.sendMail({
      from: `"AURA Próximos" <noreply@${env.DOMAIN}>`,
      to: user.email,
      subject: `⏰ Tienes ${upcomingReminders.length} recordatorio(s) próximo(s)`,
      html: emailContent,
    })
  } catch (error: any) {
    console.error('Error sending upcoming reminders:', error)
  }
}

export const checkAndSendPendingReminders = async (): Promise<void> => {
  try {
    const now = new Date()
    const pendingReminders = await getPendingReminders({
      date_to: now.toISOString(),
    })

    console.log(`Found ${pendingReminders.length} pending reminders to send`)

    for (const reminder of pendingReminders) {
      try {
        // Verificar que el usuario esté cargado antes de enviar
        if (!reminder.user) {
          console.error(`❌ User not loaded for reminder ${reminder.id}`)
          continue
        }

        await sendReminderEmail(reminder.id, reminder.user_id)
        console.log(`✅ Reminder email sent for: ${reminder.title} to ${reminder.user.email}`)
      } catch (error) {
        console.error(`❌ Failed to send reminder ${reminder.id}:`, error)
      }
    }
  } catch (error: any) {
    console.error('Error checking pending reminders:', error)
  }
}

// ==================== PAYMENT EMAIL FUNCTION ====================

export const sendPaymentConfirmationEmail = async (
  email: string,
  paymentData: any,
): Promise<boolean> => {
  try {
    console.log(`📧 Sending payment confirmation to: ${email}`)

    // Usar la misma función de test que ya funciona
    const connectionOK = await testEmailConnection()
    if (!connectionOK) {
      throw new Error('Email server connection failed')
    }

    const paymentDate = new Date(paymentData.date).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #EDE6DB; padding: 20px;">
        <div style="background-color: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header con gradiente -->
          <div style="background: linear-gradient(90deg, #B065C4 0%, #F4A45B 100%); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">¡Pago Confirmado!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Bienvenido a AURA Premium</p>
          </div>

          <!-- Información del pago -->
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #4CAF50;">
            <h3 style="color: #333; margin-top: 0;">💳 Detalles del Pago</h3>
            
            <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Monto:</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 18px; font-weight: bold; color: #4CAF50;">$${paymentData.amount} ${paymentData.currency}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">ID de Pago:</td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">${paymentData.paymentId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Fecha:</td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">${paymentDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Email:</td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">${email}</td>
                </tr>
                ${
                  paymentData.phone
                    ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Teléfono:</td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">${paymentData.phone}</td>
                </tr>`
                    : ''
                }
                ${
                  paymentData.country
                    ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">País:</td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">${paymentData.country}</td>
                </tr>`
                    : ''
                }
              </table>
            </div>
          </div>

          <!-- Beneficios Premium -->
          <div style="background-color: #E8F5E8; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #4CAF50;">
            <h3 style="color: #2E7D32; margin-top: 0;">Beneficios de AURA Premium</h3>
            <ul style="color: #333; margin: 0; padding-left: 20px;">
              <li style="margin: 8px 0;">Herramientas avanzadas de estudio</li>
              <li style="margin: 8px 0;">Más espacio para guardar tus notas</li>
              <li style="margin: 8px 0;">Más request a la IA</li>
            </ul>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <div style="background: linear-gradient(90deg, #B065C4 0%, #F4A45B 100%); color: white; padding: 15px; border-radius: 8px; display: inline-block; margin-bottom: 15px;">
              <p style="margin: 0; font-weight: bold; font-size: 16px;">✨ AURA - Tu asistente académico ✨</p>
            </div>
            <p style="color: #666; font-size: 12px; margin: 0;">
              Si tienes alguna pregunta, no dudes en contactarnos.<br>
              Este correo fue enviado automáticamente, por favor no respondas.
            </p>
          </div>
        </div>
      </div>
    `

    // Usar el MISMO emailTransporter que ya funciona
    const mailOptions = {
      from: `"AURA Pagos" <noreply@${process.env.DOMAIN}>`,
      to: email,
      subject: '🎉 ¡Pago confirmado! Bienvenido a AURA Premium',
      html: emailContent,
    }

    console.log('📤 Sending payment email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    })

    const result = await emailTransporter.sendMail(mailOptions)

    console.log('✅ Payment confirmation email sent successfully:', result.messageId)

    return true
  } catch (error: any) {
    console.error('❌ Error sending payment confirmation email:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
    })
    throw new Error('Error sending payment confirmation email: ' + error.message)
  }
}
