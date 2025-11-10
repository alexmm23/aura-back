import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
import { Op } from 'sequelize'
import { NotificationToken } from '@/models/notificationToken.model'
import { AssignmentSnapshot } from '@/models/assignmentSnapshot.model'
import { User } from '@/models/user.model'
import { ReminderWithUser } from '@/types/reminder.types'
import {
  AssignmentNotificationPayload,
  NotificationPayload,
  RegisterPushTokenRequest,
} from '@/types/notifications.types'
import { UnifiedAssignment } from '@/types/moodle.types'

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN })

const formatDateTime = (value: Date | string | null | undefined): string | undefined => {
  if (!value) return undefined
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return undefined
  return date.toLocaleString('es-MX', {
    hour12: false,
  })
}

export const registerPushToken = async (userId: number, payload: RegisterPushTokenRequest) => {
  if (!payload.token) {
    throw new Error('Push token is required')
  }

  if (!Expo.isExpoPushToken(payload.token)) {
    throw new Error('Invalid Expo push token')
  }

  const normalizedToken = payload.token.trim()

  const existingToken = await NotificationToken.findOne({
    where: {
      expo_push_token: normalizedToken,
    },
  })

  if (existingToken) {
    await existingToken.update({
      user_id: userId,
      device_type: payload.deviceType,
      device_name: payload.deviceName,
      os_name: payload.osName,
      os_version: payload.osVersion,
      app_version: payload.appVersion,
      metadata: payload.metadata,
      is_active: true,
      last_used_at: new Date(),
      updated_at: new Date(),
    })
    return existingToken
  }

  const token = await NotificationToken.create({
    user_id: userId,
    expo_push_token: normalizedToken,
    device_type: payload.deviceType,
    device_name: payload.deviceName,
    os_name: payload.osName,
    os_version: payload.osVersion,
    app_version: payload.appVersion,
    metadata: payload.metadata,
    is_active: true,
    last_used_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  })

  return token
}

export const unregisterPushToken = async (token: string, userId?: number) => {
  if (!token) return false

  const whereClause: Record<string, unknown> = {
    expo_push_token: token,
  }

  if (userId) {
    whereClause.user_id = userId
  }

  const existingToken = await NotificationToken.findOne({ where: whereClause })

  if (!existingToken) return false

  await existingToken.update({
    is_active: false,
    updated_at: new Date(),
  })

  return true
}

const fetchActiveTokens = async (userId: number) => {
  const tokens = await NotificationToken.findAll({
    where: {
      user_id: userId,
      is_active: true,
      expo_push_token: {
        [Op.ne]: null,
      },
    },
  })

  return tokens
}

const sendExpoMessages = async (messages: ExpoPushMessage[]) => {
  if (messages.length === 0) return [] as ExpoPushTicket[]

  const chunks = expo.chunkPushNotifications(messages)
  const tickets: ExpoPushTicket[] = []

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk)
      tickets.push(...ticketChunk)
    } catch (error) {
      console.error('Expo push error:', error)
    }
  }

  return tickets
}

const handleExpoReceipts = async (tokens: string[], tickets: ExpoPushTicket[]) => {
  if (tokens.length === 0 || tickets.length === 0) return

  tokens.forEach((token, index) => {
    const ticket = tickets[index]
    if (!ticket || !ticket.details || ticket.status === 'ok') {
      return
    }

    const errorCode = ticket.details?.error
    if (errorCode === 'DeviceNotRegistered' || errorCode === 'InvalidCredentials') {
      NotificationToken.update(
        {
          is_active: false,
          updated_at: new Date(),
        },
        {
          where: { expo_push_token: token },
        },
  ).catch((err: unknown) => console.error('Failed to deactivate invalid token:', err))
    }
  })
}

export const sendNotificationToUser = async (
  payload: NotificationPayload,
): Promise<{ delivered: number; attempted: number }> => {
  const tokens = await fetchActiveTokens(payload.userId)

  if (tokens.length === 0) {
    return { delivered: 0, attempted: 0 }
  }

  const messages: ExpoPushMessage[] = []
  const tokenList: string[] = []

  for (const token of tokens) {
    if (!Expo.isExpoPushToken(token.expo_push_token)) {
      await token.update({ is_active: false, updated_at: new Date() })
      continue
    }

    tokenList.push(token.expo_push_token)
    messages.push({
      to: token.expo_push_token,
      title: payload.title,
      body: payload.body,
      subtitle: payload.subtitle,
      sound: payload.sound ?? 'default',
      priority: payload.priority === 'high' ? 'high' : 'default',
      channelId: payload.channel,
      data: {
        ...payload.data,
      },
    })

    await token.update({ last_used_at: new Date(), updated_at: new Date() })
  }

  const tickets = await sendExpoMessages(messages)
  await handleExpoReceipts(tokenList, tickets)

  return { delivered: tickets.filter((ticket) => ticket.status === 'ok').length, attempted: tokenList.length }
}

export const sendReminderCreatedNotification = async (reminder: ReminderWithUser) => {
  if (!reminder || !reminder.user) return

  await sendNotificationToUser({
    userId: reminder.user_id,
    title: 'Recordatorio configurado ✅',
    body: reminder.title,
    data: {
      type: 'reminder_created',
      reminderId: reminder.id,
      dateTime: reminder.date_time,
    },
  })
}

export const sendReminderDueNotification = async (reminder: ReminderWithUser) => {
  if (!reminder || !reminder.user) return

  await sendNotificationToUser({
    userId: reminder.user_id,
    title: '⏰ Recordatorio',
    body: reminder.title,
    data: {
      type: 'reminder_due',
      reminderId: reminder.id,
      dateTime: reminder.date_time,
    },
    priority: 'high',
  })
}

export const sendUpcomingRemindersPush = async (
  userId: number,
  reminders: ReminderWithUser[],
  hoursAhead: number,
) => {
  if (!reminders || reminders.length === 0) return

  const bodyLines = reminders
    .slice(0, 3)
    .map((reminder) => `• ${reminder.title} (${formatDateTime(reminder.date_time)})`)
    .join('\n')

  await sendNotificationToUser({
    userId,
    title: `Tienes ${reminders.length} recordatorio(s) en las próximas ${hoursAhead}h`,
    body: bodyLines,
    data: {
      type: 'reminder_upcoming',
      reminderIds: reminders.map((r) => r.id),
      hoursAhead,
    },
  })
}

export const sendAssignmentPublishedNotification = async (
  payload: AssignmentNotificationPayload,
) => {
  await sendNotificationToUser({
    userId: payload.userId,
    title: `Nueva tarea en ${payload.courseName ?? 'tu curso'}`,
    body: payload.title,
    data: {
      type: 'assignment_new',
      platform: payload.platform,
      assignmentId: payload.assignmentId,
      dueDate: payload.dueDate?.toISOString?.(),
    },
    priority: 'high',
  })
}

export const syncAssignmentSnapshots = async (
  userId: number,
  assignments: UnifiedAssignment[],
): Promise<{ created: number; updated: number }> => {
  if (!userId || !assignments || assignments.length === 0) {
    return { created: 0, updated: 0 }
  }

  const now = new Date()
  const existingRecords = await AssignmentSnapshot.findAll({
    where: {
      user_id: userId,
    },
  })

  const snapshotMap = new Map<string, any>()
  for (const record of existingRecords) {
    const key = `${record.platform}:${record.external_assignment_id}`
    snapshotMap.set(key, record)
  }

  let created = 0
  let updated = 0

  for (const assignment of assignments) {
    const platform = assignment.source
    const externalId = assignment.id

    if (!platform || !externalId) continue

    const key = `${platform}:${externalId}`
    const rawDueDate = assignment.dueDate ? new Date(assignment.dueDate) : null
    const dueDate = rawDueDate && !Number.isNaN(rawDueDate.getTime()) ? rawDueDate : null
    const isCompleted = assignment.status === 'submitted' || assignment.status === 'graded'

    const metadata: Record<string, unknown> = {
      status: assignment.status,
    }

    if (assignment.dueTime) metadata.dueTime = assignment.dueTime
    const link = assignment.link ?? assignment.alternateLink
    if (link) metadata.link = link
    if (assignment.grade !== undefined && assignment.grade !== null) metadata.grade = assignment.grade
    if (assignment.materials && assignment.materials.length > 0) metadata.materials = assignment.materials
    if (assignment.allowSubmissionsFromDate !== undefined && assignment.allowSubmissionsFromDate !== null) {
      metadata.allowSubmissionsFromDate = assignment.allowSubmissionsFromDate
    }
    if (assignment.cutoffDate !== undefined && assignment.cutoffDate !== null) {
      metadata.cutoffDate = assignment.cutoffDate
    }

    const existing = snapshotMap.get(key)

    if (!existing) {
      const snapshot = await AssignmentSnapshot.create({
        user_id: userId,
        platform,
        external_assignment_id: externalId,
        course_id: assignment.courseId,
        course_name: assignment.courseName,
        title: assignment.title,
        due_date: dueDate,
        first_seen_at: now,
        last_seen_at: now,
        last_notification_at: now,
        metadata,
        is_completed: isCompleted,
      })

      try {
        await sendAssignmentPublishedNotification({
          userId,
          platform,
          assignmentId: externalId,
          title: assignment.title,
          courseName: assignment.courseName,
          dueDate: dueDate ?? undefined,
        })
      } catch (error) {
        console.error('Failed to send assignment notification:', error)
      }

      snapshotMap.set(key, snapshot)
      created += 1
    } else {
      const existingMetadata =
        (typeof existing.get === 'function'
          ? (existing.get('metadata') as Record<string, unknown> | null)
          : (existing.metadata as Record<string, unknown> | null)) ?? {}

      await existing.update({
        course_id: assignment.courseId,
        course_name: assignment.courseName,
        title: assignment.title,
        due_date: dueDate,
        last_seen_at: now,
        metadata: { ...existingMetadata, ...metadata },
        is_completed: isCompleted,
      })

      snapshotMap.set(key, existing)
      updated += 1
    }
  }

  return { created, updated }
}

export const deactivateTokensForUser = async (userId: number) => {
  await NotificationToken.update(
    { is_active: false, updated_at: new Date() },
    {
      where: {
        user_id: userId,
      },
    },
  )
}

export const getUserNotificationTokens = async (userId: number) => {
  const tokens = await NotificationToken.findAll({
    where: {
      user_id: userId,
    },
    order: [['updated_at', 'DESC']],
  })

  return tokens
}

export const markAssignmentNotified = async (
  userId: number,
  platform: string,
  assignmentId: string,
) => {
  await AssignmentSnapshot.update(
    {
      last_notification_at: new Date(),
    },
    {
      where: {
        user_id: userId,
        platform,
        external_assignment_id: assignmentId,
      },
    },
  )
}

export const getUsersWithNotificationsEnabled = async () => {
  const tokenRecords = (await NotificationToken.findAll({
    attributes: ['user_id'],
    where: {
      is_active: true,
    },
    group: ['user_id'],
  })) as Array<{ user_id: number }>

  const userIds = tokenRecords.map((record) => record.user_id)

  if (userIds.length === 0) return []

  const users = await User.findAll({
    where: {
      deleted: false,
      id: {
        [Op.in]: userIds,
      },
    },
    attributes: ['id', 'name', 'email'],
  })

  return users
}
